'use client';
import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { useToast } from '@adminpanel/components/admin/Toast';
import { FaUpload, FaTrash, FaImage, FaFileVideo, FaFilePdf, FaSearch, FaSyncAlt, FaCheckCircle } from 'react-icons/fa';

interface MediaItem {
  id: string;
  filename: string;
  url: string;
  size: number;
  type: string;
  alt?: string;
  caption?: string;
  uploadedAt: string;
  path?: string;
}

export default function MediaLibrary() {
  const { addToast } = useToast();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ indexed: number; total: number } | null>(null);

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/cms/media/scan', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Scan failed');
      const data = await res.json();
      setScanResult({ indexed: data.indexed, total: data.total });
      if (data.indexed > 0) {
        await fetchMedia();
        addToast('success', `Indexed ${data.indexed} new file${data.indexed === 1 ? '' : 's'}`);
      }
    } catch (error) {
      console.error('Scan failed', error);
      addToast('error', 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/media', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setMedia(data || []);
    } catch (error) {
      console.error('Fetch failed', error);
      addToast('error', 'Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', files[0]);
    formData.append('alt', `Media ${new Date().toLocaleDateString()}`);

    try {
      const res = await fetch('/api/cms/media', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const newMedia = await res.json();
      setMedia((prev) => [newMedia, ...prev]);
      addToast('success', 'Media uploaded');
    } catch (error) {
      console.error('Upload failed', error);
      addToast('error', 'Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  const deleteMedia = async (id: string) => {
    if (!confirm('Delete this media?')) return;
    try {
      await fetch(`/api/cms/media?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setMedia((prev) => prev.filter((m) => m.id !== id));
      addToast('success', 'Media deleted');
    } catch (error) {
      console.error('Delete failed', error);
      addToast('error', 'Failed to delete');
    }
  };

  const filtered = media.filter((m) => m.filename.toLowerCase().includes(searchTerm.toLowerCase()));
  const getIcon = (type: string | undefined) => {
    if (!type) return FaImage;
    if (type.startsWith('image')) return FaImage;
    if (type.startsWith('video')) return FaFileVideo;
    if (type === 'application/pdf') return FaFilePdf;
    return FaImage;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <AdminShell title="Media Library">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="heading-xl text-gradient mb-2">Media Library</h1>
          <p className="text-text-secondary">Manage your images, videos, and documents</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="btn-secondary flex items-center space-x-2"
          >
            <FaSyncAlt className={scanning ? 'animate-spin' : ''} />
            <span>{scanning ? 'Scanning…' : 'Scan Uploads'}</span>
          </button>
          <label className="btn-primary flex items-center space-x-2 cursor-pointer">
            <FaUpload />
            <span>Upload Media</span>
            <input type="file" onChange={handleFileUpload} className="hidden" accept="image/*,video/*,.pdf" disabled={uploading} />
          </label>
        </div>
      </div>

      {scanResult !== null && (
        <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-lg border border-cyber-green/40 bg-cyber-green/10 text-cyber-green text-sm">
          <FaCheckCircle />
          <span>Scan complete &mdash; {scanResult.indexed} photo{scanResult.indexed === 1 ? '' : 's'} indexed</span>
          <button
            className="ml-auto text-text-secondary hover:text-text-primary text-xs"
            onClick={() => setScanResult(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="card-cyber p-6 mb-6">
        <div className="flex-1 relative">
          <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Search media..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 pl-12 pr-4 text-text-primary focus:border-cyber-green focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-text-secondary">Loading media...</div>
      ) : filtered.length === 0 ? (
        <div className="text-text-secondary">No media found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((item) => {
            const Icon = getIcon(item.type);
            return (
              <div key={item.id} className="card-cyber p-4 group hover:border-cyber-green transition-all">
                <div className="aspect-square bg-dark-lighter rounded-lg flex items-center justify-center mb-4 overflow-hidden">
                  {item.type && item.type.startsWith('image') ? (
                    <img src={item.url} alt={item.alt || item.filename} className="w-full h-full object-cover" />
                  ) : (
                    <Icon className="text-6xl text-cyber-green" />
                  )}
                </div>
                <h3 className="text-text-primary font-semibold mb-1 truncate text-sm">{item.filename}</h3>
                <p className="text-text-secondary text-xs mb-4">{formatSize(item.size)}</p>
                <div className="flex items-center space-x-2">
                  <button className="flex-1 btn-secondary py-2 text-sm" onClick={() => navigator.clipboard.writeText(item.url)}>
                    Copy Link
                  </button>
                  <button className="p-2 text-cyber-red hover:bg-cyber-red/20 rounded" onClick={() => deleteMedia(item.id)}>
                    <FaTrash />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
