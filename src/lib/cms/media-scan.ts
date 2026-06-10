import fs from 'fs';
import path from 'path';

// Orphan-upload indexer, shared by POST /api/cms/media/scan and the OODA auto-apply
// lane. Idempotent + reversible: only ADDS entries to cms-data/media-index.json for
// files already present in public/uploads/ that aren't indexed yet. Never deletes.

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

export interface MediaItem {
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

export interface ScanResult {
  indexed: number;
  total: number;
  newFiles: string[];
  message?: string;
}

function loadMedia(): MediaItem[] {
  if (!fs.existsSync(MEDIA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(MEDIA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export function scanOrphanUploads(uploadedBy = 'system'): ScanResult {
  if (!fs.existsSync(MEDIA_DIR)) {
    return { indexed: 0, total: 0, newFiles: [], message: 'Uploads directory not found' };
  }
  const existing = loadMedia();
  const tracked = new Set(existing.map((m) => m.filename));
  const allFiles = fs.readdirSync(MEDIA_DIR).filter((f) => {
    try { return fs.statSync(path.join(MEDIA_DIR, f)).isFile(); } catch { return false; }
  });

  const newItems: MediaItem[] = [];
  for (const filename of allFiles) {
    if (tracked.has(filename)) continue;
    const stat = fs.statSync(path.join(MEDIA_DIR, filename));
    newItems.push({
      id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      filename,
      originalName: filename,
      mimeType: guessMime(filename),
      size: stat.size,
      uploadedAt: stat.mtime.toISOString(),
      uploadedBy,
      alt: '',
      caption: '',
      path: `/uploads/${filename}`,
      url: `/uploads/${filename}`,
    });
  }

  if (newItems.length > 0) {
    fs.writeFileSync(MEDIA_FILE, JSON.stringify([...existing, ...newItems], null, 2));
  }
  return { indexed: newItems.length, total: allFiles.length, newFiles: newItems.map((i) => i.filename) };
}
