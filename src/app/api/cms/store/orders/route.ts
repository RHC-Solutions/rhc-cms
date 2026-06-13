import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { listOrders, updateOrderStatus, getOrder } from '@adminpanel/lib/store/orders';
import { recordAudit } from '@adminpanel/lib/audit';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled', 'refunded'] as const;

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
  const limit = parseInt(searchParams.get('limit') || '200', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  try {
    const result = await listOrders({ status, limit, offset });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[api/cms/store/orders] GET', err);
    return NextResponse.json({ error: 'Failed to list orders' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  try {
    const body = await request.json();
    const { id, status } = body || {};
    if (!id || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'id and a valid status are required' }, { status: 400 });
    }
    const before = await getOrder(id);
    if (!before) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    const updated = await updateOrderStatus(id, status);
    await recordAudit({
      actor: (token as any)?.email || 'admin',
      actorEmail: (token as any)?.email || 'admin',
      action: 'order.status',
      target: before.orderNumber,
      detail: { from: before.status, to: status },
      ip: clientIp(request),
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[api/cms/store/orders] PATCH', err);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
