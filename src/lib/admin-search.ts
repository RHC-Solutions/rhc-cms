// Search index for the admin panel.
//
// Keep this in step with the `navigation` array in components/admin/AdminShell.tsx:
// every reachable admin route should be listed here with the same `roles` it has in
// the nav, so search never offers a page the signed-in user would be 403'd out of.
// Pages that are reachable but deliberately absent from the sidebar (Offices, Social
// Links, Typography, MFA Setup) are indexed too — search is the only way to find them.

export type AdminSearchRole = 'admin' | 'editor' | 'jobs_manager';

export interface AdminSearchItem {
  id: string;
  title: string;
  description: string;
  href: string;
  keywords: string[];
  /** Parent area, shown as a breadcrumb in the results list. */
  section?: string;
  roles: AdminSearchRole[];
}

const ALL: AdminSearchRole[] = ['admin', 'editor', 'jobs_manager'];
const ADMIN_ONLY: AdminSearchRole[] = ['admin'];
const ADMIN_EDITOR: AdminSearchRole[] = ['admin', 'editor'];

export const ADMIN_SEARCH_INDEX: AdminSearchItem[] = [
  // ---- Overview -----------------------------------------------------------
  { id: 'dashboard', title: 'Dashboard', description: 'Overview of traffic, content and media', href: '/admin/dashboard', roles: ADMIN_EDITOR,
    keywords: ['dashboard', 'overview', 'home', 'stats', 'top pages', 'traffic sources', 'devices'] },

  // ---- Analytics ----------------------------------------------------------
  { id: 'analytics', title: 'Analytics', description: 'Google Analytics, Search Console and PageSpeed', href: '/admin/analytics', roles: ADMIN_EDITOR,
    keywords: ['analytics', 'ga4', 'google analytics', 'search console', 'gsc', 'pagespeed', 'lighthouse', 'traffic', 'visitors', 'sessions', 'bounce'] },
  { id: 'analytics-setup', title: 'Analytics Setup', description: 'Connect the GA4 property and service account', href: '/admin/analytics/setup', section: 'Analytics', roles: ADMIN_EDITOR,
    keywords: ['analytics', 'setup', 'connect', 'ga4', 'property id', 'service account', 'credentials'] },

  // ---- Content ------------------------------------------------------------
  { id: 'pages', title: 'Pages', description: 'Create and edit website pages and their blocks', href: '/admin/pages', roles: ADMIN_EDITOR,
    keywords: ['pages', 'content', 'blocks', 'create', 'edit', 'delete', 'publish', 'draft', 'slug', 'meta title', 'meta description'] },
  { id: 'landing-pages', title: 'Landing Pages', description: 'Campaign landing pages and their leads', href: '/admin/landing-pages', roles: ADMIN_EDITOR,
    keywords: ['landing pages', 'campaign', 'lp', 'marketing', 'leads', 'funnel'] },
  { id: 'media', title: 'Media Library', description: 'Upload and manage images and files', href: '/admin/media', roles: ADMIN_EDITOR,
    keywords: ['media', 'images', 'files', 'upload', 'gallery', 'assets', 'photos'] },
  { id: 'menu', title: 'Navigation Menu', description: 'Configure the site header navigation', href: '/admin/menu', roles: ADMIN_EDITOR,
    keywords: ['menu', 'navigation', 'nav', 'header', 'links', 'structure'] },
  { id: 'footer', title: 'Footer', description: 'Footer columns, contact details and social icons', href: '/admin/footer', roles: ADMIN_EDITOR,
    keywords: ['footer', 'links', 'columns', 'contact', 'social icons', 'linkedin', 'facebook', 'instagram', 'telegram'] },
  { id: 'offices', title: 'Offices', description: 'Office locations shown on the contact page', href: '/admin/offices', roles: ADMIN_EDITOR,
    keywords: ['offices', 'locations', 'address', 'branches', 'map', 'globe', 'contact'] },
  { id: 'social', title: 'Social Links', description: 'Profile URLs and messaging handles', href: '/admin/social', roles: ADMIN_EDITOR,
    keywords: ['social', 'links', 'profiles', 'linkedin', 'facebook', 'instagram', 'x', 'twitter', 'whatsapp', 'telegram', 'messaging'] },

  // ---- Jobs ---------------------------------------------------------------
  { id: 'jobs', title: 'Jobs', description: 'Manage job postings and vacancies', href: '/admin/jobs', roles: ALL,
    keywords: ['jobs', 'careers', 'positions', 'postings', 'vacancies', 'hiring', 'recruitment'] },
  { id: 'job-applications', title: 'Job Applications', description: 'Review applications and candidate CVs', href: '/admin/jobs/applications', section: 'Jobs', roles: ALL,
    keywords: ['applications', 'applicants', 'candidates', 'resumes', 'cv', 'jobs', 'hiring'] },

  // ---- Leads --------------------------------------------------------------
  { id: 'forms', title: 'Forms & Submissions', description: 'Contact form entries, Wi-Fi guests and CSV export', href: '/admin/forms', roles: ADMIN_EDITOR,
    keywords: ['forms', 'submissions', 'contact', 'messages', 'inquiries', 'leads', 'enquiries', 'csv', 'export', 'hotspot', 'wifi', 'guests'] },

  // ---- Appearance ---------------------------------------------------------
  { id: 'theme', title: 'Theme Settings', description: 'Brand colours, palette and appearance', href: '/admin/theme', roles: ADMIN_EDITOR,
    keywords: ['theme', 'colors', 'colours', 'palette', 'appearance', 'branding', 'styling', 'dark mode'] },
  { id: 'typography', title: 'Typography', description: 'Fonts, headings and text styles', href: '/admin/typography', roles: ADMIN_EDITOR,
    keywords: ['typography', 'fonts', 'text', 'heading', 'body', 'font size', 'design system'] },

  // ---- Marketing ----------------------------------------------------------
  { id: 'seo', title: 'SEO Settings', description: 'Meta defaults, verification codes, GTM, Ahrefs, IPinfo', href: '/admin/seo', roles: ADMIN_EDITOR,
    keywords: ['seo', 'meta', 'sitemap', 'robots', 'google tag manager', 'gtm', 'ahrefs', 'ipinfo', 'verification', 'search console', 'bing', 'indexnow', 'schema'] },
  { id: 'buffer', title: 'Social Autopilot', description: 'AI-generated social posts published via Buffer', href: '/admin/buffer', roles: ADMIN_ONLY,
    keywords: ['social autopilot', 'buffer', 'posts', 'scheduling', 'ai', 'linkedin', 'facebook', 'publish', 'approval', 'campaign'] },

  // ---- Users & access -----------------------------------------------------
  { id: 'users', title: 'Users', description: 'Accounts, roles and blocked IP addresses', href: '/admin/users', roles: ADMIN_ONLY,
    keywords: ['users', 'accounts', 'roles', 'permissions', 'access', 'admin', 'editor', 'password', 'blocked ips', 'brute force', 'lockout'] },
  { id: 'mfa-setup', title: 'MFA Setup', description: 'Two-factor authentication and recovery codes', href: '/admin/mfa-setup', roles: ALL,
    keywords: ['mfa', '2fa', 'two factor', 'authentication', 'totp', 'authenticator', 'recovery codes', 'security'] },

  // ---- Platform -----------------------------------------------------------
  { id: 'integrations', title: 'Integrations', description: 'API keys and credentials for third-party services', href: '/admin/integrations', roles: ADMIN_ONLY,
    keywords: ['integrations', 'api keys', 'credentials', 'secrets', 'tokens', 'telegram', 'brevo', 'smtp', 'email', 'unifi', 'turnstile', 'third party'] },
  { id: 'cloudflare', title: 'Cloudflare', description: 'DNS, caching and Cloudflare status', href: '/admin/cloudflare', roles: ADMIN_ONLY,
    keywords: ['cloudflare', 'cdn', 'dns', 'cache', 'purge', 'edge', 'waf', 'proxy'] },
  { id: 'cloudflare-setup', title: 'Cloudflare Setup', description: 'Connect the Cloudflare account and zone', href: '/admin/cloudflare/setup', section: 'Cloudflare', roles: ADMIN_ONLY,
    keywords: ['cloudflare', 'setup', 'connect', 'api token', 'zone id', 'account id', 'turnstile'] },
  { id: 'cookies', title: 'Cookie Settings', description: 'Cookie consent banner and tracking categories', href: '/admin/cookies', roles: ADMIN_EDITOR,
    keywords: ['cookies', 'consent', 'privacy', 'gdpr', 'tracking', 'banner'] },
  { id: 'backups', title: 'Backups', description: 'Database and content backups, restore points', href: '/admin/backups', roles: ADMIN_ONLY,
    keywords: ['backups', 'restore', 'database', 'recovery', 'snapshot', 'download', 'cms.db'] },
  { id: 'automation', title: 'Automation', description: 'Scheduled audits, dependency updates and auto-fixes', href: '/admin/automation', roles: ADMIN_ONLY,
    keywords: ['automation', 'cron', 'scheduled', 'audit', 'dependencies', 'updates', 'auto fix', 'jobs', 'tasks'] },
  { id: 'ooda', title: 'OODA Console', description: 'Self-healing health loop, security scans and maintenance', href: '/admin/ooda', roles: ADMIN_ONLY,
    keywords: ['ooda', 'health', 'monitoring', 'uptime', 'self healing', 'restart', 'incidents', 'alerts', 'maintenance', 'disk', 'log scan'] },
  { id: 'aikido', title: 'Security (Aikido)', description: 'Vulnerability and dependency scanning', href: '/admin/aikido', roles: ADMIN_ONLY,
    keywords: ['security', 'aikido', 'vulnerabilities', 'cve', 'scanning', 'dependencies', 'audit', 'risks'] },

  // ---- Settings -----------------------------------------------------------
  { id: 'settings', title: 'General Settings', description: 'Site identity, homepage and contact page content', href: '/admin/settings', roles: ADMIN_EDITOR,
    keywords: ['settings', 'configuration', 'general', 'site', 'domain', 'tagline', 'brand', 'homepage content', 'contact content', 'stats', 'cta', 'booking'] },
  { id: 'settings-environment', title: 'Environment', description: 'Runtime environment and configuration status', href: '/admin/settings/environment', section: 'Settings', roles: ADMIN_ONLY,
    keywords: ['environment', 'env', 'runtime', 'configuration', 'variables', 'status', 'diagnostics'] },
];

