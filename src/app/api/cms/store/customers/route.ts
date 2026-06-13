import { NextRequest, NextResponse } from 'next/server';
import { listCustomers } from '@adminpanel/lib/accounts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '200', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  try {
    const result = await listCustomers({ limit, offset });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[api/cms/store/customers] GET', err);
    return NextResponse.json({ error: 'Failed to list customers' }, { status: 500 });
  }
}
