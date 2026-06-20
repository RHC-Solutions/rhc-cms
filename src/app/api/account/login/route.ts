import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerPassword } from '@adminpanel/lib/accounts';
import {
  createCustomerSession,
  CUSTOMER_COOKIE,
  CUSTOMER_COOKIE_OPTS,
} from '@adminpanel/lib/customer-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({} as any));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }
  try {
    const customer = await verifyCustomerPassword(email, password);
    if (!customer) {
      // Generic message — don't reveal whether the email exists.
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    const token = createCustomerSession(customer.id);
    const res = NextResponse.json({
      customer: { id: customer.id, email: customer.email, name: customer.name },
    });
    if (token) res.cookies.set(CUSTOMER_COOKIE, token, CUSTOMER_COOKIE_OPTS);
    return res;
  } catch (err) {
    console.error('[api/account/login] error', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
