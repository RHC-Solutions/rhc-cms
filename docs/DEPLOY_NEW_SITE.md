# Deploy a new site (e.g. bigdatacybercloud.com)

End-to-end runbook for standing up a fresh site whose public surface is a **design pack**,
with the admin panel embedded for tooling. Reflects the hardening from the deploy audit.

## 0. Prerequisites
- A host (VPS/box) with **Node ≥ 20.9** (the CLI uses global `fetch`/`FormData`/`Blob`), `git`, and a process manager (PM2 or systemd).
- A domain (e.g. `bigdatacybercloud.com`) and, optionally, a Cloudflare zone (API token with **DNS edit** + Zone/Account IDs) for DNS + analytics.
- A design pack `.zip` from Claude Design (static-site pack), or a CMS-block pack.

## 1. Create the host app + embed the panel
```bash
npx create-next-app@latest mysite --ts --app   # or your existing Next app
cd mysite
# Static-pack hosts: the pack owns '/', so remove the host's own root page:
rm -f src/app/page.tsx

npx github:RHC-Solutions/admin_panel init --static-site
#   → adds vendor/admin-panel submodule, @adminpanel/* tsconfig path, middleware
#     (adminAuthGate), route wrappers, installs deps, scaffolds .env.local + a fresh
#     NEXTAUTH_SECRET, renovate.json, and the static-site catch-all app/[[...slug]]/route.ts
```
The installer prints a checklist; heed any "remove your own / page" warning (a root `page.tsx` collides with the static catch-all).

## 2. Environment (`.env.local`)
Edit **before** building — `NEXT_PUBLIC_*` are baked in at build time:
```
NEXTAUTH_SECRET=<kept from init>
NEXTAUTH_URL=https://admin.bigdatacybercloud.com      # the ADMIN URL (subdomain is fine)
NEXT_PUBLIC_SITE_URL=https://bigdatacybercloud.com    # the public site URL
```
> The provisioning wizard can set `NEXT_PUBLIC_SITE_URL` for you, but **not** `NEXTAUTH_URL` (it never overwrites it). Any `.env.local` change needs a rebuild + restart.

## 3. Data location & permissions
- By default the panel reads/writes `./cms-data` and serves `./public/uploads` from the project root.
- If you use a shared data dir, set `SHARED_ROOT=/path/to/shared`. **Invariant:** Next serves static files from `<project>/public`, but the panel writes uploads under `$SHARED_ROOT/public/uploads`. When `SHARED_ROOT` ≠ project root, symlink them so pack assets serve:
  ```bash
  ln -s "$SHARED_ROOT/public/uploads" "<project>/public/uploads"
  ```
- Secrets/PII files are `chmod 660`, dirs `770` (see the panel's CLAUDE.md permissions table).

## 4. Build & run
```bash
npm run build
pm2 start "npm run start" --name mysite   # or: next start -p <port> behind your proxy
```
Front with Cloudflare/your proxy → the app port. `/admin` and `/api/*` resolve first; everything else is served by the static-pack catch-all.

## 5. First run — the setup wizard (`/admin`)
Open `https://admin.<domain>/admin` → the wizard runs while no admin exists yet:
1. **Design pack** — upload the `.zip` (+ identity tokens: site name, tagline, contact, domain). Or skip and use the CLI (step 5b).
2. **Configure** — domain, email (Brevo or SMTP), Cloudflare token/zone, and optionally **point DNS to the server IP** (creates the A records via Cloudflare). Shows ✓/⚠ per service. Domain/Cloudflare changes are written to `.env.local` → **rebuild + restart** to take effect.
3. **Admin account** → 4. **MFA** (scan the QR).

**5b. CLI alternative (scriptable):**
```bash
npx github:RHC-Solutions/admin_panel apply-pack ./BigDataCyberCloud.zip \
  --site-url http://localhost:<port> --tokens '{"siteName":"BigData CyberCloud","domain":"bigdatacybercloud.com"}'
```
(File upload works first-run; a remote `https` URL pack requires admin login.)

## 6. DNS
Either let the wizard create the A records (Cloudflare), or manually point `@` (and `www`) at the server IP. Cloudflare proxy (orange cloud) is fine.

## 7. Test checklist
- `https://<domain>/` and each pack route (`/big-data`, …) render **pixel-perfect** with working JS.
- Pack assets (`/uploads/pack-<slug>/styles.css`, `site.js`) return **200**.
- `https://admin.<domain>/admin` → login + MFA works.
- `/admin/pages` lists the static pages (badge + Preview link).
- `/admin/automation` → run a daily audit; try the **OODA** card (Preview = dry-run; enable + allowlist to auto-apply safe actions).
- If analytics enabled (seo.json `injectAnalyticsIntoStaticPages` + GA4 id): GA loads with Consent Mode v2 *denied* on pack pages.

## 8. Keeping it current
- `npx github:RHC-Solutions/admin_panel update` (pulls panel source, syncs deps, warns on skew) → rebuild + restart.
- Or enable the **Renovate** GitHub App on the host repo (the scaffolded `renovate.json` bumps the submodule + deps via PRs).

## Database (SQLite default, Postgres optional)
- **SQLite** (`cms-data/cms.db`) is the zero-config default — nothing to set.
- **Postgres:** set `DATABASE_URL=postgres://user:pass@host:5432/db` (append `?sslmode=require` for managed PG) — the panel auto-selects it. `DB_DRIVER=postgres|sqlite` forces a backend. Schema + seed are created on first run. The CMS API is identical on both.
- **Backups:** the file-based backup/restore (and the daily-audit WAL checkpoint) are SQLite-only and **skip automatically** under Postgres. For PG, back up with `pg_dump` (a panel-native pg_dump flow is a planned follow-up). JSON-file backups (`cms-data/*.json`) still run on both.

## Notes / current limits
- **Design generator** is external (Claude Design); this panel is the consumer.
- Re-applying a pack updates the design; pack pages aren't block-editable (by design).
