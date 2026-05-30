# 🔧 Technical Documentation

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 16 + Turbopack
- **Frontend**: React 19 + TypeScript 5.7
- **Styling**: Tailwind CSS 3.4
- **Database**: SQLite with WAL mode
- **Authentication**: NextAuth.js with JWT
- **Animations**: Framer Motion
- **Maps**: Leaflet.js
- **CDN**: Cloudflare
- **Analytics**: GA4, Hotjar, Ahrefs
- **Hosting**: Vercel or PM2/VPS

### Build Stats
- **Routes**: 77 total (15 static, 62 dynamic)
- **Build Time**: 3-4 seconds
- **Database Size**: 92 KB
- **Dependencies**: 605 packages
- **Vulnerabilities**: 0

### Performance
- **Page Load**: <500ms (with CDN)
- **API Response**: 50-200ms
- **Database Queries**: <5ms (local)
- **Time to Interactive**: <1.5s
- **LCP**: ~4.5s | **FCP**: ~3.5s | **CLS**: <0.1

---

## Project Structure

```
src/
├── app/                          # Next.js 16 App Router
│   ├── admin/                   # Admin dashboard
│   │   ├── dashboard/           # Main dashboard
│   │   ├── analytics/           # GA4 integration
│   │   ├── backups/             # Backup management
│   │   ├── cloudflare/          # Cloudflare dashboard
│   │   ├── jobs/                # Job management
│   │   ├── pages/               # Page editor
│   │   ├── users/               # User management
│   │   ├── settings/            # Site settings
│   │   └── layout.tsx           # Admin layout
│   ├── api/                     # API routes
│   │   ├── admin/               # Admin endpoints
│   │   ├── cms/                 # Content endpoints
│   │   ├── auth/                # Authentication
│   │   ├── contact              # Contact form
│   │   └── webhooks             # External webhooks
│   ├── (public)/                # Public pages
│   │   ├── page.tsx             # Homepage
│   │   ├── about-us/
│   │   ├── services/
│   │   ├── careers/
│   │   ├── contact/
│   │   └── privacy/
│   ├── layout.tsx               # Root layout
│   ├── middleware.ts            # Auth & routing
│   └── globals.css              # Global styles
├── components/
│   ├── admin/                   # Admin UI
│   ├── client/                  # Public pages
│   └── common/                  # Reusable
├── lib/
│   ├── auth/                    # NextAuth config
│   ├── db/                      # Database layer
│   ├── utils/                   # Utilities
│   └── api/                     # API helpers
├── styles/                      # CSS modules
└── types/                       # TypeScript types

cms-data/
├── cms.db                       # SQLite database
├── cms.db-shm                   # WAL shared memory
├── cms.db-wal                   # Write-ahead log
├── backups/                     # Local backups
├── pages.json.backup*           # Version backups
└── settings.json                # CMS settings

public/
├── uploads/                     # User uploads
├── robots.txt
├── sitemap.xml
└── static assets

scripts/                         # Utility scripts
├── test-backup-restore.ts
├── test-database.ts
├── check-database.ts
└── ... (other utilities)
```

---

## Database Schema

### SQLite Database (`cms.db`)

#### Pages Table
```sql
CREATE TABLE pages (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT,
  metaDescription TEXT,
  metaKeywords TEXT,
  ogImage TEXT,
  canonicalUrl TEXT,
  published BOOLEAN DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### Media Table
```sql
CREATE TABLE media (
  id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  mimeType TEXT,
  size INTEGER,
  width INTEGER,
  height INTEGER,
  uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'editor',
  twoFactorSecret TEXT,
  twoFactorEnabled BOOLEAN DEFAULT 0,
  lastLogin DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### Forms Table
```sql
CREATE TABLE forms (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  subject TEXT,
  submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### Settings Table
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  type TEXT,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### Jobs Table
```sql
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  department TEXT,
  location TEXT,
  posted DATETIME,
  published BOOLEAN DEFAULT 1
)
```

#### Backups Table
```sql
CREATE TABLE backups (
  id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  size INTEGER,
  fileCount INTEGER,
  createdAt DATETIME,
  uploadedTo TEXT,
  verified BOOLEAN,
  backupDate DATETIME
)
```

---

## Environment Configuration

### Required Variables
```bash
# Authentication
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<secure-random-32-chars>

