# A.Bag

## Configure the database and accounts

Run `database-setup.sql` in the Supabase SQL Editor to create the equipment
table and the user-profile table. New email accounts created by the app are
authenticated by Supabase Auth and automatically get a profile in `public.users`.
Passwords are stored and verified by Supabase Auth, not in the profile table.

Set the project URL, public publishable key (or legacy `anon` key), and
PostgreSQL connection string for the server:

```json
"Supabase": {
  "Url": "https://your-project.supabase.co",
  "PublishableKey": "your-public-publishable-or-anon-key"
},
"ConnectionStrings": {
  "DefaultConnection": "Host=...;Port=5432;Database=postgres;Username=...;Password=...;SSL Mode=Require"
}
```

Alternatively, set `Supabase__Url`, `Supabase__PublishableKey`, and
`ConnectionStrings__DefaultConnection` as environment variables. Keep the
PostgreSQL password on the server and never put a Supabase `service_role` or
secret key in the browser.

Run the app with `dotnet run` from this project directory and open its
ASP.NET Core URL. The equipment inventory reads and writes the
`public.sports_equipment` table. Account registration and sign-in use Supabase
Email Auth; enable it and configure the site's URL and redirect URLs in the
Supabase dashboard. If email confirmation is enabled, users must confirm their
email before signing in.
