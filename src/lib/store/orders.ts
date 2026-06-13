import crypto from 'crypto';
import { getDriver } from '../cms/db';
import { ensureSchema } from '../cms/migrations';
import { decrementStock } from './products';
import type { ResolvedCart } from './cart';

/**
 * Orders. Line items are snapshotted as JSON at creation so later catalogue
 * edits don't rewrite history. Money is integer cents. Stock is decremented
 * exactly once, on the pending → paid transition (idempotent — repeat webhook
 * deliveries are no-ops).
 */

const driver = getDriver();

export type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded';

export interface OrderItem {
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  unitAmount: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string | null;
  email: string | null;
  status: OrderStatus;
  subtotalCents: number;
  totalCents: number;
  currency: string;
  items: OrderItem[];
  shipping: Record<string, any> | null;
  notes: string | null;
  stripeSessionId: string | null;
  stripePaymentIntent: string | null;
  createdAt: string;
  updatedAt: string;
}

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function mapOrder(r: any): Order {
  return {
    id: r.id,
    orderNumber: r.orderNumber,
    customerId: r.customerId ?? null,
    email: r.email ?? null,
    status: (r.status as OrderStatus) ?? 'pending',
    subtotalCents: Number(r.subtotalCents ?? 0),
    totalCents: Number(r.totalCents ?? 0),
    currency: r.currency ?? 'usd',
    items: safeParse<OrderItem[]>(r.items, []),
    shipping: r.shipping ? safeParse<Record<string, any>>(r.shipping, {}) : null,
    notes: r.notes ?? null,
    stripeSessionId: r.stripeSessionId ?? null,
    stripePaymentIntent: r.stripePaymentIntent ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function newOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `ORD-${ts}-${rand}`;
}

export async function createOrder(input: {
  cart: ResolvedCart;
  customerId?: string | null;
  email?: string | null;
  shipping?: Record<string, any> | null;
  notes?: string | null;
}): Promise<Order> {
  await ensureSchema();
  if (!input.cart.lines.length) throw new Error('cart is empty');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const items: OrderItem[] = input.cart.lines.map((l) => ({
    productId: l.productId,
    variantId: l.variantId,
    name: l.name,
    variantLabel: l.variantLabel,
    unitAmount: l.unitAmount,
    quantity: l.quantity,
    lineTotal: l.lineTotal,
  }));
  await driver.run(
    `INSERT INTO orders (id, "orderNumber", "customerId", email, status, "subtotalCents", "totalCents", currency, items, shipping, notes, "stripeSessionId", "stripePaymentIntent", "createdAt", "updatedAt")
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
    [
      id,
      newOrderNumber(),
      input.customerId ?? null,
      input.email ?? null,
      input.cart.subtotalCents,
      input.cart.subtotalCents, // total == subtotal until shipping/tax modules land
      input.cart.currency,
      JSON.stringify(items),
      input.shipping ? JSON.stringify(input.shipping) : null,
      input.notes ?? null,
      now,
      now,
    ],
  );
  return (await getOrder(id))!;
}

export async function getOrder(id: string): Promise<Order | null> {
  await ensureSchema();
  const rows = await driver.query<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? mapOrder(rows[0]) : null;
}

export async function getOrderBySession(sessionId: string): Promise<Order | null> {
  await ensureSchema();
  const rows = await driver.query<any>('SELECT * FROM orders WHERE "stripeSessionId" = ? LIMIT 1', [
    sessionId,
  ]);
  return rows[0] ? mapOrder(rows[0]) : null;
}

export async function listOrders(
  opts: { status?: OrderStatus; limit?: number; offset?: number } = {},
): Promise<{ orders: Order[]; total: number }> {
  await ensureSchema();
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts.status) {
    conditions.push('status = ?');
    params.push(opts.status);
  }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const totalRow = (
    await driver.query<{ count: any }>(`SELECT COUNT(*) as count FROM orders${where}`, params)
  )[0];
  const total = Number(totalRow?.count ?? 0);
  const limit = Math.min(Math.max(1, opts.limit ?? 100), 500);
  const offset = Math.max(0, opts.offset ?? 0);
  const rows = await driver.query<any>(
    `SELECT * FROM orders${where} ORDER BY "createdAt" DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return { orders: rows.map(mapOrder), total };
}

export async function attachStripeSession(id: string, sessionId: string): Promise<void> {
  await ensureSchema();
  await driver.run('UPDATE orders SET "stripeSessionId" = ?, "updatedAt" = ? WHERE id = ?', [
    sessionId,
    new Date().toISOString(),
    id,
  ]);
}

async function decrementStockForOrder(order: Order): Promise<void> {
  for (const item of order.items) {
    await decrementStock(item.productId, item.variantId, item.quantity);
  }
}

/** Mark an order paid. Idempotent: only the first pending → paid transition
 *  decrements stock and stamps the payment intent. */
export async function markOrderPaid(id: string, paymentIntent?: string | null): Promise<Order | null> {
  await ensureSchema();
  const order = await getOrder(id);
  if (!order) return null;
  if (order.status !== 'pending') return order; // already advanced — no double-decrement
  await driver.run(
    'UPDATE orders SET status = ?, "stripePaymentIntent" = ?, "updatedAt" = ? WHERE id = ?',
    ['paid', paymentIntent ?? order.stripePaymentIntent ?? null, new Date().toISOString(), id],
  );
  await decrementStockForOrder(order);
  return getOrder(id);
}

/** Admin status change. Honors the same stock-decrement guard when an order is
 *  manually moved from pending → paid. */
export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null> {
  await ensureSchema();
  const order = await getOrder(id);
  if (!order) return null;
  if (status === 'paid' && order.status === 'pending') {
    return markOrderPaid(id);
  }
  await driver.run('UPDATE orders SET status = ?, "updatedAt" = ? WHERE id = ?', [
    status,
    new Date().toISOString(),
    id,
  ]);
  return getOrder(id);
}
