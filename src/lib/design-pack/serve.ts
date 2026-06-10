import * as fs from 'fs';
import * as path from 'path';
import { cmsDb } from '@adminpanel/lib/cms/database';

const SEO_FILE = path.join(process.env.SHARED_ROOT || process.cwd(), 'cms-data', 'seo.json');

// Build the GA4 snippet with Consent Mode v2 *denied* defaults — matching the panel's
// GoogleAnalytics component. Static pages are served outside React (no consent-upgrade
// UI), so consent stays denied: cookieless pings only, privacy-safe.
function ga4Snippet(id: string): string {
  return `<!-- analytics injected by admin-panel (static pack) -->
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',wait_for_update:500});</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>gtag('js',new Date());gtag('config','${id}',{anonymize_ip:true});</script>
`;
}

// Opt-in (seo.json.injectAnalyticsIntoStaticPages). Injects before </head> only when
// enabled AND a syntactically-safe GA4 id is configured (guards script-context injection).
function maybeInjectAnalytics(html: string): string {
  try {
    const seo = JSON.parse(fs.readFileSync(SEO_FILE, 'utf-8'));
    const id = seo?.googleAnalytics4Id;
    if (!seo?.injectAnalyticsIntoStaticPages || typeof id !== 'string' || !/^[A-Za-z0-9-]+$/.test(id)) return html;
    const m = html.search(/<\/head>/i);
    return m === -1 ? html : html.slice(0, m) + ga4Snippet(id) + html.slice(m);
  } catch {
    return html;
  }
}

// Return the verbatim HTML for a static-pack page, or null if the slug isn't a
// static page. Used by the serving/preview route handlers to emit the page exactly
// as Claude Design authored it (its own head/nav/footer/CSS/JS run natively).
export async function getStaticPageHtml(slug: string): Promise<string | null> {
  const normalized = !slug || slug === '/' ? '/' : `/${String(slug).replace(/^\/+/, '')}`;
  const page = await cmsDb.getPage(normalized);
  if (!page) return null;
  const block = (page.blocks || []).find((b: any) => b.type === 'staticpage');
  const html = block?.props?.html;
  return typeof html === 'string' && html.length > 0 ? html : null;
}

// Build the HTTP Response for a static-pack page (verbatim HTML), or a 404 when the
// slug isn't a static page. Shared by the panel preview route and the host catch-all
// route scaffolded by install-into-site.mjs, so both serve identically.
export async function staticPageResponse(slug: string): Promise<Response> {
  const html = await getStaticPageHtml(slug);
  if (html == null) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  return new Response(maybeInjectAnalytics(html), {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// Normalize an optional-catch-all `slug` segment array into a leading-slash path.
export function slugFromSegments(slug: string[] | undefined): string {
  return `/${Array.isArray(slug) ? slug.join('/') : ''}`;
}
