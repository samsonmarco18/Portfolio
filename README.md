# Marco Samson portfolio — PostgreSQL deployment

The portfolio runs on free Render hosting and stores all editable content in PostgreSQL. Uploaded images are saved as Base64 TEXT strings and decoded into normal image responses. No storage bucket or paid Render disk is needed.

## Deploy for free

1. Create a free PostgreSQL database with Neon (https://neon.com) or another PostgreSQL provider. Supabase PostgreSQL also works; use its database connection string, not its Storage API keys. Free plans have storage/compute limits.
2. Copy the provider's PostgreSQL connection URI. Keep its TLS options; prefer `sslmode=verify-full` where supported. URL-encode special characters in passwords. Keep the URI secret.
3. Push this folder to GitHub, including root `render.yaml` and the `portfolio` directory.
4. On Render, choose New → Blueprint and connect the repository. Set `DATABASE_URL` to the connection URI and `ADMIN_PASSWORD` to a unique password of at least 12 characters.
5. Deploy on the Free plan. Visit `/my-admin` on your Render URL to sign in and update content.

At startup the app creates the `portfolio_private` schema and its `portfolio_objects` table if missing. The database role needs schema/table creation permissions on the first run. Subsequent starts preserve existing records. The app uses parameterized SQL queries and a small connection pool. Database failures fail startup rather than falling back to temporary files.

The schema is deliberately outside `public`. If using Supabase, do not expose `portfolio_private` through the Data API or grant anonymous access to it. Password hashes and session records share this private table with portfolio content.

## Render configuration

The Blueprint sets the following automatically:

- Plan: Free, no disk
- Root Directory: `portfolio`
- Build: `npm ci --include=dev && npm test && npm run build`
- Start: `npm start`
- Health check: `/healthz`
- `STORAGE_BACKEND=postgres`
- `NODE_VERSION=24.13.1`

Supply `DATABASE_URL` and `ADMIN_PASSWORD` as secret environment variables. Render supplies `PORT` and `RENDER_EXTERNAL_URL`. For a custom domain, set `PUBLIC_URL` to its exact HTTPS origin and use that domain for the editor. Never put credentials in source or browser code.

For Supabase, the Session pooler connection string can be used when the direct database hostname requires IPv6. No Supabase storage bucket, service role API key, or SQL Data API is used. For providers requiring a private CA, install their root certificate and configure the connection URI's `sslrootcert`; do not disable certificate validation.

## Free plan limits

Render Free sleeps after inactivity, so initial page loading can be slow. Render's own free PostgreSQL databases expire after 30 days; this Blueprint therefore asks for an external PostgreSQL connection instead of provisioning that temporary database. Neon/Supabase free plans have quotas and may suspend idle compute/projects. Check current terms before deploying:

- https://render.com/docs/free
- https://neon.com/pricing
- https://supabase.com/pricing

Base64 uses about one-third more space than binary image files. Compress screenshots and keep them modest in size. Removed/replaced images remain stored to avoid breaking published pages during unsaved edits; periodically remove unreferenced `images/` records after backing up. Expired `sessions/` and old `limits/` records can also be cleaned up. Earlier local, Sites, and Supabase Storage data are separate and are not migrated automatically; re-upload content through the editor.

## Backups and password reset

Use your PostgreSQL provider's export tools or `pg_dump` to back up `portfolio_private` regularly. `ADMIN_PASSWORD` only initializes an empty database. Updating the environment variable does not change an existing password.

To reset: stop the service, change `ADMIN_PASSWORD`, back up the database, run the following SQL in your private database console, then restart:

```sql
DELETE FROM portfolio_private.portfolio_objects
WHERE object_key = 'auth' OR object_key LIKE 'sessions/%';
```

This resets authentication and invalidates sessions without deleting project content or images.

## Local development and verification

From `portfolio`, run `npm ci`, `npm test`, or `npm run dev`. Development mode uses ignored local `.data/` files. To use PostgreSQL locally, set `DATABASE_URL` and `ADMIN_PASSWORD`, then run `npm start`. There is no automatic .env loader; use shell or hosting environment variables.

Tests exercise the schema, SQL inserts/upserts/deletes, image Base64 round trips, and schema reinitialization using PGlite (a local PostgreSQL WASM engine), plus server authentication, uploads, persistence, and origin checks. A live hosted connection still requires your own `DATABASE_URL`.
