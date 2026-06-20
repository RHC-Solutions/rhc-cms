import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  setVariants,
} from '@adminpanel/lib/store/products';
import { recordAudit } from '@adminpanel/lib/audit';

// Admin store management. Gated by middleware (/api/cms/*); we read the token
// here only for the audit actor.
export const dynamic = 'force-dynamic';

function actorEmail(token: any): string {
  return (token && token.email) || 'admin';
}
function clientIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') as any) || undefined;
  const category = searchParams.get('category') || undefined;
  const limit = parseInt(searchParams.get('limit') || '200', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  try {
    const result = await listProducts({ status, category, limit, offset, withVariants: true });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[api/cms/store/products] GET', err);
    return NextResponse.json({ error: 'Failed to list products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  try {
    const body = await request.json();
    if (!body?.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    const product = await createProduct(body);
    if (Array.isArray(body.variants)) await setVariants(product.id, body.variants);
    const full = await getProduct(product.id);
    await recordAudit({
      actor: actorEmail(token),
      actorEmail: actorEmail(token),
      action: 'product.create',
      target: product.slug,
      detail: { id: product.id, priceCents: product.priceCents },
      ip: clientIp(request),
    });
    return NextResponse.json(full, { status: 201 });
  } catch (err: any) {
    console.error('[api/cms/store/products] POST', err);
    return NextResponse.json({ error: err?.message || 'Failed to create product' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  try {
    const body = await request.json();
    if (!body?.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const updated = await updateProduct(body.id, body);
    if (!updated) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (Array.isArray(body.variants)) await setVariants(body.id, body.variants);
    const full = await getProduct(body.id);
    await recordAudit({
      actor: actorEmail(token),
      actorEmail: actorEmail(token),
      action: 'product.update',
      target: updated.slug,
      detail: { id: updated.id },
      ip: clientIp(request),
    });
    return NextResponse.json(full);
  } catch (err: any) {
    console.error('[api/cms/store/products] PUT', err);
    return NextResponse.json({ error: err?.message || 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  try {
    const product = await getProduct(id);
    const ok = await deleteProduct(id);
    if (!ok) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    await recordAudit({
      actor: actorEmail(token),
      actorEmail: actorEmail(token),
      action: 'product.delete',
      target: product?.slug || id,
      detail: { id },
      ip: clientIp(request),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/cms/store/products] DELETE', err);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
