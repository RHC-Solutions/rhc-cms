import { NextRequest, NextResponse } from 'next/server';
import { translateBatch, translationConfigured } from '@adminpanel/lib/i18n/translate';

// Admin-triggered translation (forces a provider call on cache miss).
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const texts: string[] = Array.isArray(body?.texts)
      ? body.texts
      : typeof body?.text === 'string'
        ? [body.text]
        : [];
    const target = String(body?.target || '').trim();
    if (!texts.length || !target) {
      return NextResponse.json({ error: 'texts[] and target are required' }, { status: 400 });
    }
    if (!translationConfigured()) {
      return NextResponse.json(
        { error: 'Translation is not configured (set GOOGLE_TRANSLATE_API_KEY in Integrations)' },
        { status: 400 },
      );
    }
    const translations = await translateBatch(texts.slice(0, 200), target);
    return NextResponse.json({ translations });
  } catch (err: any) {
    console.error('[api/cms/i18n/translate] POST', err);
    return NextResponse.json({ error: err?.message || 'Translation failed' }, { status: 500 });
  }
}