# Database (auto-generated)
DATABASE_PATH=./cms-data/cms.db
```

### Google Analytics 4
```bash
NEXT_PUBLIC_GA_PROPERTY_ID=123456789
NEXT_PUBLIC_GA_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GA_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
NEXT_PUBLIC_GA_KEY_ID=key-id
NEXT_PUBLIC_GA_PROJECT_ID=project-id
```

### Cloudflare
```bash
CLOUDFLARE_API_TOKEN=<your-token>
NEXT_PUBLIC_CLOUDFLARE_ZONE_ID=<zone-id>
CLOUDFLARE_ACCOUNT_ID=<account-id>
NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=<site-key>
CLOUDFLARE_TURNSTILE_SECRET_KEY=<secret-key>
```

### Email (SMTP)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
CONTACT_EMAIL=contact@yourdomain.com
```

### Analytics
```bash
NEXT_PUBLIC_HOTJAR_SITE_ID=1234567
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=<key>
RECAPTCHA_SECRET_KEY=<secret>
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX        # GA4 measurement ID (fallback if CMS empty)
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX       # Alias accepted by GoogleAnalytics component
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
```

> CMS values in `cms-data/seo.json` (`googleAnalytics4Id`, `googleTagManagerId`) take precedence over env vars. The env vars are fallbacks only.

---

## Analytics & Tracking Architecture

### Google Analytics 4 — Consent Mode v2

