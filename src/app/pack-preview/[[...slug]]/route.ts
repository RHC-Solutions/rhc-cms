import { NextRequest } from 'next/server';
import { staticPageResponse, slugFromSegments } from '@adminpanel/lib/design-pack/serve';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Serves an ingested static-pack page verbatim, so the design renders exactly as
// authored (its own head/nav/footer + CSS/JS run natively). This is the panel-side
// preview/serving route; a host scaffolds the same at its root via
// install-into-site.mjs --static-site. Public — adminAuthGate ignores non-/admin,
// non-/api/cms paths.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await ctx.params;
  return staticPageResponse(slugFromSegments(slug));
}
