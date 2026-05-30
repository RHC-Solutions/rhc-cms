# GitHub Copilot Instructions for RHC Solutions Website

## Project Overview

This is a production-ready Next.js 16 enterprise website with an integrated SQLite CMS, automated backups, Cloudflare CDN integration, Google Analytics, Hotjar analytics, and a comprehensive admin dashboard. The project uses modern React Server Components (RSC), TypeScript strict mode, and a cyberpunk-themed design system.

## Technology Stack

- **Framework**: Next.js 16.1 with App Router and Turbopack
- **React**: 19.2 with React Server Components (RSC)
- **TypeScript**: 5.7 (strict mode enabled)
- **Database**: SQLite with better-sqlite3 (WAL mode)
- **Styling**: Tailwind CSS 4.1 with custom cyberpunk theme
- **Authentication**: NextAuth.js v4 with JWT sessions, 2FA/TOTP support
- **Animations**: Framer Motion
- **Maps**: Leaflet.js and react-leaflet
- **Analytics**: Google Analytics 4, Google Tag Manager, Hotjar
- **Security**: Cloudflare Turnstile, bcrypt password hashing
- **Email**: Nodemailer for SMTP
- **Deployment**: PM2 process manager (see ecosystem.config.js)

## Build, Test, and Lint Commands

```bash
# Development
npm run dev          # Start dev server on port 3003

# Production
npm run build        # Build for production (required before start)
npm start            # Start production server on port 3001

# Code Quality
npm run lint         # Run Next.js ESLint
npx tsc --noEmit     # TypeScript type checking (strict mode)
```

**IMPORTANT**: Always run `npm run build` before `npm start`. The `.next/` directory is NOT in version control.

## Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── (public)/            # Public pages (no auth required)
│   ├── admin/               # Admin dashboard (auth required)
│   ├── api/                 # API routes
│   │   ├── admin/          # Admin API endpoints
│   │   ├── auth/           # NextAuth endpoints
│   │   ├── cms/            # CMS content API
│   │   └── contact/        # Contact form endpoint
│   ├── layout.tsx          # Root layout with providers
│   └── globals.css         # Global styles and CSS variables
├── components/
│   ├── admin/              # Admin UI components
│   ├── auth/               # Authentication components
│   ├── home/               # Homepage components
│   ├── layout/             # Layout components (Header, Footer)
│   └── *.tsx               # Shared components
├── lib/
│   ├── auth/               # Authentication utilities
│   ├── cloudflare/         # Cloudflare API integration
│   ├── cms/                # CMS database and utilities
│   │   └── database.ts    # SQLite database interface
│   ├── backup.ts           # Backup system
│   └── timezones.ts        # Timezone utilities
cms-data/
├── cms.db                   # SQLite database (WAL mode)
├── backups/                 # Automated backup storage
public/
├── uploads/                 # User-uploaded media
scripts/                     # Utility scripts
```

## Coding Standards and Conventions

### TypeScript

- **Always use TypeScript** for all new files (.ts, .tsx)
- **Strict mode is enabled** - no implicit any, null checks required
- **Use interfaces** over types for object definitions
- **Export interfaces** for reusable types
- **Use explicit return types** for functions when helpful for clarity

### React and Next.js

- **Prefer React Server Components (RSC)** - Use "use client" directive only when necessary (hooks, browser APIs, event handlers)
- **Use async Server Components** for data fetching when possible
- **File-based routing** via App Router (src/app/)
- **API Routes** should be in src/app/api/
- **Use next/link** for internal navigation
- **Use next/image** for images (with unoptimized: true in config)

### Database

- **SQLite with better-sqlite3** is the primary database
- **WAL mode** is enabled for concurrent access
- **Database location**: `cms-data/cms.db`
- **Database interface**: Use `src/lib/cms/database.ts` for all CMS operations
- **Always use prepared statements** to prevent SQL injection
- **Transaction support** available for multi-step operations

### Authentication

- **NextAuth.js** handles all authentication
- **JWT sessions** with secure httpOnly cookies
- **Password hashing** uses bcrypt with salt rounds
- **2FA/TOTP** support via qrcode library
- **Role-based access** (Admin, Editor, Jobs Manager)
- **Protected routes** via middleware.ts
- **Check auth** using `src/lib/auth/check.ts`

### Styling

- **Tailwind CSS** for all styling (no CSS modules)
- **Cyberpunk theme** with custom color palette in globals.css
- **Responsive design** - mobile-first approach
- **Dark theme** by default
- **Use CSS variables** for theme colors (--primary, --secondary, etc.)
- **Framer Motion** for animations - use sparingly for better performance

### API Routes

- **RESTful conventions** for API endpoints
- **Use HTTP methods** appropriately (GET, POST, PUT, DELETE)
- **Return JSON** with proper status codes
- **Error handling** - always catch and return meaningful errors
- **Authentication** - check user session for protected endpoints
- **Use NextResponse** from 'next/server' for responses

### Error Handling

- **Always wrap async operations** in try-catch blocks
- **Log errors** to console in development
- **Return user-friendly error messages** in API responses
- **Use proper HTTP status codes** (400, 401, 403, 404, 500)

### Component Patterns

- **Small, focused components** - single responsibility
- **Props interface** - define explicitly for all components
- **Use destructuring** for props
- **Default exports** for page components, named exports for utilities
- **Client components** - mark with "use client" only when needed

### Code Organization

- **Group by feature** rather than file type when possible
- **Co-locate** related files (components with their specific hooks/utils)
- **Index files** not required - use explicit imports
- **Absolute imports** using `@/` prefix (configured in tsconfig.json)

## Security Best Practices

- **Never commit** `.env.local` or sensitive credentials
- **Use environment variables** for all secrets
- **Validate user input** on both client and server
- **Sanitize HTML** when rendering user content
- **Use CSRF tokens** for state-changing operations
- **Rate limiting** on sensitive endpoints
- **SQL injection prevention** - always use parameterized queries
- **XSS prevention** - React handles this by default, but be careful with dangerouslySetInnerHTML

## Environment Variables

Required environment variables (see `.env.local.example`):

```bash
# Required
NEXTAUTH_SECRET=<generate-with: openssl rand -base64 32>
NEXTAUTH_URL=https://yourdomain.com

# Optional - Analytics
NEXT_PUBLIC_GA_ID=<google-analytics-id>
NEXT_PUBLIC_HOTJAR_SITE_ID=<hotjar-site-id>

# Optional - Cloudflare
CLOUDFLARE_API_TOKEN=<api-token>
NEXT_PUBLIC_CLOUDFLARE_ZONE_ID=<zone-id>
CLOUDFLARE_TURNSTILE_SECRET_KEY=<secret>

# Optional - Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=<email>
SMTP_PASS=<app-password>

# Optional - Telegram (for backups)
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_CHAT_ID=<chat-id>
```

## Common Patterns

### Database Queries

```typescript
import Database from 'better-sqlite3';

// Read operation
const stmt = db.prepare('SELECT * FROM pages WHERE slug = ?');
const page = stmt.get(slug);

// Write operation
const stmt = db.prepare('INSERT INTO pages (title, slug) VALUES (?, ?)');
stmt.run(title, slug);

// Multiple operations with transaction
const transaction = db.transaction(() => {
  stmt1.run(data1);
  stmt2.run(data2);
});
transaction();
```

### API Route Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Business logic here
    const data = await fetchData();
    
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Server Component Pattern

```typescript
// No "use client" directive needed
export default async function Page() {
  // Fetch data directly in the component
  const data = await fetchData();
  
  return (
    <div>
      <h1>{data.title}</h1>
    </div>
  );
}
```

### Client Component Pattern

```typescript
'use client';

import { useState, useEffect } from 'react';

