import { NextRequest, NextResponse } from 'next/server';
import { getGiftCardByCode } from '@adminpanel/lib/giftcards';

// Public balance check. Returns only balance/status/currency — never purchaser
// or recipient details.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 });
  try {
    const card = await getGiftCardByCode(code);
    if (!card) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
    return NextResponse.json({
      code: card.code,
      balanceCents: card.balanceCents,
      currency: card.currency,
      status: card.status,
      expiresAt: card.expiresAt,
    });
  } catch (err) {
    console.error('[api/giftcards/check] GET', err);
    return NextResponse.json({ error: 'Failed to check gift card' }, { status: 500 });
  }
}
