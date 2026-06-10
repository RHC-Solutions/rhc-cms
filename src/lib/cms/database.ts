import { cache } from '@adminpanel/lib/cache';
import { getDriver } from './db';

// Data layer. Runs on SQLite (default) or Postgres (DATABASE_URL) via the driver seam
// in ./db — the public cmsDb API is unchanged and all callers already await it.
// camelCase columns are double-quoted in SQL because Postgres folds unquoted identifiers
// to lowercase (harmless in SQLite); SELECT * then returns them with the stored case.
const driver = getDriver();

// Content Block Types
export interface ContentBlock {
  id: string;
  type: 'hero' | 'features' | 'services' | 'stats' | 'cta' | 'text' | 'heading' | 'benefits' | 'process' | 'pricing' | 'testimonials' | 'faq' | 'team' | 'clients' | 'contact_cta' | 'image' | 'spacer' | 'paragraph' | 'cards' | 'columns' | 'testimonial' | 'list' | 'button' | 'worldmap' | 'contactform' | 'servicescarousel' | 'aboutpreview' | 'testimonialscarousel' | 'clientsteaser' | 'ctasection' | 'richtext' | 'staticpage';
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
        order: block.order ?? index,
      };
    }

    // Transform content + styles into props
    const props: Record<string, any> = {};
    if (block.content && typeof block.content === 'object') {
      Object.assign(props, block.content);
    } else if (block.content) {
      props.text = block.content;
    }
    if (block.styles && typeof block.styles === 'object') {
      Object.assign(props, block.styles);
    }

    return {
      id: block.id || String(index),
      type: block.type,
      props,
      order: block.order ?? index,
    };
  });
}

