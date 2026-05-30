import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@adminpanel/lib/auth/config';
import { getSecret, setSecrets } from '@adminpanel/lib/env';
import { MANAGED_SECRET_KEYS } from '@adminpanel/lib/integrations';

const MAX_VALUE_LEN = 16 * 1024;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const values: Record<string, string> = {};
  for (const key of MANAGED_SECRET_KEYS) {
    values[key] = getSecret(key);
  }
  return NextResponse.json({ values });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const incoming = body?.values;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return NextResponse.json({ error: '`values` must be an object' }, { status: 400 });
  }

  // Only persist keys that are part of the declared schema. Silently dropping
  // unknown keys is an explicit defense against client-controlled writes to
  // arbitrary secret names.
  const rejected: string[] = [];
  const updates: Record<string, string> = {};
  for (const [key, raw] of Object.entries(incoming)) {
    if (!MANAGED_SECRET_KEYS.has(key)) {
      rejected.push(key);
      continue;
    }
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'string') {
      return NextResponse.json({ error: `Value for ${key} must be a string` }, { status: 400 });
    }
    if (raw.length > MAX_VALUE_LEN) {
      return NextResponse.json({ error: `Value for ${key} exceeds ${MAX_VALUE_LEN} bytes` }, { status: 400 });
    }
    // Empty string => skip (don't clear). Use the dedicated DELETE flow if/when added.
    if (raw.trim() === '') continue;
    updates[key] = raw;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No values changed',
      saved: [],
      rejectedKeys: rejected,
    });
  }

  setSecrets(updates);

  return NextResponse.json({
    success: true,
    message: `Saved ${Object.keys(updates).length} value(s). Changes are live immediately — no restart needed.`,
    saved: Object.keys(updates),
    rejectedKeys: rejected,
  });
}
