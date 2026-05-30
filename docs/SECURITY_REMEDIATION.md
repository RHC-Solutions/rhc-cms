# Security Remediation

## 2026‑05‑13 — Pen‑test follow‑up audit

A targeted audit + live pen‑test of production found nine unauthenticated endpoints, several leaking secrets to the open internet. All are now patched, the leaked `NEXTAUTH_SECRET` has been rotated, and filesystem permissions have been tightened. **Provider‑side secret rotations are still on the user** — see the checklist below.

### Endpoints fixed

| Severity | Endpoint | Issue | Commit/file |
|---|---|---|---|
| Critical | `GET/POST /api/admin/environment` | Returned (and rewrote) the **entire `.env.local`** — `NEXTAUTH_SECRET`, Cloudflare API token, GA private key, SMTP password, Telegram bot tokens, reCAPTCHA secret — to anonymous internet. Full takeover (JWT forgery). | [src/app/api/admin/environment/route.ts](../src/app/api/admin/environment/route.ts) |
| Critical | `GET/POST /api/admin/analytics/config` | Same `.env.local` read/write for GA service‑account key. | [src/app/api/admin/analytics/config/route.ts](../src/app/api/admin/analytics/config/route.ts) |
| Critical | `PUT /api/cms/settings` | Whitelisted in middleware as public but had no per‑method auth — anonymous site‑settings mutation. | [src/app/api/cms/settings/route.ts](../src/app/api/cms/settings/route.ts) |
| High | `POST/PUT/DELETE /api/cms/offices` | Same root cause — public CRUD on office records. | [src/app/api/cms/offices/route.ts](../src/app/api/cms/offices/route.ts) |
| High | `POST/PUT/DELETE /api/cms/pages` | Anonymous could create/modify/delete CMS pages (stored‑XSS pathway via published block content). | [src/app/api/cms/pages/route.ts](../src/app/api/cms/pages/route.ts) |
| Medium | `POST /api/admin/analytics/test` | Unauthenticated outbound JWT mint / Google OAuth probe. | [src/app/api/admin/analytics/test/route.ts](../src/app/api/admin/analytics/test/route.ts) |
| Medium | `POST /api/admin/telegram/test` | Unauthenticated Telegram API proxy (abuse / SSRF‑adjacent). | [src/app/api/admin/telegram/test/route.ts](../src/app/api/admin/telegram/test/route.ts) |
| Medium | `POST /api/admin/reset-password` | Unauthenticated by design (forgot‑password) but had no rate limit — attacker could repeatedly invalidate admin password and disable MFA. Now: per‑IP limit (3/hr), per‑account 1‑hour cooldown, generic response to prevent user enumeration. | [src/app/api/admin/reset-password/route.ts](../src/app/api/admin/reset-password/route.ts) |

### Root cause

The middleware matcher only enforces auth on `/api/cms/*` and `/admin/*`. The `/api/admin/*` namespace (an internal API consumed by admin UI pages) was completely unprotected. Several `/api/cms/*` paths were whitelisted as public to expose their `GET` for the public site renderer — but the whitelist is method‑agnostic, so their `PUT/POST/DELETE` slipped through too.

