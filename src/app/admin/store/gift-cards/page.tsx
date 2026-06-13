'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaGift, FaSpinner, FaPlus, FaTimes, FaSave, FaBan } from 'react-icons/fa';

interface GiftCard {
  id: string;
  code: string;
  initialBalanceCents: number;
  balanceCents: number;
  currency: string;
  status: string;
  recipientEmail: string | null;
  createdAt: string;
}

const money = (cents: number, currency = 'usd') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(
    (cents || 0) / 100,
  );

export default function GiftCardsPage() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ amount: '', currency: 'usd', recipientEmail: '', recipientName: '', message: '', expiresAt: '' });
  const [created, setCreated] = useState<{ code: string; qr: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/cms/giftcards', { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const data = await res.json();
      setCards(data.cards || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load gift cards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/cms/giftcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: Math.round(parseFloat(form.amount || '0') * 100),
          currency: form.currency,
          recipientEmail: form.recipientEmail || undefined,
          recipientName: form.recipientName || undefined,
          message: form.message || undefined,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const data = await res.json();
      setCreated({ code: data.card.code, qr: data.qr });
      setCreating(false);
      setForm({ amount: '', currency: 'usd', recipientEmail: '', recipientName: '', message: '', expiresAt: '' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to create gift card');
    } finally {
      setSaving(false);
    }
  };

  const redeem = async (card: GiftCard) => {
    const input = prompt(`Redeem amount from ${card.code} (${card.currency.toUpperCase()}, balance ${money(card.balanceCents, card.currency)}):`);
    if (!input) return;
    const amountCents = Math.round(parseFloat(input) * 100);
    if (!amountCents || amountCents <= 0) return;
    try {
      const res = await fetch('/api/cms/giftcards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'redeem', code: card.code, amountCents }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to redeem');
    }
  };

  const setStatus = async (card: GiftCard, status: string) => {
    try {
      const res = await fetch('/api/cms/giftcards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', id: card.id, status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to update');
    }
  };

  const input = 'w-full px-3 py-2 rounded-lg bg-dark border border-dark-border text-text-primary focus:border-cyber-green focus:outline-none';

  return (
    <AdminShell title="Store — Gift Cards">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FaGift className="text-2xl text-cyber-green" />
            <h2 className="text-2xl font-bold">Gift Cards</h2>
          </div>
          <button onClick={() => setCreating(true)} className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-linear-to-r from-cyber-green to-cyber-cyan text-dark font-semibold">
            <FaPlus />
            <span>Issue gift card</span>
          </button>
        </div>

        {error && <div className="mb-4 px-4 py-3 rounded-lg bg-cyber-red/10 border border-cyber-red/40 text-cyber-red text-sm">{error}</div>}

        {created && (
          <div className="mb-4 p-4 rounded-xl bg-cyber-green/10 border border-cyber-green/40 flex items-center space-x-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={created.qr} alt="Gift card QR" className="w-24 h-24 rounded bg-white p-1" />
            <div>
              <p className="text-text-muted text-sm">New gift card issued</p>
              <p className="font-mono text-lg text-cyber-green">{created.code}</p>
              <button onClick={() => setCreated(null)} className="text-text-muted text-xs hover:text-text-primary mt-1">dismiss</button>
            </div>
          </div>
        )}

        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-dark-lighter text-text-muted text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Recipient</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted"><FaSpinner className="animate-spin inline mr-2" />Loading…</td></tr>
              )}
              {!loading && cards.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">No gift cards yet.</td></tr>
              )}
              {cards.map((c) => (
                <tr key={c.id} className="border-t border-dark-border hover:bg-dark-lighter/40">
                  <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                  <td className="px-4 py-3">{money(c.balanceCents, c.currency)} <span className="text-text-muted text-xs">/ {money(c.initialBalanceCents, c.currency)}</span></td>
                  <td className="px-4 py-3"><span className="px-2 py-1 rounded text-xs bg-dark-lighter">{c.status}</span></td>
                  <td className="px-4 py-3 text-text-secondary">{c.recipientEmail || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    {c.status === 'active' && (
                      <>
                        <button onClick={() => redeem(c)} className="text-cyber-cyan hover:text-cyber-green text-xs">Redeem</button>
                        <button onClick={() => setStatus(c, 'disabled')} className="text-cyber-red/80 hover:text-cyber-red" title="Disable"><FaBan /></button>
                      </>
                    )}
                    {c.status === 'disabled' && (
                      <button onClick={() => setStatus(c, 'active')} className="text-cyber-green text-xs">Re-enable</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
          <div className="bg-dark-card border border-dark-border rounded-xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between p-4 border-b border-dark-border">
              <h3 className="text-lg font-bold">Issue gift card</h3>
              <button onClick={() => setCreating(false)} className="text-text-muted hover:text-cyber-red"><FaTimes /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Amount ({form.currency.toUpperCase()})</label>
                  <input className={input} type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Currency</label>
                  <input className={input} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Recipient email (optional)</label>
                <input className={input} value={form.recipientEmail} onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Recipient name (optional)</label>
                <input className={input} value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Message (optional)</label>
                <textarea className={input} rows={2} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Expires (optional)</label>
                <input className={input} type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-end space-x-2 p-4 border-t border-dark-border">
              <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-lg bg-dark-lighter text-text-secondary">Cancel</button>
              <button onClick={create} disabled={saving || !parseFloat(form.amount || '0')} className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-linear-to-r from-cyber-green to-cyber-cyan text-dark font-semibold disabled:opacity-50">
                {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                <span>Issue</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
