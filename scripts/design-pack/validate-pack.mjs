#!/usr/bin/env node
// Validate a design-pack directory against the format contract (packFormat 1).
// Usage: node scripts/design-pack/validate-pack.mjs <packDir>
//
// No bundled example pack lives in this repo (it's the consumer, not a pack store),
// so the pack directory is a required argument — point it at the pack you're checking.
//
// Pure Node built-ins — no deps. Checks the manifest, apply-mode enums, forbidden
// files, and page shape. Exits non-zero on any violation. Mirrors the runtime
// guards in src/lib/design-pack/{types,extract,apply}.ts — keep in sync.

import * as fs from 'fs';
import * as path from 'path';

const PACK_FORMAT = 1;
const APPLY_MODES = ['merge', 'overwrite', 'merge-design-keys', 'upsert-by-slug', 'copy-if-absent'];
const FORBIDDEN_FILES = [
  'secrets.json', 'users.json', 'seo.json', 'cms.db', 'cms.db-wal', 'cms.db-shm',
  'submissions.json', 'applications.json', 'leads.json', 'blocked-ips.json',
];
const FORBIDDEN_PATTERNS = [/(^|\/)\.env/i];

if (!process.argv[2]) {
  console.error('Usage: node scripts/design-pack/validate-pack.mjs <packDir>');
  process.exit(2);
}
const dir = path.resolve(process.argv[2]);
const errors = [];
const fail = (m) => errors.push(m);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

// Walk every file in the pack, checking forbidden names/patterns.
function walk(d, base = '') {
  for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
    const rel = path.posix.join(base, entry.name);
    if (FORBIDDEN_FILES.includes(entry.name) || FORBIDDEN_PATTERNS.some((re) => re.test(rel))) {
      fail(`Forbidden file present in pack: ${rel}`);
    }
    if (entry.isDirectory()) walk(path.join(d, entry.name), rel);
  }
}

if (!fs.existsSync(dir)) {
  console.error(`✗ Pack dir not found: ${dir}`);
  process.exit(2);
}

// 1. Manifest.
const manifestPath = path.join(dir, 'pack.json');
if (!fs.existsSync(manifestPath)) {
  fail('pack.json missing');
} else {
  let m;
  try { m = readJson(manifestPath); } catch (e) { fail(`pack.json not valid JSON: ${e.message}`); }
  if (m) {
    if (m.packFormat !== PACK_FORMAT) fail(`packFormat must be ${PACK_FORMAT} (got ${JSON.stringify(m.packFormat)})`);
    for (const k of ['name', 'slug', 'version']) {
      if (typeof m[k] !== 'string' || !m[k]) fail(`manifest.${k} must be a non-empty string`);
    }
    if (m.slug && !/^[a-z0-9-]+$/.test(m.slug)) fail(`manifest.slug must match ^[a-z0-9-]+$ (got "${m.slug}")`);
    if (m.contents) {
      for (const [k, v] of Object.entries(m.contents)) {
        if (!APPLY_MODES.includes(v)) fail(`contents.${k} has invalid apply mode "${v}"`);
      }
    }
  }
}

// 2. Forbidden files anywhere.
walk(dir);

// 3. Pages shape.
const pagesDir = path.join(dir, 'pages');
let pageCount = 0;
if (fs.existsSync(pagesDir)) {
  for (const f of fs.readdirSync(pagesDir).filter((n) => n.endsWith('.json'))) {
    pageCount++;
    let p;
    try { p = readJson(path.join(pagesDir, f)); } catch (e) { fail(`pages/${f}: invalid JSON (${e.message})`); continue; }
    if (!p.slug || !p.title) fail(`pages/${f}: missing slug or title`);
    if (!Array.isArray(p.blocks)) { fail(`pages/${f}: blocks must be an array`); continue; }
    p.blocks.forEach((b, i) => {
      if (!b.type) fail(`pages/${f}: block[${i}] missing type`);
      if (b.props == null || typeof b.props !== 'object' || Array.isArray(b.props)) {
        fail(`pages/${f}: block[${i}].props must be an object (editor convention), not a string/array`);
      }
    });
  }
}

if (errors.length) {
  console.error(`✗ ${path.relative(process.cwd(), dir)} — ${errors.length} problem(s):`);
  for (const e of errors) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✓ Valid design pack: ${path.relative(process.cwd(), dir)} (${pageCount} page(s))`);
