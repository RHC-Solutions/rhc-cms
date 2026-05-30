import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { generateSecret, buildOtpauthURL, verifyTotp, generateRecoveryCodes } from '@adminpanel/lib/auth/totp';
import { loadUsers, saveUsers, sanitizeUser } from '@adminpanel/lib/auth/users';

const authError = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !(token as any).email) {
    return authError;
  }

  const email = (token as any).email as string;
  const users = loadUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) return authError;

  const user = users[idx];

  if (user.totpEnabled) {
    return NextResponse.json({ enabled: true, user: sanitizeUser(user) });
  }

  const tempSecret = user.totpTempSecret || generateSecret(32);
  users[idx] = { ...user, totpTempSecret: tempSecret };
  saveUsers(users);

  const otpauthUrl = buildOtpauthURL(tempSecret, email, 'RHC Solutions');

  return NextResponse.json({
    enabled: false,
    secret: tempSecret,
    otpauthUrl,
  });
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !(token as any).email) {
    return authError;
  }

  const email = (token as any).email as string;
  const users = loadUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) return authError;

  const body = await request.json();
  const code = body?.code as string | undefined;

  const user = users[idx];
  const secret = user.totpTempSecret || user.totpSecret;

  if (!secret) {
    return NextResponse.json({ error: 'No pending MFA secret' }, { status: 400 });
  }

  const valid = verifyTotp(code || '', secret);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  const recoveryCodes = generateRecoveryCodes(8);

  users[idx] = {
    ...user,
    totpSecret: secret,
    totpEnabled: true,
    mfaRequired: false, // MFA is complete
    totpTempSecret: undefined,
    recoveryCodes,
    updatedAt: new Date().toISOString(),
    updatedBy: email,
  } as any;

  saveUsers(users);

  return NextResponse.json({
    enabled: true,
    recoveryCodes,
    user: sanitizeUser(users[idx]),
  });
}

// DELETE: Disable/reset MFA for the current user
export async function DELETE(request: NextRequest) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !(token as any).email) {
    return authError;
  }

  const email = (token as any).email as string;
  const users = loadUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) return authError;

  const user = users[idx];

  // Clear all MFA-related fields so the user can re-enroll
  users[idx] = {
    ...user,
    totpEnabled: false,
    totpSecret: undefined,
    totpTempSecret: undefined,
    recoveryCodes: undefined,
    mfaRequired: false,
    updatedAt: new Date().toISOString(),
    updatedBy: email,
  } as any;

  saveUsers(users);

  return NextResponse.json({
    success: true,
    message: 'MFA disabled. You can set up a new authenticator now.',
    user: sanitizeUser(users[idx]),
  });
}
