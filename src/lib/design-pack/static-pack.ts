import * as fs from 'fs';
import * as path from 'path';
import { cmsDb } from '@adminpanel/lib/cms/database';
import { revalidateAllPublic } from '@adminpanel/lib/revalidate';
import { slugToId, freeId, interpolate } from './apply';
import type { DesignTokens } from './types';

const SHARED = process.env.SHARED_ROOT || process.cwd();
const UPLOADS_DIR = path.join(SHARED, 'public', 'uploads');

export interface StaticImportResult {
  ok: boolean;
  type: 'static';
  packSlug: string;
  pages: { created: number; updated: number; slugs: string[] };
  assets: number;
  navItems: number;
  warnings: string[];
}

function slugify(s: string): string {
  return String(s).toLowerCase().replace(/\.zip$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'site';
}

// A static pack has NO pack.json (that's the CMS-block format) but DOES have .html files.
export function isStaticPack(dir: string): boolean {
  if (fs.existsSync(path.join(dir, 'pack.json'))) return false;
  try {
    return fs.readdirSync(dir).some((f) => f.toLowerCase().endsWith('.html'));
  } catch {
    return false;
  }
}

// index.html -> '/', big-data.html -> '/big-data'
function fileToSlug(file: string): string {
  const base = path.basename(file).replace(/\.html$/i, '');
  return base.toLowerCase() === 'index' ? '/' : `/${base}`;
}
function htmlNameToSlug(name: string): string {
  const base = name.replace(/\.html$/i, '');
  return base.toLowerCase() === 'index' ? '/' : `/${base}`;
}

// Rewrite a page's HTML for serving from this site:
//  - assets/x  -> /uploads/pack-<slug>/x   (same-origin, served by Next + cached)
//  - foo.html  -> /foo  (clean route; index.html -> /), preserving #anchors
function rewriteHtml(html: string, packSlug: string): string {
  let out = html;
  // asset references in href/src attributes
  out = out.replace(/(href|src)=(["'])assets\//gi, `$1=$2/uploads/pack-${packSlug}/`);
  // CSS url(assets/...) just in case
  out = out.replace(/url\((['"]?)assets\//gi, `url($1/uploads/pack-${packSlug}/`);
  // internal .html links -> clean routes (keep optional #anchor)
  out = out.replace(
    /(href=)(["'])([A-Za-z0-9._\/-]+?)\.html((?:#[^"']*)?)\2/gi,
    (_m, pre, q, name, anchor) => `${pre}${q}${htmlNameToSlug(name)}${anchor}${q}`,
  );
  return out;
}

function extractBetween(html: string, re: RegExp): string {
  const m = html.match(re);
  return m ? m[1].trim() : '';
}

// Best-effort: pull the top nav links into a CMS navigation array (links rewritten).
function extractNavigation(html: string, packSlug: string): Array<Record<string, unknown>> {
  const navBlock = extractBetween(html, /<nav[^>]*class=["'][^"']*nav-links[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i)
    || extractBetween(html, /<nav[^>]*>([\s\S]*?)<\/nav>/i);
  if (!navBlock) return [];
  const items: Array<Record<string, unknown>> = [{ id: '1', label: 'Home', url: '/', visible: true, order: 1 }];
  const linkRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  let order = 2;
  while ((m = linkRe.exec(navBlock)) !== null) {
    const attrs = m[1];
    const label = m[2].replace(/<[^>]+>/g, '').trim();
    const hrefM = attrs.match(/href=["']([^"']+)["']/i);
    if (!label || !hrefM) continue;
    let url = hrefM[1];
    const isExternal = /^https?:\/\//i.test(url);
    if (!isExternal) {
      const htmlM = url.match(/^([A-Za-z0-9._\/-]+?)\.html(#.*)?$/i);
      if (htmlM) url = htmlNameToSlug(htmlM[1]) + (htmlM[2] || '');
    }
    items.push({ id: String(order), label, url, visible: true, order, external: isExternal || undefined });
    order++;
  }
  return items;
}

/**
 * Ingest a finished static HTML site (no pack.json) as managed CMS pages. Each
 * .html becomes a page holding one `staticpage` block with the full, path-rewritten
 * HTML; assets are copied to public/uploads/pack-<slug>/ and served same-origin.
 * Pages are served verbatim (see serve.ts), so the pack's own CSS/JS/interactivity
 * runs natively. Writes go through cmsDb (the SQLite->Postgres seam).
 */
export async function importStaticPack(
  dir: string,
  opts: { tokens?: DesignTokens; packName?: string } = {},
): Promise<StaticImportResult> {
  const tokens = opts.tokens || {};
  const warnings: string[] = [];
  const packSlug = slugify(opts.packName || tokens.siteName || 'site');

  const htmlFiles = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.html'));
  if (!htmlFiles.length) throw new Error('Static pack contains no .html files.');

  // 1. Copy assets/ -> public/uploads/pack-<slug>/ (recursive).
  let assetCount = 0;
  const assetsSrc = path.join(dir, 'assets');
  if (fs.existsSync(assetsSrc) && fs.statSync(assetsSrc).isDirectory()) {
    const destRoot = path.join(UPLOADS_DIR, `pack-${packSlug}`);
    const copyDir = (src: string, dest: string) => {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(s, d);
        else if (entry.isFile()) { fs.copyFileSync(s, d); assetCount++; }
      }
    };
    copyDir(assetsSrc, destRoot);
  }

  // 2. Derive the site nav from the first page (nav is shared across pages).
  const firstHtml = fs.readFileSync(path.join(dir, htmlFiles[0]), 'utf-8');
  const navigation = extractNavigation(firstHtml, packSlug);
  if (navigation.length > 1) {
    const current = await cmsDb.getSettings();
    await cmsDb.updateSettings({ ...current, navigation });
  } else {
    warnings.push('Could not derive a navigation menu from the pack.');
  }

  // 3. Upsert each page as a staticpage block.
  const result = { created: 0, updated: 0, slugs: [] as string[] };
  for (const file of htmlFiles) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    const slug = fileToSlug(file);
    const title = extractBetween(raw, /<title[^>]*>([\s\S]*?)<\/title>/i) || path.basename(file, '.html');
    const metaDesc = extractBetween(raw, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i);
    const dataTopic = extractBetween(raw, /<body[^>]*data-topic=["']([^"']*)["']/i);
    const html = interpolate(rewriteHtml(raw, packSlug), tokens);

    const page = {
      id: slugToId(slug),
      title: interpolate(title, tokens),
      slug,
      description: interpolate(metaDesc, tokens),
      category: 'main',
      status: 'published' as const,
      showInFooter: false,
      blocks: [{ id: '1', type: 'staticpage', order: 1, props: { html, dataTopic, packSlug, slug } }],
      seo: { metaTitle: interpolate(title, tokens), metaDescription: interpolate(metaDesc, tokens) },
    };

    const existing = await cmsDb.getPage(slug);
    if (existing) {
      const { id: _id, ...updates } = page;
      await cmsDb.updatePage(existing.id, updates as any);
      result.updated++;
    } else {
      page.id = await freeId(page.id);
      await cmsDb.createPage(page as any);
      result.created++;
    }
    result.slugs.push(slug);
  }

  revalidateAllPublic();

  return {
    ok: true,
    type: 'static',
    packSlug,
    pages: result,
    assets: assetCount,
    navItems: Math.max(0, navigation.length),
    warnings,
  };
}
