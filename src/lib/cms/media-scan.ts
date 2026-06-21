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
  system?: boolean; // bundled brand asset (logo/favicon/og) seeded by seedBrandMedia
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

// Bundled brand assets a freshly-deployed site already has on disk but that never
// land in media-index.json (so /admin/media starts empty and the logo/favicon are
// invisible). seedBrandMedia surfaces them as managed media. Idempotent + additive:
// keyed by served URL, never overwrites or deletes. Assets already under public/ are
// referenced in place; Next file-convention icons (src/app/icon.png …) live outside
// public/, so they're copied into public/uploads/ to guarantee they're served.
const BRAND_CANDIDATES: { url?: string; rel: string; copyAs?: string; label: string }[] = [
  { rel: 'public/logo.png', url: '/logo.png', label: 'Logo' },
  { rel: 'public/logo.svg', url: '/logo.svg', label: 'Logo' },
  { rel: 'public/favicon.ico', url: '/favicon.ico', label: 'Favicon' },
  { rel: 'public/og-image.jpg', url: '/og-image.jpg', label: 'Social share image' },
  { rel: 'public/og-image.png', url: '/og-image.png', label: 'Social share image' },
  // Next metadata-file icons — outside public/, copy into uploads so they render.
  { rel: 'src/app/icon.png', copyAs: 'favicon.png', label: 'Favicon' },
  { rel: 'app/icon.png', copyAs: 'favicon.png', label: 'Favicon' },
  { rel: 'src/app/apple-icon.png', copyAs: 'apple-icon.png', label: 'Apple touch icon' },
  { rel: 'app/apple-icon.png', copyAs: 'apple-icon.png', label: 'Apple touch icon' },
];

export function seedBrandMedia(uploadedBy = 'system'): { seeded: number; files: string[] } {
  const root = process.env.SHARED_ROOT || process.cwd();
  const existing = loadMedia();
  const seenUrls = new Set(existing.map((m) => m.url));
  const seenFiles = new Set(existing.map((m) => m.filename));
  const added: MediaItem[] = [];

  for (const cand of BRAND_CANDIDATES) {
    const src = path.join(root, cand.rel);
    if (!fs.existsSync(src)) continue;
    let url: string;
    let filename: string;
    if (cand.copyAs) {
      // Copy into public/uploads so it's served + becomes real managed media.
      filename = cand.copyAs;
      url = `/uploads/${filename}`;
      if (seenUrls.has(url) || seenFiles.has(filename)) continue;
      try {
        if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
        const dest = path.join(MEDIA_DIR, filename);
        if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
      } catch { continue; }
    } else {
      url = cand.url!;
      filename = path.basename(cand.rel);
      if (seenUrls.has(url)) continue;
    }
    seenUrls.add(url);
    seenFiles.add(filename);
    let size = 0;
    try { size = fs.statSync(path.join(root, cand.copyAs ? path.join('public', 'uploads', filename) : cand.rel)).size; } catch { /* best effort */ }
    added.push({
      id: `brand_${filename.replace(/[^a-z0-9]+/gi, '_')}`,
      filename,
      originalName: filename,
      mimeType: guessMime(filename),
      size,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
      alt: cand.label,
      caption: '',
      path: url,
      url,
      system: true,
    });
  }

  if (added.length > 0) {
    const dir = path.dirname(MEDIA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MEDIA_FILE, JSON.stringify([...existing, ...added], null, 2));
  }
  return { seeded: added.length, files: added.map((i) => i.filename) };
}