**Going forward** every `/api/admin/**/route.ts` handler must call `getToken` and check `role === 'admin'`; whitelisted public `/api/cms/*` handlers must guard mutating verbs in‑body. This is now documented in [CLAUDE.md → Security & auth](../CLAUDE.md#security--auth).

### Filesystem permissions tightened

The audit also found `.env.local`, `cms-data/cms.db`, and `cms-data/users.json` were `-rw-rw-rw-` (world‑readable) on the shared host. `public/uploads/`, `cms-data/backups/`, `.git/`, `.vscode/`, `src/components/cms/`, and `src/app/terms/` were `drwxrwxrwx` (world‑writable). All have been narrowed to owner + `rhcsolutions` group only. Conventions in [CLAUDE.md → Filesystem layout & permissions](../CLAUDE.md#filesystem-layout--permissions).

### Required follow‑up (provider‑side — must be done by hand)

The `/api/admin/environment` leak was live on the public internet. Assume every value `.env.local` contains is **compromised** and rotate at the provider:

- [x] `NEXTAUTH_SECRET` — rotated in `.env.local` during this audit (all admin sessions invalidated).
- [ ] `CLOUDFLARE_API_TOKEN` — revoke + reissue at Cloudflare dashboard → My Profile → API Tokens.
- [ ] `CLOUDFLARE_TURNSTILE_SECRET_KEY` — rotate at Cloudflare → Turnstile.
- [ ] `SMTP_PASS` (and rotate the SMTP_USER mailbox password).
- [ ] `GA_PRIVATE_KEY` — disable the existing service‑account key in Google Cloud IAM and create a new one.
- [ ] `RECAPTCHA_SECRET_KEY` — regenerate in the Google reCAPTCHA admin console.
- [ ] All Telegram bot tokens (`TELEGRAM_BACKUP_BOT_TOKEN`, `TELEGRAM_LOGIN_ALERT_BOT_TOKEN`, etc.) — revoke at `@BotFather` → `/revoke`.
- [ ] `IPINFO_TOKEN` — regenerate at https://ipinfo.io/account/token.

After rotating each value, paste the new value into `.env.local` and run `pm2 restart ecosystem.config.js`.

---

## 2026‑05‑11 — Committed secrets (prior audit)

**Source:** [QA_AUDIT_2026-04-21.md § 5.1](./QA_AUDIT_2026-04-21.md#51--critical--secrets-committed-in-cms-data)
**Status as of 2026-05-11:**

| Step | Status |
|---|---|
| Files removed from active tracking | ✅ `cms-data/users.json` and `cms-data/seo.json` are in `.gitignore`; `git ls-files cms-data/` no longer lists them |
| Hardcoded NEXTAUTH_SECRET fallback removed | ✅ Audit-flagged `'your-secret-key-change-in-production'` strings no longer present in source |
| MFA TOTP secret rotated in repo | ✅ Commit `1f3fbe9` (security: Disable MFA and remove leaked TOTP secrets and recovery codes) |
| **TOTP secret + IPinfo token + Ahrefs key purged from git history** | ❌ **Still present in old commits — see below** |
| **External keys rotated at the provider** | ❓ Unknown — verify with the provider dashboards |

---

## What is still in git history

These commits contain the literal secrets and must be assumed public:

**TOTP seed `DNNRIX7RBEMBABDPLLQQF6GD7OQGQQ5R`:**
- `6c215ec`, `be9955a`, `cc7ceef`

**IPinfo token `e7dda13207bb37`:**
- `6c215ec`, `be9955a`, `f05fbf6`

**Ahrefs API key:** verify with `git log --all -S "<key fragment>"` once you have the leaked value at hand.

**Telegram forms-bot token (bot ID `8443979246`, chat ID `-4949703854`):**
Hardcoded in `src/app/api/cms/forms/route.ts` until commit removing it (replaced with `TELEGRAM_FORMS_BOT_TOKEN` / `TELEGRAM_FORMS_CHAT_ID` env vars). The full token string is in every commit that touched that file before the fix — grep history for the bot ID prefix `8443979246:` to locate it. **Rotate now** at https://t.me/BotFather → `/revoke` (select the bot) → confirm regeneration. The previous token is public; assume any party with repo read access has it.

**Telegram example-token (bot ID `8212839523`, chat ID `-5006088546`):**
Committed as a literal example in `.env.local.example` (commits `f05fbf6`, `d614836`, `2214f23`). Even though `.env.local.example` is a template, it shipped a real-looking token string. If that bot exists, **rotate at @BotFather** the same way. The example file has since been rewritten to use placeholder values only.

---

## What you must still do

### 1. Rotate every key, today

These actions live outside the repo — Claude / CI cannot do them for you:

- **Ahrefs** — log in to Ahrefs → API → revoke the leaked key, issue a new one, update `.env.local` and the production env (`NEXT_PUBLIC_AHREFS_KEY` or wherever it lives, plus `cms-data/seo.json` on the production server only). Anything that still uses the old key is dead.
- **IPinfo** — log in to https://ipinfo.io/account/token → regenerate. Token `e7dda13207bb37` should be revoked.
- **Admin password** — the bcrypt hash is in the leaked `cms-data/users.json`. Reset via `/admin/login` → forgot password, or run `npx tsx scripts/hash-password.ts` and replace the hash in `cms-data/users.json` on the production server.
- **TOTP** — if you re-enable MFA, do **not** reuse the old seed. The current setup has MFA off per commit `1f3fbe9` so this is dormant, but if you turn it back on, re-enroll.

### 2. Purge from history (optional — destructive)

> ⚠️ This rewrites every commit hash from the offending commit forward. Anyone with an existing clone or open PR will need to reclone. **Coordinate before doing this.**

Recommended tool: `git-filter-repo` (https://github.com/newren/git-filter-repo).

```bash
# Backup the repo first.
cp -a rhcsolutions.com rhcsolutions.com.pre-purge

cd rhcsolutions.com
pip install --user git-filter-repo

# Strip the specific files from all history:
git filter-repo --invert-paths --path cms-data/users.json --path cms-data/seo.json

# (Optional) replace remaining occurrences of literal secrets if they leaked
# through other paths — write `replace.txt` with one line per secret then:
#   git filter-repo --replace-text replace.txt

# Force-push the rewritten history (requires admin rights on GitHub):
git push --force-with-lease origin master
```

**Before force-pushing:**
- Notify everyone who has a clone.
- Close any open PRs (they're based on the old hashes).
- Confirm CI / deployment will accept the new history.

### 3. Verify the cleanup

After rotation + (optional) purge:

```bash
# Should produce 0 lines once everything is rotated AND purged.
git log --all -S "DNNRIX7RBEMBABDPLLQQF6GD7OQGQQ5R" --oneline
git log --all -S "e7dda13207bb37" --oneline

# Should NOT list users.json or seo.json:
git ls-files cms-data/
```

---

## Why this isn't a one-line fix

Rotating the keys is sufficient to neutralize the leak — once Ahrefs / IPinfo invalidate the old tokens, an attacker who copies them from git history can do nothing with them. Purging history is **belt-and-suspenders** but optional, and the cost (shared-state rewrite) is non-trivial. Treat rotation as mandatory and purge as a hygiene improvement.
