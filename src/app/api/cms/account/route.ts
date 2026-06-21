import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import bcrypt from 'bcryptjs';
import { loadUsers, saveUsers, sanitizeUser } from '@adminpanel/lib/auth/users';
import { validatePassword } from '@adminpanel/lib/auth/password';
import { recordAudit } from '@adminpanel/lib/audit';

/**
 * Self-service account endpoint. STRICTLY scoped to the authenticated caller (keyed
 * off the JWT email) — unlike /api/cms/users (admin-only management of ALL users),
 * this lets any signed-in admin/editor change their OWN name, email, and password.
 * It deliberately NEVER touches role/status, so it cannot be used to escalate
 * privileges. 2FA is handled by /api/cms/mfa (also self-scoped).
 */

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const noStore = { 'Cache-Control': 'private, no-store' };

async function callerEmail(request: NextRequest): Promise<string> {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  return token && (token as any).email ? String((token as any).email) : '';
}

export async function GET(request: NextRequest) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = loadUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!me) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  return NextResponse.json(sanitizeUser(me), { headers: noStore });
}

export async function PUT(request: NextRequest) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const users = loadUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  const me = users[idx];

  const updates: Partial<typeof me> = {};
  const changed: string[] = [];
  let reauthRequired = false;

  if (typeof body.name === 'string' && body.name.trim() && body.name.trim() !== me.name) {
    updates.name = body.name.trim();
    changed.push('name');
  }

  // Email is the login identity AND the JWT subject — changing it invalidates the
  // current session, so the client must re-authenticate afterwards.
  if (typeof body.email === 'string' && body.email.trim().toLowerCase() !== me.email.toLowerCase()) {
    const next = body.email.trim();
    // Cap length (RFC 5321 max is 254) BEFORE the regex so the pattern only ever
    // runs on a bounded string — defuses the polynomial-backtracking ReDoS class.
    if (next.length > 254 || !EMAIL_RE.test(next)) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    if (users.some((u, i) => i !== idx && u.email.toLowerCase() === next.toLowerCase()))
      return NextResponse.json({ error: 'That email is already in use' }, { status: 409 });
    updates.email = next;
    changed.push('email');
    reauthRequired = true;
  }

  // Password change requires the current password (defense against session hijack /
  // an unlocked screen) and must pass the same NIST policy as user creation.
  if (typeof body.newPassword === 'string' && body.newPassword.length > 0) {
    const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    if (!me.passwordHash || !bcrypt.compareSync(current, me.passwordHash))
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    const v = validatePassword(body.newPassword);
    if (!v.valid) return NextResponse.json({ error: v.errors[0] || 'Password is too weak', errors: v.errors }, { status: 400 });
    updates.passwordHash = bcrypt.hashSync(body.newPassword, 10);
    changed.push('password');
    reauthRequired = true;
  }

  if (changed.length === 0) return NextResponse.json({ error: 'No changes provided' }, { status: 400 });

  // STRICT: spread `me` then `updates` only — role/status/id are never accepted from
  // the body, so this endpoint cannot grant the caller admin or reactivate themselves.
  users[idx] = { ...me, ...updates, updatedAt: new Date().toISOString(), updatedBy: me.email };
  saveUsers(users);

  try {
    await recordAudit({ actor: me.id, actorEmail: me.email, action: 'account.update', target: me.email, detail: { changed } });
  } catch { /* audit is best-effort */ }

  return NextResponse.json({ ok: true, changed, reauthRequired, user: sanitizeUser(users[idx]) }, { headers: noStore });
}