function mapPageRow(row: any): CMSPage {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    category: row.category,
    status: row.status,
    showInFooter: row.showInFooter === 1 || row.showInFooter === true,
    blocks: normalizeBlocks(JSON.parse(row.blocks || '[]')),
    seo: JSON.parse(row.seo || '{}'),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const PAGE_INSERT_SQL = `
  INSERT INTO pages (id, title, slug, description, category, status, blocks, seo, "createdAt", "updatedAt")
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

// CMS Database Class — driver-backed, lazily initialized (DDL + seed run once).
export class CMSDatabase {
  private initPromise: Promise<void> | null = null;

  private ready(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.init();
    return this.initPromise;
  }

  private async init(): Promise<void> {
    await driver.exec(`
      CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        category TEXT,
        status TEXT DEFAULT 'draft',
        "showInFooter" INTEGER DEFAULT 0,
        blocks TEXT,
        seo TEXT,
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      )
    `);
    await driver.exec(`
      CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
      CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status);
      CREATE INDEX IF NOT EXISTS idx_pages_category ON pages(category);
      CREATE INDEX IF NOT EXISTS idx_pages_updated ON pages("updatedAt" DESC);
      CREATE INDEX IF NOT EXISTS idx_pages_status_category ON pages(status, category);
    `);
    await driver.exec(`
      CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        url TEXT NOT NULL,
        size INTEGER,
        type TEXT,
        "uploadedAt" TEXT NOT NULL
      )
    `);
    await driver.exec(`
      CREATE INDEX IF NOT EXISTS idx_media_uploaded ON media("uploadedAt" DESC);
      CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);
    `);
    await driver.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    await this.seedDefaultData();
  }

  private async seedDefaultData(): Promise<void> {
    const pageRow = (await driver.query<{ count: any }>('SELECT COUNT(*) as count FROM pages'))[0];
    if (Number(pageRow?.count ?? 0) === 0) {
      const now = new Date().toISOString();

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
            backgroundImage: '/images/hero-bg.jpg',
          },
        },
      ];

      await driver.run(PAGE_INSERT_SQL, [
        'home', 'Home', '/', 'Welcome to RHC Solutions', 'main', 'published',
        JSON.stringify(homeBlocks),
        JSON.stringify({
          title: 'RHC Solutions - Innovative IT Solutions',
          description: 'Professional IT services and consulting',
          keywords: ['IT solutions', 'technology', 'consulting'],
        }),
        now, now,
      ]);

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
        { id: 'careers', title: 'Careers', slug: '/careers', category: 'main' },
      ];

      for (const page of servicePages) {
        const defaultBlocks: ContentBlock[] = [
          { id: '1', type: 'heading', order: 1, props: { text: page.title, level: 1, align: 'center' } },
          { id: '2', type: 'text', order: 2, props: { content: `Welcome to ${page.title}. This page is currently being set up.` } },
        ];
        await driver.run(PAGE_INSERT_SQL, [
          page.id, page.title, page.slug, page.title, page.category, 'published',
          JSON.stringify(defaultBlocks),
          JSON.stringify({ title: page.title, description: page.title }),
          now, now,
        ]);
      }
    }

    const settingsRow = (await driver.query<{ count: any }>('SELECT COUNT(*) as count FROM settings'))[0];
    if (Number(settingsRow?.count ?? 0) === 0) {
      const defaultSettings: SiteSettings = {
        siteName: 'RHC Solutions',
        siteDescription: 'Professional IT Solutions and Consulting',
        contactEmail: 'info@rhcsolutions.com',
        contactPhone: '+1 (555) 123-4567',
        address: '123 Business St, Suite 100, City, State 12345',
        socialMedia: { facebook: '', twitter: '', linkedin: '', instagram: '' },
        analytics: { googleAnalyticsId: '', googleTagManagerId: '' },
      };
      await driver.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['siteSettings', JSON.stringify(defaultSettings)]);
    }
  }

  // Page Methods
  async getPages(filters?: { status?: string; category?: string; limit?: number }): Promise<CMSPage[]> {
    await this.ready();
    let query = 'SELECT * FROM pages';
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.status) { conditions.push('status = ?'); params.push(filters.status); }
    if (filters?.category) { conditions.push('category = ?'); params.push(filters.category); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');

    query += ' ORDER BY "updatedAt" DESC';
    const limit = Math.min(Math.max(1, filters?.limit ?? 100), 1000);
    query += ' LIMIT ?';
    params.push(limit);

    const rows = await driver.query<any>(query, params);
    return rows.map(mapPageRow);
  }

  async getPage(slugOrId: string): Promise<CMSPage | null> {
    // No in-process cache: the public renderer runs in a different module instance than
    // this admin PUT, so a cache here would survive revalidatePath() and serve stale data.
    await this.ready();
    const rows = await driver.query<any>('SELECT * FROM pages WHERE slug = ? OR id = ? LIMIT 1', [slugOrId, slugOrId]);
    return rows[0] ? mapPageRow(rows[0]) : null;
  }

  async createPage(page: Omit<CMSPage, 'createdAt' | 'updatedAt'>): Promise<CMSPage> {
    await this.ready();
    const now = new Date().toISOString();
    await driver.run(
      `INSERT INTO pages (id, title, slug, description, category, status, "showInFooter", blocks, seo, "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        page.id, page.title, page.slug, page.description, page.category, page.status,
        page.showInFooter ? 1 : 0,
        JSON.stringify(page.blocks), JSON.stringify(page.seo || {}), now, now,
      ],
    );
    return { ...page, createdAt: now, updatedAt: now };
  }

  async updatePage(id: string, updates: Partial<Omit<CMSPage, 'id' | 'createdAt'>>): Promise<CMSPage | null> {
    const existing = await this.getPage(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updatedPage = { ...existing, ...updates, updatedAt: now };

    await driver.run(
      `UPDATE pages
       SET title = ?, slug = ?, description = ?, category = ?, status = ?, "showInFooter" = ?, blocks = ?, seo = ?, "updatedAt" = ?
       WHERE id = ?`,
      [
        updatedPage.title, updatedPage.slug, updatedPage.description, updatedPage.category, updatedPage.status,
        updatedPage.showInFooter ? 1 : 0,
        JSON.stringify(updatedPage.blocks), JSON.stringify(updatedPage.seo || {}), now, id,
      ],
    );

    cache.delete(`cms:page:${id}`);
    cache.delete(`cms:page:${existing.slug}`);
    if (updatedPage.slug !== existing.slug) cache.delete(`cms:page:${updatedPage.slug}`);

    return updatedPage;
  }

  async deletePage(id: string): Promise<boolean> {
    const existing = await this.getPage(id);
    const result = await driver.run('DELETE FROM pages WHERE id = ?', [id]);
    if (existing) {
      cache.delete(`cms:page:${id}`);
      cache.delete(`cms:page:${existing.slug}`);
    }
    return result.changes > 0;
  }

  // Media Methods
  async getMedia(limit?: number): Promise<MediaItem[]> {
    await this.ready();
    const maxLimit = Math.min(Math.max(1, limit ?? 1000), 1000);
    return driver.query<MediaItem>('SELECT * FROM media ORDER BY "uploadedAt" DESC LIMIT ?', [maxLimit]);
  }

  async addMedia(media: MediaItem): Promise<MediaItem> {
    await this.ready();
    await driver.run(
      'INSERT INTO media (id, filename, url, size, type, "uploadedAt") VALUES (?, ?, ?, ?, ?, ?)',
      [media.id, media.filename, media.url, media.size, media.type, media.uploadedAt],
    );
    return media;
  }

  async deleteMedia(id: string): Promise<boolean> {
    await this.ready();
    const result = await driver.run('DELETE FROM media WHERE id = ?', [id]);
    return result.changes > 0;
  }

  // Settings Methods with caching
  async getSettings(): Promise<any> {
    const cached = cache.get('cms:settings');
    if (cached !== null) return cached;

    await this.ready();
    const rows = await driver.query<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['siteSettings']);

    let settings;
    if (!rows[0]) {
      settings = this.getDefaultSettings();
    } else {
      settings = JSON.parse(rows[0].value);
      if (!settings.navigation) settings.navigation = this.getDefaultNavigation();
    }

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
      navigation: this.getDefaultNavigation(),
    };
  }

  private getDefaultNavigation(): any[] {
    return [
      { id: '1', label: 'Home', url: '/', visible: true, order: 1 },
      { id: '2', label: 'About', url: '/about-us', visible: true, order: 2 },
      {
        id: '3', label: 'Services', url: '/services', visible: true, order: 3,
        children: [
          { id: '3-1', label: 'IT Consulting', url: '/services/it-consulting', visible: true, order: 1 },
          { id: '3-2', label: 'Professional Services', url: '/services/professional-services', visible: true, order: 2 },
          { id: '3-3', label: 'CIO as a Service', url: '/services/cio-as-a-service', visible: true, order: 3 },
          { id: '3-4', label: 'CISO as a Service', url: '/services/ciso-as-a-service', visible: true, order: 4 },
          { id: '3-5', label: 'Cloud Infrastructure', url: '/services/cloud-infrastructure', visible: true, order: 5 },
          { id: '3-6', label: 'Cyber Security', url: '/services/cyber-security', visible: true, order: 6 },
          { id: '3-7', label: 'Virtual Office', url: '/services/virtual-office', visible: true, order: 7 },
          { id: '3-8', label: 'Business Continuity', url: '/services/business-continuity', visible: true, order: 8 },
        ],
      },
      { id: '4', label: 'Careers', url: '/careers', visible: true, order: 4 },
      { id: '5', label: 'Contact', url: '/contact', visible: true, order: 5 },
    ];
  }

  async updateSettings(settings: Partial<SiteSettings>): Promise<SiteSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };

    await driver.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['siteSettings', JSON.stringify(updated)],
    );

    cache.delete('cms:settings');
    return updated;
  }
}

// Export singleton instance
export const cmsDb = new CMSDatabase();
