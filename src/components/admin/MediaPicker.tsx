'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@adminpanel/components/admin/Toast';
import { FaImage, FaTimes, FaUpload, FaSearch, FaTrash } from 'react-icons/fa';

/**
 * Reusable media field + gallery modal. One source of truth for "browse the media
 * library to pick an image/video" across the admin (SEO OG image, theme logo/favicon,
 * landing-page hero, page-editor SEO). Fetches /api/cms/media, supports inline upload,
 * and shows a helpful empty state instead of a blank grid. Keeps the editable text
 * field too, so an explicit/external URL can still be pasted.
 */

export interface MediaPickerItem {
  id: string;
  url: string;
  filename: string;
  type?: string; // mime
  alt?: string;
  system?: boolean;
}

const isImageUrl = (u: string) => /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(u);
// Sanitize a value before it reaches an <img src> sink: return it only when it's an
// http(s) / root-relative / image-data URL, else ''. Never lets arbitrary schemes
// (javascript:, etc.) through. The sink uses this RETURN value, so the raw input
// never reaches the DOM unsanitized.
const safeImgSrc = (u: string): string => {
  const s = (u || '').trim();
  return /^https?:\/\//i.test(s) || s.startsWith('/') || /^data:image\//i.test(s) ? s : '';
};

export default function MediaPicker({
  value,
  onChange,
  accept = 'image',
  label,
  placeholder = 'No media selected — browse or paste a URL',
}: {
  value: string;
  onChange: (url: string, item?: MediaPickerItem) => void;
  accept?: 'image' | 'video' | 'all';
  label?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const safeSrc = safeImgSrc(value);
  const showImg = !!safeSrc && (accept !== 'video') && (isImageUrl(value) || accept === 'image');

  return (
    <div>
      {label && <label className="block text-text-primary font-semibold mb-2">{label}</label>}
      <div className="flex items-start gap-4">
        <div className="w-24 h-24 shrink-0 bg-dark border border-dark-border rounded-lg overflow-hidden flex items-center justify-center">
          {showImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={safeSrc} alt="" className="w-full h-full object-contain" />
          ) : (
            <FaImage className="text-2xl text-text-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 bg-cyber-green text-dark font-semibold px-3 py-2 rounded-lg hover:bg-cyber-green/90 text-sm"
            >
              <FaImage /> Browse media
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-red-400 px-3 py-2"
              >
                <FaTrash /> Clear
              </button>
            )}
          </div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-2 px-3 text-text-primary text-sm focus:border-cyber-cyan focus:outline-none font-mono break-all"
          />
        </div>
      </div>

      {open && (
        <MediaPickerModal
          accept={accept}
          onPick={(item) => {
            onChange(item.url, item);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function MediaPickerModal({
  accept,
  onPick,
  onClose,
}: {
  accept: 'image' | 'video' | 'all';
  onPick: (item: MediaPickerItem) => void;
  onClose: () => void;
}) {
  const { addToast } = useToast();
  const [items, setItems] = useState<MediaPickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/media', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load media');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      addToast('error', e?.message || 'Failed to load media');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/cms/media', { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) throw new Error('Upload failed');
      const item = await res.json();
      addToast('success', `Uploaded ${item.filename || file.name}`);
      onPick({ id: item.id, url: item.url, filename: item.filename, type: item.type, alt: item.alt });
    } catch (e: any) {
      addToast('error', e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const t = (i.type || '').toLowerCase();
      const matchesType =
        accept === 'all' ? true : accept === 'video' ? t.startsWith('video') : t.startsWith('image');
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q || (i.filename || '').toLowerCase().includes(q) || (i.alt || '').toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [items, search, accept]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-dark-card border border-dark-border rounded-xl max-w-5xl w-full my-8">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-dark-border sticky top-0 bg-dark-card z-10">
          <h2 className="text-xl font-bold text-text-primary">Media gallery</h2>
          <div className="flex items-center gap-2 flex-1 max-w-sm ml-auto">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search media…"
                className="w-full bg-dark border border-dark-border rounded-lg py-2 pl-9 pr-3 text-sm text-text-primary focus:border-cyber-cyan focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 bg-cyber-green text-dark font-semibold px-3 py-2 rounded-lg hover:bg-cyber-green/90 text-sm disabled:opacity-60"
            >
              <FaUpload /> {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={accept === 'video' ? 'video/*' : accept === 'all' ? 'image/*,video/*' : 'image/*'}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = '';
              }}
            />
          </div>
          <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary" aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="py-16 text-center text-text-muted">Loading media…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <FaImage className="mx-auto text-4xl text-text-muted mb-3" />
              <p className="text-text-secondary mb-1">No media yet.</p>
              <p className="text-text-muted text-sm">Upload a file above — it will appear here and be available everywhere.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((item) => {
                const isVid = (item.type || '').toLowerCase().startsWith('video');
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => onPick(item)}
                    className="group text-left bg-dark border border-dark-border rounded-lg overflow-hidden hover:border-cyber-green focus:border-cyber-green focus:outline-none"
                  >
                    <div className="aspect-square bg-black/40 flex items-center justify-center overflow-hidden">
                      {isVid ? (
                        <video src={item.url} muted playsInline className="w-full h-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.url} alt={item.alt || ''} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-xs text-text-primary truncate" title={item.filename}>{item.filename}</div>
                      {item.system && <span className="text-[10px] text-cyber-cyan">brand asset</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
