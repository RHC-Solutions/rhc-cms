import { NextRequest, NextResponse } from 'next/server';
import {
  CART_COOKIE,
  decodeCart,
  encodeCart,
  addToCart,
  setCartQuantity,
  removeFromCart,
  resolveCart,
  type CartLine,
} from '@adminpanel/lib/store/cart';

// Public cart. Stored in an httpOnly cookie holding only ids + quantities;
// prices are always resolved server-side (see lib/store/cart.ts).
export const dynamic = 'force-dynamic';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

export async function GET(request: NextRequest) {
  const lines = decodeCart(request.cookies.get(CART_COOKIE)?.value);
  const cart = await resolveCart(lines);
  return NextResponse.json(cart);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { action, productId, variantId, quantity } = body || {};
  let lines = decodeCart(request.cookies.get(CART_COOKIE)?.value);

  const target: CartLine = { productId, variantId: variantId ?? null, quantity: quantity ?? 1 };

  switch (action) {
    case 'add':
      if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });
      lines = addToCart(lines, target);
      break;
    case 'set':
      if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });
      lines = setCartQuantity(lines, target, Number(quantity) || 0);
      break;
    case 'remove':
      if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });
      lines = removeFromCart(lines, target);
      break;
    case 'clear':
      lines = [];
      break;
    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }

  const cart = await resolveCart(lines);
  const res = NextResponse.json(cart);
  res.cookies.set(CART_COOKIE, encodeCart(lines), COOKIE_OPTS);
  return res;
}
