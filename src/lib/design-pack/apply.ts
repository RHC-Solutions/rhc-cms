import * as fs from 'fs';
import * as path from 'path';
import { cmsDb } from '@adminpanel/lib/cms/database';
import { revalidateAllPublic } from '@adminpanel/lib/revalidate';
import { createBackupZip, ensureBackupsDir, getSiteSlug } from '@adminpanel/lib/backup';
import {
  PACK_FORMAT,
  DESIGN_SETTINGS_KEYS,
  FORBIDDEN_PACK_FILES,
  type ApplyResult,
  type DesignTokens,
  type PackManifest,
  type PackPage,
} from './types';

const SHARED = process.env.SHARED_ROOT || process.cwd();
const DATA_DIR = path.join(SHARED, 'cms-data');
const UPLOADS_DIR = path.join(SHARED, 'public', 'uploads');
const MEDIA_INDEX = path.join(DATA_DIR, 'media-index.json');

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

// Recursive merge of plain objects; arrays and scalars from `patch` replace base.
export function deepMerge<T = any>(base: any, patch: any): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

// Replace {{token}} placeholders with wizard-supplied values, recursively.
export function interpolate<T>(value: T, tokens: DesignTokens): T {
  if (typeof value === 'string') {
    return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) =>
      tokens[key] != null ? String(tokens[key]) : m,
    ) as unknown as T;
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, tokens)) as unknown as T;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = interpolate(v, tokens);
    return out as unknown as T;
  }
  return value;
}

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf',
};
function guessMime(file: string): string {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

// Derive a stable page id from a slug ('/', '/about-us', '/services/x' -> 'home', 'about-us', 'services-x').
export function slugToId(slug: string): string {
  const id = slug.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
  return id || 'home';
}

// Find an id not already taken by a DIFFERENT page. getPage() matches id OR slug,
// so a non-null hit here means the preferred id collides (e.g. seed data already
// uses it under another slug) — bump a suffix until free.
export async function freeId(preferred: string): Promise<string> {
  const base = preferred || 'page';
  let candidate = base;
  let n = 1;
  while (await cmsDb.getPage(candidate)) candidate = `${base}-${++n}`;
  return candidate;
}

/**
 * Apply a design pack (already extracted to `packDir`) into this site.
 * Writes theme/typography/cookies as filesystem JSON and pages/settings via the
 * cmsDb data layer (the future Postgres seam) — never raw SQLite — then revalidates.
 */
export async function applyDesignPack(
  packDir: string,
  opts: { tokens?: DesignTokens; backup?: boolean } = {},
): Promise<ApplyResult> {
  const tokens = opts.tokens || {};
  const warnings: string[] = [];

  // 1. Validate manifest.
  const manifestPath = path.join(packDir, 'pack.json');
  if (!fs.existsSync(manifestPath)) throw new Error('pack.json not found in design pack.');
  const manifest = readJson<PackManifest | null>(manifestPath, null);
  if (!manifest || typeof manifest.packFormat !== 'number') throw new Error('Invalid pack.json.');
  if (manifest.packFormat > PACK_FORMAT) {
    throw new Error(`Pack format ${manifest.packFormat} is newer than this panel supports (${PACK_FORMAT}). Update the panel.`);
  }

  // 2. Forbidden-content guard (defense-in-depth alongside extract()).
  for (const f of FORBIDDEN_PACK_FILES) {
    if (fs.existsSync(path.join(packDir, f))) throw new Error(`Pack contains a forbidden file: ${f}`);
  }

  const applied: ApplyResult['applied'] = {
    theme: false, typography: false, cookies: false, settings: false,
    menu: false, footer: false, pages: { created: 0, updated: 0 }, assets: { copied: 0, skipped: 0 },
  };

  // 3. Auto-backup first (safety net for rollback).
  let backupPath: string | null = null;
  if (opts.backup !== false) {
    try {
      ensureBackupsDir();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      backupPath = path.join(DATA_DIR, 'backups', `pre-pack-${getSiteSlug()}-${stamp}.zip`);
      const ok = await createBackupZip(backupPath);
      if (!ok) warnings.push('Pre-apply backup may be incomplete.');
    } catch (e) {
      warnings.push(`Pre-apply backup failed: ${(e as Error).message}`);
      backupPath = null;
    }
  }

  // 4. Theme — deep-merge per the theme route's section semantics.
  const themeFile = path.join(packDir, 'theme.json');
  if (fs.existsSync(themeFile)) {
    const incoming = interpolate(readJson<any>(themeFile, {}), tokens);
    const existing = readJson<any>(path.join(DATA_DIR, 'theme.json'), {});
    writeJson(path.join(DATA_DIR, 'theme.json'), {
      ...existing, ...incoming,
      colors: { ...(existing.colors || {}), ...(incoming.colors || {}) },
      fonts: { ...(existing.fonts || {}), ...(incoming.fonts || {}) },
      sizes: { ...(existing.sizes || {}), ...(incoming.sizes || {}) },
      branding: { ...(existing.branding || {}), ...(incoming.branding || {}) },
      updatedAt: new Date().toISOString(),
      updatedBy: 'design-pack',
    });
    applied.theme = true;
  }

  // 5. Typography — overwrite.
  const typoFile = path.join(packDir, 'typography.json');
  if (fs.existsSync(typoFile)) {
    writeJson(path.join(DATA_DIR, 'typography.json'), interpolate(readJson<any>(typoFile, {}), tokens));
    applied.typography = true;
  }

  // 6. Cookie consent — overwrite.
  const cookiesFile = path.join(packDir, 'cookies.json');
  if (fs.existsSync(cookiesFile)) {
    writeJson(path.join(DATA_DIR, 'cookies.json'), interpolate(readJson<any>(cookiesFile, {}), tokens));
    applied.cookies = true;
  }

  // 7. Settings (design subset only) + menu + footer, via the data layer.
  const designSettingsRaw = fs.existsSync(path.join(packDir, 'settings.design.json'))
    ? interpolate(readJson<any>(path.join(packDir, 'settings.design.json'), {}), tokens) : null;
  const menu = fs.existsSync(path.join(packDir, 'menu.json'))
    ? interpolate(readJson<any>(path.join(packDir, 'menu.json'), {}), tokens) : null;
  const footer = fs.existsSync(path.join(packDir, 'footer.json'))
    ? interpolate(readJson<any>(path.join(packDir, 'footer.json'), {}), tokens) : null;

  if (designSettingsRaw || menu || footer) {
    const current = await cmsDb.getSettings();
    let next: Record<string, any> = { ...current };

    if (designSettingsRaw) {
      // Whitelist: only design keys survive; identity keys are dropped even if present.
      const dropped = Object.keys(designSettingsRaw).filter((k) => !DESIGN_SETTINGS_KEYS.includes(k));
      if (dropped.length) warnings.push(`Ignored non-design settings keys from pack: ${dropped.join(', ')}`);
      const designOnly: Record<string, any> = {};
      for (const k of DESIGN_SETTINGS_KEYS) if (k in designSettingsRaw) designOnly[k] = designSettingsRaw[k];
      next = deepMerge(next, designOnly);
      applied.settings = true;
    }

    if (menu) {
      next.navigation = Array.isArray(menu) ? menu : (menu.navigation ?? menu);
      applied.menu = true;
    }

    if (footer) {
      if (Array.isArray(footer)) {
        next.customFooter = footer;
      } else {
        if (footer.customFooter) next.customFooter = footer.customFooter;
        if (footer.socialLinks) next.footer = deepMerge(next.footer || {}, { socialLinks: footer.socialLinks });
        if (footer.footer) next.footer = deepMerge(next.footer || {}, footer.footer);
      }
      applied.footer = true;
    }

    // cmsDb.updateSettings shallow-spreads onto current; passing the fully-merged
    // object means our deep merges win and untouched keys survive.
    await cmsDb.updateSettings(next);
  }

  // 8. Pages — upsert by slug (create new, update existing).
  const pagesDir = path.join(packDir, 'pages');
  if (fs.existsSync(pagesDir) && fs.statSync(pagesDir).isDirectory()) {
    for (const f of fs.readdirSync(pagesDir).filter((n) => n.endsWith('.json'))) {
      const raw = interpolate(readJson<PackPage | null>(path.join(pagesDir, f), null), tokens);
      if (!raw || !raw.slug || !raw.title) { warnings.push(`Skipped invalid page file: pages/${f}`); continue; }
      const page = {
        id: raw.id || slugToId(raw.slug),
        title: raw.title,
        slug: raw.slug,
        description: raw.description || '',
        category: raw.category || 'main',
        status: raw.status || 'published',
        showInFooter: raw.showInFooter ?? false,
        blocks: Array.isArray(raw.blocks) ? raw.blocks : [],
        seo: raw.seo || {},
      };
      const existing = await cmsDb.getPage(page.slug);
      if (existing) {
        const { id: _id, ...updates } = page;
        await cmsDb.updatePage(existing.id, updates as any);
        applied.pages.updated++;
      } else {
        page.id = await freeId(page.id);
        await cmsDb.createPage(page as any);
        applied.pages.created++;
      }
    }
  }

  // 9. Assets -> public/uploads (copy if absent) + media-index entry.
  const assetsDir = path.join(packDir, 'assets', 'uploads');
  if (fs.existsSync(assetsDir) && fs.statSync(assetsDir).isDirectory()) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const index = readJson<any[]>(MEDIA_INDEX, []);
    const known = new Set(index.map((m) => m?.filename));
    for (const name of fs.readdirSync(assetsDir)) {
      const src = path.join(assetsDir, name);
      if (!fs.statSync(src).isFile()) continue;
      const dest = path.join(UPLOADS_DIR, name);
      if (fs.existsSync(dest)) {
        applied.assets.skipped++;
      } else {
        fs.copyFileSync(src, dest);
        applied.assets.copied++;
      }
      if (!known.has(name)) {
        index.push({
          id: `${Date.now()}-${name}`,
          filename: name,
          originalName: name,
          mimeType: guessMime(name),
          size: fs.statSync(dest).size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'design-pack',
          path: `/uploads/${name}`,
          url: `/uploads/${name}`,
        });
        known.add(name);
      }
    }
    writeJson(MEDIA_INDEX, index);
  }

  // 10. Regenerate the public site.
  revalidateAllPublic();

  return { ok: true, packName: manifest.name, applied, backupPath, warnings };
}
