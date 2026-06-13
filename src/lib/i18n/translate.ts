import crypto from 'crypto';
import { getDriver } from '../cms/db';
import { ensureSchema } from '../cms/migrations';
import { getSecret } from '../env';
import { getI18nConfig } from './config';

/**
 * Machine translation with a DB cache. Provider is Google Cloud Translation
 * (REST, API key via getSecret('GOOGLE_TRANSLATE_API_KEY') — encrypted at rest).
 * Cache-first: a (locale, text) pair is translated at most once.
 *
 * translateText() will only call the provider when `force` is set (admin tools)
 * or when autoTranslate is enabled in the i18n config — otherwise a cache miss
 * falls back to the source text, so public traffic can't run up API cost.
 */

const driver = getDriver();
const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

export function translationConfigured(): boolean {
  return !!getSecret('GOOGLE_TRANSLATE_API_KEY');
}

function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 40);
}

async function getCached(locale: string, sourceHash: string): Promise<string | null> {
  await ensureSchema();
  const rows = await driver.query<{ translatedText: string }>(
    'SELECT "translatedText" FROM translations WHERE locale = ? AND "sourceHash" = ? LIMIT 1',
    [locale, sourceHash],
  );
  return rows[0]?.translatedText ?? null;
}

async function saveCached(locale: string, sourceHash: string, sourceText: string, translatedText: string): Promise<void> {
  await driver.run(
    `INSERT INTO translations (id, locale, "sourceHash", "sourceText", "translatedText", "createdAt")
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(locale, "sourceHash") DO UPDATE SET "translatedText" = excluded."translatedText"`,
    [crypto.randomUUID(), locale, sourceHash, sourceText, translatedText, new Date().toISOString()],
  );
}

async function callProvider(texts: string[], target: string, source?: string): Promise<string[]> {
  const key = getSecret('GOOGLE_TRANSLATE_API_KEY');
  if (!key) throw new Error('Translation is not configured');
  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, target, format: 'text', ...(source ? { source } : {}) }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Translation provider error (HTTP ${res.status})`);
  }
  return (data?.data?.translations || []).map((t: any) => t.translatedText as string);
}

export async function translateText(
  text: string,
  target: string,
  opts: { force?: boolean } = {},
): Promise<string> {
  if (!text || !text.trim()) return text;
  const cfg = await getI18nConfig();
  if (target === cfg.defaultLocale) return text;

  const h = hash(text);
  const cached = await getCached(target, h);
  if (cached != null) return cached;

  // Cache miss — only spend an API call when explicitly forced or auto-translate is on.
  if (!opts.force && !cfg.autoTranslate) return text;
  if (!translationConfigured()) return text;

  try {
    const [translated] = await callProvider([text], target, cfg.defaultLocale);
    if (translated) {
      await saveCached(target, h, text, translated);
      return translated;
    }
  } catch (err) {
    console.error('[i18n] translation failed', err);
  }
  return text;
}

/** Translate many strings at once (admin tooling). Always calls the provider. */
export async function translateBatch(texts: string[], target: string): Promise<string[]> {
  if (!texts.length) return [];
  const cfg = await getI18nConfig();
  if (target === cfg.defaultLocale) return texts;

  const results: string[] = new Array(texts.length);
  const toFetch: { index: number; text: string; hash: string }[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    if (!text?.trim()) {
      results[i] = text;
      continue;
    }
    const h = hash(text);
    const cached = await getCached(target, h);
    if (cached != null) results[i] = cached;
    else toFetch.push({ index: i, text, hash: h });
  }

  if (toFetch.length && translationConfigured()) {
    try {
      const translated = await callProvider(
        toFetch.map((t) => t.text),
        target,
        cfg.defaultLocale,
      );
      for (let j = 0; j < toFetch.length; j++) {
        const out = translated[j] ?? toFetch[j].text;
        results[toFetch[j].index] = out;
        await saveCached(target, toFetch[j].hash, toFetch[j].text, out);
      }
    } catch (err) {
      console.error('[i18n] batch translation failed', err);
      for (const t of toFetch) results[t.index] = t.text;
    }
  } else {
    for (const t of toFetch) results[t.index] = t.text;
  }

  return results;
}
