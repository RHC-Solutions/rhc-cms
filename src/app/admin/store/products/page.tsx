'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaBoxOpen, FaSpinner, FaPlus, FaTrash, FaEdit, FaTimes, FaSave } from 'react-icons/fa';

interface Variant {
  id?: string;
  label: string;
  sku?: string | null;
  priceCents?: number | null;
  stock?: number | null;
}
interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: 'active' | 'draft' | 'archived';
  priceCents: number;
  currency: string;
  images: string[];
  category: string | null;
  trackStock: boolean;
  stock: number | null;
  variants?: Variant[];
}

const money = (cents: number, currency = 'usd') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(
    (cents || 0) / 100,
  );

const emptyForm = {
  id: '',
  name: '',
  description: '',
  status: 'active' as Product['status'],
  price: '',
  currency: 'usd',
  images: '',
  category: '',
  trackStock: false,
  stock: '',
  variants: [] as Variant[],
};

export default function StoreProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<typeof emptyForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/cms/store/products', { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => setEditing({ ...emptyForm });
  const openEdit = (p: Product) =>
    setEditing({
      id: p.id,
      name: p.name,
      description: p.description || '',
      status: p.status,
      price: (p.priceCents / 100).toString(),
      currency: p.currency,
      images: (p.images || []).join(', '),
      category: p.category || '',
      trackStock: p.trackStock,
      stock: p.stock == null ? '' : String(p.stock),
      variants: p.variants || [],
    });

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        id: editing.id || undefined,
        name: editing.name,
        description: editing.description,
        status: editing.status,
        priceCents: Math.round(parseFloat(editing.price || '0') * 100),
        currency: editing.currency || 'usd',
        images: editing.images.split(',').map((s) => s.trim()).filter(Boolean),
        category: editing.category || null,
        trackStock: editing.trackStock,
        stock: editing.stock === '' ? null : parseInt(editing.stock, 10),
        variants: editing.variants
          .filter((v) => v.label?.trim())
          .map((v) => ({
            label: v.label,
            sku: v.sku || null,
            priceCents: v.priceCents == null || (v.priceCents as any) === '' ? null : Math.round(Number(v.priceCents)),
            stock: v.stock == null || (v.stock as any) === '' ? null : Math.round(Number(v.stock)),
          })),
      };
      const res = await fetch('/api/cms/store/products', {
        method: editing.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/cms/store/products?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete product');
    }
  };

  const setVariant = (i: number, patch: Partial<Variant>) =>
    setEditing((cur) =>
      cur ? { ...cur, variants: cur.variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) } : cur,
    );

  const input = 'w-full px-3 py-2 rounded-lg bg-dark border border-dark-border text-text-primary focus:border-cyber-green focus:outline-none';

  return (
    <AdminShell title="Store — Products">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FaBoxOpen className="text-2xl text-cyber-green" />
            <h2 className="text-2xl font-bold">Products</h2>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-linear-to-r from-cyber-green to-cyber-cyan text-dark font-semibold"
          >
            <FaPlus />
            <span>New product</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-cyber-red/10 border border-cyber-red/40 text-cyber-red text-sm">
            {error}
          </div>
        )}

        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-dark-lighter text-text-muted text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                    <FaSpinner className="animate-spin inline mr-2" /> Loading…
                  </td>
                </tr>
              )}
              {!loading && products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                    No products yet. Create your first one.
                  </td>
                </tr>
              )}
              {products.map((p) => (
                <tr key={p.id} className="border-t border-dark-border hover:bg-dark-lighter/40">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-text-muted text-xs font-mono">/{p.slug}</div>
                  </td>
                  <td className="px-4 py-3">{money(p.priceCents, p.currency)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded text-xs bg-dark-lighter">{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {p.variants && p.variants.length
                      ? `${p.variants.length} variant${p.variants.length === 1 ? '' : 's'}`
                      : p.trackStock
                        ? (p.stock ?? 0)
                        : '∞'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(p)} className="text-cyber-cyan hover:text-cyber-green" title="Edit">
                      <FaEdit />
                    </button>
                    <button onClick={() => remove(p)} className="text-cyber-red/80 hover:text-cyber-red" title="Delete">
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
          <div className="bg-dark-card border border-dark-border rounded-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b border-dark-border">
              <h3 className="text-lg font-bold">{editing.id ? 'Edit product' : 'New product'}</h3>
              <button onClick={() => setEditing(null)} className="text-text-muted hover:text-cyber-red">
                <FaTimes />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Name</label>
                <input className={input} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Price ({editing.currency.toUpperCase()})</label>
                  <input className={input} type="number" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Currency</label>
                  <input className={input} value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Status</label>
                  <select className={input} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as Product['status'] })}>
                    <option value="active">active</option>
                    <option value="draft">draft</option>
                    <option value="archived">archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Category</label>
                  <input className={input} value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Description</label>
                <textarea className={input} rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Image URLs (comma-separated)</label>
                <input className={input} value={editing.images} onChange={(e) => setEditing({ ...editing, images: e.target.value })} />
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 text-sm">
                  <input type="checkbox" checked={editing.trackStock} onChange={(e) => setEditing({ ...editing, trackStock: e.target.checked })} />
                  <span>Track stock</span>
                </label>
                {editing.trackStock && (
                  <input className={input + ' max-w-[8rem]'} type="number" placeholder="Stock" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} />
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-text-muted">Variants (optional)</label>
                  <button
                    onClick={() => setEditing({ ...editing, variants: [...editing.variants, { label: '', sku: '', priceCents: null, stock: null }] })}
                    className="text-cyber-cyan text-xs hover:text-cyber-green"
                  >
                    + Add variant
                  </button>
                </div>
                {editing.variants.map((v, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                    <input className={input + ' col-span-4'} placeholder="Label" value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} />
                    <input className={input + ' col-span-3'} placeholder="SKU" value={v.sku || ''} onChange={(e) => setVariant(i, { sku: e.target.value })} />
                    <input className={input + ' col-span-2'} type="number" placeholder="¢ price" value={v.priceCents ?? ''} onChange={(e) => setVariant(i, { priceCents: e.target.value === '' ? null : Number(e.target.value) })} />
                    <input className={input + ' col-span-2'} type="number" placeholder="stock" value={v.stock ?? ''} onChange={(e) => setVariant(i, { stock: e.target.value === '' ? null : Number(e.target.value) })} />
                    <button className="col-span-1 text-cyber-red/80 hover:text-cyber-red" onClick={() => setEditing({ ...editing, variants: editing.variants.filter((_, idx) => idx !== i) })}>
                      <FaTrash />
                    </button>
                  </div>
                ))}
                <p className="text-text-muted text-xs">Variant price is in cents and overrides the product price when set.</p>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-2 p-4 border-t border-dark-border">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-dark-lighter text-text-secondary">
                Cancel
              </button>
              <button onClick={save} disabled={saving || !editing.name.trim()} className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-linear-to-r from-cyber-green to-cyber-cyan text-dark font-semibold disabled:opacity-50">
                {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
