# RHC CMS — embeddable CMS admin + design-pack platform

A reusable Next.js 16 (App Router) admin panel that drops into any site as a **git
submodule** and runs *inside* the host's process — so it uses that site's theme, data,
auth, and domain automatically. Update it once here, pull it everywhere.

On top of the admin sits a **design-pack pipeline**: install the panel on a fresh domain,
apply a portable design pack, configure identity/DNS/keys in a setup wizard, and you have a
finished site. The goal, in one line: **WordPress, but for the Node / Next / Postgres stack
instead of PHP / MySQL.** (The design *generator* — Claude Design — is external; this repo
is the consumer + the runtime.)

## What you get

- **Embeddable admin** — submodule + `@adminpanel/*` path alias + thin re-export route
  wrappers + an `adminAuthGate` middleware. No separate service; `revalidatePath`
  invalidates the host's cache directly.
- **Design packs** — portable `.zip`s that theme + populate a site. Two kinds, auto-detected
  on apply: **CMS-block packs** (a `pack.json` manifest, editable block-by-block) and
  **static-site packs** (finished `.html` + `assets/`, ingested as managed pages and served
  **verbatim** at clean routes). See [docs/DESIGN_PACKS.md](./docs/DESIGN_PACKS.md).
- **Provisioning wizard** — first-run flow: design → configure (domain, Brevo/SMTP email,
  Cloudflare token + **DNS automation**, live ✓/⚠ validation) → admin account → MFA.
- **Self-improvement loop (OODA)** — `/admin/automation` runs Observe→Orient→Decide→Act over
  the daily audits, auto-applying a safe allowlist (revalidate / sync-seo / scan-media) and
  proposing the rest. Dry-run by default.
- **SQLite or Postgres** — SQLite (`cms-data/cms.db`) is the zero-config default; set
  `DATABASE_URL` (or `DB_DRIVER=postgres`) to run on Postgres. Same CMS API on both.
- **CLI** — `init`, `update`, `apply-pack` via `npx github:RHC-Solutions/rhc-cms`.

## Architecture

```
your-site/
├─ vendor/admin-panel/          ← this repo, as a git submodule
│   └─ src/{app,lib,components}  ← the real admin code (imports via @adminpanel/*)
├─ src/app/admin/**             ← thin AUTO-GENERATED re-export wrappers
├─ src/app/api/{admin,cms,auth} ← thin AUTO-GENERATED re-export wrappers
├─ app/[[...slug]]/route.ts     ← (static-pack hosts only) serves ingested pack pages
├─ middleware.ts                ← composes adminAuthGate() from the submodule
├─ cms-data/                    ← THIS site's own theme/pages/users/secrets (or Postgres)
└─ tsconfig.json                ← maps @adminpanel/* → vendor/admin-panel/src/*
```

- **Per-site data**: the admin reads/writes `./cms-data` (theme/pages/users/secrets/cms.db)
  or your Postgres DB. Each site keeps its own — nothing is shared between sites.
- **In-process**: no separate service, no cross-app webhook.
- **Collision-free imports**: all internal imports use `@adminpanel/*`, so they never clash
  with the host site's own `@/*`.

## Add to an existing site

**One command**, from the root of your site:

```bash
npx github:RHC-Solutions/rhc-cms init
#   add --static-site if the public site IS a static design pack (scaffolds the
#   app/[[...slug]]/route.ts catch-all; skip it on hosts with their own Next pages)
```

That adds the submodule, patches `tsconfig.json`, wires `adminAuthGate` into `middleware.ts`,
generates the route wrappers, installs deps, and scaffolds `.env.local` with a fresh
`NEXTAUTH_SECRET`. It's idempotent — safe to re-run. Then set `NEXTAUTH_URL` /
`NEXT_PUBLIC_SITE_URL`, `npm run build`, and open `/admin`.
Flags: `--no-install`, `--static-site`, `--submodule <path>`, `--url <git-url>`.

📖 **Full step-by-step guide: [INSTALL.md](./INSTALL.md).**

## Stand up a brand-new design-pack site

Fresh host → `init --static-site` → setup wizard (upload pack, configure DNS/keys) → live.
Full runbook with the test checklist: **[docs/DEPLOY_NEW_SITE.md](./docs/DEPLOY_NEW_SITE.md)**.
Scriptable apply:

```bash
npx github:RHC-Solutions/rhc-cms apply-pack ./design-pack.zip \
  --site-url http://localhost:<port> --tokens '{"siteName":"Acme Inc","domain":"example.com"}'
```

## Pull updates into every site

```bash
npx github:RHC-Solutions/rhc-cms update    # pulls panel source, syncs deps, warns on skew
npm run build && pm2 restart ecosystem.config.js
```

Or, by hand: `git submodule update --remote vendor/admin-panel` then
`node vendor/admin-panel/scripts/install-into-site.mjs --force` to refresh wrappers if routes
changed. Hosts can also enable the **Renovate** GitHub App (the scaffolded `renovate.json`
bumps the submodule + deps via PRs).

## Database

- **SQLite** (`cms-data/cms.db`) — zero-config default, nothing to set.
- **Postgres** — set `DATABASE_URL=postgres://user:pass@host:5432/db` (append
  `?sslmode=require` for managed PG); the panel auto-selects it. Schema + seed are created on
  first run. File-based backups (the SQLite `.db` zip + WAL checkpoint) skip automatically
  under Postgres — back up with `pg_dump` there.

## Standalone (this repo)

This repo also builds on its own (`npm run build`) as a CI/dev sanity check — `@adminpanel/*`
maps to `./src/*` here. Standalone mode is only for validating the module; in production the
admin always runs embedded in a host site.

## Docs

- **[INSTALL.md](./INSTALL.md)** — install reference (env, permissions, DB, first-run, updating).
- **[docs/](./docs/README.md)** — full documentation index (guides, architecture, audits).
- **[CLAUDE.md](./CLAUDE.md)** — conventions for AI assistants working in this repo.
- **[SECURITY.md](./SECURITY.md)** — security policy.
