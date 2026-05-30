import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { loadLeads, saveLeads } from '@adminpanel/lib/cms/landing-pages';

const checkAdmin = async (request: NextRequest) => {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = (token as any)?.role;
  if (role !== 'admin' && role !== 'editor') {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { authorized: true as const };
};

export async function GET(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;
  return NextResponse.json({ leads: loadLeads() });
}

export async function PUT(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const id = String(body.id || '');
    const status = body.status as 'new' | 'contacted' | 'converted' | 'archived';
    if (!id || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const leads = loadLeads();
    const idx = leads.findIndex((l) => l.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    leads[idx] = { ...leads[idx], status };
    saveLeads(leads);
    return NextResponse.json(leads[idx]);
  } catch (e) {
    console.error('[leads] PUT failed', e);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const leads = loadLeads();
    const next = leads.filter((l) => l.id !== id);
    saveLeads(next);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[leads] DELETE failed', e);
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}
