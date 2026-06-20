# 📚 Documentation index

`admin_panel` is an embeddable Next.js 16 CMS admin that drops into any host site as a git
submodule (`vendor/admin-panel`), plus a **design-pack** pipeline that turns a fresh domain
into a finished site. Think "WordPress for the Node/Next/Postgres stack." This folder holds
the deeper docs — start with the root **[README](../README.md)**.

---

## 🚀 Getting started
1. **[../README.md](../README.md)** — what this is + the submodule architecture.
2. **[../INSTALL.md](../INSTALL.md)** — embed the panel into a host (`admin-panel init`), env, permissions, DB.
3. **[DEPLOY_NEW_SITE.md](./DEPLOY_NEW_SITE.md)** — stand up a brand-new design-pack site end-to-end.

## 🧭 Guides — operate a site
| Doc | Purpose |
|---|---|
| [DEPLOY_NEW_SITE.md](./DEPLOY_NEW_SITE.md) | End-to-end: host create → `init --static-site` → wizard → DNS → test checklist |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Build/deploy an existing site (PM2, build flow) |
| [BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md) | Backups (SQLite zip / `pg_dump`), restore, disaster recovery |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues & fixes (build, login, GA, permissions) |

## 🏗️ Architecture & reference — build on it
| Doc | Purpose |
|---|---|
| [TECHNICAL.md](./TECHNICAL.md) | Stack, data layer, API routes, analytics architecture, performance |
| [DESIGN_PACKS.md](./DESIGN_PACKS.md) | The design-pack contract — CMS-block **and** static-site packs, importer, verbatim serving, tokens |
| [SECURITY_REMEDIATION.md](./SECURITY_REMEDIATION.md) | Pen-test / secret-remediation log + the auth-gate patterns to copy |
| [CHANGELOG_PERFORMANCE.md](./CHANGELOG_PERFORMANCE.md) | Performance-optimization history |

## 🗄️ Audits — point-in-time snapshots (historical)
The living docs above stay current; these are dated audits, archived under **[audits/](./audits/)**.
Check each doc's Progress Log for status before acting on its recommendations.

| Audit | Topic | Date |
|---|---|---|
| [audits/AUDIT_SEO_2026-05-25.md](./audits/AUDIT_SEO_2026-05-25.md) | SEO follow-up audit | 2026‑05‑25 |
| [audits/AUDIT_SEO_2026-05-18.md](./audits/AUDIT_SEO_2026-05-18.md) | Deep SEO audit + phased plan (Phase 1 ✅) | 2026‑05‑18 |
| [audits/AUDIT_BRAND_2026-05-11.md](./audits/AUDIT_BRAND_2026-05-11.md) | Brand consistency audit | 2026‑05‑11 |
| [audits/AUDIT_DESIGN_SEO_UX_2026-05-11.md](./audits/AUDIT_DESIGN_SEO_UX_2026-05-11.md) | Design / SEO / UX combined audit | 2026‑05‑11 |
| [audits/QA_AUDIT_2026-04-21.md](./audits/QA_AUDIT_2026-04-21.md) | QA audit | 2026‑04‑21 |

## 🔐 Also at the repo root
- **[../CLAUDE.md](../CLAUDE.md)** — conventions & quick context for AI assistants (read before editing).
- **[../SECURITY.md](../SECURITY.md)** — security policy & reporting.

---

## ⚡ Quick reference
| Need | Command / path |
|---|---|
| Embed panel into a host | `npx github:RHC-Solutions/admin_panel init` (add `--static-site` for pack-served hosts) |
| Apply a design pack (CLI) | `npx github:RHC-Solutions/admin_panel apply-pack <zip\|url> --site-url <url> --tokens '{…}'` |
| Update the panel in a host | `npx github:RHC-Solutions/admin_panel update` → rebuild + restart |
| Build & run | `npm run build && pm2 restart ecosystem.config.js` |
| Type-check | `npx --no-install tsc --noEmit` |
| Postgres instead of SQLite | set `DATABASE_URL=postgres://…` (or `DB_DRIVER=postgres`) |
| Self-improvement loop | `/admin/automation` → OODA card (dry-run by default) |

## 🔧 Key environment variables
See [../INSTALL.md](../INSTALL.md) and [TECHNICAL.md](./TECHNICAL.md#environment-configuration):
- `NEXTAUTH_URL` / `NEXTAUTH_SECRET` — admin auth (rotating the secret invalidates sessions).
- `NEXT_PUBLIC_SITE_URL` — the public site URL (baked at build time).
- `DATABASE_URL` / `DB_DRIVER` — Postgres opt-in (SQLite is the zero-config default).
- `SHARED_ROOT` — external data dir (symlink `public/uploads` when it differs from the project root).
- `CLOUDFLARE_API_TOKEN` — DNS automation + analytics.
