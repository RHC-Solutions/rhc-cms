/**
 * SEO collector. Cross-checks the CMS metadata source of truth (cms.db pages)
 * against what the live server actually renders, plus robots/sitemap health.
 * Pure data-gathering — emits seo.json for the audit agent + email to reason over.
 *
 * Run: node scripts/audit/collect-seo.mjs
 */
import { loadPages, fetchText, writeArtifact, LOCAL_BASE, log } from './_lib.mjs';

const TITLE_MIN = 30, TITLE_MAX = 60;
const DESC_MIN = 70, DESC_MAX = 160;

function tag(html, re) {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function check(html) {
  const title = tag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDesc =
    tag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    tag(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const canonical = tag(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
  const ogTitle = /<meta[^>]+property=["']og:title["']/i.test(html);
  const ogImage = /<meta[^>]+property=["']og:image["']/i.test(html);
  const twitterCard = /<meta[^>]+name=["']twitter:card["']/i.test(html);
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  return { title, metaDesc, canonical, ogTitle, ogImage, twitterCard, h1Count };
}

async function main() {
  const date = process.argv[2];
  const issues = [];
  const add = (severity, page, field, detail) => issues.push({ severity, page, field, detail });

  let pages = [];
  try {
    pages = (await loadPages()).filter((p) => p.status === 'published');
  } catch (e) {
    add('high', '(db)', 'cms.db', `Could not read pages table: ${e.message}`);
  }
  log(`SEO: ${pages.length} published pages`);

  // 1) CMS metadata source-of-truth checks
  for (const p of pages) {
    const { metaTitle, metaDescription, noindex, robots } = p.seo || {};
    const isNoindex = noindex === true || robots?.index === false;
    if (isNoindex) { add('info', p.slug, 'robots', 'Page is noindex (skipped meta-length checks)'); continue; }
    if (!metaTitle) add('high', p.slug, 'metaTitle', 'Missing metaTitle in cms.db');
    else if (metaTitle.length < TITLE_MIN || metaTitle.length > TITLE_MAX)
      add('medium', p.slug, 'metaTitle', `Title length ${metaTitle.length} (target ${TITLE_MIN}-${TITLE_MAX})`);
    if (!metaDescription) add('high', p.slug, 'metaDescription', 'Missing metaDescription in cms.db');
    else if (metaDescription.length < DESC_MIN || metaDescription.length > DESC_MAX)
      add('medium', p.slug, 'metaDescription', `Description length ${metaDescription.length} (target ${DESC_MIN}-${DESC_MAX})`);
  }

  // 2) Live-render checks against the running server
  const rendered = [];
  for (const p of pages) {
    const url = LOCAL_BASE + (p.slug === '/' ? '/' : p.slug);
    const res = await fetchText(url);
    if (!res.ok) { add('high', p.slug, 'render', `Live fetch ${url} -> ${res.status || res.error}`); continue; }
    const c = check(res.text);
    rendered.push({ slug: p.slug, ...c });
    if (!c.title) add('high', p.slug, 'title', 'No <title> in rendered HTML');
    if (!c.metaDesc) add('high', p.slug, 'metaDescription', 'No meta description in rendered HTML');
    if (!c.canonical) add('medium', p.slug, 'canonical', 'No canonical link in rendered HTML');
    if (!c.ogImage) add('low', p.slug, 'og:image', 'No og:image meta');
    if (!c.twitterCard) add('low', p.slug, 'twitter:card', 'No twitter:card meta');
    if (c.h1Count === 0) add('medium', p.slug, 'h1', 'No <h1> on page');
    else if (c.h1Count > 1) add('low', p.slug, 'h1', `${c.h1Count} <h1> tags (prefer 1)`);
  }

  // 3) robots.txt & sitemap.xml health
  const robotsRes = await fetchText(LOCAL_BASE + '/robots.txt');
  if (!robotsRes.ok) add('high', '/robots.txt', 'robots', `robots.txt -> ${robotsRes.status || robotsRes.error}`);

  const smRes = await fetchText(LOCAL_BASE + '/sitemap.xml');
  let sitemapUrls = [];
  if (!smRes.ok) {
    add('high', '/sitemap.xml', 'sitemap', `sitemap.xml -> ${smRes.status || smRes.error}`);
  } else {
    sitemapUrls = [...smRes.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (sitemapUrls.length === 0) add('high', '/sitemap.xml', 'sitemap', 'sitemap.xml has no <loc> entries');
    const publishedSlugs = new Set(pages.map((p) => (p.slug === '/' ? '' : p.slug.replace(/^\//, ''))));
    const sitemapSlugs = new Set(sitemapUrls.map((u) => new URL(u).pathname.replace(/^\/|\/$/g, '')));
    for (const s of publishedSlugs)
      if (!sitemapSlugs.has(s)) add('medium', '/' + s, 'sitemap', 'Published page missing from sitemap');
  }

  const summary = {
    pages: pages.length,
    rendered: rendered.length,
    sitemapEntries: sitemapUrls.length,
    counts: issues.reduce((a, i) => ((a[i.severity] = (a[i.severity] || 0) + 1), a), {}),
  };
  writeArtifact('seo.json', { generatedAt: new Date().toISOString(), summary, issues, rendered }, date);
  log('SEO done:', JSON.stringify(summary));
}

main().catch((e) => { log('SEO collector fatal:', e.message); process.exit(0); });
