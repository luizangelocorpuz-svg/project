
using Npgsql;

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

var app = builder.Build();

// Existing frontend configuration
app.UseDefaultFiles();
app.UseStaticFiles();

// Existing Supabase configuration endpoint
app.MapGet("/api/config", (IConfiguration configuration) =>
    Results.Ok(new
    {
        supabaseUrl = configuration["Supabase:Url"],
        supabasePublishableKey = configuration["Supabase:PublishableKey"]
    }));

// Get all sports equipment
app.MapGet("/api/equipment", async (NpgsqlDataSource dataSource) =>
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

app.MapPost("/api/equipment", async (
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

app.MapPut("/api/equipment/{id:int}", async (
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

app.MapDelete("/api/equipment/{id:int}", async (
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
