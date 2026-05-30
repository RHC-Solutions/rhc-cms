import Database from 'better-sqlite3';
import path from 'path';
import { cache } from '@adminpanel/lib/cache';

const dbPath = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'cms.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Content Block Types
export interface ContentBlock {
  id: string;
  type: 'hero' | 'features' | 'services' | 'stats' | 'cta' | 'text' | 'heading' | 'benefits' | 'process' | 'pricing' | 'testimonials' | 'faq' | 'team' | 'clients' | 'contact_cta' | 'image' | 'spacer' | 'paragraph' | 'cards' | 'columns' | 'testimonial' | 'list' | 'button' | 'worldmap' | 'contactform' | 'servicescarousel' | 'aboutpreview' | 'testimonialscarousel' | 'clientsteaser' | 'ctasection' | 'richtext';
  props: Record<string, any>;
  order: number;
}

// CMS Page Interface
export interface CMSPage {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  status: 'draft' | 'published' | 'archived';
  showInFooter?: boolean;
  blocks: ContentBlock[];
  seo?: {
    title?: string;
    description?: string;
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    ogImage?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Media Item Interface
export interface MediaItem {
  id: string;
  filename: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
}

// Site Settings Interface
export interface SiteSettings {
  siteName: string;
  siteDescription: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  socialMedia: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  };
  analytics?: {
    googleAnalyticsId?: string;
    googleTagManagerId?: string;
  };
}

// Initialize database tables
function initDatabase() {
  // Create pages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      category TEXT,
      status TEXT DEFAULT 'draft',
      showInFooter INTEGER DEFAULT 0,
      blocks TEXT,
      seo TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
    CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status);
    CREATE INDEX IF NOT EXISTS idx_pages_category ON pages(category);
    CREATE INDEX IF NOT EXISTS idx_pages_updated ON pages(updatedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_pages_status_category ON pages(status, category);
  `);

  // Create media table
  db.exec(`
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      url TEXT NOT NULL,
      size INTEGER,
      type TEXT,
      uploadedAt TEXT NOT NULL
    )
  `);

  // Create indexes for media table
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_media_uploaded ON media(uploadedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);
  `);

  // Create settings table (key-value store)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Seed default data if tables are empty
  seedDefaultData();
}

