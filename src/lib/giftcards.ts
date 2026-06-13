import crypto from 'crypto';
import QRCode from 'qrcode';
import { getDriver } from './cms/db';
import { ensureSchema } from './cms/migrations';

/**
 * Gift cards with a transaction ledger. Money in integer cents. Codes are
 * human-readable (Crockford-ish alphabet, no ambiguous chars). Redemption
 * decrements the balance and writes a ledger row; a card with a zero balance
 * flips to 'redeemed'.
 */

const driver = getDriver();

export type GiftCardStatus = 'active' | 'redeemed' | 'disabled' | 'expired';

export interface GiftCard {
  id: string;
  code: string;
  initialBalanceCents: number;
  balanceCents: number;
  currency: string;
  status: GiftCardStatus;
  purchaserEmail: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  message: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GiftCardTransaction {
  id: string;
  giftCardId: string;
  type: 'issue' | 'redeem' | 'adjust';
  amountCents: number;
  balanceAfterCents: number;
  note: string | null;
  createdAt: string;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(): string {
  const seg = () => Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
  return `GIFT-${seg()}-${seg()}-${seg()}`;
}

function mapCard(r: any): GiftCard {
  return {
    id: r.id,
    code: r.code,
    initialBalanceCents: Number(r.initialBalanceCents ?? 0),
    balanceCents: Number(r.balanceCents ?? 0),
    currency: r.currency ?? 'usd',
    status: (r.status as GiftCardStatus) ?? 'active',
    purchaserEmail: r.purchaserEmail ?? null,
    recipientEmail: r.recipientEmail ?? null,
    recipientName: r.recipientName ?? null,
    message: r.message ?? null,
    expiresAt: r.expiresAt ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const code = genCode();
    const rows = await driver.query<any>('SELECT id FROM gift_cards WHERE code = ? LIMIT 1', [code]);
    if (!rows[0]) return code;
  }
  return `GIFT-${crypto.randomUUID().slice(0, 14).toUpperCase()}`;
}

async function ledger(
  giftCardId: string,
  type: GiftCardTransaction['type'],
  amountCents: number,
  balanceAfterCents: number,
  note?: string | null,
): Promise<void> {
  await driver.run(
    `INSERT INTO gift_card_transactions (id, "giftCardId", type, "amountCents", "balanceAfterCents", note, "createdAt")
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), giftCardId, type, amountCents, balanceAfterCents, note ?? null, new Date().toISOString()],
  );
}

export async function createGiftCard(input: {
  amountCents: number;
  currency?: string;
  purchaserEmail?: string;
  recipientEmail?: string;
  recipientName?: string;
  message?: string;
  expiresAt?: string | null;
}): Promise<GiftCard> {
  await ensureSchema();
  const amount = Math.max(0, Math.round(input.amountCents || 0));
  if (amount <= 0) throw new Error('amount must be greater than zero');
  const id = crypto.randomUUID();
  const code = await uniqueCode();
  const now = new Date().toISOString();
  await driver.run(
    `INSERT INTO gift_cards (id, code, "initialBalanceCents", "balanceCents", currency, status, "purchaserEmail", "recipientEmail", "recipientName", message, "expiresAt", "createdAt", "updatedAt")
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      code,
      amount,
      amount,
      (input.currency ?? 'usd').toLowerCase(),
      input.purchaserEmail ?? null,
      input.recipientEmail ?? null,
      input.recipientName ?? null,
      input.message ?? null,
      input.expiresAt ?? null,
      now,
      now,
    ],
  );
  await ledger(id, 'issue', amount, amount, 'Gift card issued');
  return (await getGiftCard(id))!;
}

export async function getGiftCard(id: string): Promise<GiftCard | null> {
  await ensureSchema();
  const rows = await driver.query<any>('SELECT * FROM gift_cards WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? mapCard(rows[0]) : null;
}

export async function getGiftCardByCode(code: string): Promise<GiftCard | null> {
  await ensureSchema();
  const rows = await driver.query<any>('SELECT * FROM gift_cards WHERE code = ? LIMIT 1', [
    code.trim().toUpperCase(),
  ]);
  return rows[0] ? mapCard(rows[0]) : null;
}

export async function listGiftCards(
  opts: { limit?: number; offset?: number } = {},
): Promise<{ cards: GiftCard[]; total: number }> {
  await ensureSchema();
  const totalRow = (await driver.query<{ count: any }>('SELECT COUNT(*) as count FROM gift_cards'))[0];
  const total = Number(totalRow?.count ?? 0);
  const limit = Math.min(Math.max(1, opts.limit ?? 200), 500);
  const offset = Math.max(0, opts.offset ?? 0);
  const rows = await driver.query<any>(
    'SELECT * FROM gift_cards ORDER BY "createdAt" DESC LIMIT ? OFFSET ?',
    [limit, offset],
  );
  return { cards: rows.map(mapCard), total };
}

async function expireIfDue(card: GiftCard): Promise<GiftCard> {
  if (card.status === 'active' && card.expiresAt && Date.parse(card.expiresAt) < Date.now()) {
    await driver.run('UPDATE gift_cards SET status = ?, "updatedAt" = ? WHERE id = ?', [
      'expired',
      new Date().toISOString(),
      card.id,
    ]);
    return { ...card, status: 'expired' };
  }
  return card;
}

/** Redeem up to `amountCents` (clamped to the remaining balance). */
export async function redeemGiftCard(
  code: string,
  amountCents: number,
  note?: string,
): Promise<{ card: GiftCard; redeemedCents: number }> {
  await ensureSchema();
  let card = await getGiftCardByCode(code);
  if (!card) throw new Error('Gift card not found');
  card = await expireIfDue(card);
  if (card.status !== 'active') throw new Error(`Gift card is ${card.status}`);
  const requested = Math.max(0, Math.round(amountCents || 0));
  if (requested <= 0) throw new Error('amount must be greater than zero');
  const redeemed = Math.min(requested, card.balanceCents);
  const newBalance = card.balanceCents - redeemed;
  const newStatus: GiftCardStatus = newBalance <= 0 ? 'redeemed' : 'active';
  await driver.run('UPDATE gift_cards SET "balanceCents" = ?, status = ?, "updatedAt" = ? WHERE id = ?', [
    newBalance,
    newStatus,
    new Date().toISOString(),
    card.id,
  ]);
  await ledger(card.id, 'redeem', -redeemed, newBalance, note ?? null);
  return { card: (await getGiftCard(card.id))!, redeemedCents: redeemed };
}

export async function setGiftCardStatus(id: string, status: GiftCardStatus): Promise<GiftCard | null> {
  await ensureSchema();
  await driver.run('UPDATE gift_cards SET status = ?, "updatedAt" = ? WHERE id = ?', [
    status,
    new Date().toISOString(),
    id,
  ]);
  return getGiftCard(id);
}

export async function listGiftCardTransactions(giftCardId: string): Promise<GiftCardTransaction[]> {
  await ensureSchema();
  const rows = await driver.query<any>(
    'SELECT * FROM gift_card_transactions WHERE "giftCardId" = ? ORDER BY "createdAt" ASC',
    [giftCardId],
  );
  return rows.map((r) => ({
    id: r.id,
    giftCardId: r.giftCardId,
    type: r.type,
    amountCents: Number(r.amountCents ?? 0),
    balanceAfterCents: Number(r.balanceAfterCents ?? 0),
    note: r.note ?? null,
    createdAt: r.createdAt,
  }));
}

/** PNG data URL encoding the gift-card code, for printing / emailing. */
export async function giftCardQrDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(code, { margin: 1, width: 240 });
}
