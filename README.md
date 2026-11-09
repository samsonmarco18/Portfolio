# Marco Samson portfolio — free deployment

Source is in `portfolio/`. The root `render.yaml` uses free Render hosting and Supabase Free storage. No paid disk is needed.

## One-time setup

1. Create a free project at https://supabase.com.
2. In Storage, create a bucket named `portfolio-private`. Keep Public bucket OFF. Password hashes and sessions also live here, so never make it public. Allow `application/json` or leave MIME restrictions unset. Allow objects up to 15 MB; images are stored inside JSON as Base64 strings.
3. Copy your Project URL and legacy `service_role` API key from Supabase project settings. Use the server-only service role key, not the anon/publishable key. Never put it in source, browser code, or chat.
4. Push this folder to GitHub, including `render.yaml` and `portfolio/`.
5. In Render, choose New → Blueprint and connect the repository. Supply `ADMIN_PASSWORD` (at least 12 characters), `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` when prompted.
6. Confirm the Free plan and deploy. Open your URL and visit `/my-admin` to sign in.

The Blueprint sets `STORAGE_BACKEND=supabase`, `SUPABASE_BUCKET=portfolio-private`, Node version, build/start commands, and health check. No SQL migration or public bucket policy is needed. Only the server uses the privileged key. The admin editor works as before.

## Image storage

Images are saved as Base64 strings inside separate private JSON objects in Supabase. The server decodes them and serves normal image responses through `/media/images/...`. Captions and gallery order live in the content object. Images, content, password hashes, and sessions survive Render restarts because they are stored outside Render's temporary filesystem.

Base64 adds roughly one-third to image sizes. Compress screenshots and stay within free storage/bandwidth limits. Removed or replaced images are retained to protect published content while editing; clean up unreferenced `images/` objects manually after backing up. Expired `sessions/` and old `limits/` objects can also be periodically removed from the private bucket.

## Free service limits

Render Free sleeps after inactivity, so the first visit may load slowly. Supabase Free has quotas and may pause inactive projects; resume a paused project in Supabase. Check current terms at https://render.com/docs/free and https://supabase.com/pricing. Do not enable paid upgrades if you want to remain free.

Previous Sites and local content use separate storage and are not automatically migrated.

## Manual Render setup

Choose a Free Web Service. Root Directory: `portfolio`. Build Command: `npm ci && npm test && npm run build`. Start Command: `npm start`. Health Check: `/healthz`.

Set `STORAGE_BACKEND=supabase`, `SUPABASE_BUCKET=portfolio-private`, `NODE_VERSION=24.13.1`, and the three secrets above. No disk is needed. The app refuses temporary local storage on Render.

For a custom domain, set `PUBLIC_URL` to the exact HTTPS origin and use that domain for the admin editor. Otherwise Render supplies `RENDER_EXTERNAL_URL`.

## Password reset and backups

`ADMIN_PASSWORD` initializes an empty bucket once. Changing it later does not overwrite the stored password. To reset: stop the service, change the secret, back up the bucket, remove only `auth` and all `sessions/` objects in the private bucket, and restart. Do not delete `content`, `images/`, or the bucket. Keep regular storage backups.

## Local development

From `portfolio`, run `npm ci`, `npm test`, or `npm run dev`. Development uses ignored `.data/` files. For a production-mode local test, set `ADMIN_PASSWORD` and run `npm start`. Set the Supabase variables as well to test remote storage. Variables are configured through your shell or Render; there is no automatic .env loader.
