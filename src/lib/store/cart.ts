import { getProduct } from './products';

/**
 * Cookie-backed cart. The cookie stores ONLY identifiers + quantities — never
 * prices — so client tampering can't change what a customer is charged; the
 * server re-resolves prices from the catalogue at every read and at checkout.
 */

export interface CartLine {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface ResolvedLine {
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantLabel: string | null;
  unitAmount: number;
  quantity: number;
  lineTotal: number;
  image: string | null;
}

export interface ResolvedCart {
  lines: ResolvedLine[];
  subtotalCents: number;
  currency: string;
  itemCount: number;
}

export const CART_COOKIE = 'ap_cart';
const MAX_ITEMS = 50;
const MAX_QTY = 999;

function clampQty(n: unknown): number {
  return Math.min(MAX_QTY, Math.max(1, Math.round(Number(n) || 1)));
}

export function encodeCart(lines: CartLine[]): string {
  return Buffer.from(JSON.stringify(lines.slice(0, MAX_ITEMS))).toString('base64');
}

export function decodeCart(raw: string | undefined | null): CartLine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l) => l && typeof l.productId === 'string')
      .map((l) => ({
        productId: l.productId as string,
        variantId: l.variantId ?? null,
        quantity: clampQty(l.quantity),
      }))
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

const sameLine = (a: CartLine, b: CartLine) =>
  a.productId === b.productId && (a.variantId ?? null) === (b.variantId ?? null);

/** Merge a line into the cart (sum quantities for matching product+variant). */
export function addToCart(lines: CartLine[], add: CartLine): CartLine[] {
  const next = lines.map((l) => ({ ...l }));
  const existing = next.find((l) => sameLine(l, add));
  if (existing) {
    existing.quantity = clampQty(existing.quantity + clampQty(add.quantity));
  } else if (next.length < MAX_ITEMS) {
    next.push({ productId: add.productId, variantId: add.variantId ?? null, quantity: clampQty(add.quantity) });
  }
  return next;
}

/** Set an exact quantity (0 removes the line). */
export function setCartQuantity(lines: CartLine[], target: CartLine, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((l) => !sameLine(l, target));
  return lines.map((l) => (sameLine(l, target) ? { ...l, quantity: clampQty(quantity) } : l));
}

export function removeFromCart(lines: CartLine[], target: CartLine): CartLine[] {
  return lines.filter((l) => !sameLine(l, target));
}

/** Resolve identifiers to priced line items against the live catalogue.
 *  Drops missing / inactive products and out-of-catalogue variants. */
export async function resolveCart(lines: CartLine[]): Promise<ResolvedCart> {
  const resolved: ResolvedLine[] = [];
  let currency = 'usd';

  for (const line of lines) {
    const product = await getProduct(line.productId);
    if (!product || product.status !== 'active') continue;

    let unitAmount = product.priceCents;
    let variantLabel: string | null = null;
    let variantId: string | null = null;

    if (line.variantId) {
      const variant = (product.variants || []).find((v) => v.id === line.variantId);
      if (!variant) continue; // variant no longer exists — skip rather than mischarge
      variantId = variant.id;
      variantLabel = variant.label;
      if (variant.priceCents != null) unitAmount = variant.priceCents;
    }

    currency = product.currency || currency;
    const quantity = clampQty(line.quantity);
    resolved.push({
      productId: product.id,
      variantId,
      slug: product.slug,
      name: product.name,
      variantLabel,
      unitAmount,
      quantity,
      lineTotal: unitAmount * quantity,
      image: product.images?.[0] ?? null,
    });
  }

  const subtotalCents = resolved.reduce((sum, l) => sum + l.lineTotal, 0);
  const itemCount = resolved.reduce((sum, l) => sum + l.quantity, 0);
  return { lines: resolved, subtotalCents, currency, itemCount };
}
