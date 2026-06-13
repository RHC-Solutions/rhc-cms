import { NextResponse } from 'next/server';
import { getI18nConfig } from '@adminpanel/lib/i18n/config';

// Public: enabled locales + default, for the storefront language switcher.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cfg = await getI18nConfig();
    return NextResponse.json({
      defaultLocale: cfg.defaultLocale,
      locales: cfg.locales.filter((l) => l.enabled),
    });
  } catch (err) {
    console.error('[api/i18n/locales] GET', err);
    return NextResponse.json({ error: 'Failed to load locales' }, { status: 500 });
  }
}
