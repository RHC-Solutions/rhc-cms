# 📊 Changelog & Performance History

## Version 2.7.0 - May 11, 2026

### 🎨 Brand consistency (per [docs/AUDIT_BRAND_2026-05-11.md](./AUDIT_BRAND_2026-05-11.md))
- **B1**: Replaced `cms-data/theme.json` "Google Dark" (Google's literal brand colors) with the project's cyber palette (`#00FF41` primary, `#00F0FF` secondary, `#00AAFF` accent). `ThemeProvider`'s runtime overrides now match the build‑time `globals.css` defaults instead of overwriting them with Material.
- **B2**: `theme.fonts.mono` now references **JetBrains Mono** (was "Inter", which is a sans‑serif). Body/display fonts aligned to Space Grotesk across `theme.json`, `layout.tsx`, and `globals.css`.
- **B3**: Deleted the 218 KB original logo backups under `public/`. Replaced the programmatic `icon.tsx` / `apple-icon.tsx` (which rendered the text "RHC") with `src/app/icon.png` (32×32) and `src/app/apple-icon.png` (180×180) generated from the actual brand mark via `sharp`.
- **B4**: New `brand` + `stats` + `cta` objects in `cms-data/settings.json` as the single source of truth for tagline, founding year, value‑prop, stat numbers/labels, and primary/secondary CTA labels.
- **B5**: CTA labels unified to **"Book a 30‑min call"** (external) and **"Get in touch"** (internal `/contact`). 15+ variants reduced to 2.
- **B7**: Replaced all emoji literals in `BlockRenderer` (cards `🔒🛡️⚡…`, columns `📋💡⚡🎯`, testimonial `💬👤`, list `📧📞🕐📍✓`, cta `🎯`, contactform `📬`, button `🚀`) with `react-icons/fa` components. CMS pages now match the design system instead of looking like Notion docs.
- **B8**: Stripped 10 inline `style={{ fontFamily: fonts.primary }}` overrides from `ContactForm`. Form inherits site typography. Killed the unused `fonts`/`sizes` state and the `/api/cms/theme` fetch.
- **B11**: `AboutPreview` reads stats from `settings.stats` (with hardcoded fallbacks).
- **B14**: `CTASection` reads `bookingUrl` from `/api/cms/settings`.
- **B17**: Deleted orphan `src/data/pageContent.ts`.

### 🧹 Cleanup
- Deleted **18 one‑off test/diagnostic scripts** under `scripts/` (`test-*.ts`, `diagnostic-*.ts`, `check-*.ts`, `update-*.ts`, `verify-*.ts`, `add-icons-to-cards.ts`). Kept `hash-password.ts`, `cleanup-server-space.sh`, `inline-critical-css.mjs`, `migrate-to-sqlite.ts`.
- Deleted stale root docs that duplicated `/docs` content: `DEPLOYMENT_SUMMARY.txt`, `OPTIMIZATION_SUMMARY.md`, `PERFORMANCE.md`.

### 📦 Dependency bumps (within semver)
- `@tailwindcss/postcss` 4.1.18 → 4.3.0
- `@types/node` 25.0.3 → 25.6.2
- `@types/react` 19.2.7 → 19.2.14
- `autoprefixer` 10.4.23 → 10.5.0
- `better-sqlite3` 12.5.0 → 12.9.0
- `eslint` 9.39.2 → 9.39.4
- `eslint-config-next` 16.1.1 → 16.2.6
- `framer-motion` 12.23.26 → 12.38.0
- `isomorphic-dompurify` 3.9.0 → 3.12.0
- `next` 16.2.4 → 16.2.6
- `next-auth` 4.24.13 → 4.24.14
- `react` 19.2.3 → 19.2.6 (+ `react-dom`)
- `react-icons` 5.5.0 → 5.6.0
- `tailwindcss` 4.1.18 → 4.3.0
- `typescript-eslint` 8.59.0 → 8.59.2

Major bumps deferred (would break): `eslint` 10, `typescript` 6, `archiver` 8, `@types/nodemailer` 8.

---

## Version 2.6.0 - May 11, 2026

### ✨ New Features
- **Google Analytics Consent Mode v2** — `gtag.js` loads immediately with default‑denied consent; upgrades to `granted` when the CookieConsent banner is accepted. GDPR‑safe by default, no longer blocks all traffic from showing in GA. See [TECHNICAL.md → Analytics & Tracking Architecture](./TECHNICAL.md#analytics--tracking-architecture).
- **`cookieConsentChanged` event** — CookieConsent dispatches a window event when the user accepts/declines, so any component (analytics, marketing) can react instantly without a page reload.

### 🔧 Improvements
- **Logo asset**: `public/logo.png` resized from 7088×7087 (218 KB) to 512×512 (1.8 KB) — saves ~216 KB on every page load for every visitor. Original kept at `public/logo-original-backup.png`.
- **Tracker loading strategies** moved to `next/script`:
  - GTM / GA4 → `afterInteractive` (loads after hydration, off the critical path)
  - Ahrefs / Hotjar / ContentSquare → `lazyOnload` (loads after idle)
- **Preconnect hints made conditional** — only emit `<link rel="preconnect">` for trackers that are actually configured. `dns-prefetch` for non‑critical providers (was upgrading the wrong ones).
- **GA4 ID passed server‑side** — eliminates the client `/api/cms/seo` round‑trip on every page load (was firing in `GoogleAnalytics.tsx`'s `useEffect`).
- **Hero fade‑in animation** moved from `framer-motion` to CSS keyframes (`hero-fade-in` in `globals.css`) with `prefers-reduced-motion` support.

### 📦 Files Changed
- `src/components/GoogleAnalytics.tsx` — Consent Mode v2 implementation
- `src/components/CookieConsent.tsx` — dispatches `cookieConsentChanged`
- `src/app/layout.tsx` — tracker loading via `next/script`, conditional preconnects, server-passed GA4 ID
- `src/components/home/Hero.tsx` + `src/app/globals.css` — framer-motion → CSS
- `public/logo.png` — resized

### 📈 Expected PageSpeed Impact
- **LCP**: ~200 KB less per first‑load → faster on slow mobile
- **TBT**: trackers no longer compete with hydration → significant mobile improvement
- **Speed Index**: deferred third‑party scripts no longer paint‑block

---

## Version 2.5.0 - January 4, 2026

### ✨ New Features
- **Hotjar Integration** - Behavior analytics with heatmaps and session recordings
- **Ahrefs Analytics** - SEO analysis with dual installation methods (Direct & GTM)
- **Ahrefs Verification** - Website ownership verification file support

### 🔧 Improvements
- Enhanced SEO panel with Hotjar and Ahrefs tabs
- Admin configuration for all analytics tools
- Automatic tracking code injection
- Documentation consolidated to docs/ folder

### 📊 Metrics
- 77 routes total (15 static, 62 dynamic)
- Database size: 92 KB
- Build time: 3-4 seconds
- Dependencies: 605 packages
- Vulnerabilities: 0

---

## Version 2.0.0 - January 2, 2026

### 🎉 Major Updates

#### SQLite Migration
- **Migrated from JSON to SQLite database** (cms.db)
- Database size: 92 KB with 15 pages, 1 media file
- Enabled WAL mode for better concurrency
- Automatic database initialization on startup

#### Backup System
- **Automated backup system** with Telegram integration
- Full site backups (381 KB, 242 files)
- 14-day local retention policy
- One-click restore functionality
- Verified with automated test scripts

#### Documentation Overhaul
- **Consolidated documentation** from 8+ files to 3 core files (66% reduction)
- Updated README.md with comprehensive project overview
- QUICK_REFERENCE.md for detailed setup guide
- BACKUP_SYSTEM.md for backup/restore procedures

### ✨ Features Added
- **Footer Editor** - Full management of footer sections, links, and social media
- Footer API with GET/PUT endpoints for persistence
- Social links extraction and storage
- Menu builder improvements
- Enhanced dashboard analytics

### 📦 Package Updates
- Updated to **Next.js 16.1** (from 15.x)
- Updated to **React 19.2** (from 18.x)
- Updated to **TypeScript 5.7** (from 5.6)
- **26 packages updated**, 27 added, 19 removed
- **0 vulnerabilities** found

### 🐛 Fixes
- Fixed footer admin not persisting changes
- Fixed TypeScript compilation issues with scripts
- Fixed backup restore verification
- Resolved package dependency conflicts
- Fixed admin authentication edge cases

---

## Version 1.0.0 - December 30, 2025

### Initial Production Release
- Next.js 15 with React 18
- Full admin dashboard
- Google Analytics 4 integration
- Cloudflare CDN support
- Email notifications
- Form submission tracking

---

## 📈 Performance Optimization History

### Phase 1: Initial Optimization (January 4, 2026)

**PageSpeed Results (Mobile)**:
- Performance: 47/100 → 62/100 (+15 points)
- Accessibility: 92/100 ✅
- Best Practices: 96/100 ✅
- SEO: 100/100 ✅

**Core Web Vitals**:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| FCP | 5.6s | 5.2s | <1.8s |
| LCP | 7.0s | 6.7s | <2.5s |
| TBT | 550ms | 0ms | <200ms |
| CLS | 0.082 | 0.057 | <0.1 |
| SI | 6.4s | 5.8s | <3.4s |

**Optimizations Applied**:
1. Image optimization (AVIF, WebP formats)
2. JavaScript minification
3. Font preloading
4. CSS optimization
5. Dynamic imports (code-splitting)
6. Lazy loading for images
7. CSS-in-JS optimization

### Phase 3: Asset Diet & Consent Mode v2 (May 11, 2026)

**Status**: ✅ Deployed and Live

**Optimizations Applied**:
1. Resized 7088×7087 logo PNG (218 KB → 1.8 KB at 512×512)
2. Migrated all third‑party trackers to `next/script` with explicit strategies
3. Conditional preconnect hints (only for configured providers)
4. Eliminated `/api/cms/seo` client fetch from `<GoogleAnalytics>` (GA4 ID passed server-side)
5. Replaced `framer-motion` fade‑in on Hero with CSS keyframes
6. Implemented Google Consent Mode v2 (cookieless pings for non‑consenting visitors)

**Performance Gains**:
- ✅ ~216 KB transfer reduction per page (logo)
- ✅ Trackers no longer execute during hydration window (TBT)
- ✅ Browser no longer warms TCP to unused tracker domains
- ✅ One fewer client API round‑trip per page
- ✅ GA captures all traffic (cookieless pings + full hits) instead of zero

---

### Phase 2: Resource Hints & Deferred Scripts (January 5, 2026)

**Status**: ✅ Deployed and Live

**Expected Improvements**:
- Resource hints (preconnect, dns-prefetch)
- Deferred analytics scripts
- EST: 200-500ms faster per external resource
- Font loading latency reduction

**Optimizations Applied**:
1. Preconnect to Google Fonts, Analytics
2. DNS prefetch for analytics providers
3. Deferred GTM, Hotjar, Ahrefs scripts
4. Strategic script placement
5. Async/defer attributes on scripts

**Performance Gains**:
- ✅ DNS lookups in parallel
- ✅ TLS handshakes pre-completed
- ✅ Est. 200-500ms per resource saved
- ✅ Fonts load faster
- ✅ Analytics non-blocking

---

## 🎯 Performance Targets vs Actual

| Area | Target | Current | Status |
|------|--------|---------|--------|
| PageSpeed | 75+ | 62-70 | 🟡 In Progress |
| LCP | <2.5s | ~4.5s | 🟡 Good (CDN) |
| FCP | <1.8s | ~3.5s | 🟡 Acceptable |
| TBT | <200ms | 0ms | ✅ Excellent |
| CLS | <0.1 | 0.057 | ✅ Excellent |
| Build Time | <5s | 3-4s | ✅ Excellent |

---

## 📋 Optimization Checklist

### Completed ✅
- [x] Image optimization (AVIF, WebP)
- [x] JavaScript minification
- [x] Code-splitting via dynamic imports
- [x] Font preloading
- [x] Resource hints (preconnect, dns-prefetch)
- [x] Deferred analytics scripts
- [x] Lazy loading for below-fold images
- [x] CSS optimization
- [x] React Server Components (RSC)
- [x] Turbopack for fast builds

### Future Improvements 🔮
- [ ] Service Worker caching
- [ ] Edge caching rules
- [ ] Critical CSS extraction
- [ ] Image sprite optimization
- [ ] API response caching
- [ ] Database query optimization

---

## 🔄 Continuous Monitoring

### Metrics to Track
- PageSpeed Insights score (monthly)
- Core Web Vitals (real user data)
- Build time trends
- Bundle size growth
- API response times
- Database query performance

### Testing Tools
- Google PageSpeed Insights
- Google Lighthouse
- Web Vitals JS library
- Next.js Analytics
- PM2 monitoring
- SQLite query profiling

---

**Last Updated**: May 11, 2026
