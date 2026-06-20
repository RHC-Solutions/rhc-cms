import { NextRequest, NextResponse } from 'next/server';
import { listProducts } from '@adminpanel/lib/store/products';

// Public storefront catalogue. Lives under /api/store/* which is NOT gated by
// the admin middleware (only /admin and /api/cms are). Returns active products
// only.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || undefined;
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  try {
    const { products, total } = await listProducts({
      status: 'active',
      category,
      limit,
      offset,
      withVariants: true,
    });
    return NextResponse.json({ products, total });
  } catch (err) {
    console.error('[api/store/products] GET', err);
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }
}