/**
 * Score one item against a single lowercase token.
 * Returns 0 when the token does not appear anywhere in the item.
 */
function scoreToken(item: AdminSearchItem, token: string): number {
  let score = 0;
  const title = item.title.toLowerCase();

  if (title === token) score += 100;
  else if (title.startsWith(token)) score += 50;
  else if (title.includes(token)) score += 30;

  if (item.description.toLowerCase().includes(token)) score += 15;
  if (item.section?.toLowerCase().includes(token)) score += 10;

  for (const keyword of item.keywords) {
    if (keyword === token) score += 40;
    else if (keyword.startsWith(token)) score += 20;
    else if (keyword.includes(token)) score += 10;
  }

  return score;
}

/**
 * Fuzzy search over the admin index.
 *
 * Multi-word queries are AND-matched token by token ("blocked ip", "cookie consent",
 * "top pages" all work) — the previous implementation compared the whole query as one
 * substring, so anything longer than a single word silently returned nothing.
 *
 * @param role when given, results the role cannot open are dropped.
 */
export function searchAdmin(query: string, role?: string | null): AdminSearchItem[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const pool = role
    ? ADMIN_SEARCH_INDEX.filter((item) => item.roles.includes(role as AdminSearchRole))
    : ADMIN_SEARCH_INDEX;

  return pool
    .map((item) => {
      let total = 0;
      for (const token of tokens) {
        const score = scoreToken(item, token);
        // Every token must hit something, otherwise "cookie zzz" would still match.
        if (score === 0) return { item, score: 0 };
        total += score;
      }
      return { item, score: total };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, 10)
    .map((r) => r.item);
}
