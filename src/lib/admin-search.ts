// Search index for admin panel
export const ADMIN_SEARCH_INDEX = [
  // Dashboard
  { id: 'dashboard', title: 'Dashboard', description: 'View dashboard overview', href: '/admin/dashboard', keywords: ['dashboard', 'overview', 'analytics', 'stats'] },
  
  // Analytics
  { id: 'analytics', title: 'Analytics', description: 'View site analytics and traffic', href: '/admin/analytics', keywords: ['analytics', 'stats', 'traffic', 'visitors', 'engagement'] },
  
  // Pages
  { id: 'pages', title: 'Pages', description: 'Manage website pages', href: '/admin/pages', keywords: ['pages', 'content', 'create', 'edit', 'delete'] },
  
  // Landing Pages
  { id: 'landing-pages', title: 'Landing Pages', description: 'Manage marketing landing pages', href: '/admin/landing-pages', keywords: ['landing', 'campaigns', 'marketing', 'lead', 'pages'] },
  
  // Media
  { id: 'media', title: 'Media Library', description: 'Manage images and files', href: '/admin/media', keywords: ['media', 'images', 'files', 'upload', 'gallery'] },
  
  // Forms
  { id: 'forms', title: 'Forms', description: 'Manage contact forms and submissions', href: '/admin/forms', keywords: ['forms', 'submissions', 'contact', 'messages', 'inquiries'] },
  
  // Menu
  { id: 'menu', title: 'Navigation Menu', description: 'Configure site navigation', href: '/admin/menu', keywords: ['menu', 'navigation', 'links', 'structure'] },
  
  // Footer
  { id: 'footer', title: 'Footer', description: 'Manage footer content', href: '/admin/footer', keywords: ['footer', 'links', 'information', 'contact'] },
  
  // Theme Settings
  { id: 'theme', title: 'Theme Settings', description: 'Customize site theme colors and appearance', href: '/admin/theme', keywords: ['theme', 'colors', 'appearance', 'branding', 'typography', 'styling'] },
  
  // Users
  { id: 'users', title: 'Users', description: 'Manage user accounts and permissions', href: '/admin/users', keywords: ['users', 'accounts', 'roles', 'permissions', 'access'] },
  
  // SEO
  { id: 'seo', title: 'SEO Settings', description: 'Configure SEO, GTM, Analytics, Ahrefs, IPinfo', href: '/admin/seo', keywords: ['seo', 'google tag manager', 'gtm', 'analytics', 'ahrefs', 'ipinfo', 'robots', 'sitemap'] },
  
  // Cookies
  { id: 'cookies', title: 'Cookie Settings', description: 'Manage cookie consent and tracking', href: '/admin/cookies', keywords: ['cookies', 'consent', 'privacy', 'gdpr', 'tracking'] },
  
  // Cloudflare
  { id: 'cloudflare', title: 'Cloudflare', description: 'Cache, DNS, Turnstile, and WAF status', href: '/admin/cloudflare', keywords: ['cloudflare', 'cdn', 'cache', 'dns', 'turnstile', 'waf'] },
  
  // Integrations
  { id: 'integrations', title: 'Integrations', description: 'Connect third-party services (SMTP, Telegram, WhatsApp, Brevo)', href: '/admin/integrations', keywords: ['integrations', 'smtp', 'telegram', 'whatsapp', 'brevo', 'email', 'notifications'] },
  
  // Backups
  { id: 'backups', title: 'Backups', description: 'Manage database backups', href: '/admin/backups', keywords: ['backups', 'restore', 'database', 'recovery'] },

  // Automation
  { id: 'automation', title: 'Automation', description: 'Daily site audit + weekly dependency PRs', href: '/admin/automation', keywords: ['automation', 'audit', 'cron', 'schedule', 'dependencies', 'auto-fix', 'reports'] },

  // Settings
  { id: 'settings', title: 'General Settings', description: 'Configure general site settings', href: '/admin/settings', keywords: ['settings', 'configuration', 'general', 'site', 'domain'] },
  
  // Security (Aikido)
  { id: 'aikido', title: 'Security (Aikido)', description: 'Aikido security scanner — issues, blocked IPs, brute-force protection', href: '/admin/aikido', keywords: ['security', 'aikido', 'blocked', 'ips', 'brute force', 'protection', 'scanner', 'issues'] },

  // Audit Log
  { id: 'audit', title: 'Audit Log', description: 'Admin action history — who did what and when', href: '/admin/audit', keywords: ['audit', 'log', 'history', 'activity', 'security', 'accountability', 'trail'] },
  
  // MFA Setup
  { id: 'mfa-setup', title: 'MFA Setup', description: 'Configure two-factor authentication', href: '/admin/mfa-setup', keywords: ['mfa', '2fa', 'authentication', 'totp', 'security'] },
  
  // Typography
  { id: 'typography', title: 'Typography', description: 'Manage fonts and text styles', href: '/admin/typography', keywords: ['typography', 'fonts', 'text', 'heading', 'body'] },
];

// Fuzzy search function
export function searchAdmin(query: string) {
  if (!query.trim()) return [];
  
  const lowerQuery = query.toLowerCase();
  
  return ADMIN_SEARCH_INDEX
    .map((item) => {
      let score = 0;
      
      // Title match (highest priority)
      if (item.title.toLowerCase() === lowerQuery) score += 100;
      if (item.title.toLowerCase().startsWith(lowerQuery)) score += 50;
      if (item.title.toLowerCase().includes(lowerQuery)) score += 30;
      
      // Description match
      if (item.description.toLowerCase().includes(lowerQuery)) score += 20;
      
      // Keywords match
      for (const keyword of item.keywords) {
        if (keyword === lowerQuery) score += 40;
        if (keyword.startsWith(lowerQuery)) score += 20;
        if (keyword.includes(lowerQuery)) score += 10;
      }
      
      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
