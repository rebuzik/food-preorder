# Food Preorder

Full-stack food preorder application built with Vinext, React, Cloudflare D1,
R2, and Drizzle.

## Requirements

- Node.js `>=22.13.0`
- PowerShell on Windows

## Windows quick start

Run this command from PowerShell:

```powershell
npm.cmd run dev:windows
```

The command:

- installs locked dependencies when they are missing or outdated;
- creates local administrator credentials in `.dev.vars` on the first run;
- creates the local D1 database and applies pending migrations;
- starts the site at `http://127.0.0.1:5173/`.

It is safe to run the same command again. Existing credentials, data, and
applied migrations are preserved.

## Administrator access

Open `http://127.0.0.1:5173/admin/login` and use the credentials stored in the
ignored `.dev.vars` file. Authentication uses the application's own signed,
HTTP-only 12-hour session cookie.

The required runtime variables are:

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-password
ADMIN_SESSION_SECRET=replace-with-at-least-32-random-bytes
```

Use `.dev.vars.example` as a template. Never commit real credentials.

## Project structure

- `app/` — pages and API routes
- `app/admin-auth.ts` — administrator authentication and session validation
- `db/` — D1/Drizzle access and schema
- `drizzle/` — database migrations
- `.openai/hosting.json` — Sites bindings
- `wrangler.local.jsonc` — local D1/R2 configuration
- `wrangler.runtime.jsonc` — persisted D1/R2 bindings for the Node production runtime
- `scripts/dev.ps1` — repeatable Windows setup and launch script

## Commands

- `npm.cmd run dev:windows` — prepare and run locally on Windows
- `npm run dev` — run the Vite/Vinext server in a Unix-compatible shell
- `npm run build` — build and validate the Sites artifact in Linux
- `npm start` — run the built application with the Vinext production server
- `npm test` — build and run the rendered HTML test in Linux
- `npm run db:generate` — generate Drizzle migrations after schema changes

## Server deployment with Traefik

The included `compose.yaml` connects the application to the external Traefik
network, keeps D1 and R2 data in a named Docker volume, applies pending database
migrations on every container start, and exposes port `3000` only inside Docker.
The HTTP process is the Vinext production server (`vinext start`), not
`wrangler dev`. Persisted local D1/R2 bindings are attached to the Node process
through Wrangler Platform Proxy and reuse the existing `/data/wrangler/v3`
state from the Docker volume.

1. Create the external network once if Traefik has not created it already:

   ```bash
   docker network create traefik-public
   ```

2. Copy the environment template and edit its values:

   ```bash
   cp .env.example .env
   nano .env
   ```

   `DOMAIN` must point to the server in DNS. `TRAEFIK_NETWORK` must exactly
   match the Docker network used by Traefik. Generate a session secret with:

   ```bash
   openssl rand -hex 32
   ```

3. Build and start the service:

   ```bash
   docker compose up -d --build
   docker compose ps
   docker compose logs -f food-preorder
   ```

4. Open `https://${DOMAIN}/` and `https://${DOMAIN}/admin/login`.

Traefik reaches the service at `http://food-preorder:3000` through the external
network. Do not add a `ports` section unless direct host-port access is
specifically needed. Updating the application is repeatable:

```bash
chmod +x update.sh
./update.sh
```

The update script pulls only fast-forward changes, builds and restarts the
service, waits for startup, verifies that the persisted database can serve the
home page, confirms that PID 1 is `vinext start` rather than `wrangler dev`, and
removes dangling Docker images. D1 migrations run automatically before the HTTP
server starts. The script preserves the `food-preorder-data` volume.

The `food-preorder-data` volume survives rebuilds and container replacement.
Back it up before destructive server maintenance. To inspect connectivity:

```bash
docker network inspect "${TRAEFIK_NETWORK:-traefik-public}"
docker compose exec food-preorder node -e "fetch('http://127.0.0.1:3000/').then(async r => console.log(r.status))"
```

Example volume backup from the project directory:

```bash
docker run --rm -v food-preorder-data:/data -v "$PWD:/backup" alpine \
  tar czf /backup/food-preorder-backup.tar.gz -C /data .
```

## References

- [Vinext documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 guide](https://orm.drizzle.team/docs/get-started/d1-new)
