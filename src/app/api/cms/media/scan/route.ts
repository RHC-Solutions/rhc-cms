import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import fs from 'fs';
import path from 'path';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime', '.pdf': 'application/pdf',
};
const guessMime = (filename: string) =>
  MIME_MAP[path.extname(filename).toLowerCase()] ?? 'application/octet-stream';

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
  url: string;
}

const loadMedia = (): MediaItem[] => {
  if (!fs.existsSync(MEDIA_FILE)) return [];
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
    return { authorized: false, email: '', response: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) };
  }
  return { authorized: true, email, response: null };
};

// POST - Scan uploads directory and index untracked files
export async function POST(request: NextRequest) {
  const auth = await checkAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    if (!fs.existsSync(MEDIA_DIR)) {
      return NextResponse.json({ indexed: 0, total: 0, message: 'Uploads directory not found' });
    }

    const existing = loadMedia();
    const trackedFilenames = new Set(existing.map((m) => m.filename));

    const allFiles = fs.readdirSync(MEDIA_DIR).filter((f) => {
      const stat = fs.statSync(path.join(MEDIA_DIR, f));
      return stat.isFile();
    });

    const newItems: MediaItem[] = [];

    for (const filename of allFiles) {
      if (trackedFilenames.has(filename)) continue;

      const filepath = path.join(MEDIA_DIR, filename);
      const stat = fs.statSync(filepath);
      const mimeType = guessMime(filename);

      newItems.push({
        id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        filename,
        originalName: filename,
        mimeType,
        size: stat.size,
        uploadedAt: stat.mtime.toISOString(),
        uploadedBy: auth.email,
        alt: '',
        caption: '',
        path: `/uploads/${filename}`,
        url: `/uploads/${filename}`,
      });

      // Small delay to ensure unique IDs
      await new Promise((r) => setTimeout(r, 1));
    }

    if (newItems.length > 0) {
      saveMedia([...existing, ...newItems]);
    }

    return NextResponse.json({
      indexed: newItems.length,
      total: allFiles.length,
      newFiles: newItems.map((i) => i.filename),
    });
  } catch (error) {
    console.error('Scan failed', error);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}
