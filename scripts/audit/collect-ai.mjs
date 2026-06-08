/**
 * AI / Agent readiness collector. Four dimensions:
 *   1. AI crawler access  — robots.txt rules for known AI agents + llms.txt presence
 *   2. Structured data     — JSON-LD extracted from rendered pages, parsed + typed
 *   3. GEO / answer-ready   — heading structure, length, FAQ/answer signals
 *   4. Content / E-E-A-T    — thin content, missing dates/expertise signals
 *
 * Run: node scripts/audit/collect-ai.mjs
 */
import { loadPages, fetchText, writeArtifact, LOCAL_BASE, log } from './_lib.mjs';

// Agents we want to see explicitly addressed (allowed) in robots.txt.
const AI_AGENTS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-SearchBot',
  'anthropic-ai', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended',
  'CCBot', 'Bytespider', 'Amazonbot', 'cohere-ai', 'Meta-ExternalAgent',
];

function extractJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const types = [];
  const errors = [];
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b[1].trim());
      const arr = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];
      for (const node of arr) if (node && node['@type']) types.push(node['@type']);
    } catch (e) {
      errors.push(e.message);
    }
  }
  return { count: blocks.length, types: types.flat(), errors };
}

function textStats(html) {
  const body = (html.match(/<body[\s\S]*?<\/body>/i) || [html])[0];
  // Match script/style blocks with a tag-name word boundary and a whitespace-
  // tolerant closing tag (browsers accept `</script >`), so the block can't be
  // smuggled past the filter (js/bad-tag-filter). This is metrics-only word
  // counting, not security sanitization.
  const stripped = body
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    words: stripped ? stripped.split(' ').length : 0,
    h2: (html.match(/<h2[\s>]/gi) || []).length,
    h3: (html.match(/<h3[\s>]/gi) || []).length,
    hasDate: /\b(19|20)\d{2}\b/.test(stripped) || /datetime=/i.test(html),
    hasFaqSchema: /FAQPage/i.test(html),
    hasQuestionHeading: /<h[23][^>]*>[^<]*\?/i.test(html),
  };
}

async function main() {
  const date = process.argv[2];
  const findings = [];
  const add = (severity, area, page, detail) => findings.push({ severity, area, page, detail });

  // 1) AI crawler access
  const robotsRes = await fetchText(LOCAL_BASE + '/robots.txt');
  const robotsTxt = robotsRes.ok ? robotsRes.text : '';
  const crawlerStatus = {};
  for (const ua of AI_AGENTS) {
    const re = new RegExp(`User-agent:\\s*${ua}\\b`, 'i');
    crawlerStatus[ua] = re.test(robotsTxt) ? 'addressed' : 'not-mentioned';
    if (!re.test(robotsTxt))
      add('low', 'crawler-access', '/robots.txt', `${ua} not explicitly addressed (falls back to "*" allow)`);
    if (new RegExp(`User-agent:\\s*${ua}[\\s\\S]*?Disallow:\\s*/\\s*$`, 'im').test(robotsTxt))
      add('high', 'crawler-access', '/robots.txt', `${ua} appears fully disallowed`);
  }
  const llms = await fetchText(LOCAL_BASE + '/llms.txt');
  const hasLlmsTxt = llms.ok && llms.status === 200;
  if (!hasLlmsTxt)
    add('low', 'crawler-access', '/llms.txt', 'No /llms.txt — recommended for AI assistant grounding/citation');

  // 2-4) per-page structured data + content heuristics
  let pages = [];
  try { pages = (await loadPages()).filter((p) => p.status === 'published'); }
  catch (e) { add('high', 'content', '(db)', `cms.db read failed: ${e.message}`); }

  const perPage = [];
  for (const p of pages) {
    const url = LOCAL_BASE + (p.slug === '/' ? '/' : p.slug);
    const res = await fetchText(url);
    if (!res.ok) { add('high', 'render', p.slug, `fetch ${url} -> ${res.status || res.error}`); continue; }
    const jsonld = extractJsonLd(res.text);
    const stats = textStats(res.text);
    perPage.push({ slug: p.slug, jsonld: { count: jsonld.count, types: jsonld.types }, stats });

    if (jsonld.errors.length) add('high', 'json-ld', p.slug, `Invalid JSON-LD: ${jsonld.errors[0]}`);
    if (jsonld.count === 0) add('medium', 'json-ld', p.slug, 'No JSON-LD on page');
    if (p.slug === '/' && !jsonld.types.some((t) => /Organization/i.test(t)))
      add('medium', 'json-ld', '/', 'Root page missing Organization JSON-LD');
    if (/^\/services\/[^/]+$/.test(p.slug) && !jsonld.types.some((t) => /Service/i.test(t)))
      add('medium', 'json-ld', p.slug, 'Service leaf page missing Service JSON-LD');
    if (!jsonld.types.some((t) => /BreadcrumbList/i.test(t)) && p.slug !== '/')
      add('low', 'json-ld', p.slug, 'No BreadcrumbList JSON-LD');

    if (stats.words < 300) add('medium', 'geo', p.slug, `Thin content (~${stats.words} words) — weak for AI extraction/citation`);
    if (stats.h2 === 0) add('low', 'geo', p.slug, 'No <h2> — flat structure hurts answer extraction');
    if (!stats.hasDate) add('low', 'eeat', p.slug, 'No visible date — freshness/E-E-A-T signal missing');
  }

  const summary = {
    pages: perPage.length,
    hasLlmsTxt,
    crawlersAddressed: Object.values(crawlerStatus).filter((v) => v === 'addressed').length,
    crawlersTotal: AI_AGENTS.length,
    counts: findings.reduce((a, f) => ((a[f.severity] = (a[f.severity] || 0) + 1), a), {}),
  };
  writeArtifact('ai.json', {
    generatedAt: new Date().toISOString(), summary, crawlerStatus, findings, perPage,
  }, date);
  log('AI done:', JSON.stringify(summary));
}

main().catch((e) => { log('AI collector fatal:', e.message); process.exit(0); });
