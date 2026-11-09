# Marco Samson portfolio — PHP + PostgreSQL

The frontend and backend are separate. No Node.js, npm, framework, or Composer dependencies are required.

```text
public/
  index.html       Homepage, project pages, and editor document
  styles.css       Responsive dark theme
  app.js           Browser UI and API requests
  index.php        PHP HTTP entry point
  .htaccess        Apache routing
backend/
  Api.php          Login, content editing, uploads, and logout
  Storage.php      PDO PostgreSQL persistence and Base64 encoding
  Validation.php   Content, link, and image validation
  default-content.json
  init.php         Database schema and first admin password initialization
db/001_storage.sql Database schema (compatible with previous Node version)
docker/            Apache/PHP configuration and container startup
tests/             PHP API checks and optional PostgreSQL integration test
Dockerfile         Production PHP + Apache image
render.yaml        Free Render Docker service
router.php         Local PHP development routing
```

The existing design, three project pages, profile editor, image captions, replacement, removal, and reordering are unchanged. The browser calls `/api/...`; PHP handles authentication, validation, and database writes. Only `public/` is exposed by the web server. Backend source, configuration, and database credentials are not publicly served.

## Deploy to Render for free

1. Create a PostgreSQL database with a free provider such as Neon (https://neon.com), or use an existing PostgreSQL database. Keep within the provider's free quotas. Render's own free PostgreSQL databases expire after 30 days, so this Blueprint does not provision one.
2. Copy its PostgreSQL URI, including the provider's TLS settings. Prefer `sslmode=verify-full` with a trusted CA when supported. URL-encode special characters in passwords. Do not share or commit this URI.
3. Push this repository to GitHub. In Render choose New → Blueprint and connect the repository.
4. Set `DATABASE_URL` to the URI and `ADMIN_PASSWORD` to a unique password of 12–72 characters.
5. Deploy the Free Docker service. Render builds the PHP/Apache image, runs PHP syntax/API checks, then initializes the schema and first admin password before starting Apache.
6. Open the site and visit `/my-admin` to log in and edit your portfolio.

Use the **Docker** runtime if creating a service manually. Dockerfile path is `./Dockerfile`; repository root is the build context. Leave custom build/start commands blank. Health check is `/healthz`. No disk, Node build, or npm command is needed. Render supplies `PORT` and `RENDER_EXTERNAL_URL`. For a custom domain, set `PUBLIC_URL` to the exact HTTPS origin and use that domain for the editor.

If replacing an existing Node Render service, create a new Docker service from the updated Blueprint/repository and reuse the same PostgreSQL `DATABASE_URL`. Do not delete the database. If Render lets you recreate/reconfigure the existing service as Docker, use the same settings. A local source change does not automatically update an existing deployment.

## PostgreSQL and images

The app uses PDO PostgreSQL with parameterized queries. Data is stored in `portfolio_private.portfolio_objects`; image bytes are Base64 TEXT strings, metadata is JSONB. `/media/images/...` decodes those strings and serves actual PNG/JPEG/WebP images. Project content, captions, gallery order, profile pictures, password hashes, and sessions survive web-service restarts.

Base64 increases image sizes by approximately one-third. Compress screenshots and stay within your free database quota. Files are limited to 10 MB each. Removed/replaced images remain in storage to protect published content during unsaved edits; periodically remove unreferenced `images/` records after backing up. Expired `sessions/` and old `limits/` records can be cleaned up too.

The startup initializer creates the schema/table if absent and never drops content. The database role needs schema/table creation permissions for initial setup. Keep `portfolio_private` out of public Data API schemas if your database provider exposes SQL tables through an API.

Existing content/images in the earlier PostgreSQL table work without migration. Earlier Node PBKDF2 password records are accepted and upgraded to PHP password hashing on successful login. Local `.data/`, Sites, and Supabase Storage objects are separate and are not automatically imported.

## Local development

Install PHP 8.3+ with `pdo_pgsql` enabled and PostgreSQL access. The Docker deployment uses PHP 8.5. In PowerShell, from this project folder:

```powershell
$env:DATABASE_URL = 'postgresql://user:password@localhost:5432/portfolio?sslmode=disable'
$env:ADMIN_PASSWORD = 'choose-your-own-long-password'
php backend/init.php
php -S localhost:3000 -t public router.php
```

Open http://localhost:3000. The PHP built-in server is for local development only; production uses Apache. For hosted databases, use the provider's TLS-enabled URI. PHP does not automatically load `.env`; configure variables in your shell or Render dashboard. `.env.example` lists the required keys.

You can also build/run the container with Docker, passing `DATABASE_URL`, `ADMIN_PASSWORD`, and `PUBLIC_URL` as runtime variables. PostgreSQL must be reachable from inside the container; `localhost` inside Docker refers to the container itself.

## Verification

```powershell
php tests/run.php
```

The API checks use an in-memory test storage implementation to verify login, cookie flags, origin checks, logout, rate limiting, uploads, captions/profile saving, validation, and legacy password compatibility. They do not require a database or alter production data.

For real PDO/PostgreSQL integration, set `TEST_DATABASE_URL` to a disposable test database and run:

```powershell
php tests/postgres.php
```

This initializes the test schema and verifies reconnects, Base64 image bytes/MIME metadata, upsert, and deletion. Do not point the test at production.

## Backups and password reset

Back up the private schema with your database provider's tools or `pg_dump`. `ADMIN_PASSWORD` only initializes a database without an auth record; editing the variable does not overwrite an existing password.

To reset: stop the service, update `ADMIN_PASSWORD`, back up the database, execute the following in your private database console, and restart:

```sql
DELETE FROM portfolio_private.portfolio_objects
WHERE object_key = 'auth' OR object_key LIKE 'sessions/%';
```

This invalidates sessions without deleting project content or images.

Free Render hosting sleeps after inactivity; PostgreSQL free providers have their own storage, compute, and inactivity limits. Current terms: https://render.com/docs/free, https://neon.com/pricing, https://supabase.com/pricing.
