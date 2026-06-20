# Installing the admin panel into a new site

This guide installs the embeddable CMS admin (`@adminpanel/*`) into a fresh
Next.js site as a git submodule. The admin runs **inside** the host site's
process, so it uses that site's theme, data, auth, and domain. Update it once in
the shared repo, pull it everywhere.

> TL;DR for the impatient is in [README.md](./README.md). This file is the
> complete version with **every setting** spelled out.

---

## 0. What you get

A `/admin` area with: Dashboard · Analytics (+ setup) · Pages · Landing Pages ·
Media · Forms · Menu · Footer · Theme · Typography · Users
(role-based: `admin` / `editor`) · SEO · Cookies · Cloudflare
(+ setup) · Integrations · Backups · **Automation** (daily audit + weekly
dependency PRs) · Security (Aikido) · Settings + Environment. Plus NextAuth login
with brute-force IP blocking, mandatory TOTP MFA, and a first-run setup wizard.

---

## 1. Prerequisites

| Need | Why |
|---|---|
| **Node 20.9+** (LTS 20 or 22) | Next.js 16 requirement |
| A **Next.js 16 App Router** host site (`src/app`, TypeScript) | the admin mounts as route wrappers |
| **git** with submodule support | the panel ships as a submodule |
| A build toolchain (`build-essential`/`python3`) | `better-sqlite3` compiles a native addon |
| Linux host, a process manager (PM2/systemd) for production | long-running Next server |

The host can be brand-new — but it must be a Next.js app **before** you embed the
panel. Scaffold one first, then `init` (the CLI checks these prerequisites and stops
with guidance if a `package.json`, Node 20.9+, git, or npm is missing):

```bash
npx create-next-app@latest your-site --typescript --app
cd your-site
npx github:RHC-Solutions/admin_panel init            # add --static-site if the pack IS the whole site
```

> **`init` vs `update`:** `init` sets up a fresh site; `update` only upgrades a site
> that has **already** run `init`. Running `update` in an empty folder does nothing —
> there's no embed to update yet.

---

## 2. Install

### Fast path — one command (recommended)

From the root of your site:

```bash
npx github:RHC-Solutions/admin_panel init
```

This runs the bundled CLI ([bin/admin-panel.mjs](./bin/admin-panel.mjs)), which
does **all** of steps 2–4 and 6 for you, idempotently:

- adds the submodule at `vendor/admin-panel`
- adds the `@adminpanel/*` path to `tsconfig.json`
- creates `middleware.ts` wired to `adminAuthGate` (or prints the snippet if you
  already have one — it won't overwrite yours)
- generates the Next route wrappers
- installs the runtime deps (`--no-install` to skip)
- runs an interactive **`.env.local` wizard** — prompts for the admin/site URLs, offers
  to auto-generate `NEXTAUTH_SECRET`, asks for an optional Postgres `DATABASE_URL`, then
  optionally walks every other setting (GA, SMTP, Telegram, Cloudflare…). Press Enter to
  accept a `[default]`; a blank skips an optional. Pass `--yes` (or run non-interactively,
  e.g. piped/CI) to skip the wizard and write defaults + a generated secret instead. Also
  updates `.gitignore`.

Flags: `--no-install` · `--static-site` (scaffold the root catch-all that serves a
design pack at clean routes — single-purpose pack hosts only) · `--submodule <path>`
(default `vendor/admin-panel`) · `--url <git-url>` · `--no-renovate` · `--help`. Then
jump to **step 4** to fill in the 3 required env vars, and **step 6** to run.

> The first `npx` run clones the panel once to execute the CLI; that's expected.

To pull a newer panel later: `npx github:RHC-Solutions/admin_panel update` (or
`node vendor/admin-panel/bin/admin-panel.mjs update`) — see step 8.

### Manual path — what the CLI automates

If you'd rather wire it up yourself (or the CLI can't auto-edit a commented
`tsconfig`/existing `middleware`), do the submodule + wrappers here and the rest
in steps 3–4:

```bash
cd your-site
git submodule add https://github.com/RHC-Solutions/admin_panel.git vendor/admin-panel
node vendor/admin-panel/scripts/install-into-site.mjs        # writes thin re-export wrappers into src/app
```

`install-into-site.mjs` mirrors every admin route from the submodule into your
`src/app` as a one-line re-export (Next routing is filesystem-based, so the
wrappers must exist in the host; the real code stays in the submodule). Flags:

- `--force` — overwrite existing wrappers (use after pulling panel updates that add/rename routes)
- `--print-deps` — list the runtime deps to install (see step 3)
- `--submodule <path>` — submodule location (default `vendor/admin-panel`)
- `--site <path>` — host root (default `.`)