function seedDefaultData() {
  const pageCount = db.prepare('SELECT COUNT(*) as count FROM pages').get() as { count: number };
  
  if (pageCount.count === 0) {
    const now = new Date().toISOString();
    
    // Default home page
    const homeBlocks: ContentBlock[] = [
      {
        id: '1',
        type: 'hero',
        order: 1,
        props: {
          title: 'Welcome to RHC Solutions',
          subtitle: 'Innovative IT Solutions for Your Business',
          description: 'We provide cutting-edge technology solutions to help your business thrive in the digital age.',
          ctaText: 'Get Started',
          ctaLink: '/contact',
          backgroundImage: '/images/hero-bg.jpg'
        }
      }
    ];

    const insertPage = db.prepare(`
      INSERT INTO pages (id, title, slug, description, category, status, blocks, seo, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPage.run(
      'home',
      'Home',
      '/',
      'Welcome to RHC Solutions',
      'main',
      'published',
      JSON.stringify(homeBlocks),
      JSON.stringify({
        title: 'RHC Solutions - Innovative IT Solutions',
        description: 'Professional IT services and consulting',
        keywords: ['IT solutions', 'technology', 'consulting']
      }),
      now,
      now
    );

    // Create default service pages
    const servicePages = [
      { id: 'it-consulting', title: 'IT Consulting', slug: '/services/it-consulting', category: 'services' },
      { id: 'professional-services', title: 'Professional Services', slug: '/services/professional-services', category: 'services' },
      { id: 'cio-as-a-service', title: 'CIO as a Service', slug: '/services/cio-as-a-service', category: 'services' },
      { id: 'ciso-as-a-service', title: 'CISO as a Service', slug: '/services/ciso-as-a-service', category: 'services' },
      { id: 'cloud-infrastructure', title: 'Cloud Infrastructure', slug: '/services/cloud-infrastructure', category: 'services' },
      { id: 'cyber-security', title: 'Cyber Security', slug: '/services/cyber-security', category: 'services' },
      { id: 'virtual-office', title: 'Virtual Office', slug: '/services/virtual-office', category: 'services' },
      { id: 'business-continuity', title: 'Business Continuity', slug: '/services/business-continuity', category: 'services' },
      { id: 'about', title: 'About Us', slug: '/about-us', category: 'main' },
      { id: 'contact', title: 'Contact', slug: '/contact', category: 'main' },
      { id: 'careers', title: 'Careers', slug: '/careers', category: 'main' }
    ];

    for (const page of servicePages) {
      const defaultBlocks: ContentBlock[] = [
        {
          id: '1',
          type: 'heading',
          order: 1,
          props: {
            text: page.title,
            level: 1,
            align: 'center'
          }
        },
        {
          id: '2',
          type: 'text',
          order: 2,
          props: {
            content: `Welcome to ${page.title}. This page is currently being set up.`
          }
        }
      ];

      insertPage.run(
        page.id,
        page.title,
        page.slug,
        page.title,
        page.category,
        'published',
        JSON.stringify(defaultBlocks),
        JSON.stringify({
          title: page.title,
          description: page.title
        }),
        now,
        now
      );
    }
  }

  // Seed default settings if empty
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
  
  if (settingsCount.count === 0) {
    const defaultSettings: SiteSettings = {
      siteName: 'RHC Solutions',
      siteDescription: 'Professional IT Solutions and Consulting',
      contactEmail: 'info@rhcsolutions.com',
      contactPhone: '+1 (555) 123-4567',
      address: '123 Business St, Suite 100, City, State 12345',
      socialMedia: {
        facebook: '',
        twitter: '',
        linkedin: '',
        instagram: ''
      },
      analytics: {
        googleAnalyticsId: '',
        googleTagManagerId: ''
      }
    };

    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('siteSettings', JSON.stringify(defaultSettings));
  }
}

// Initialize on module load
initDatabase();

// Transform blocks to normalize content/styles into props format
function normalizeBlocks(blocks: any[]): ContentBlock[] {
  return blocks.map((block, index) => {
    // If block already has props, normalize legacy nested content/styles first
    if (block.props && typeof block.props === 'object') {
      const normalizedProps: Record<string, any> = { ...block.props };

      if (block.props.content != null) {
        if (typeof block.props.content === 'object') {
          Object.assign(normalizedProps, block.props.content);
        } else if (normalizedProps.text == null) {
          normalizedProps.text = block.props.content;
        }
      }

      if (block.props.styles && typeof block.props.styles === 'object') {
        Object.assign(normalizedProps, block.props.styles);
      }

      return {
        id: block.id || String(index),
        type: block.type,
        props: normalizedProps,
        order: block.order ?? index
      };
    }
    
    // Transform content + styles into props
    const props: Record<string, any> = {};
    
    // Merge content into props
    if (block.content && typeof block.content === 'object') {
      Object.assign(props, block.content);
    } else if (block.content) {
      // For simple content like heading text
      props.text = block.content;
    }
    
    // Merge styles into props
    if (block.styles && typeof block.styles === 'object') {
      Object.assign(props, block.styles);
    }
    
    return {
      id: block.id || String(index),
      type: block.type,
      props,
      order: block.order ?? index
    };
  });
}

// CMS Database Class
export class CMSDatabase {
  // Page Methods
  async getPages(filters?: { status?: string; category?: string; limit?: number }): Promise<CMSPage[]> {
    let query = 'SELECT * FROM pages';
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters?.category) {
      conditions.push('category = ?');
      params.push(filters.category);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY updatedAt DESC';

    // Add limit to prevent accidentally loading too many records
    // Use parameterized query to prevent SQL injection
    const limit = Math.min(Math.max(1, filters?.limit ?? 100), 1000); // Clamp between 1 and 1000
    query += ' LIMIT ?';
    params.push(limit);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      category: row.category,
      status: row.status,
      showInFooter: row.showInFooter === 1,
      blocks: normalizeBlocks(JSON.parse(row.blocks || '[]')),
      seo: JSON.parse(row.seo || '{}'),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
  }

  async getPage(slugOrId: string): Promise<CMSPage | null> {
    // Cache individual pages for 2 minutes
    const cacheKey = `cms:page:${slugOrId}`;
    const cached = cache.get<CMSPage>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const stmt = db.prepare('SELECT * FROM pages WHERE slug = ? OR id = ? LIMIT 1');
    const row = stmt.get(slugOrId, slugOrId) as any;

    if (!row) return null;

    const page: CMSPage = {
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      category: row.category,
      status: row.status,
      showInFooter: row.showInFooter === 1,
      blocks: normalizeBlocks(JSON.parse(row.blocks || '[]')),
      seo: JSON.parse(row.seo || '{}'),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };

    // Cache for 2 minutes
    cache.set(cacheKey, page, 2 * 60 * 1000);

    return page;
  }

  async createPage(page: Omit<CMSPage, 'createdAt' | 'updatedAt'>): Promise<CMSPage> {
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO pages (id, title, slug, description, category, status, showInFooter, blocks, seo, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      page.id,
      page.title,
      page.slug,
      page.description,
      page.category,
      page.status,
      page.showInFooter ? 1 : 0,
      JSON.stringify(page.blocks),
      JSON.stringify(page.seo || {}),
      now,
      now
    );

    return {
      ...page,
      createdAt: now,
      updatedAt: now
    };
  }

  async updatePage(id: string, updates: Partial<Omit<CMSPage, 'id' | 'createdAt'>>): Promise<CMSPage | null> {
    const existing = await this.getPage(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updatedPage = { ...existing, ...updates, updatedAt: now };

    const stmt = db.prepare(`
      UPDATE pages 
      SET title = ?, slug = ?, description = ?, category = ?, status = ?, showInFooter = ?, blocks = ?, seo = ?, updatedAt = ?
      WHERE id = ?
    `);

    stmt.run(
      updatedPage.title,
      updatedPage.slug,
      updatedPage.description,
      updatedPage.category,
      updatedPage.status,
      updatedPage.showInFooter ? 1 : 0,
      JSON.stringify(updatedPage.blocks),
      JSON.stringify(updatedPage.seo || {}),
      now,
      id
    );

    // Invalidate caches after update
    cache.delete(`cms:page:${id}`);
    cache.delete(`cms:page:${existing.slug}`);
    if (updatedPage.slug !== existing.slug) {
      cache.delete(`cms:page:${updatedPage.slug}`);
    }

    return updatedPage;
  }

  async deletePage(id: string): Promise<boolean> {
    const existing = await this.getPage(id);
    
    const stmt = db.prepare('DELETE FROM pages WHERE id = ?');
    const result = stmt.run(id);
    
    // Invalidate caches after deletion
    if (existing) {
      cache.delete(`cms:page:${id}`);
      cache.delete(`cms:page:${existing.slug}`);
    }
    
    return result.changes > 0;
  }

  // Media Methods
  async getMedia(limit?: number): Promise<MediaItem[]> {
    // Clamp limit between 1 and 1000, default to 1000
    const maxLimit = Math.min(Math.max(1, limit ?? 1000), 1000);
    const stmt = db.prepare('SELECT * FROM media ORDER BY uploadedAt DESC LIMIT ?');
    const rows = stmt.all(maxLimit) as any[];
    return rows;
  }

  async addMedia(media: MediaItem): Promise<MediaItem> {
    const stmt = db.prepare(`
      INSERT INTO media (id, filename, url, size, type, uploadedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      media.id,
      media.filename,
      media.url,
      media.size,
      media.type,
      media.uploadedAt
    );

    return media;
  }

  async deleteMedia(id: string): Promise<boolean> {
    const stmt = db.prepare('DELETE FROM media WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Settings Methods with caching
  async getSettings(): Promise<any> {
    // Try to get from cache first (5 minute TTL)
    const cached = cache.get('cms:settings');
    if (cached !== null) {
      return cached;
    }

    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get('siteSettings') as { value: string } | undefined;

    let settings;
    if (!row) {
      // Return default settings with navigation
      settings = this.getDefaultSettings();
    } else {
      settings = JSON.parse(row.value);
      
      // Ensure navigation is included - if not, add default
      if (!settings.navigation) {
        settings.navigation = this.getDefaultNavigation();
      }
    }

    // Cache the result for 5 minutes
    cache.set('cms:settings', settings, 5 * 60 * 1000);
    
    return settings;
  }

  private getDefaultSettings(): any {
    return {
      siteName: 'RHC Solutions',
      siteDescription: 'Professional IT Solutions and Consulting',
      contactEmail: 'info@rhcsolutions.com',
      contactPhone: '+1 (555) 123-4567',
      address: '123 Business St, Suite 100, City, State 12345',
      socialMedia: {},
      analytics: {},
      navigation: this.getDefaultNavigation()
    };
  }

  private getDefaultNavigation(): any[] {
    return [
      { id: '1', label: 'Home', url: '/', visible: true, order: 1 },
      { id: '2', label: 'About', url: '/about-us', visible: true, order: 2 },
      {
        id: '3',
        label: 'Services',
        url: '/services',
        visible: true,
        order: 3,
        children: [
          { id: '3-1', label: 'IT Consulting', url: '/services/it-consulting', visible: true, order: 1 },
          { id: '3-2', label: 'Professional Services', url: '/services/professional-services', visible: true, order: 2 },
          { id: '3-3', label: 'CIO as a Service', url: '/services/cio-as-a-service', visible: true, order: 3 },
          { id: '3-4', label: 'CISO as a Service', url: '/services/ciso-as-a-service', visible: true, order: 4 },
          { id: '3-5', label: 'Cloud Infrastructure', url: '/services/cloud-infrastructure', visible: true, order: 5 },
          { id: '3-6', label: 'Cyber Security', url: '/services/cyber-security', visible: true, order: 6 },
          { id: '3-7', label: 'Virtual Office', url: '/services/virtual-office', visible: true, order: 7 },
          { id: '3-8', label: 'Business Continuity', url: '/services/business-continuity', visible: true, order: 8 }
        ]
      },
      { id: '4', label: 'Careers', url: '/careers', visible: true, order: 4 },
      { id: '5', label: 'Contact', url: '/contact', visible: true, order: 5 }
    ];
  }

  async updateSettings(settings: Partial<SiteSettings>): Promise<SiteSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };

    const stmt = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    stmt.run('siteSettings', JSON.stringify(updated));
    
    // Invalidate cache after update
    cache.delete('cms:settings');
    
    return updated;
  }
}

// Export singleton instance
export const cmsDb = new CMSDatabase();