export default function ClientComponent() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // Client-side data fetching or browser API usage
  }, []);
  
  return <div>Interactive content</div>;
}
```

## Testing and Quality Assurance

- **Manual testing** is the primary QA method
- **Test all API endpoints** with curl or API client
- **Test authentication flows** thoroughly
- **Test database operations** with various inputs
- **Verify responsive design** on mobile, tablet, desktop
- **Check console** for errors and warnings
- **Lighthouse scores** - aim for >90 on performance, accessibility, SEO

## Deployment

- **Production server**: PM2 process manager (see ecosystem.config.js)
- **Port**: 3001 for production, 3003 for development
- **Build required**: Always run `npm run build` before deployment
- **Database**: Ensure cms-data/ directory exists and is writable
- **Backups**: Automated daily backups to cms-data/backups/
- **CDN**: Cloudflare integration for caching and DDoS protection

## Backup System

- **Automated backups** run daily at 2:00 AM UTC
- **Retention**: 14 days automatic cleanup
- **Location**: cms-data/backups/
- **Contents**: Database, uploads, config files, source code
- **Cloud storage**: Optional Telegram integration (50MB limit)
- **Restore**: Extract ZIP, run `npm install && npm run build && npm start`

## Common Tasks

### Adding a New Page

1. Create route in `src/app/your-page/page.tsx`
2. Add metadata export for SEO
3. Use Server Components by default
4. Add to navigation via CMS admin panel

### Adding a New API Endpoint

1. Create route in `src/app/api/your-endpoint/route.ts`
2. Export HTTP method functions (GET, POST, etc.)
3. Add authentication check if needed
4. Return NextResponse with proper status codes

### Adding a New Admin Feature

1. Create admin route in `src/app/admin/your-feature/page.tsx`
2. Use client components for interactivity
3. Protect with authentication middleware
4. Add to admin navigation in AdminShell component

### Database Schema Changes

1. Add migration logic to `src/lib/cms/database.ts`
2. Test with fresh database to ensure initialization works
3. Backup existing database before applying changes
4. Update TypeScript interfaces to match new schema

## Troubleshooting

### "Could not find a production build"
- Run `npm run build` before `npm start`
- The `.next/` directory must exist

### Port Already in Use
- Kill process: `lsof -ti:3001 | xargs kill`
- Or use different port: `npm run dev -- -p 3002`

### Database Locked
- Check for stale processes: `lsof | grep cms.db`
- Restart application to reset connections

### Build Fails
- Clear cache: `rm -rf .next node_modules/.cache`
- Reinstall: `npm install`
- Check TypeScript errors: `npx tsc --noEmit`

## Performance Tips

- **Use Server Components** to reduce client JavaScript
- **Lazy load** heavy components with next/dynamic
- **Optimize images** using next/image
- **Enable caching** for static assets
- **Use Cloudflare CDN** for global distribution
- **SQLite WAL mode** for concurrent reads
- **Minimize client-side state** and prefer server data fetching

## Accessibility

- **Semantic HTML** - use proper elements (nav, main, article, etc.)
- **ARIA labels** for interactive elements
- **Keyboard navigation** - all features accessible via keyboard
- **Color contrast** - meet WCAG AA standards (already configured in theme)
- **Alt text** for all images
- **Focus indicators** visible and clear

## Documentation

- **README.md** - Main documentation with setup and deployment
- **BACKUP_SYSTEM.md** - Detailed backup procedures
- **CLOUDFLARE_README.md** - Cloudflare integration guide
- **QUICK_REFERENCE.md** - Feature reference
- **Code comments** - Use when logic is complex or non-obvious

## Additional Notes

- **Production status**: ✅ Ready - 77 routes, 0 vulnerabilities
- **Admin access**: /admin/login (default: admin@rhcsolutions.com / admin123)
- **Database size**: ~92 KB average
- **Build time**: 3-4 seconds
- **Node version**: 18+ recommended
- **License**: Proprietary - RHC Solutions
