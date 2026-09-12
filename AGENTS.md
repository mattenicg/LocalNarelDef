# Base44 dev notes

- The actual app lives in `LOCAL.NAREL/plantilla1` (Express + PostgreSQL, static HTML frontend served from `public/`). Repo-root `Dockerfile`/`vercel.json` are not used.
- Run: `docker compose -f docker-compose.base44.yml up -d`. `app` runs `nodemon --legacy-watch` on the bind-mounted source; backend edits restart automatically, frontend files in `public/` are served live (browser reload needed).
- Schema is applied automatically on boot (`src/db/postgres-schema.sql` via `initPostgres`). Seed admin: `docker compose -f docker-compose.base44.yml exec -T app node src/db/postgres-seed.js` (uses `ADMIN_DEFAULT_EMAIL`/`ADMIN_DEFAULT_PASSWORD` from compose → dev login `admin@narel.local` / `Admin1234!`).
- `ORIGIN_PERMITIDO` must include the preview origin (`https://3000-$BASE44_PUBLIC_HOST_SUFFIX`); CORS rejects POSTs otherwise. Cookies are `sameSite: lax`, non-secure in development — same-origin only.
- Legacy SQLite routes are disabled (`LEGACY_SQLITE_ENABLED=false`). All secrets (OpenAI, Mercado Pago, SMTP) are optional; `PAYMENT_PROVIDER` defaults to `manual`.
- Health: `GET /api/health`. Admin panel: `/admin/login.html`.
