
using Npgsql;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Register PostgreSQL connection
var connectionString = builder.Configuration
    .GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new Exception("Supabase connection string not found. Check appsettings.json.");
}

builder.Services.AddSingleton(
    NpgsqlDataSource.Create(connectionString)
);
builder.Services.AddHttpClient();

var app = builder.Build();

// Existing frontend configuration
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/config", (IConfiguration configuration) =>
    Results.Ok(new
    {
        supabaseUrl = configuration["Supabase:Url"],
        supabasePublishableKey = configuration["Supabase:PublishableKey"]
    }));

app.MapPost("/api/auth/signup", async (
    AuthRequest request,
    IConfiguration configuration,
    IHttpClientFactory httpClientFactory) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) ||
        string.IsNullOrWhiteSpace(request.Password) ||
        request.Data is null ||
        !request.Data.TryGetValue("full_name", out var fullName) ||
        string.IsNullOrWhiteSpace(fullName) ||
        !request.Data.TryGetValue("username", out var username) ||
        string.IsNullOrWhiteSpace(username))
    {
        return Results.BadRequest(new { error = "Email, password, full name, and username are required." });
    }

    return await ForwardAuthRequest(
        configuration,
        httpClientFactory,
        "auth/v1/signup",
        new
        {
            email = request.Email.Trim(),
            request.Password,
            data = request.Data
        });
});

app.MapPost("/api/auth/login", async (
    AuthRequest request,
    IConfiguration configuration,
    IHttpClientFactory httpClientFactory) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) ||
        string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.BadRequest(new { error = "Email and password are required." });
    }

    return await ForwardAuthRequest(
        configuration,
        httpClientFactory,
        "auth/v1/token?grant_type=password",
        new { email = request.Email.Trim(), request.Password });
});

app.MapPost("/api/auth/refresh", async (
    RefreshRequest request,
    IConfiguration configuration,
    IHttpClientFactory httpClientFactory) =>
{
    if (string.IsNullOrWhiteSpace(request.RefreshToken))
    {
        return Results.BadRequest(new { error = "A refresh token is required." });
    }

    return await ForwardAuthRequest(
        configuration,
        httpClientFactory,
        "auth/v1/token?grant_type=refresh_token",
        new { refresh_token = request.RefreshToken });
});

app.MapPost("/api/auth/logout", async (
    LogoutRequest request,
    IConfiguration configuration,
    IHttpClientFactory httpClientFactory) =>
{
    if (string.IsNullOrWhiteSpace(request.AccessToken))
    {
        return Results.BadRequest(new { error = "An access token is required." });
    }

    return await ForwardAuthRequest(
        configuration,
        httpClientFactory,
        "auth/v1/logout",
        new { },
        request.AccessToken);
});

// Get all sports equipment
var equipmentApi = app.MapGroup("/api/equipment");

