import { NextRequest, NextResponse } from 'next/server';
import { verifyAndConstructEvent } from '@adminpanel/lib/store/stripe';
import { getOrder, getOrderBySession, markOrderPaid } from '@adminpanel/lib/store/orders';
import { recordAudit } from '@adminpanel/lib/audit';

// Stripe webhook. Public by design (Stripe calls it). Authenticity is enforced
// by HMAC signature verification on the RAW body — read request.text() and do
// NOT parse before verifying.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get('stripe-signature');
  const event = verifyAndConstructEvent(raw, signature);
  if (!event) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object || {};
      const orderId: string | undefined = session?.metadata?.orderId || session?.client_reference_id;
      const sessionId: string | undefined = session?.id;
      const order = orderId
        ? await getOrder(orderId)
        : sessionId
          ? await getOrderBySession(sessionId)
          : null;
      if (order) {
        await markOrderPaid(order.id, session?.payment_intent ?? null);
        await recordAudit({
          actor: 'stripe',
          action: 'order.paid',
          target: order.orderNumber,
          detail: { sessionId, amountTotal: session?.amount_total },
          ip: null,
        });
      }
    }
  } catch (err) {
    console.error('[api/store/webhook] handler error', err);
    // Still 200 so Stripe doesn't hammer retries for a transient app error;
    // the event type/id is logged for manual reconciliation.
  }

  return NextResponse.json({ received: true });
}