[`src/components/GoogleAnalytics.tsx`](../src/components/GoogleAnalytics.tsx) implements [Google Consent Mode v2](https://developers.google.com/tag-platform/security/guides/consent):

- `gtag.js` is loaded immediately when a GA4 ID is present (no opt‑in gate on script load).
- Default consent is `denied` for `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`. No cookies are written until consent is granted.
- The GA4 ID is passed in **server‑side** from `layout.tsx` (`<GoogleAnalytics ga4Id={seoSettings?.googleAnalytics4Id} />`) to avoid a client `/api/cms/seo` round‑trip.
- Consent state is read from `localStorage.cookieConsent` (set by the CookieConsent banner). When the banner is accepted/declined it dispatches a `cookieConsentChanged` window event; GA listens for it and calls `gtag('consent', 'update', …)` immediately.
- `navigator.doNotTrack === '1'` forces consent to remain denied.

This means GA reports cookieless pings (consent‑mode) for non‑consenting visitors and full hits for consenting visitors — Realtime should always show traffic.

### Third‑Party Script Loading

All trackers load via `next/script` with explicit strategies (set in [`src/app/layout.tsx`](../src/app/layout.tsx)):

| Script | Strategy | Loaded when |
|---|---|---|
| GA4 (`gtag.js`) | `afterInteractive` | GA4 ID present |
| Google Tag Manager | `afterInteractive` | GTM ID present |
| Ahrefs Analytics | `lazyOnload` | Ahrefs data key present |
| Hotjar | `lazyOnload` | Hotjar site ID present |
| ContentSquare | `lazyOnload` | Script URL present |

Preconnect hints are conditional — the browser only opens connections to domains that will actually be used.

### Cookie Consent

[`src/components/CookieConsent.tsx`](../src/components/CookieConsent.tsx) stores selections in `localStorage.cookieConsent` as a JSON array of category IDs (e.g. `["necessary","analytics"]`). Every accept/decline path calls `persistConsent()` which:

1. Writes to `localStorage`.
2. Dispatches `window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: ids }))`.

Any component that needs to react to consent changes can listen for this event — no page reload required.


### Telegram Backups
```bash
TELEGRAM_BOT_TOKEN=<token>
TELEGRAM_CHAT_ID=-123456789
```

---

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/signin` - Login
- `POST /api/auth/signout` - Logout
- `POST /api/auth/callback/credentials` - Credentials auth
- `GET /api/auth/session` - Current session
- `POST /api/auth/2fa/setup` - Enable 2FA
- `POST /api/auth/2fa/verify` - Verify 2FA code

### Content (`/api/cms`)
- `GET /api/cms/pages` - List pages
- `GET /api/cms/pages/[slug]` - Get page
- `POST /api/cms/pages` - Create page
- `PUT /api/cms/pages/[id]` - Update page
- `DELETE /api/cms/pages/[id]` - Delete page
- `GET /api/cms/media` - List media
- `POST /api/cms/media` - Upload media
- `GET /api/cms/settings` - Get settings
- `PUT /api/cms/settings` - Update settings

### Admin (`/api/admin`)
- `GET /api/admin/users` - List users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/[id]` - Update user
- `DELETE /api/admin/users/[id]` - Delete user
- `GET /api/admin/analytics` - Analytics data
- `POST /api/admin/analytics/test` - Test GA4 connection
- `GET /api/admin/cloudflare` - Cloudflare data
- `POST /api/admin/backups` - Create backup
- `GET /api/admin/backups` - List backups

### Contact (`/api/contact`)
- `POST /api/contact` - Submit contact form (with Turnstile verification)

---

## Performance Optimization

### Turbopack Configuration
- 5-10x faster builds than Webpack
- Incremental builds
- Instant HMR (Hot Module Reload)
- Zero config

### Image Optimization
```javascript
// next.config.mjs
images: {
  formats: ['image/avif', 'image/webp'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 31536000,  // 1 year
}
```

### React Server Components (RSC)
- Reduces client-side JavaScript
- Server-side rendering for data fetching
- Better Core Web Vitals
- Improved SEO

### Resource Hints
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="dns-prefetch" href="https://www.google-analytics.com" />
```

### Dynamic Imports
```typescript
const AdminPanel = dynamic(() => import('@/components/admin/Panel'), {
  loading: () => <LoadingSpinner />,
})
```

---

## Security

### Authentication Flow
1. User submits credentials
2. Password hashed with bcrypt (rounds=10)
3. JWT token generated
4. Token stored in secure HTTP-only cookie
5. Middleware verifies token on protected routes

### 2FA Implementation
- TOTP (Time-based One-Time Password)
- QR code generation with `qrcode` library
- Recovery codes stored hashed
- Configurable time window (30 seconds)

### CSRF Protection
- Automatic CSRF tokens on forms
- Verified server-side
- Integrated with NextAuth.js

### Input Sanitization
- Server-side validation
- XSS prevention with React auto-escaping
- HTML sanitization for rich text

### Secure Headers
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

### SQLite Security
- Parameterized queries prevent SQL injection
- Database file not accessible from web
- Regular backups with integrity checks

---

## Development Commands

```bash
# Development
npm run dev              # Start dev server (port 3000)

# Production Build
npm run build            # Build for production
npm start                # Run production server

# Code Quality
npm run lint             # ESLint check
npx tsc --noEmit         # TypeScript check (strict)
npm run format           # Format with Prettier

# Database
sqlite3 cms.db           # Open database shell

# Testing
npm run test             # Run tests (if configured)
npm run test:e2e         # End-to-end tests

# Scripts
npx tsx scripts/migrate-to-sqlite.ts         # Migrate from JSON
npx tsx scripts/test-backup-restore.ts       # Test backups
npx tsx scripts/check-database.ts            # DB integrity check
```

---

## Deployment Best Practices

### Pre-deployment Checklist
- [ ] All env vars configured
- [ ] Database initialized
- [ ] Backups enabled
- [ ] HTTPS/SSL configured
- [ ] Analytics set up
- [ ] Admin credentials changed
- [ ] Performance tested

### Production Monitoring
```bash
# Check process status
pm2 status

# Monitor in real-time
pm2 monit

# View logs
pm2 logs rhcsolutions --lines 100

# Check memory usage
free -h

# Check disk space
df -h
```

### Scaling Considerations
- SQLite suitable for ~100K users
- For larger scale, migrate to PostgreSQL
- Use CDN for static assets (Cloudflare)
- Implement caching headers
- Monitor database performance

---

## Troubleshooting

### Build Issues
```bash
# Clear cache
rm -rf .next node_modules/.cache

# Reinstall dependencies
npm install

# Rebuild
npm run build
```

### Database Issues
```bash
# Check integrity
sqlite3 cms.db "PRAGMA integrity_check;"

# View schema
sqlite3 cms.db ".schema"

# Backup database
cp cms.db cms.db.backup

# Restore from backup
cp cms.db.backup cms.db
```

### Performance Issues
```bash
# Check build size
npm run build -- --debug

# Analyze bundle
npx next-bundle-analyzer

# Monitor server resources
pm2 monit
top
```

---

## References

- [Next.js Docs](https://nextjs.org/docs)
- [NextAuth.js](https://next-auth.js.org/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [React Server Components](https://react.dev/reference/rsc/use-server)
- [Turbopack](https://turbo.build/pack)
- [TypeScript 5.7](https://www.typescriptlang.org/)

---

**Last Updated**: January 9, 2026
