# 🚀 RHC Solutions - Enterprise Website

**Production-ready Next.js 16 website with integrated SQLite CMS, automated backups, Cloudflare CDN, Google Analytics, and comprehensive admin dashboard.**

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-CDN-orange)](https://cloudflare.com/)

**Status**: ✅ Production Ready | SQLite CMS | Cloudflare CDN | GA4 + Hotjar

---

## 📖 Documentation

**Quick Links:**
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Deploy to Vercel, PM2, or Docker
- **[BACKUP & RECOVERY](./docs/BACKUP_RECOVERY.md)** - Backup & restore procedures
- **[TECHNICAL.md](./docs/TECHNICAL.md)** - Architecture, database, API reference
- **[TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)** - Common issues & solutions
- **[SEO Audit (2026‑05‑18)](./docs/AUDIT_SEO_2026-05-18.md)** - Deep audit + phased improvement plan
- **[All Docs](./docs/README.md)** - Complete documentation index

---

## ⚡ Quick Start

```bash
# 1. Clone & install
git clone <repository-url>
cd rhcsolutions.com
npm install

# 2. Configure environment
cp .env.local.example .env.local
# Edit .env.local with credentials (see docs/TECHNICAL.md)

# 3. Start development
npm run dev          # http://localhost:3000

# 4. Build for production
npm run build
npm start
```

**[→ Full deployment guide](./docs/DEPLOYMENT.md)**

---

## 🎯 Key Features

### Technology
- **Next.js 16** + Turbopack + React Server Components
- **React 19**, **TypeScript 5.7**, **SQLite CMS**
- **Tailwind CSS 3.4**, **Framer Motion**, **NextAuth.js**
- **Cloudflare CDN**, **GA4**, **Hotjar**, **Ahrefs**

### CMS & Admin
- ✅ SQLite CMS (zero external database)
- ✅ Pages, Media, Forms, Jobs management
- ✅ User roles with 2FA authentication
- ✅ Theme customization & SEO editor

### Integrations
- ✅ **Google Analytics 4** - Real-time metrics
- ✅ **Hotjar** - Heatmaps & session recordings
- ✅ **Cloudflare** - CDN + Turnstile bot protection
- ✅ **Ahrefs** - SEO analysis integration

### DevOps
- ✅ Automated daily backups
- ✅ Telegram cloud storage integration
- ✅ One-click disaster recovery
- ✅ 14-day retention policy
- ✅ PM2 process management

---

## 📂 Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── admin/          # Admin dashboard
│   ├── api/            # API endpoints
│   └── (public)/       # Public pages
├── components/         # UI components
├── lib/                # Utilities & DB
└── styles/             # Global styles

cms-data/              # Database & backups
public/                # Static assets
docs/                  # Documentation
```

**[→ Full architecture details](./docs/TECHNICAL.md)**

---

## 🔧 Admin Panel

Access at `https://yourdomain.com/admin/login`

**First‑time setup**: there is no shipped default password. On a fresh install the middleware redirects unauthenticated `/admin/*` traffic to `/admin/setup`, where you pick the admin email + password and enroll a TOTP authenticator. The setup endpoint refuses to run once an `admin` user already exists in `cms-data/users.json` — so it can't be used to re‑elevate after install.

### Features
| Feature | URL |
|---------|-----|
| Dashboard | `/admin/dashboard` |
| Analytics | `/admin/analytics` |
| Cloudflare | `/admin/cloudflare` |
| Pages | `/admin/pages` |
| Media | `/admin/media` |
| Forms | `/admin/forms` |
| Jobs | `/admin/jobs` |
| Users | `/admin/users` |
| Backups | `/admin/backups` |
| Settings | `/admin/settings` |

---

## 💾 Backup & Recovery

### Automated Backups
- Daily at 2:00 AM UTC
- 14-day local retention
- Optional Telegram cloud backup
- Full site snapshots (DB + files)

### Quick Restore
```bash
unzip backup.zip -d restored
cd restored && npm install && npm run build && npm start
```

**⚠️ CRITICAL**: Always use `.env.local` from backup (contains NEXTAUTH_SECRET)

**[→ Complete backup guide](./docs/BACKUP_RECOVERY.md)**

---

## 📊 Build Stats

| Metric | Value |
|--------|-------|
| **Routes** | 77 (15 static, 62 dynamic) |
| **Build Time** | ~3-4 seconds |
| **Database** | 92 KB (SQLite) |
| **Page Load** | <500ms (with CDN) |

---

## 🚀 Deployment Options

### Vercel (Recommended)
```bash
git push origin main
# Visit https://vercel.com/new → Import → Deploy
```

### PM2 on VPS
```bash
npm install -g pm2
npm run build
pm2 start ecosystem.config.js
pm2 startup && pm2 save
```

### Docker
```bash
docker build -t rhcsolutions .
docker run -p 3001:3001 --env-file .env.local rhcsolutions
```

**[→ Detailed deployment guide](./docs/DEPLOYMENT.md)**

---

## 🔒 Security

- **NextAuth.js** JWT sessions
- **2FA** TOTP authentication, forced on first admin login
- **Password hashing** with bcrypt
- **Role-based access** (Admin, Editor, Jobs Manager)
- **XSS prevention** via input sanitization (DOMPurify in CMS block renderer)
- **Secure headers** (CSP without `unsafe-eval`, X‑Frame‑Options, Permissions‑Policy, HSTS) set in [middleware.ts](./middleware.ts) and re‑applied in [next.config.mjs](./next.config.mjs) so `/_next/image` paths aren't bypassed
- **Auth gating discipline**: middleware covers `/admin/*` and `/api/cms/*`; every `/api/admin/*` handler enforces `getToken` + role inline. Whitelisted public `/api/cms/*` endpoints guard mutating verbs in‑body. See [CLAUDE.md → Security & auth](./CLAUDE.md#security--auth).
- **Audit history**: see [docs/SECURITY_REMEDIATION.md](./docs/SECURITY_REMEDIATION.md) for the 2026‑05‑13 pen‑test and 2026‑05‑11 committed‑secret remediation.

### File permissions (shared‑host deployment)

On the PM2 host, secrets and CMS data must not be world‑readable. The site runs as user `rhcsolutions_com`; SFTP/admin access uses user `rhcsolutions`. Both share group `rhcsolutions`. After a deploy where `git`/`npm install` reset modes, restore with:

```bash
chmod 660 .env.local cms-data/*.json cms-data/cms.db*
chmod 770 cms-data cms-data/backups
chmod 2775 public/uploads     # setgid keeps admin uploads in the rhcsolutions group
find . -type d -not -path './node_modules/*' -not -path './.next/*' -not -path './.git/*' -exec chmod g+w,o-w {} +
```

---

## 📚 Environment Variables

```bash
# Required
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<openssl rand -base64 32>

# Google Analytics
NEXT_PUBLIC_GA_PROPERTY_ID=123456789
GA_PRIVATE_KEY=<service-account-key>

# Cloudflare
CLOUDFLARE_API_TOKEN=<token>
NEXT_PUBLIC_CLOUDFLARE_ZONE_ID=<zone-id>

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=<app-password>

# See docs/TECHNICAL.md for complete list
```

---

## 🛠️ Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm start            # Run production
npm run lint         # ESLint check
npx tsc --noEmit     # TypeScript check
npm run format       # Format code
```

**[→ Full development guide](./docs/TECHNICAL.md)**

### Auto-sync to GitHub

A cron job on the production host (`/home/rhcsolutions_com/github-sync/auto-sync.sh`) auto-commits and pushes this repo to `master` every 30 minutes:

```
*/30 * * * * /home/rhcsolutions_com/github-sync/auto-sync.sh
```

- Any uncommitted change in the working tree gets a generic `Auto-sync: <timestamp>` commit on the next tick — stage + commit with a real message first if you want one.
- Pushes go straight to `master` (`github.com/rhcsolutions/rhcsolutions.com_2026`) — no PR workflow.
- Manual run: `/home/rhcsolutions_com/github-sync/auto-sync.sh`. Logs: `logs/github-sync.log` and `~/github-sync/cron.log`. Pause by commenting the line in `crontab -e`.

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Can't login** | Check `.env.local` has NEXTAUTH_SECRET |
| **Port in use** | `lsof -ti:3001 \| xargs kill -9` |
| **Build fails** | `rm -rf .next && npm install && npm run build` |
| **Database locked** | `pm2 restart rhcsolutions` |
| **GA shows no data** | See [docs/TROUBLESHOOTING.md → Google Analytics Shows No Data](./docs/TROUBLESHOOTING.md#google-analytics-shows-no-data) |

**[→ Full troubleshooting guide](./docs/TROUBLESHOOTING.md)**

---

## 📊 Performance

- **Turbopack** 5-10x faster builds
- **React Server Components** reduce client JS
- **SQLite WAL** concurrent read access
- **Cloudflare CDN** static asset caching
- **Image optimization** automatic WebP/AVIF; logo at ~1.8 KB
- **ISR** — public pages prerendered with `revalidate: 60`; CMS save endpoints call `revalidatePath()` for instant updates
- **Critical CSS inlining** — `scripts/inline-critical-css.mjs` runs post‑build via Beasties
- **Google Consent Mode v2** — analytics capture cookieless pings for non‑consenting visitors
- **Lazy‑loaded trackers** — Hotjar/Ahrefs/ContentSquare load after idle via `next/script` `lazyOnload`

See [docs/CHANGELOG_PERFORMANCE.md](./docs/CHANGELOG_PERFORMANCE.md) for optimization history and targets.

## 🎨 Brand

- **Theme** in [cms-data/theme.json](./cms-data/theme.json) (cyber/neon palette: `#00FF41` primary, `#00F0FF` secondary, `#00AAFF` accent).
- **Single source of truth** for tagline, founding year, value‑prop, stats, and CTA labels lives in [cms-data/settings.json](./cms-data/settings.json) under `brand`, `stats`, and `cta`. Components read from `/api/cms/settings` and the layout passes server‑rendered initial props to Header/Footer.
- **CTAs**: primary `"Book a 30‑min call"` → external Outlook bookwithme URL (`settings.bookingUrl`); secondary `"Get in touch"` → `/contact`. Don't invent new variants.
- **Icons** use `react-icons/fa` everywhere — both hand‑built pages and CMS block defaults. No emoji literals in markup.

## 🔎 SEO

- **robots.txt** is generated by [src/app/robots.ts](./src/app/robots.ts) — single source of truth. The admin SEO form no longer exposes a robots.txt textarea (it was dead code that wrote a shadowed file).
- **sitemap.xml** is generated by [src/app/sitemap.ts](./src/app/sitemap.ts) from CMS `pages.json` with filesystem fallback discovery.
- **Per‑page SEO** (`page.seo` in [cms-data/pages.json](./cms-data/pages.json)) supports `metaTitle`, `metaDescription`, `ogImage`, `keywords`, plus `noindex: true` or full `robots: {…}` for per‑page indexing control. Consumed by `buildPageMetadata()` in [src/lib/cms/page-renderer.tsx](./src/lib/cms/page-renderer.tsx). Admin form currently only exposes title/description — other fields require hand‑editing pages.json until the admin form is extended.
- **GSC verification** comes from `cms-data/seo.json.googleSearchConsoleVerification` and is server‑rendered into `<head>` (no client‑side `useEffect` injection).
- **www → apex** is normalized via 301 in [middleware.ts](./middleware.ts) as a defensive backstop; Cloudflare normally handles this at the edge.
- **Structured data** in [src/components/JsonLd.tsx](./src/components/JsonLd.tsx): Organization + WebSite emitted from root layout; BreadcrumbList emitted by `renderCmsPage`. Service / FAQPage / LocalBusiness schemas not yet implemented — see audit.
- **Audit & roadmap**: [docs/AUDIT_SEO_2026-05-18.md](./docs/AUDIT_SEO_2026-05-18.md) (deep audit + phased improvement plan; Phase 1 complete).

---

## 🔗 Quick Links

- [Live Site](https://rhcsolutions.com)
- [Admin Panel](https://rhcsolutions.com/admin/login)
- [GitHub Repo](https://github.com/rhcsolutions/rhcsolutions.com)
- [Cloudflare Dashboard](https://dash.cloudflare.com/)
- [Google Analytics](https://analytics.google.com/)
- [Documentation Index](./docs/README.md)

---

## 📄 License

Proprietary © 2026 RHC Solutions. All rights reserved.

---

**Status**: ✅ Production Ready | **Version**: 2.7 | **Updated**: May 13, 2026 (security pen‑test pass)

Made with ❤️ by RHC Solutions Team
