import * as fs from 'fs';
import * as path from 'path';
import { ZipArchive } from 'archiver';
import { cmsDb } from '@adminpanel/lib/cms/database';
import { PACK_FORMAT, DESIGN_SETTINGS_KEYS, type PackManifest } from './types';

const SHARED = process.env.SHARED_ROOT || process.cwd();
const DATA_DIR = path.join(SHARED, 'cms-data');
const UPLOADS_DIR = path.join(SHARED, 'public', 'uploads');

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'site';
}

// Replace this site's real identity strings with {{tokens}} so the pack is reusable.
function makeTemplatizer(idents: Record<string, string | undefined>) {
  const pairs = Object.entries(idents)
    .filter(([, v]) => typeof v === 'string' && v.trim().length >= 3)
    .sort((a, b) => (b[1] as string).length - (a[1] as string).length); // longest first
  const replaceAll = (text: string) => {
    let out = text;
    for (const [token, value] of pairs) {
      out = out.split(value as string).join(`{{${token}}}`);
    }
    return out;
  };
  const walk = (v: any): any => {
    if (typeof v === 'string') return replaceAll(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) o[k] = walk(val);
      return o;
    }
    return v;
  };
  return walk;
}

// Collect /uploads/<file> references from any JSON-serializable value.
function collectAssets(...values: unknown[]): Set<string> {
  const found = new Set<string>();
  const re = /\/uploads\/([A-Za-z0-9._-]+)/g;
  const blob = values.map((v) => JSON.stringify(v ?? null)).join('\n');
  let m: RegExpExecArray | null;
  while ((m = re.exec(blob)) !== null) found.add(m[1]);
  return found;
}

export interface ExportOptions {
  name?: string;
  description?: string;
  author?: string;
  createdAt?: string;     // caller stamps the time (keeps this fn deterministic-friendly)
  templatize?: boolean;   // default true
}

/**
 * Curate the current site into a design pack (.zip Buffer). Includes
 * theme/typography/cookies, the design subset of settings, menu/footer skeletons,
 * all pages, and referenced /uploads assets. Strips secrets/users/identity.
 */
export async function exportDesignPack(opts: ExportOptions = {}): Promise<Buffer> {
  const settings = await cmsDb.getSettings();
  const pages = await cmsDb.getPages({ limit: 1000 });

  const name = opts.name || settings?.siteName || 'Design Pack';
  const templatize = opts.templatize !== false;
  const ident = {
    siteName: settings?.siteName,
    tagline: settings?.tagline || settings?.brand?.tagline,
    contactEmail: settings?.contactEmail || settings?.contact?.email,
    domain: settings?.siteUrl || settings?.domain,
  };
  const t = templatize ? makeTemplatizer(ident) : (v: any) => v;

  const theme = readJson<any>(path.join(DATA_DIR, 'theme.json'), null);
  const typography = readJson<any>(path.join(DATA_DIR, 'typography.json'), null);
  const cookies = readJson<any>(path.join(DATA_DIR, 'cookies.json'), null);

  // Design-only settings subset (drop identity entirely).
  const settingsDesign: Record<string, any> = {};
  for (const k of DESIGN_SETTINGS_KEYS) if (settings && k in settings) settingsDesign[k] = t(settings[k]);

  const menu = settings?.navigation ? { navigation: t(settings.navigation) } : null;
  const footer = (settings?.customFooter || settings?.footer?.socialLinks)
    ? { customFooter: t(settings?.customFooter) || undefined, socialLinks: settings?.footer?.socialLinks || undefined }
    : null;

  const packPages = pages.map((p) => t({
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description,
    category: p.category,
    status: p.status,
    showInFooter: p.showInFooter,
    blocks: p.blocks,
    seo: p.seo,
  }));

  const manifest: PackManifest = {
    packFormat: PACK_FORMAT,
    name,
    slug: slugify(name),
    version: '1.0.0',
    description: opts.description || `Design pack exported from ${name}`,
    author: opts.author || 'admin-panel exporter',
    createdAt: opts.createdAt,
    minPanelVersion: '1.0.0',
    contents: {
      theme: theme ? 'merge' : undefined,
      typography: typography ? 'overwrite' : undefined,
      cookies: cookies ? 'overwrite' : undefined,
      settings: Object.keys(settingsDesign).length ? 'merge-design-keys' : undefined,
      menu: menu ? 'overwrite' : undefined,
      footer: footer ? 'overwrite' : undefined,
      pages: packPages.length ? 'upsert-by-slug' : undefined,
      assets: 'copy-if-absent',
    },
    tokens: ['siteName', 'tagline', 'contactEmail', 'domain'],
  };

  const assets = collectAssets(packPages, theme);

  // Build the zip in memory.
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on('data', (c: Buffer) => chunks.push(c));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('warning', (w) => { if ((w as any).code !== 'ENOENT') reject(w); });
    archive.on('error', reject);
  });

  archive.append(JSON.stringify(manifest, null, 2), { name: 'pack.json' });
  if (theme) archive.append(JSON.stringify(theme, null, 2), { name: 'theme.json' });
  if (typography) archive.append(JSON.stringify(typography, null, 2), { name: 'typography.json' });
  if (cookies) archive.append(JSON.stringify(cookies, null, 2), { name: 'cookies.json' });
  if (Object.keys(settingsDesign).length) archive.append(JSON.stringify(settingsDesign, null, 2), { name: 'settings.design.json' });
  if (menu) archive.append(JSON.stringify(menu, null, 2), { name: 'menu.json' });
  if (footer) archive.append(JSON.stringify(footer, null, 2), { name: 'footer.json' });
  for (const p of packPages) {
    const fileSlug = slugify(p.slug || p.id || p.title);
    archive.append(JSON.stringify(p, null, 2), { name: `pages/${fileSlug}.json` });
  }
  for (const file of assets) {
    const abs = path.join(UPLOADS_DIR, file);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      archive.file(abs, { name: `assets/uploads/${file}` });
    }
  }

  await archive.finalize();
  return done;
}
