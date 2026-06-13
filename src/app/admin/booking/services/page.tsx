'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaConciergeBell, FaSpinner, FaPlus, FaTrash, FaEdit, FaTimes, FaSave } from 'react-icons/fa';

interface Service {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  durationMins: number;
  bufferMins: number;
  priceCents: number;
  currency: string;
  active: boolean;
}

const emptyForm = {
  id: '',
  name: '',
  description: '',
  durationMins: '30',
  bufferMins: '0',
  price: '',
  currency: 'usd',
  active: true,
};

export default function BookingServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<typeof emptyForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/cms/booking/services', { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const data = await res.json();
      setServices(data.services || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        id: editing.id || undefined,
        name: editing.name,
        description: editing.description,
        durationMins: parseInt(editing.durationMins, 10) || 30,
        bufferMins: parseInt(editing.bufferMins, 10) || 0,
        priceCents: Math.round(parseFloat(editing.price || '0') * 100),
        currency: editing.currency || 'usd',
        active: editing.active,
      };
      const res = await fetch('/api/cms/booking/services', {
        method: editing.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Service) => {
    if (!confirm(`Delete "${s.name}"?`)) return;
    try {
      const res = await fetch(`/api/cms/booking/services?id=${encodeURIComponent(s.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete');
    }
  };

  const input = 'w-full px-3 py-2 rounded-lg bg-dark border border-dark-border text-text-primary focus:border-cyber-green focus:outline-none';

  return (
    <AdminShell title="Booking — Services">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FaConciergeBell className="text-2xl text-cyber-green" />
            <h2 className="text-2xl font-bold">Bookable Services</h2>
          </div>
          <button onClick={() => setEditing({ ...emptyForm })} className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-linear-to-r from-cyber-green to-cyber-cyan text-dark font-semibold">
            <FaPlus />
            <span>New service</span>
          </button>
        </div>

        {error && <div className="mb-4 px-4 py-3 rounded-lg bg-cyber-red/10 border border-cyber-red/40 text-cyber-red text-sm">{error}</div>}

        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-dark-lighter text-text-muted text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted"><FaSpinner className="animate-spin inline mr-2" />Loading…</td></tr>
              )}
              {!loading && services.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">No services yet.</td></tr>
              )}
              {services.map((s) => (
                <tr key={s.id} className="border-t border-dark-border hover:bg-dark-lighter/40">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{s.durationMins} min{s.bufferMins ? ` (+${s.bufferMins} buffer)` : ''}</td>
                  <td className="px-4 py-3">{s.priceCents ? new Intl.NumberFormat(undefined, { style: 'currency', currency: s.currency.toUpperCase() }).format(s.priceCents / 100) : 'Free'}</td>
                  <td className="px-4 py-3">{s.active ? '✓' : '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => setEditing({ id: s.id, name: s.name, description: s.description || '', durationMins: String(s.durationMins), bufferMins: String(s.bufferMins), price: (s.priceCents / 100).toString(), currency: s.currency, active: s.active })} className="text-cyber-cyan hover:text-cyber-green"><FaEdit /></button>
                    <button onClick={() => remove(s)} className="text-cyber-red/80 hover:text-cyber-red"><FaTrash /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
          <div className="bg-dark-card border border-dark-border rounded-xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between p-4 border-b border-dark-border">
              <h3 className="text-lg font-bold">{editing.id ? 'Edit service' : 'New service'}</h3>
              <button onClick={() => setEditing(null)} className="text-text-muted hover:text-cyber-red"><FaTimes /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Name</label>
                <input className={input} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Description</label>
                <textarea className={input} rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Duration (min)</label>
                  <input className={input} type="number" value={editing.durationMins} onChange={(e) => setEditing({ ...editing, durationMins: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Buffer after (min)</label>
                  <input className={input} type="number" value={editing.bufferMins} onChange={(e) => setEditing({ ...editing, bufferMins: e.target.value })} />
                </div>
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
              <label className="flex items-center space-x-2 text-sm">
                <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                <span>Active (bookable by customers)</span>
              </label>
            </div>
            <div className="flex items-center justify-end space-x-2 p-4 border-t border-dark-border">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-dark-lighter text-text-secondary">Cancel</button>
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
