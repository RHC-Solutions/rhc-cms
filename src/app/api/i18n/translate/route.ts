import { NextRequest, NextResponse } from 'next/server';
import { translateText } from '@adminpanel/lib/i18n/translate';

// Public translation. Cache-first; a cache miss only hits the provider when
// autoTranslate is enabled in the i18n config (otherwise returns source text).
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = typeof body?.text === 'string' ? body.text : '';
    const target = String(body?.target || '').trim();
    if (!text || !target) {
      return NextResponse.json({ error: 'text and target are required' }, { status: 400 });
    }
    const translated = await translateText(text.slice(0, 5000), target);
    return NextResponse.json({ text: translated });
  } catch (err) {
    console.error('[api/i18n/translate] POST', err);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
