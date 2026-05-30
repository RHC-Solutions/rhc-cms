import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { writeFile, mkdir } from 'fs/promises';
import fs from 'fs';
import path from 'path';

const MEDIA_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'media-index.json');
const MEDIA_DIR = path.join((process.env.SHARED_ROOT || process.cwd()), 'public', 'uploads');

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

    const id = Date.now().toString();
    const ext = path.extname(file.name);
    const filename = `${id}${ext}`;
    const filepath = path.join(MEDIA_DIR, filename);

    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    const item: MediaItem = {
      id,
      filename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
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
