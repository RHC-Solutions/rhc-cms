import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { revalidatePath } from 'next/cache';
import { createDemo, deleteDemo, DemoSlugInUse, getDemo, listDemos, reorderDemos, updateDemo } from '@adminpanel/lib/cms/demos';
import { revalidateAllPublic } from '@adminpanel/lib/revalidate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const checkAdmin = async (request: NextRequest) => {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = (token as any)?.role;
  if (role !== 'admin' && role !== 'editor') {
    return { authorized: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { authorized: true as const };
};

// A demo appears in the header menu and the footer, so a change to it re-renders every page.
function revalidate(slug?: string) {
  revalidateAllPublic();
  try {
    revalidatePath('/demos');
    if (slug) revalidatePath(`/demos/${slug}`);
  } catch (e) {
    console.error('[demos] revalidate failed', e);
  }
}

// GET /api/cms/demos — every demo, in display order
export async function GET(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;
  return NextResponse.json({ demos: listDemos() });
}

// POST /api/cms/demos — create (draft by default)
export async function POST(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;
  try {
    const body = await request.json();
    const demo = createDemo(body || {});
    revalidate(demo.slug);
    return NextResponse.json(demo, { status: 201 });
  } catch (e) {
    console.error('[demos] POST failed', e);
    return NextResponse.json({ error: 'Failed to create demo' }, { status: 500 });
  }
}

// PUT /api/cms/demos — update { id, ...fields }, or reorder { reorder: [ids] }
export async function PUT(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;
  try {
    const body = await request.json();
    if (Array.isArray(body?.reorder)) {
      reorderDemos(body.reorder);
      revalidate();
      return NextResponse.json({ demos: listDemos() });
    }
    const id = String(body?.id || '');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const before = getDemo(id);
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const demo = updateDemo(id, body);
    if (!demo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    revalidate(demo.slug);
    if (before.slug !== demo.slug) revalidate(before.slug);
    return NextResponse.json(demo);
  } catch (e) {
    if (e instanceof DemoSlugInUse) return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    console.error('[demos] PUT failed', e);
    return NextResponse.json({ error: 'Failed to update demo' }, { status: 500 });
  }
}

// DELETE /api/cms/demos?id=…
export async function DELETE(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const demo = getDemo(id);
    if (!demo || !deleteDemo(demo.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    revalidate(demo.slug);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[demos] DELETE failed', e);
    return NextResponse.json({ error: 'Failed to delete demo' }, { status: 500 });
  }
}
