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
- `scripts/dev.ps1` — repeatable Windows setup and launch script

## Commands

- `npm.cmd run dev:windows` — prepare and run locally on Windows
- `npm run dev` — run the Vite/Vinext server in a Unix-compatible shell
- `npm run build` — build and validate the Sites artifact in Linux
- `npm test` — build and run the rendered HTML test in Linux
- `npm run db:generate` — generate Drizzle migrations after schema changes

## References

- [Vinext documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 guide](https://orm.drizzle.team/docs/get-started/d1-new)
