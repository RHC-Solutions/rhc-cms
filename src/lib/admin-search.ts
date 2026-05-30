// Search index for admin panel
export const ADMIN_SEARCH_INDEX = [
  // Dashboard
  { id: 'dashboard', title: 'Dashboard', description: 'View dashboard overview', href: '/admin/dashboard', keywords: ['dashboard', 'overview', 'analytics', 'stats'] },
  
  // Analytics
  { id: 'analytics', title: 'Analytics', description: 'View site analytics and traffic', href: '/admin/analytics', keywords: ['analytics', 'stats', 'traffic', 'visitors', 'engagement'] },
  
  // Pages
  { id: 'pages', title: 'Pages', description: 'Manage website pages', href: '/admin/pages', keywords: ['pages', 'content', 'create', 'edit', 'delete'] },
  
  // Media
  { id: 'media', title: 'Media Library', description: 'Manage images and files', href: '/admin/media', keywords: ['media', 'images', 'files', 'upload', 'gallery'] },
  
  // Jobs
  { id: 'jobs', title: 'Jobs', description: 'Manage job postings', href: '/admin/jobs', keywords: ['jobs', 'careers', 'positions', 'postings'] },
  
  // Job Applications
  { id: 'job-applications', title: 'Job Applications', description: 'View job applications', href: '/admin/job-applications', keywords: ['applications', 'jobs', 'candidates', 'resumes'] },
  
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
  
  // Backups
  { id: 'backups', title: 'Backups', description: 'Manage database backups', href: '/admin/backups', keywords: ['backups', 'restore', 'database', 'recovery'] },
  
  // Settings
  { id: 'settings', title: 'General Settings', description: 'Configure general site settings', href: '/admin/settings', keywords: ['settings', 'configuration', 'general', 'site', 'domain'] },
  
  // Security
  { id: 'security', title: 'Security - Blocked IPs', description: 'Manage blocked IP addresses', href: '/admin/security', keywords: ['security', 'blocked', 'ips', 'brute force', 'protection'] },
  
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
