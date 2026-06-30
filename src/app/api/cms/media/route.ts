import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

const MEDIA_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'media-index.json');
const MEDIA_DIR = path.join((process.env.SHARED_ROOT || process.cwd()), 'public', 'uploads');

// Upload hardening (stored-XSS / DoS mitigation).
// Allow-list of extension -> canonical MIME. Raster images only. SVG is
// deliberately EXCLUDED — it is XML and can carry <script>/onload handlers,
// and uploads are served same-origin from /uploads, so an SVG (or HTML/JS
// renamed to an image extension) would be a stored-XSS vector. Anything not
// in this map is rejected.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXT_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

// Sniff the leading bytes so a file renamed to an image extension (e.g. an
// .html payload saved as foo.png) cannot masquerade as an image. The stored
// file's type is taken from this sniff, never from the client-declared MIME.
function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image/png';
  // GIF: "GIF87a" / "GIF89a"
  const head6 = buf.toString('ascii', 0, 6);
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'image/gif';
  // WEBP: "RIFF"...."WEBP"
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  // AVIF: ISO-BMFF "ftyp" box with an AVIF brand
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (brand === 'avif' || brand === 'avis' || brand === 'mif1' || brand === 'msf1') return 'image/avif';
  }
  return null;
}

const EXT_FOR_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

interface MediaItem {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: string;
  alt?: string;
  caption?: string;
  path: string;
  url?: string; // Public-facing URL for image display
}

const ensureDir = async () => {
  await mkdir(MEDIA_DIR, { recursive: true });
  const dir = path.dirname(MEDIA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const loadMedia = (): MediaItem[] => {
  if (!fs.existsSync(MEDIA_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(MEDIA_FILE, 'utf-8'));
  } catch {
    return [];
  }
};

const saveMedia = (items: MediaItem[]) => {
  fs.writeFileSync(MEDIA_FILE, JSON.stringify(items, null, 2));
};

const checkAuth = async (request: NextRequest) => {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = (token as any)?.role;
  const email = (token as any)?.email || 'admin';
  if (!role || !['admin', 'editor'].includes(role)) {
    return { authorized: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) };
  }
  return { authorized: true, email };
};

// GET - List media
export async function GET(request: NextRequest) {
  const auth = await checkAuth(request);
  if (!auth.authorized) return auth.response;

  await ensureDir();
  const media = loadMedia();
  // Ensure all items have a url property and type alias for backward compatibility
  const mediaWithUrls = media.map((item) => ({
    ...item,
    url: item.url || item.path,
    type: item.mimeType, // Alias for frontend
  }));
  return NextResponse.json(mediaWithUrls);
}

// POST - Upload file
export async function POST(request: NextRequest) {
  const auth = await checkAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    await ensureDir();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const alt = (formData.get('alt') as string) || '';
    const caption = (formData.get('caption') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 1) Extension allow-list (reject SVG/HTML/JS/etc. by omission).
    const declaredExt = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT_MIME[declaredExt]) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed: JPG, PNG, WebP, GIF, AVIF.' },
        { status: 415 },
      );
    }

    // 2) Declared MIME, if present, must be an image (cheap pre-read guard).
    const declaredMime = (file.type || '').toLowerCase();
    if (declaredMime && !declaredMime.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed: JPG, PNG, WebP, GIF, AVIF.' },
        { status: 415 },
      );
    }

    // 3) Size cap on the multipart-declared size before buffering.
    if (typeof file.size === 'number' && file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large (max 10 MB).' }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 4) Enforce the real byte length (don't trust the declared size).
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large (max 10 MB).' }, { status: 413 });
    }

    // 5) Magic-byte sniff — the actual content must be a real raster image.
    //    This is the authoritative type; the client-declared MIME is ignored.
    const sniffedMime = sniffImageMime(buffer);
    if (!sniffedMime) {
      return NextResponse.json(
        { error: 'File content is not a valid image.' },
        { status: 415 },
      );
    }

    // 6) Random, unguessable name + an extension derived from the sniffed type
    //    (so the served Content-Type always matches the real bytes).
    const id = randomUUID();
    const safeExt = EXT_FOR_MIME[sniffedMime] || declaredExt;
    const filename = `${id}${safeExt}`;
    const filepath = path.join(MEDIA_DIR, filename);

    await writeFile(filepath, buffer);

    const item: MediaItem = {
      id,
      filename,
      originalName: file.name,
      mimeType: sniffedMime,
      size: buffer.length,
      uploadedAt: new Date().toISOString(),
      uploadedBy: auth.email,
      alt,
      caption,
      path: `/uploads/${filename}`,
      url: `/uploads/${filename}`, // Add URL for frontend display
    };

    const media = loadMedia();
    media.push(item);
    saveMedia(media);

    // Return with type alias for frontend compatibility
    return NextResponse.json({ ...item, type: item.mimeType }, { status: 201 });
  } catch (error) {
    console.error('Upload failed', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// DELETE - Remove media
export async function DELETE(request: NextRequest) {
  const auth = await checkAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const media = loadMedia();
    const idx = media.findIndex((m) => m.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const item = media[idx];
    const filepath = path.join(MEDIA_DIR, item.filename);

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    media.splice(idx, 1);
    saveMedia(media);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete failed', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}

// PUT - Update metadata
export async function PUT(request: NextRequest) {
  const auth = await checkAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const { id, alt, caption } = body;

    const media = loadMedia();
    const idx = media.findIndex((m) => m.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (alt !== undefined) media[idx].alt = alt;
    if (caption !== undefined) media[idx].caption = caption;

    saveMedia(media);
    return NextResponse.json(media[idx]);
  } catch (error) {
    console.error('Update failed', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
