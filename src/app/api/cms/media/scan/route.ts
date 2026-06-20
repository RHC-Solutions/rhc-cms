import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { scanOrphanUploads } from '@adminpanel/lib/cms/media-scan';

const checkAuth = async (request: NextRequest) => {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = (token as any)?.role;
  const email = (token as any)?.email || 'admin';
  if (!role || !['admin', 'editor'].includes(role)) {
    return { authorized: false, email: '', response: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) };
  }
  return { authorized: true, email, response: null };
};

// POST - Scan uploads directory and index untracked files
export async function POST(request: NextRequest) {
  const auth = await checkAuth(request);
  if (!auth.authorized) return auth.response!;
  try {
    return NextResponse.json(scanOrphanUploads(auth.email));
  } catch (error) {
    console.error('Scan failed', error);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}
