import { NextResponse } from 'next/server';
import { CUSTOMER_COOKIE } from '@adminpanel/lib/customer-auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(CUSTOMER_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
