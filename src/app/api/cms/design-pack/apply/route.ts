import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import * as fs from 'fs';
import * as path from 'path';
import { extractPack } from '@adminpanel/lib/design-pack/extract';
import { applyDesignPack } from '@adminpanel/lib/design-pack/apply';
import { isStaticPack, importStaticPack } from '@adminpanel/lib/design-pack/static-pack';
import { adminExists } from '@adminpanel/lib/auth/setup-gate';
import type { DesignTokens } from '@adminpanel/lib/design-pack/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PACK_BYTES = 100 * 1024 * 1024; // 100 MB

// Block fetching a pack from a private/loopback/link-local/metadata address (SSRF).
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h === '[::1]' || h === '0.0.0.0') return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return true;
  }
  return false;
}

// Fetch a remote pack, re-validating every redirect hop (https + non-private host).
async function fetchPack(initialUrl: URL): Promise<Buffer> {
  let url = initialUrl;
  for (let hop = 0; hop < 5; hop++) {
    if (url.protocol !== 'https:') throw new Error('Pack URL must be https.');
    if (isBlockedHost(url.hostname)) throw new Error('Pack URL host is not allowed.');
    const res = await fetch(url, { redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error('Redirect without a Location.');
      url = new URL(loc, url);
      continue;
    }
    if (!res.ok) throw new Error(`Failed to fetch pack: HTTP ${res.status}`);
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_PACK_BYTES) throw new Error('Pack exceeds 100 MB limit.');
    return Buffer.from(ab);
  }
  throw new Error('Too many redirects fetching the pack.');
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = String((token as any)?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'administrator';
  const firstRun = !adminExists();

  if (!isAdmin && !firstRun) {
    return NextResponse.json({ error: 'Unauthorized: admin role required' }, { status: 403 });
  }

  const contentType = request.headers.get('content-type') || '';
  let packBuffer: Buffer | null = null;
  let tokens: DesignTokens = {};
  let extractedDir: string | null = null;
  let packName = 'site'; // used to namespace a static pack's assets (pack-<slug>)

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('pack');
      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'No pack file uploaded (field "pack").' }, { status: 400 });
      }
      const ab = await (file as File).arrayBuffer();
      if (ab.byteLength > MAX_PACK_BYTES) {
        return NextResponse.json({ error: 'Pack exceeds 100 MB limit.' }, { status: 413 });
      }
      packBuffer = Buffer.from(ab);
      if ((file as File).name) packName = (file as File).name;
      const rawTokens = form.get('tokens');
      if (typeof rawTokens === 'string' && rawTokens.trim()) {
        try { tokens = JSON.parse(rawTokens); } catch { /* ignore malformed tokens */ }
      }
    } else {
      const body = await request.json().catch(() => ({}));
      tokens = body?.tokens || {};
      // Fetching a remote pack or reading a server path is admin-only (SSRF / FS safety):
      // the unauthenticated first-run path accepts uploads only.
      if (body?.url) {
        if (!isAdmin) return NextResponse.json({ error: 'Applying a pack by URL requires admin login.' }, { status: 403 });
        const u = new URL(String(body.url));
        packBuffer = await fetchPack(u);
        packName = path.basename(u.pathname) || packName;
      } else if (body?.path) {
        if (!isAdmin) return NextResponse.json({ error: 'Applying a pack by path requires admin login.' }, { status: 403 });
        if (!fs.existsSync(body.path)) return NextResponse.json({ error: 'Pack path not found.' }, { status: 400 });
        packBuffer = fs.readFileSync(body.path);
        packName = path.basename(body.path) || packName;
      }
      if (typeof body?.packName === 'string' && body.packName.trim()) packName = body.packName;
    }

    if (!packBuffer) {
      return NextResponse.json({ error: 'No pack provided (upload a file, or pass {url} / {path}).' }, { status: 400 });
    }

    extractedDir = extractPack(packBuffer);
    // Two pack types: a CMS-block pack (has pack.json) vs a finished static-HTML
    // site (no pack.json, has .html files). Route to the matching importer.
    let result: unknown;
    if (fs.existsSync(path.join(extractedDir, 'pack.json'))) {
      // First-run has no prior content worth a (slow, full) backup; admin re-apply does.
      result = await applyDesignPack(extractedDir, { tokens, backup: !firstRun });
    } else if (isStaticPack(extractedDir)) {
      result = await importStaticPack(extractedDir, { tokens, packName });
    } else {
      return NextResponse.json(
        { error: 'Unrecognized pack: no pack.json (CMS-block pack) and no .html files (static-site pack).' },
        { status: 400 },
      );
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return NextResponse.json({ error: `Apply failed: ${(e as Error).message}` }, { status: 400 });
  } finally {
    if (extractedDir) {
      try { fs.rmSync(extractedDir, { recursive: true, force: true }); } catch { /* best effort */ }
    }
  }
}
