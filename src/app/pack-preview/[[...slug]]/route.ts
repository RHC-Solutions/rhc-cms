import { NextRequest } from 'next/server';
import { getStaticPageHtml } from '@adminpanel/lib/design-pack/serve';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Serves an ingested static-pack page verbatim, so the design renders exactly as
// authored (its own head/nav/footer + CSS/JS run natively). This is the panel-side
// preview/serving route; a host scaffolds the same at its root (Phase 2). Public —
// adminAuthGate ignores non-/admin, non-/api/cms paths.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await ctx.params;
  const rest = Array.isArray(slug) ? slug.join('/') : '';
  const html = await getStaticPageHtml(`/${rest}`);
  if (html == null) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
