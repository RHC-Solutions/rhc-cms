import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getI18nConfig, setI18nConfig, type I18nConfig } from '@adminpanel/lib/i18n/config';
import { recordAudit } from '@adminpanel/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getI18nConfig();
    return NextResponse.json({ config }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[api/cms/i18n] GET', err);
    return NextResponse.json({ error: 'Failed to load i18n config' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  try {
    const body = await request.json();
    const config = body?.config as I18nConfig;
    if (!config || !Array.isArray(config.locales)) {
      return NextResponse.json({ error: 'A valid config is required' }, { status: 400 });
    }
    await setI18nConfig(config);
    await recordAudit({
      actor: (token as any)?.email || 'admin',
      actorEmail: (token as any)?.email || 'admin',
      action: 'i18n.config.update',
      target: null,
      detail: { locales: config.locales.length, autoTranslate: !!config.autoTranslate },
      ip: null,
    });
    return NextResponse.json({ success: true, config: await getI18nConfig() });
  } catch (err) {
    console.error('[api/cms/i18n] PUT', err);
    return NextResponse.json({ error: 'Failed to save i18n config' }, { status: 500 });
  }
}
