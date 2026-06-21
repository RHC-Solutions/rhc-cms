import fs from 'fs';
import path from 'path';

// Single owner of the cms-data/seo.json path so first-run seeding and the
// /api/cms/seo route agree on location/shape (see SEO consolidation, PR6).
const SEO_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'seo.json');

export interface SeoSeedInput {
  siteName?: string;
  host?: string;
  ogImage?: string;
}

/**
 * Write cms-data/seo.json from first-run identity, but ONLY if it doesn't already
 * exist — never clobber a configured site. Without this, a freshly-provisioned site
 * opens /admin/seo showing the generic "Your Site Name … Since 1994" placeholder.
 * Returns the seeded field names (empty if a file was already present).
 */
export function seedSeoDefaults(input: SeoSeedInput): string[] {
  if (fs.existsSync(SEO_FILE)) return [];
  const name = (input.siteName || '').trim();
  const seo = {
    title: name || 'Your Site',
    metaDescription: '',
    keywords: '',
    ogTitle: name || 'Your Site',
    ogDescription: '',
    ogImage: input.ogImage || '/logo.png',
    googleTagManagerId: '',
    googleAnalytics4Id: '',
    googleSearchConsoleVerification: '',
    ahrefsId: '',
    ahrefsApiKey: '',
    ahrefsDomain: input.host || '',
    updatedAt: new Date().toISOString(),
    updatedBy: 'setup',
  };
  const dir = path.dirname(SEO_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SEO_FILE, JSON.stringify(seo, null, 2));
  return Object.keys(seo).filter((k) => k !== 'updatedAt' && k !== 'updatedBy');
}