It also **copies/scaffolds the audit scripts reference** — automation lives at
`vendor/admin-panel/scripts/audit/` (see step 7).

---

## 3. Wire it into the host

### 3a. `tsconfig.json` — path alias

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@adminpanel/*": ["./vendor/admin-panel/src/*"]
    }
  }
}
```

`@/*` stays your site's own; `@adminpanel/*` resolves into the submodule. The two
never collide.

### 3b. `middleware.ts` — compose the auth gate

Keep your site's own middleware concerns and call the gate:

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminAuthGate, ADMIN_MATCHER } from '@adminpanel/admin-middleware';

export async function middleware(req: NextRequest) {
  // ...your site-level headers / canonical-host / CSP here...

  const gate = await adminAuthGate(req);   // handles login, MFA, roles, first-run setup
  if (gate) return gate;                   // short-circuit: redirect / 401 / 403

  return NextResponse.next();
}

export const config = { matcher: [ /* ...your matchers..., */ ...ADMIN_MATCHER ] };
```

`ADMIN_MATCHER` = `['/admin/:path*', '/api/cms/:path*']`. Note `/api/admin/*` is
**not** matched by middleware on purpose — those handlers authenticate
themselves; don't add them to the matcher.

### 3c. Dependencies

```bash
node vendor/admin-panel/scripts/install-into-site.mjs --print-deps   # prints the list
npm i adm-zip archiver bcryptjs better-sqlite3 framer-motion googleapis \
  isomorphic-dompurify leaflet next-auth node-cron nodemailer qrcode \
  react-hot-toast react-icons react-leaflet --legacy-peer-deps
npm i -D @types/better-sqlite3 @types/leaflet --legacy-peer-deps
```

(`--legacy-peer-deps` because the panel tracks the newest React/Next; adjust if
your host already satisfies the peers.)

### 3d. `next.config` (optional but recommended)

The admin serves uploads from `/public/uploads` (no remote image config needed).
If you enable third-party trackers (GA/GTM/Ahrefs/etc.), make sure your host's
CSP `script-src`/`connect-src` allow them. The panel ships a reference
`security-headers.mjs` you can crib from.

---

## 4. Environment (`.env.local`)

Copy the template and fill it in:

```bash
cp vendor/admin-panel/.env.local.example .env.local
```

**Two ways to set credentials.** Server-side secrets are read via `getSecret()`,
which checks **`cms-data/secrets.json` first** (written by the admin UI →
Integrations / Environment pages) **then `.env.local`**. So anything in the
"Server secrets" group below can be entered in the admin UI *after* first login
instead of here. The **Required** and **Public** groups must be in `.env.local`
because they're needed at build/boot.

### Required (must be in `.env.local`)

| Var | Notes |
|---|---|
| `NEXTAUTH_SECRET` | `openssl rand -base64 32`. Rotating it invalidates all sessions. |
| `NEXTAUTH_URL` | Full site URL, e.g. `https://your-domain.com`. |
| `NEXT_PUBLIC_SITE_URL` | Same canonical URL; drives white-labeled strings (Telegram alerts, Cloudflare hints, seed emails, audit digests). |

### Public — build-time, must be env (inlined into the bundle)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_GA_ID` | GA4 measurement ID `G-XXXX`. |
| `NEXT_PUBLIC_GA_PROPERTY_ID` | Numeric GA4 property ID (admin dashboard charts). |
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager `GTM-XXXX`. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile (contact form). |
| `NEXT_PUBLIC_AHREFS_KEY` | Ahrefs (SEO panel). |
| `NEXT_PUBLIC_BOOKING_URL` | Booking link used in CTAs. |
| `NEXT_PUBLIC_PM2_APP_NAME` | PM2 process name shown in setup hints (default: site-domain first label). |

### Server secrets — env **or** admin UI (`cms-data/secrets.json`)

| Var | Purpose |
|---|---|
| `ADMIN_EMAIL` | Default recipient for form/audit notifications. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | Email delivery. Port 465 ⇒ implicit TLS; 587 ⇒ STARTTLS. |
| `TELEGRAM_FORMS_BOT_TOKEN` / `TELEGRAM_FORMS_CHAT_ID` | Contact-form delivery to Telegram. |
| `TELEGRAM_CONTACT_BOT_TOKEN` / `TELEGRAM_CONTACT_CHAT_ID` | Contact route + login-attempt alerts. |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` / `WHATSAPP_DESTINATION` | WhatsApp Cloud API fallback (E.164 destination). |
| `TURNSTILE_SECRET_KEY` | Server-side Turnstile verification. |
| `AIKIDO_API_TOKEN` (preferred; alias: `AIKIDO_IDE_TOKEN`) | Aikido security panel. |
| `IPINFO_TOKEN` | Visitor geolocation. |
| `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` | Brevo email integration (optional). |
| `CLOUDFLARE_API_TOKEN` / `NEXT_PUBLIC_CLOUDFLARE_ZONE_ID` / `CLOUDFLARE_ACCOUNT_ID` | Cloudflare panel (cache/DNS/analytics). |
| `NEXT_PUBLIC_GA_SERVICE_ACCOUNT_EMAIL` / `GA_PRIVATE_KEY` | Google service account for the Analytics dashboard. |

> ⚠️ **Never hardcode a token in source.** Committed secrets get leaked
> (GitHub secret-scanning will flag them). Use env or the admin UI only.

### Initial admin seed (rarely needed — the setup wizard is the normal path)

| Var | Purpose |
|---|---|
| `SEED_ADMIN_PASSWORD` | Used only if `cms-data/users.json` is auto-seeded; falls back to `admin123` with a warning. |
| `SEED_ADMIN_EMAIL` | Default seed email; default to `admin@<site-domain>`. |

### Automation / audit (all optional — see step 7)

| Var | Default |
|---|---|
| `AUDIT_SCRIPTS_DIR` | path to the audit scripts; **set this in embedded mode** → `vendor/admin-panel/scripts/audit` |
| `AUDIT_REPO_DIR` | repo the audit runs against (default: repo root containing the scripts) |
| `AUDIT_GIT_REMOTE` | `origin` |
| `AUDIT_BASE_BRANCH` | `main` |
| `AUDIT_GH_REPO` | `owner/repo` for `gh pr create` — required to open auto-fix PRs |
| `AUDIT_WORKTREE_DIR` | `$HOME/audit-worktrees` |
| `AUDIT_REPORT_TO` | digest recipient (default: `ADMIN_EMAIL`) |
| `AUDIT_LOCAL_BASE` | local server base for collectors (default `http://localhost:3001`) |
| `CLAUDE_BIN` | path to the headless `claude` CLI for auto-fix passes |

### Advanced

| Var | Purpose |
|---|---|
| `SHARED_ROOT` | Override the base dir for `cms-data/` (default: `process.cwd()`). Useful when the server runs from a different working directory. |
| `DATABASE_URL` | Use **Postgres** instead of SQLite, e.g. `postgres://user:pass@host:5432/db` (`?sslmode=require` for managed PG). Unset → SQLite (`cms-data/cms.db`, the default). Schema + seed auto-create on first run. PG backups use `pg_dump` (file-based backup/restore is SQLite-only). |
| `DB_DRIVER` | Force the backend: `sqlite` or `postgres` (overrides the `DATABASE_URL` heuristic). |

---

## 5. Data & filesystem permissions

The admin reads/writes **`./cms-data`** in the host site (its own
`theme.json`, `settings.json`, `pages.json`, `users.json`, `secrets.json`,
`cms.db`). Nothing is shared between sites — each keeps its own. You don't need
to pre-create these; the setup wizard makes `cms-data/` and the loaders create
sane defaults on first read.

On a shared host, lock down secret files (owner+group only):

| Path | Mode | Why |
|---|---|---|
| `.env.local`, `cms-data/*.json`, `cms-data/cms.db*` | `660` | secrets / password hashes |
| `cms-data/`, `cms-data/backups/` | `770` | dirs need `+x` |
| `public/uploads/` | `2775` | setgid so UI uploads stay in-group; world-read so Next serves them |

Never commit `.env.local`, `cms-data/secrets.json`, or `cms-data/users.json`
(add them to `.gitignore`).

---

## 6. First run

```bash
npm run build
npm start          # or: pm2 start npm --name your-app -- start
```

Then in a browser:

1. Visit **`/admin`** → you're redirected to **`/admin/setup`** (first-run gate).
2. Create the admin: **name, email, password** (≥8 chars). This writes
   `cms-data/users.json` with a bcrypt hash — the account you can actually log in
   with.
3. Click finish → you land on **`/admin/login`**.
4. Log in → you're forced to **`/admin/mfa-setup`**: scan the TOTP QR with an
   authenticator app, enter a code to verify, and **save the recovery codes**.
5. You're in. MFA is now required for every login.

> The setup wizard intentionally does **not** enable MFA from an unverified QR —
> enrollment happens in the verified `/admin/mfa-setup` step so a mis-scan can't
> lock you out.

---

## 7. Automation (optional)

The `/admin/automation` page schedules a **daily site audit** (SEO / AI-readiness
/ performance, with optional auto-fix PR) and a **weekly dependency PR**. It runs
`vendor/admin-panel/scripts/audit/{daily-audit.sh,weekly-deps.sh}`.

To enable:

1. In `.env.local` set `AUDIT_SCRIPTS_DIR=vendor/admin-panel/scripts/audit` (so
   the API finds the scripts in embedded mode) and, for auto-fix PRs,
   `AUDIT_GH_REPO=owner/repo`. Ensure `gh` is authenticated and (for AI auto-fix)
   `CLAUDE_BIN` points at the headless `claude` CLI.
2. Add cron jobs (adjust paths/times):

   ```cron
   17 6 * * *   cd /path/to/your-site && ./vendor/admin-panel/scripts/audit/daily-audit.sh  >> logs/audit/cron.log 2>&1
   37 7 * * 1   cd /path/to/your-site && ./vendor/admin-panel/scripts/audit/weekly-deps.sh  >> logs/audit/cron.log 2>&1
   ```

3. Toggle each job and set the recipient email from the `/admin/automation` UI
   (stored in `cms-data/automation.json`). With no config set, both default to
   enabled and email the `ADMIN_EMAIL`.

Everything in the scripts is parameterized — a fresh clone runs with sane
defaults and no edits; override via the `AUDIT_*` env vars above.

---

## 8. Updating the panel later

### One command (recommended)

```bash
cd your-site
npx github:RHC-Solutions/admin_panel update
npm run build && pm2 restart your-app
```

`update` only upgrades a site that has **already** embedded the panel via `init` — it
needs the `vendor/admin-panel` submodule and a `package.json` to be present, and stops
with guidance if they aren't (for a brand-new folder, run `init`, not `update`). It
pulls the newest panel source, regenerates the route wrappers, and **syncs
your `package.json` deps to the versions the panel declares** — so source and deps
move in lockstep (e.g. a panel build that needs `archiver` 8 won't land on a host
still resolving `archiver` 7). It also warns if any host dep is below the panel's
declared `peerDependencies` minimum. Your `cms-data/` is untouched.

### Hands-off (recommended for fleets)

`init`/`update` drop a `renovate.json` that enables Renovate's **git-submodules** +
**npm** managers, so each site auto-opens PRs that bump `vendor/admin-panel` and the
panel's deps. Enable the [Renovate GitHub App](https://github.com/apps/renovate) (or
self-hosted) on the repo and you get reviewable update PRs on a weekly schedule —
nothing auto-merges by default. Skip with `--no-renovate`; tune `automerge` per
`packageRule` to make safe bumps fully hands-off. (Dependabot works too but its
submodule support is weaker.)

### Manual path (if you don't use the CLI)

```bash
cd your-site
git submodule update --remote vendor/admin-panel
node vendor/admin-panel/scripts/install-into-site.mjs --force   # refresh wrappers if routes changed
# then bump the panel's deps in your package.json to match vendor/admin-panel/package.json
npm run build && pm2 restart your-app
```

---

## 9. Verify / troubleshoot

| Symptom | Check |
|---|---|
| `@adminpanel/*` import errors | tsconfig path added? submodule actually checked out (`git submodule update --init`)? |
| `/admin` 404s | ran `install-into-site.mjs`? wrappers present under `src/app/admin`? |
| Redirected to `/admin/setup` forever | finish the wizard — it sets a `setup-complete` cookie; clear cookies to retry. |
| Can't log in after setup | the account uses bcrypt `passwordHash`; if you hand-edited `users.json`, hash with `scripts/hash-password.ts`. |
| `Configuring Next.js via 'next.config.ts' is not supported` | Your host resolved an **old Next (<16)** (stale `node_modules` or a skipped install). This setup requires **Next.js 16+**. Fix: `npm install next@latest react@latest react-dom@latest && rm -rf .next && npm run build` (or rename `next.config.ts` → `next.config.js`). `init` now warns when it detects this. |
| `better-sqlite3` build fails | install build tools (`build-essential`, `python3`) and reinstall. |
| `npm warn deprecated` during install (`prebuild-install`, `node-domexception`, `glob`) | Harmless. These are **transitive** deps of `better-sqlite3` / `node-fetch` / `googleapis`, each already the latest version its parent allows (`npm audit` = 0). They clear only when those upstreams update — not panel-controllable. `init` already pins `uuid` forward (next-auth ships a deprecated `uuid@8`) via a propagated `overrides` entry, so that one won't appear. |
| Automation "Script not found" | set `AUDIT_SCRIPTS_DIR` to `vendor/admin-panel/scripts/audit`. |
| Secrets not taking effect | `getSecret` caches ~1 min; admin-UI saves win over `.env.local`. |
| GA dashboard empty | set `NEXT_PUBLIC_GA_SERVICE_ACCOUNT_EMAIL` / `GA_PRIVATE_KEY` and `NEXT_PUBLIC_GA_PROPERTY_ID`. |

Standalone sanity build of the panel itself: `cd vendor/admin-panel && npm i && npm run build`.
