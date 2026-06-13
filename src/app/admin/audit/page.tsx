'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaHistory, FaSpinner, FaSyncAlt } from 'react-icons/fa';

interface AuditEntry {
  id: string;
  actor: string | null;
  actorEmail: string | null;
  action: string;
  target: string | null;
  detail: Record<string, any> | null;
  ip: string | null;
  createdAt: string;
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/cms/audit?limit=200', { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminShell title="Audit Log">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FaHistory className="text-2xl text-cyber-green" />
            <div>
              <h2 className="text-2xl font-bold">Audit Log</h2>
              <p className="text-text-muted text-sm">
                {total} recorded admin action{total === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-dark-lighter hover:bg-dark-border text-text-secondary hover:text-cyber-green transition-all disabled:opacity-50"
          >
            {loading ? <FaSpinner className="animate-spin" /> : <FaSyncAlt />}
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-cyber-red/10 border border-cyber-red/40 text-cyber-red text-sm">
            {error}
          </div>
        )}

        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-dark-lighter text-text-muted text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                  <th className="px-4 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {!loading && entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                      No audit entries yet.
                    </td>
                  </tr>
                )}
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-dark-border hover:bg-dark-lighter/40">
                    <td className="px-4 py-3 whitespace-nowrap text-text-secondary font-mono text-xs">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.actorEmail || e.actor || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 rounded bg-cyber-cyan/10 text-cyber-cyan text-xs font-mono">
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-text-secondary">
                      {e.target || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-text-muted font-mono text-xs">
                      {e.ip || '—'}
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs max-w-xs truncate">
                      {e.detail ? JSON.stringify(e.detail) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
