import { NextRequest, NextResponse } from 'next/server';
import { CART_COOKIE, decodeCart, resolveCart } from '@adminpanel/lib/store/cart';
import { createOrder, attachStripeSession, markOrderPaid } from '@adminpanel/lib/store/orders';
import { stripeConfigured, createCheckoutSession } from '@adminpanel/lib/store/stripe';
import { findOrCreateCustomer } from '@adminpanel/lib/accounts';

// Public checkout. Resolves the cart server-side (never trusts client prices),
// creates a pending order, then either hands off to Stripe Checkout or — when
// no payment provider is configured — auto-confirms (demo mode) so a fresh
// install has a working store out of the box.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({} as any));
  const lines = decodeCart(request.cookies.get(CART_COOKIE)?.value);
  const cart = await resolveCart(lines);
  if (!cart.lines.length) {
    return NextResponse.json({ error: 'Your cart is empty' }, { status: 400 });
  }

  const email = (typeof body.email === 'string' ? body.email.trim().toLowerCase() : '') || null;
  let customerId: string | null = null;
  if (email) {
    try {
      const customer = await findOrCreateCustomer({ email, name: body.name, phone: body.phone });
      customerId = customer.id;
    } catch (err) {
      console.error('[api/store/checkout] customer', err);
    }
  }

  const order = await createOrder({
    cart,
    email,
    customerId,
    shipping: body.shipping ?? null,
    notes: typeof body.notes === 'string' ? body.notes : null,
  });

  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const successUrl = `${base}/store/order/${order.orderNumber}?status=success`;
  const cancelUrl = `${base}/store/cart?status=cancelled`;

  const clearCart = (res: NextResponse) => {
    res.cookies.set(CART_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  };

  if (stripeConfigured()) {
    try {
      const session = await createCheckoutSession({
        lineItems: cart.lines.map((l) => ({
          name: l.variantLabel ? `${l.name} — ${l.variantLabel}` : l.name,
          unitAmount: l.unitAmount,
          quantity: l.quantity,
          currency: cart.currency,
          image: l.image,
        })),
        successUrl,
        cancelUrl,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerEmail: email,
      });
      await attachStripeSession(order.id, session.id);
      return clearCart(NextResponse.json({ url: session.url, orderNumber: order.orderNumber }));
    } catch (err: any) {
      console.error('[api/store/checkout] stripe', err);
      return NextResponse.json(
        { error: err?.message || 'Payment initialization failed' },
        { status: 502 },
      );
    }
  }

  // Demo mode — no payment provider configured.
  await markOrderPaid(order.id);
  return clearCart(
    NextResponse.json({ url: successUrl, orderNumber: order.orderNumber, demo: true }),
  );
}
