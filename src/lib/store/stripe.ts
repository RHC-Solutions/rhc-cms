import crypto from 'crypto';
import { getSecret } from '../env';

/**
 * Minimal Stripe client over the REST API (no SDK dependency — the panel ships
 * to arbitrary hosts and we avoid native/heavy deps). Secret key is read via
 * getSecret() so it lives encrypted in cms-data/secrets.json and is editable
 * from /admin/integrations without a restart.
 */

const STRIPE_API = 'https://api.stripe.com/v1';

export function stripeConfigured(): boolean {
  return !!getSecret('STRIPE_SECRET_KEY');
}

// Stripe expects application/x-www-form-urlencoded with bracketed nested keys,
// e.g. line_items[0][price_data][unit_amount]=500.
function flatten(value: any, prefix: string, out: URLSearchParams): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => flatten(item, `${prefix}[${i}]`, out));
  } else if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flatten(v, `${prefix}[${k}]`, out);
  } else {
    out.append(prefix, String(value));
  }
}

function encodeForm(obj: Record<string, any>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) flatten(v, k, out);
  return out;
}

export interface CheckoutLineItem {
  name: string;
  unitAmount: number;
  quantity: number;
  currency: string;
  image?: string | null;
}

export async function createCheckoutSession(params: {
  lineItems: CheckoutLineItem[];
  successUrl: string;
  cancelUrl: string;
  orderId: string;
  orderNumber: string;
  customerEmail?: string | null;
}): Promise<{ id: string; url: string }> {
  const key = getSecret('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Stripe is not configured');

  const body: Record<string, any> = {
    mode: 'payment',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.orderId,
    metadata: { orderId: params.orderId, orderNumber: params.orderNumber },
    line_items: params.lineItems.map((li) => ({
      quantity: li.quantity,
      price_data: {
        currency: li.currency,
        unit_amount: li.unitAmount,
        product_data: {
          name: li.name,
          ...(li.image ? { images: [li.image] } : {}),
        },
      },
    })),
  };
  if (params.customerEmail) body.customer_email = params.customerEmail;

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: encodeForm(body).toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Stripe error (HTTP ${res.status})`);
  }
  return { id: data.id, url: data.url };
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: any };
}

/**
 * Verify the Stripe-Signature header and return the parsed event, or null if
 * verification fails. Implements Stripe's scheme: v1 = HMAC-SHA256(secret,
 * `${t}.${payload}`), with a 5-minute timestamp tolerance, compared in
 * constant time. rawBody MUST be the exact bytes Stripe sent.
 */
export function verifyAndConstructEvent(
  rawBody: string,
  signatureHeader: string | null,
): StripeEvent | null {
  const secret = getSecret('STRIPE_WEBHOOK_SECRET');
  if (!secret || !signatureHeader) return null;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const idx = kv.indexOf('=');
      return [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()];
    }),
  );
  const timestamp = parts['t'];
  const provided = parts['v1'];
  if (!timestamp || !provided) return null;

  // Reject stale timestamps (replay protection).
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (!Number.isFinite(age) || Math.abs(age) > 60 * 5) return null;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(rawBody) as StripeEvent;
  } catch {
    return null;
  }
}
