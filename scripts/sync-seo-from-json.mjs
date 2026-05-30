#!/usr/bin/env node
// One-shot: copy the `seo` block from cms-data/pages.json into the SQLite
// pages table. Only touches the `seo` column; never modifies blocks, status,
// title, or any other field.

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const root = process.cwd();
const pagesJson = JSON.parse(
  fs.readFileSync(path.join(root, 'cms-data', 'pages.json'), 'utf-8'),
);
const db = new Database(path.join(root, 'cms-data', 'cms.db'));

// Bump updatedAt alongside seo so the sitemap's <lastmod> reflects the
// change. Without this, sync-only edits never emit a recrawl signal to
// Google (see docs/AUDIT_SEO_2026-05-25.md §B2).
const update = db.prepare('UPDATE pages SET seo = ?, updatedAt = ? WHERE id = ?');
const findBySlug = db.prepare('SELECT id FROM pages WHERE slug = ?');
const now = new Date().toISOString();

let updated = 0;
let skipped = 0;
for (const page of pagesJson) {
  if (!page?.seo) {
    skipped++;
    continue;
  }
  let id = page.id;
  const existing = db.prepare('SELECT id FROM pages WHERE id = ?').get(id);
  if (!existing) {
    const bySlug = findBySlug.get(page.slug);
    if (!bySlug) {
      console.log(`  - skip: no DB row for ${page.slug}`);
      skipped++;
      continue;
    }
    id = bySlug.id;
  }
  update.run(JSON.stringify(page.seo), now, id);
  console.log(`  ✓ ${page.slug}  →  ${(page.seo.metaTitle || page.seo.title || '').slice(0, 60)}`);
  updated++;
}

console.log(`\nDone. Updated ${updated} pages, skipped ${skipped}.`);
db.close();
