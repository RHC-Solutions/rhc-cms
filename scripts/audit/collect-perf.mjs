/**
 * Performance collector via Google PageSpeed Insights API (runs Lighthouse in
 * Google's cloud against the live, Cloudflare-fronted URL — no local Chrome).
 * Uses GOOGLE_PAGESPEED_API_KEY from secrets.json. Degrades gracefully on
 * rate-limit / network errors so the daily run never hard-fails on perf.
 *
 * Run: node scripts/audit/collect-perf.mjs
 */
import { getSecret, fetchText, writeArtifact, PUBLIC_BASE, log } from './_lib.mjs';

const PATHS = ['/', '/services', '/services/cyber-security', '/contact'];
const STRATEGIES = ['mobile', 'desktop'];

async function runPSI(url, strategy, key) {
  const api = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  api.searchParams.set('url', url);
  api.searchParams.set('strategy', strategy);
  for (const c of ['performance', 'seo', 'accessibility', 'best-practices'])
    api.searchParams.append('category', c);
  if (key) api.searchParams.set('key', key);

  const res = await fetchText(api.toString(), { timeoutMs: 90000 });
  if (!res.ok) return { url, strategy, error: `PSI ${res.status || res.error}` };

  let data;
  try { data = JSON.parse(res.text); } catch { return { url, strategy, error: 'PSI parse error' }; }
  if (data.error) return { url, strategy, error: data.error.message };

  const lh = data.lighthouseResult || {};
  const cat = lh.categories || {};
  const audits = lh.audits || {};
  const score = (c) => (cat[c]?.score != null ? Math.round(cat[c].score * 100) : null);
  const metric = (id) => audits[id]?.displayValue || null;

  const opportunities = Object.values(audits)
    .filter((a) => a.details?.type === 'opportunity' && (a.numericValue || 0) > 100)
    .sort((a, b) => (b.numericValue || 0) - (a.numericValue || 0))
    .slice(0, 5)
    .map((a) => ({ title: a.title, savingsMs: Math.round(a.numericValue || 0) }));

  return {
    url, strategy,
    scores: {
      performance: score('performance'), seo: score('seo'),
      accessibility: score('accessibility'), bestPractices: score('best-practices'),
    },
    metrics: {
      LCP: metric('largest-contentful-paint'), CLS: metric('cumulative-layout-shift'),
      TBT: metric('total-blocking-time'), FCP: metric('first-contentful-paint'),
      SI: metric('speed-index'), INP: metric('interaction-to-next-paint'),
    },
    opportunities,
  };
}

async function main() {
  const date = process.argv[2];
  const key = getSecret('GOOGLE_PAGESPEED_API_KEY');
  if (!key) log('PERF: GOOGLE_PAGESPEED_API_KEY not set — PSI may rate-limit (continuing keyless)');

  const results = [];
  for (const p of PATHS) {
    for (const s of STRATEGIES) {
      const url = PUBLIC_BASE + p;
      log(`PERF: PSI ${s} ${url}`);
      results.push(await runPSI(url, s, key));
    }
  }

  // Average scores per strategy for the email headline.
  const summary = {};
  for (const s of STRATEGIES) {
    const ok = results.filter((r) => r.strategy === s && r.scores);
    const avg = (k) => {
      const vals = ok.map((r) => r.scores[k]).filter((v) => v != null);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    };
    summary[s] = { performance: avg('performance'), seo: avg('seo'), accessibility: avg('accessibility'), bestPractices: avg('bestPractices') };
  }
  const errors = results.filter((r) => r.error).length;

  writeArtifact('perf.json', { generatedAt: new Date().toISOString(), base: PUBLIC_BASE, summary, errors, results }, date);
  log('PERF done:', JSON.stringify(summary));
}

main().catch((e) => { log('PERF collector fatal:', e.message); process.exit(0); });
