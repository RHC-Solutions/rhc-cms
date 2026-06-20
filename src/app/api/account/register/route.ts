import { NextRequest, NextResponse } from 'next/server';
import { createCustomer, findCustomerByEmail } from '@adminpanel/lib/accounts';
import {
  createCustomerSession,
  CUSTOMER_COOKIE,
  CUSTOMER_COOKIE_OPTS,
} from '@adminpanel/lib/customer-auth';

// Public storefront registration.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({} as any));
  const email = (typeof body.email === 'string' ? body.email.trim().toLowerCase() : '') || '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }
  try {
    if (await findCustomerByEmail(email)) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }
    const customer = await createCustomer({ email, password, name: body.name, phone: body.phone });
    const token = createCustomerSession(customer.id);
    const res = NextResponse.json({
      customer: { id: customer.id, email: customer.email, name: customer.name },
    });
    if (token) res.cookies.set(CUSTOMER_COOKIE, token, CUSTOMER_COOKIE_OPTS);
    return res;
  } catch (err) {
    console.error('[api/account/register] error', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
