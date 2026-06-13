import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  listServices,
  createService,
  updateService,
  deleteService,
  getService,
} from '@adminpanel/lib/booking/services';
import { recordAudit } from '@adminpanel/lib/audit';

export const dynamic = 'force-dynamic';

const ip = (r: NextRequest) =>
  r.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || r.headers.get('x-real-ip') || null;

export async function GET() {
  try {
    const services = await listServices();
    return NextResponse.json({ services }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[api/cms/booking/services] GET', err);
    return NextResponse.json({ error: 'Failed to list services' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  try {
    const body = await request.json();
    if (!body?.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    const service = await createService(body);
    await recordAudit({
      actor: (token as any)?.email || 'admin',
      actorEmail: (token as any)?.email || 'admin',
      action: 'service.create',
      target: service.slug,
      detail: { id: service.id },
      ip: ip(request),
    });
    return NextResponse.json(service, { status: 201 });
  } catch (err: any) {
    console.error('[api/cms/booking/services] POST', err);
    return NextResponse.json({ error: err?.message || 'Failed to create service' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  try {
    const body = await request.json();
    if (!body?.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const service = await updateService(body.id, body);
    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    await recordAudit({
      actor: (token as any)?.email || 'admin',
      actorEmail: (token as any)?.email || 'admin',
      action: 'service.update',
      target: service.slug,
      detail: { id: service.id },
      ip: ip(request),
    });
    return NextResponse.json(service);
  } catch (err: any) {
    console.error('[api/cms/booking/services] PUT', err);
    return NextResponse.json({ error: err?.message || 'Failed to update service' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  try {
    const service = await getService(id);
    const ok = await deleteService(id);
    if (!ok) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    await recordAudit({
      actor: (token as any)?.email || 'admin',
      actorEmail: (token as any)?.email || 'admin',
      action: 'service.delete',
      target: service?.slug || id,
      detail: { id },
      ip: ip(request),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/cms/booking/services] DELETE', err);
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 });
  }
}
