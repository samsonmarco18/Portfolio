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

The portfolio includes a visual project editor. The browser calls `/api/...`; PHP handles authentication, validation, and PostgreSQL writes. Only `public/` is exposed by the web server. Backend source, configuration, and database credentials are not publicly served.

## Use the visual editor

1. Sign in at `/my-admin` and choose a project card.
2. Click **Add pictures** to select multiple PNG, JPG, or WebP files, or drop files onto the canvas. You can add up to 60 pictures per project, up to 10 MB each. Uploads append to your existing gallery.
3. Drag pictures/text around the canvas. Drag a selected element's corner handles to resize it. Arrow keys nudge a selected block; Shift + arrow moves it by 10 pixels. Numeric Left/Top/Width/Height fields provide precise control.
4. Select **Heading** or **Text** to add a text box. Edit its wording, font size, color, weight, and alignment in the inspector. Double-clicking a text box focuses its text field.
5. Select a picture to edit its caption, replace it, choose fit/crop, or make it the homepage cover. Remove detaches it from the gallery; Undo restores it before saving.
6. Use the layer buttons for overlapping elements, Undo/Redo for recent canvas edits, and **Arrange images in a grid** for a quick tidy layout. Adjust canvas height/color in the inspector. The Preview button shows your unsaved layout.
7. Expand **Project details** for title, description, technologies, and links, or **Homepage & profile** for your introduction and photo. Click **Save changes** to publish everything.

On desktop, project pages use the positions and dimensions you saved. On phones, content stacks in reading order so pictures and text remain legible. Layouts are saved with project content in PostgreSQL; no database migration is required. Earlier galleries remain compatible and receive a starting layout when opened in the editor. New editor code is in `public/editor.js` and `public/admin.js`.

## Deploy to Render for free

1. Push this repository, including the updated `render.yaml`, to GitHub.
2. In Render choose New → Blueprint and connect the repository. For an existing Blueprint, select it and use Manual Sync after pushing the change. Deploying only the individual web service does not create the database.
3. Review the two resources: the Free Docker web service `marco-samson-portfolio` and Free PostgreSQL database `marco-samson-db`. Render permits only one active Free PostgreSQL database per workspace; if you already have one, reference that existing database instead of creating another.
4. Render generates `ADMIN_PASSWORD` if it is missing. Read it privately from the web service Environment page for your first login, or set your own unique password of 12–72 characters before the database's first initialization. Existing environment values are preserved. `DATABASE_URL` is automatically supplied from the database's internal connection string; do not enter it manually for Blueprint deployment.
5. Apply the Blueprint. Render provisions and connects both resources, builds the PHP/Apache image, runs PHP checks, and initializes the schema/admin before starting Apache.
6. Open the web service URL and visit `/my-admin` to edit the portfolio.

**Render Free PostgreSQL expires after 30 days.** Export your content before expiry. For longer-term free storage, use an external free PostgreSQL provider and replace the `DATABASE_URL.fromDatabase` block with `sync: false`, then remove the `databases` block and enter your external URI. Do not remove/delete a database containing your only copy of saved content.

If the web service already uses an external database, the updated Blueprint connects it to a new, initially empty database. Existing data is not copied automatically; back it up and import it if needed.

Use the **Docker** runtime if creating a service manually. Dockerfile path is `./Dockerfile`; repository root is the build context. Leave custom build/start commands blank. Health check is `/healthz`. No disk, Node build, or npm command is needed. Render supplies `PORT` and `RENDER_EXTERNAL_URL`. For a custom domain, set `PUBLIC_URL` to the exact HTTPS origin and use that domain for the editor.

If replacing an existing Node Render service, create a new Docker service from the updated Blueprint/repository and reuse the same PostgreSQL `DATABASE_URL`. Do not delete the database. If Render lets you recreate/reconfigure the existing service as Docker, use the same settings. A local source change does not automatically update an existing deployment.

## PostgreSQL and images

### If startup initialization fails

Push the latest source and use **Blueprint → Manual Sync**, then inspect the startup log. It now reports the failing stage (`connection`, `schema`, or `admin`) and a credential-safe explanation. Transient connection failures are retried up to three times; authentication and schema errors stop immediately.

- `ADMIN_PASSWORD is missing` or a length error: set a 12–72 byte password on the **web service → Environment** page and redeploy. Generating a missing variable does not replace an existing empty/invalid value.
- Missing/invalid `DATABASE_URL`: sync the Blueprint so its `fromDatabase` reference is applied. If deploying manually, use the database's **Internal Database URL**.
- Hostname/unreachable error: confirm PostgreSQL is Available and the web service and database are in the same Render region. Wait for database provisioning to finish before redeploying.
- Database username/password error: replace stale `DATABASE_URL` credentials using the linked database. Changing the admin password does not fix PostgreSQL credentials.
- Schema permissions error: use a database owner account for first initialization. Do not drop tables or recreate the database to troubleshoot.

Do not paste `DATABASE_URL` or passwords into logs/chat. If it still fails, share only the new diagnostic line beginning `Initialization failed [stage]`.

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
php tests/startup.php
```

The API checks use an in-memory test storage implementation to verify login, cookie flags, origin checks, logout, rate limiting, uploads, captions/profile saving, validation, and legacy password compatibility. They do not require a database or alter production data.

Optional JavaScript checks (Node is a test tool only): `node --test tests/layout.cjs` validates canvas placement, resizing bounds, escaping, and mobile reading order. `tests/editor-dom.cjs` additionally uses jsdom to exercise pointer dragging/resizing, undo/redo, multiple uploads, text editing, saving, and rendering the saved public project page. To run it, make jsdom available to Node or set `PORTFOLIO_JSDOM` to its installed module path, then run `node --test tests/editor-dom.cjs`.

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
