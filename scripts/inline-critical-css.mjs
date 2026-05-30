#!/usr/bin/env node
// Post-build pass that runs Beasties on every prerendered HTML file to inline
// critical (above-the-fold) CSS and async-load the rest. This is the App Router
// equivalent of Next's experimental.optimizeCss (which only runs for Pages
// Router in Next 16).
//
// Idempotent — safe to run multiple times.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import Beasties from 'beasties';

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, '.next', 'server', 'app');
const PUBLIC_DIR = path.join(ROOT, 'public');
const STATIC_DIR = path.join(ROOT, '.next', 'static');

const INLINED_MARKER = '<!-- beasties-inlined -->';

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else if (entry.isFile() && p.endsWith('.html')) out.push(p);
  }
  return out;
}

async function main() {
  let files;
  try {
    files = await walk(APP_DIR);
  } catch (e) {
    console.error('[inline-critical-css] .next/server/app missing — run `next build` first.');
    process.exit(1);
  }

  if (files.length === 0) {
    console.warn('[inline-critical-css] No .html files found under .next/server/app — nothing to do.');
    return;
  }

  const beasties = new Beasties({
    path: PUBLIC_DIR,
    publicPath: '/',
    additionalStylesheets: [],
    pruneSource: false,
    preload: 'media',
    inlineFonts: false,
    fonts: false,
    compress: true,
    logLevel: 'silent',
  });

  // Beasties resolves URLs against `path` (public/), but Next CSS lives under
  // .next/static — rewrite any path that traverses /_next/static/ to the real
  // disk location before reading.
  const origReadFile = beasties.readFile.bind(beasties);
  beasties.readFile = async (filePath) => {
    const idx = filePath.indexOf('/_next/static/');
    if (idx !== -1) {
      const rel = filePath.slice(idx + '/_next/static/'.length);
      return fs.readFile(path.join(STATIC_DIR, rel), 'utf8');
    }
    return origReadFile(filePath);
  };

  let processed = 0;
  let skipped = 0;

  for (const file of files) {
    const html = await fs.readFile(file, 'utf8');
    if (html.includes(INLINED_MARKER)) { skipped++; continue; }
    if (!html.includes('<link rel="stylesheet"')) { skipped++; continue; }

    try {
      const out = await beasties.process(html);
      await fs.writeFile(file, out + '\n' + INLINED_MARKER);
      processed++;
    } catch (e) {
      console.warn(`[inline-critical-css] skipped ${path.relative(ROOT, file)}: ${e.message}`);
      skipped++;
    }
  }

  console.log(`[inline-critical-css] processed ${processed} file(s), skipped ${skipped}.`);
}

main().catch((e) => {
  console.error('[inline-critical-css] failed:', e);
  process.exit(1);
});
