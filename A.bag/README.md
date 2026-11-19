# A.Bag

## Configure the database and accounts

Run `database-setup.sql` in the Supabase SQL Editor to create the equipment
table and the user-profile table. The registration and login forms send
same-origin requests to the ASP.NET Core app, which forwards authentication
requests to Supabase Auth. New email accounts automatically get a profile in
`public.users`. Passwords are stored and verified by Supabase Auth, not in the
profile table.

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
`ConnectionStrings__DefaultConnection` as environment variables. Replace the
sample `YOUR_PROJECT` and `YOUR_PUBLISHABLE_KEY` values before using account
forms. Keep the PostgreSQL password on the server and never put a Supabase
`service_role` or secret key in the browser.

Run the app with `dotnet run` from this project directory and open its
ASP.NET Core URL. The equipment inventory reads and writes the
`public.sports_equipment` table. Account registration and sign-in use Supabase
Email Auth; enable it and configure the site's URL and redirect URLs in the
Supabase dashboard. If email confirmation is enabled, users must confirm their
email before signing in. New profiles default to the `member` role. To grant
dashboard access, promote an administrator explicitly in the SQL Editor:

```sql
UPDATE public.users
SET role = 'admin'
WHERE email = 'admin@example.com';
```

Only administrator profiles can use the equipment API.
