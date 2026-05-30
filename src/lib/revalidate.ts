// Standalone admin app: content is written to the shared cms-data, but the
// public site runs as a *separate* Next.js process and owns its prerendered
// cache. We can't call next/cache's revalidatePath() across processes, so we
// ping the public site's secret-protected /api/revalidate webhook instead.
//
// These keep the same names/signatures as the original in-process helpers so
// the ~25 CMS API call sites don't change. They're fire-and-forget (callers
// don't await) — the webhook is best-effort.

const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://rhcsolutions.com').replace(/\/+$/, '');
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || '';

async function ping(body: Record<string, unknown>) {
  if (!REVALIDATE_SECRET) {
    console.warn('[revalidate] REVALIDATE_SECRET not set — skipping public-site revalidation');
    return;
  }
  try {
    const res = await fetch(`${PUBLIC_SITE_URL}/api/revalidate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-revalidate-secret': REVALIDATE_SECRET,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('[revalidate] webhook failed', res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.error('[revalidate] webhook error', e);
  }
}

export function revalidateAllPublic() {
  void ping({ all: true });
}

export function revalidatePageBySlug(slug?: string | null) {
  if (!slug) {
    void ping({ all: true });
    return;
  }
  const normalized = slug === '/' ? '/' : `/${slug.replace(/^\/+/, '')}`;
  void ping({ path: normalized });
}
