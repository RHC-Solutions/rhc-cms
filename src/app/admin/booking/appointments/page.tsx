'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaSpinner, FaSyncAlt } from 'react-icons/fa';

interface Appointment {
  id: string;
  serviceName: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
}

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
const statusColor: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400',
  confirmed: 'bg-cyber-green/15 text-cyber-green',
  completed: 'bg-cyber-cyan/15 text-cyber-cyan',
  cancelled: 'bg-cyber-red/15 text-cyber-red',
};

export default function BookingAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/cms/booking/appointments', { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const data = await res.json();
      setAppointments(data.appointments || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (appt: Appointment, status: string) => {
    try {
      const res = await fetch('/api/cms/booking/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appt.id, status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      setAppointments((cur) => cur.map((a) => (a.id === appt.id ? { ...a, status } : a)));
    } catch (e: any) {
      setError(e?.message || 'Failed to update');
    }
  };

  return (
    <AdminShell title="Booking — Appointments">
      <div className="max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="heading-xl">Appointments</h1>
            <p className="text-text-secondary text-sm mt-1">Bookings made by customers. Change a booking&apos;s status to confirm, complete or cancel it.</p>
          </div>
          <button onClick={load} disabled={loading} className="btn-secondary">
            {loading ? <FaSpinner className="animate-spin" aria-hidden="true" /> : <FaSyncAlt aria-hidden="true" />}
            <span>Refresh</span>
          </button>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

        <div className="bg-dark-card border border-dark-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark-lighter text-text-muted text-left">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && appointments.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-text-muted">No appointments yet.</td></tr>
              )}
              {appointments.map((a) => (
                <tr key={a.id} className="border-t border-dark-border hover:bg-dark-lighter/40">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div>{new Date(a.startsAt).toLocaleString()}</div>
                    <div className="text-text-muted text-xs">→ {new Date(a.endsAt).toLocaleTimeString()}</div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{a.serviceName || '—'}</td>
                  <td className="px-4 py-3">
                    <div>{a.customerName || '—'}</div>
                    <div className="text-text-muted text-xs">{a.customerEmail || ''}{a.customerPhone ? ` · ${a.customerPhone}` : ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select value={a.status} onChange={(e) => changeStatus(a, e.target.value)} aria-label={`Status of ${a.customerName || 'appointment'} on ${new Date(a.startsAt).toLocaleDateString()}`} className={`px-2 py-1 rounded text-xs border-0 ${statusColor[a.status] || 'bg-dark-lighter'}`}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
