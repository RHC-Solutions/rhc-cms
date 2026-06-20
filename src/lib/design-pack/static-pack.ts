import * as fs from 'fs';
import * as path from 'path';
import { cmsDb } from '@adminpanel/lib/cms/database';
import type { CMSPage } from '@adminpanel/lib/cms/database';
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
  const normalized = String(s);
  const lower = normalized.toLowerCase();
  const withoutZipSuffix = lower.replace(/\.zip$/i, '');
  const dashed = withoutZipSuffix.replace(/[^a-z0-9]+/g, '-');
  const trimmed = dashed.replace(/^-+|-+$/g, '');
  return trimmed || 'site';
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

// index.html -> '/', About.html -> '/about' (lowercased so links and slugs match).
function fileToSlug(file: string): string {
  return htmlNameToSlug(path.basename(file));
}
// Normalize a relative *.html name to a clean route. Strips leading slashes (so an
// accidental match never yields '//x') and lowercases (slugs are stored lowercased).
function htmlNameToSlug(name: string): string {
  const base = name.replace(/\.html$/i, '').replace(/^\/+/, '').toLowerCase();
  return base === 'index' || base === '' ? '/' : `/${base}`;
}

// Matches relative href values that end with `.html`, preserving optional query/hash:
//   href="about.html", href='docs/page.html?x=1#top'
// Excludes data-href / xlink:href via leading negative lookbehind, and excludes values
// containing ':' so protocol-based links are not matched.
const INTERNAL_HREF_HTML_RE =
  /(?<![\w:-])(href=)(["'])([^"':?#]+?)\.html((?:\?[^"'#]*)?(?:#[^"']*)?)\2/gi;

// Rewrite a page's HTML for serving from this site:
//  - assets/x  -> /uploads/pack-<slug>/x   (any quote/paren/comma/space-prefixed ref:
//    href/src/srcset/poster/CSS url(); srcset holds comma-separated candidates)
//  - relative foo.html  -> /foo  (clean route; index.html -> /), preserving ?query#anchor.
//    Absolute (/x.html) and protocol-relative (//cdn/x.html) and external (https://…)
//    links are left untouched.
function rewriteHtml(html: string, packSlug: string): string {
  let out = html;
  // Asset references: anything that points into the pack's assets/ dir, regardless of
  // attribute (href/src/srcset/poster/data-*) or CSS url(). Preceded by a quote, paren,
  // comma (srcset), or whitespace (srcset candidates).
  out = out.replace(/(["'(,\s])assets\//gi, `$1/uploads/pack-${packSlug}/`);
  // Internal .html links -> clean routes. (?<![\w:-]) so data-href / xlink:href aren't
  // matched; the value char class excludes ':' so https:// links don't match; absolute
  // and protocol-relative links are skipped in the callback.
  out = out.replace(
    INTERNAL_HREF_HTML_RE,
    (m, pre, q, name, tail) =>
      (name.startsWith('//') || name.startsWith('/') ? m : `${pre}${q}${htmlNameToSlug(name)}${tail}${q}`),
  );
  return out;
}

function extractBetween(html: string, re: RegExp): string {
  const m = html.match(re);
  return m ? m[1].trim() : '';
}

// Match a <nav> block whose class attribute contains "nav-links".
// Captures the inner HTML so link extraction can run on that subset.
const NAV_WITH_NAV_LINKS_RE = /<nav[^>]*class=["'][^"']*nav-links[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i;

// Fallback: match any <nav> block and capture its inner HTML.
const NAV_ANY_RE = /<nav[^>]*>([\s\S]*?)<\/nav>/i;

// Best-effort: pull the top nav links into a CMS navigation array (links rewritten).
function extractNavigation(html: string): Array<Record<string, unknown>> {
  const navBlock = extractBetween(html, NAV_WITH_NAV_LINKS_RE)
    || extractBetween(html, NAV_ANY_RE);
  if (!navBlock) return [];
  const items: Array<Record<string, unknown>> = [{ id: '1', label: 'Home', url: '/', visible: true, order: 1 }];
  const linkRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  let order = 2;
  while ((m = linkRe.exec(navBlock)) !== null) {
    const attrs = m[1];
    const label = m[2].replace(/[<>]/g, '').trim();
    const hrefM = attrs.match(/href=["']([^"']+)["']/i);
    if (!label || !hrefM) continue;
    let url = hrefM[1];
    const isExternal = /^(https?:)?\/\//i.test(url); // http(s):// or protocol-relative //
    if (!isExternal) {
      const htmlM = url.match(/^([A-Za-z0-9._\/-]+?)\.html((?:\?[^#]*)?(?:#.*)?)$/i);
      if (htmlM) url = htmlNameToSlug(htmlM[1]) + (htmlM[2] || '');
    }
    items.push({ id: String(order), label, url, visible: true, order, external: isExternal });
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
  const navigation = extractNavigation(firstHtml);
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

    const page: Omit<CMSPage, 'createdAt' | 'updatedAt'> = {
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
      const { id: existingPageId, ...updates } = page; // Exclude `id`: updatePage receives the target id separately.
      await cmsDb.updatePage(existing.id, updates);
      result.updated++;
    } else {
      page.id = await freeId(page.id);
      await cmsDb.createPage(page);
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