equipmentApi.AddEndpointFilter(async (context, next) =>
{
    var configuration = context.HttpContext.RequestServices
        .GetRequiredService<IConfiguration>();
    var supabaseUrl = configuration["Supabase:Url"];
    var publishableKey = configuration["Supabase:PublishableKey"];

    if (string.IsNullOrWhiteSpace(supabaseUrl) ||
        string.IsNullOrWhiteSpace(publishableKey))
    {
        return Results.Problem(
            "Supabase authentication is not configured.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    if (!AuthenticationHeaderValue.TryParse(
            context.HttpContext.Request.Headers.Authorization,
            out var authorization) ||
        !string.Equals(authorization.Scheme, "Bearer", StringComparison.OrdinalIgnoreCase) ||
        string.IsNullOrWhiteSpace(authorization.Parameter))
    {
        return Results.Unauthorized();
    }

    var httpClient = context.HttpContext.RequestServices
        .GetRequiredService<IHttpClientFactory>()
        .CreateClient();
    using var authRequest = new HttpRequestMessage(
        HttpMethod.Get,
        new Uri(new Uri($"{supabaseUrl.TrimEnd('/')}/"), "auth/v1/user"));
    authRequest.Headers.Authorization = authorization;
    authRequest.Headers.TryAddWithoutValidation("apikey", publishableKey);

    using var authResponse = await httpClient.SendAsync(authRequest);
    if (!authResponse.IsSuccessStatusCode)
    {
        return Results.Unauthorized();
    }

    var user = await authResponse.Content.ReadFromJsonAsync<SupabaseUser>();
    if (user is null)
    {
        return Results.Unauthorized();
    }

    var dataSource = context.HttpContext.RequestServices
        .GetRequiredService<NpgsqlDataSource>();
    await using var connection = await dataSource.OpenConnectionAsync();
    await using var roleCommand = new NpgsqlCommand(
        "SELECT EXISTS (SELECT 1 FROM public.users WHERE id = @id AND role = 'admin')",
        connection);
    roleCommand.Parameters.AddWithValue("id", user.Id);

    if (!Convert.ToBoolean(await roleCommand.ExecuteScalarAsync()))
    {
        return Results.Forbid();
    }

    return await next(context);
});

equipmentApi.MapGet("/", async (NpgsqlDataSource dataSource) =>
{
    var equipment = new List<object>();

    await using var connection =
        await dataSource.OpenConnectionAsync();

    await using var command = new NpgsqlCommand(
        @"SELECT id, name, category, quantity, condition, status
          FROM sports_equipment
          ORDER BY id",
        connection
    );

    await using var reader = await command.ExecuteReaderAsync();

    while (await reader.ReadAsync())
    {
        equipment.Add(new
        {
            id = reader.GetInt32(0),
            name = reader.GetString(1),
            category = reader.GetString(2),
            quantity = reader.GetInt32(3),
            condition = reader.GetString(4),
            status = reader.GetString(5)
        });
    }

    return Results.Ok(equipment);
});

equipmentApi.MapPost("/", async (
    EquipmentRequest request,
    NpgsqlDataSource dataSource) =>
{
    var validationError = ValidateEquipment(request);
    if (validationError is not null)
    {
        return Results.BadRequest(new { error = validationError });
    }

    await using var connection = await dataSource.OpenConnectionAsync();
    await using var command = new NpgsqlCommand(
        @"INSERT INTO sports_equipment (name, category, quantity, condition, status)
          VALUES (@name, @category, @quantity, @condition, @status)
          RETURNING id",
        connection);

    command.Parameters.AddWithValue("name", request.Name.Trim());
    command.Parameters.AddWithValue("category", request.Category.Trim());
    command.Parameters.AddWithValue("quantity", request.Quantity);
    command.Parameters.AddWithValue("condition", request.Condition);
    command.Parameters.AddWithValue("status", request.Status);

    var id = (int)(await command.ExecuteScalarAsync())!;
    return Results.Created($"/api/equipment/{id}", new
    {
        id,
        name = request.Name.Trim(),
        category = request.Category.Trim(),
        quantity = request.Quantity,
        condition = request.Condition,
        status = request.Status
    });
});

equipmentApi.MapPut("/{id:int}", async (
    int id,
    EquipmentRequest request,
    NpgsqlDataSource dataSource) =>
{
    var validationError = ValidateEquipment(request);
    if (validationError is not null)
    {
        return Results.BadRequest(new { error = validationError });
    }

    await using var connection = await dataSource.OpenConnectionAsync();
    await using var command = new NpgsqlCommand(
        @"UPDATE sports_equipment
          SET name = @name,
              category = @category,
              quantity = @quantity,
              condition = @condition,
              status = @status
          WHERE id = @id",
        connection);

    command.Parameters.AddWithValue("id", id);
    command.Parameters.AddWithValue("name", request.Name.Trim());
    command.Parameters.AddWithValue("category", request.Category.Trim());
    command.Parameters.AddWithValue("quantity", request.Quantity);
    command.Parameters.AddWithValue("condition", request.Condition);
    command.Parameters.AddWithValue("status", request.Status);

    if (await command.ExecuteNonQueryAsync() == 0)
    {
        return Results.NotFound();
    }

    return Results.Ok(new
    {
        id,
        name = request.Name.Trim(),
        category = request.Category.Trim(),
        quantity = request.Quantity,
        condition = request.Condition,
        status = request.Status
    });
});

