import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  listGiftCards,
  createGiftCard,
  redeemGiftCard,
  setGiftCardStatus,
  getGiftCard,
  giftCardQrDataUrl,
} from '@adminpanel/lib/giftcards';
import { recordAudit } from '@adminpanel/lib/audit';

export const dynamic = 'force-dynamic';

const ip = (r: NextRequest) =>
  r.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || r.headers.get('x-real-ip') || null;
const actor = (t: any) => (t && t.email) || 'admin';

export async function GET() {
  try {
    const result = await listGiftCards();
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[api/cms/giftcards] GET', err);
    return NextResponse.json({ error: 'Failed to list gift cards' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  try {
    const body = await request.json();
    const amountCents = Math.round(Number(body.amountCents ?? (body.amount ? body.amount * 100 : 0)));
    if (!amountCents || amountCents <= 0) {
      return NextResponse.json({ error: 'A positive amount is required' }, { status: 400 });
    }
    const card = await createGiftCard({ ...body, amountCents });
    const qr = await giftCardQrDataUrl(card.code);
    await recordAudit({
      actor: actor(token),
      actorEmail: actor(token),
      action: 'giftcard.create',
      target: card.code,
      detail: { amountCents, currency: card.currency },
      ip: ip(request),
    });
    return NextResponse.json({ card, qr }, { status: 201 });
  } catch (err: any) {
    console.error('[api/cms/giftcards] POST', err);
    return NextResponse.json({ error: err?.message || 'Failed to create gift card' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  try {
    const body = await request.json();
    const { action } = body || {};

    if (action === 'redeem') {
      const { code, amountCents, note } = body;
      if (!code || !amountCents) {
        return NextResponse.json({ error: 'code and amountCents are required' }, { status: 400 });
      }
      const result = await redeemGiftCard(code, Math.round(Number(amountCents)), note);
      await recordAudit({
        actor: actor(token),
        actorEmail: actor(token),
        action: 'giftcard.redeem',
        target: code,
        detail: { redeemedCents: result.redeemedCents, balanceCents: result.card.balanceCents },
        ip: ip(request),
      });
      return NextResponse.json(result);
    }

    if (action === 'status') {
      const { id, status } = body;
      if (!id || !['active', 'disabled', 'redeemed', 'expired'].includes(status)) {
        return NextResponse.json({ error: 'id and a valid status are required' }, { status: 400 });
      }
      const before = await getGiftCard(id);
      const card = await setGiftCardStatus(id, status);
      if (!card) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
      await recordAudit({
        actor: actor(token),
        actorEmail: actor(token),
        action: 'giftcard.status',
        target: card.code,
        detail: { from: before?.status, to: status },
        ip: ip(request),
      });
      return NextResponse.json({ card });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('[api/cms/giftcards] PATCH', err);
    return NextResponse.json({ error: err?.message || 'Failed to update gift card' }, { status: 500 });
  }
}
