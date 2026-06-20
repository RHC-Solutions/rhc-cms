import { NextRequest, NextResponse } from 'next/server';
import { getCustomer } from '@adminpanel/lib/accounts';
import { verifyCustomerSession, CUSTOMER_COOKIE } from '@adminpanel/lib/customer-auth';
import { getOrdersForCustomer } from '@adminpanel/lib/store/orders';
import { getAppointmentsForEmail } from '@adminpanel/lib/booking/appointments';

// Public self-service: the logged-in customer's profile, orders and bookings.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const customerId = verifyCustomerSession(request.cookies.get(CUSTOMER_COOKIE)?.value);
  if (!customerId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const customer = await getCustomer(customerId);
  if (!customer || customer.status !== 'active') {
    const res = NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    res.cookies.set(CUSTOMER_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  }

  const [orders, appointments] = await Promise.all([
    getOrdersForCustomer(customer.id),
    customer.email ? getAppointmentsForEmail(customer.email) : Promise.resolve([]),
  ]);

  return NextResponse.json(
    {
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
      },
      orders,
      appointments,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
