import { cmsDb } from '@adminpanel/lib/cms/database';

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