equipmentApi.MapDelete("/{id:int}", async (
    int id,
    NpgsqlDataSource dataSource) =>
{
    await using var connection = await dataSource.OpenConnectionAsync();
    await using var command = new NpgsqlCommand(
        "DELETE FROM sports_equipment WHERE id = @id",
        connection);

    command.Parameters.AddWithValue("id", id);

    return await command.ExecuteNonQueryAsync() == 0
        ? Results.NotFound()
        : Results.NoContent();
});

app.Run();

static async Task<IResult> ForwardAuthRequest(
    IConfiguration configuration,
    IHttpClientFactory httpClientFactory,
    string authPath,
    object requestBody,
    string? accessToken = null)
{
    var supabaseUrl = configuration["Supabase:Url"];
    var publishableKey = configuration["Supabase:PublishableKey"];

    if (!Uri.TryCreate(supabaseUrl, UriKind.Absolute, out var projectUri) ||
        projectUri.Scheme != Uri.UriSchemeHttps ||
        projectUri.Host.Contains("YOUR_PROJECT", StringComparison.OrdinalIgnoreCase) ||
        string.IsNullOrWhiteSpace(publishableKey) ||
        publishableKey.Contains("YOUR_PUBLISHABLE_KEY", StringComparison.OrdinalIgnoreCase))
    {
        return Results.Problem(
            "Set a valid Supabase project URL and publishable key in appsettings.json or environment variables.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    using var authRequest = new HttpRequestMessage(
        HttpMethod.Post,
        new Uri(new Uri($"{projectUri.ToString().TrimEnd('/')}/"), authPath))
    {
        Content = JsonContent.Create(requestBody)
    };
    authRequest.Headers.TryAddWithoutValidation("apikey", publishableKey);
    if (!string.IsNullOrWhiteSpace(accessToken))
    {
        authRequest.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", accessToken);
    }

    try
    {
        using var authResponse = await httpClientFactory
            .CreateClient()
            .SendAsync(authRequest);
        var responseBody = await authResponse.Content.ReadAsStringAsync();

        return Results.Content(
            responseBody,
            authResponse.Content.Headers.ContentType?.MediaType ?? "application/json",
            statusCode: (int)authResponse.StatusCode);
    }
    catch (HttpRequestException)
    {
        return Results.Problem(
            "Could not connect to Supabase Auth. Check the project URL and the server's network connection.",
            statusCode: StatusCodes.Status502BadGateway);
    }
}

static string? ValidateEquipment(EquipmentRequest request)
{
    if (string.IsNullOrWhiteSpace(request.Name) ||
        string.IsNullOrWhiteSpace(request.Category))
    {
        return "Name and category are required.";
    }

    if (request.Quantity < 1)
    {
        return "Quantity must be at least 1.";
    }

    if (request.Condition is not ("Good" or "Fair" or "Needs repair") ||
        request.Status is not ("Available" or "Borrowed" or "Maintenance"))
    {
        return "Condition or availability is invalid.";
    }

    return null;
}

public sealed record EquipmentRequest(
    string Name,
    string Category,
    int Quantity,
    string Condition,
    string Status);

public sealed record SupabaseUser(
    [property: JsonPropertyName("id")] Guid Id);

public sealed record AuthRequest(
    string Email,
    string Password,
    Dictionary<string, string>? Data = null);

public sealed record RefreshRequest(string RefreshToken);

public sealed record LogoutRequest(string AccessToken);
