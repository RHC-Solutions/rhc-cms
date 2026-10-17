'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaSpinner, FaSave, FaPlus, FaTrash } from 'react-icons/fa';

interface TimeWindow {
  start: string;
  end: string;
}
interface AvailabilityConfig {
  timezone: string;
  slotIntervalMins: number;
  weekly: Record<number, TimeWindow[]>;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function BookingAvailabilityPage() {
  const [config, setConfig] = useState<AvailabilityConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/cms/booking/availability', { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const data = await res.json();
      setConfig(data.config);
    } catch (e: any) {
      setError(e?.message || 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/cms/booking/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const setWindow = (day: number, idx: number, patch: Partial<TimeWindow>) =>
    setConfig((c) =>
      c
        ? { ...c, weekly: { ...c.weekly, [day]: (c.weekly[day] || []).map((w, i) => (i === idx ? { ...w, ...patch } : w)) } }
        : c,
    );
  const addWindow = (day: number) =>
    setConfig((c) => (c ? { ...c, weekly: { ...c.weekly, [day]: [...(c.weekly[day] || []), { start: '09:00', end: '17:00' }] } } : c));
  const removeWindow = (day: number, idx: number) =>
    setConfig((c) => (c ? { ...c, weekly: { ...c.weekly, [day]: (c.weekly[day] || []).filter((_, i) => i !== idx) } } : c));

  const input = 'px-2 py-1 rounded-lg bg-dark border border-dark-border text-text-primary focus:border-cyber-green focus:outline-none';

  return (
    <AdminShell title="Booking — Availability">
      <div className="max-w-3xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="heading-xl">Availability</h1>
            <p className="text-text-secondary text-sm mt-1">Weekly opening hours that bookable time slots are generated from.</p>
          </div>
          <button onClick={save} disabled={saving || !config} className="btn-primary">
            {saving ? <FaSpinner className="animate-spin" aria-hidden="true" /> : <FaSave aria-hidden="true" />}
            <span>Save</span>
          </button>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
        {saved && <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">Saved.</div>}

        {loading || !config ? (
          <div className="text-text-muted"><FaSpinner className="animate-spin inline mr-2" aria-hidden="true" />Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="bg-dark-card border border-dark-border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="availability-timezone" className="block text-sm font-medium text-text-secondary mb-1.5">Timezone (informational — times are treated as UTC for now)</label>
                <input id="availability-timezone" className={input + ' w-full'} value={config.timezone} onChange={(e) => setConfig({ ...config, timezone: e.target.value })} />
              </div>
              <div>
                <label htmlFor="availability-interval" className="block text-sm font-medium text-text-secondary mb-1.5">Slot interval (min)</label>
                <input id="availability-interval" className={input + ' w-full'} type="number" value={config.slotIntervalMins} onChange={(e) => setConfig({ ...config, slotIntervalMins: parseInt(e.target.value, 10) || 30 })} />
              </div>
            </div>

            {DAYS.map((label, day) => (
              <div key={day} className="bg-dark-card border border-dark-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="heading-sm">{label}</h2>
                  <button onClick={() => addWindow(day)} className="text-cyber-cyan text-xs hover:text-cyber-green flex items-center space-x-1">
                    <FaPlus aria-hidden="true" /> <span>Add window</span>
                  </button>
                </div>
                {(config.weekly[day] || []).length === 0 && <p className="text-text-muted text-sm">Closed</p>}
                {(config.weekly[day] || []).map((w, idx) => (
                  <div key={idx} className="flex items-center space-x-2 mb-2">
                    <input type="time" className={input} aria-label={`${label} window ${idx + 1} start`} value={w.start} onChange={(e) => setWindow(day, idx, { start: e.target.value })} />
                    <span className="text-text-muted">to</span>
                    <input type="time" className={input} aria-label={`${label} window ${idx + 1} end`} value={w.end} onChange={(e) => setWindow(day, idx, { end: e.target.value })} />
                    <button onClick={() => removeWindow(day, idx)} className="text-cyber-red/80 hover:text-cyber-red" aria-label={`Remove ${label} window ${idx + 1}`}><FaTrash aria-hidden="true" /></button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
