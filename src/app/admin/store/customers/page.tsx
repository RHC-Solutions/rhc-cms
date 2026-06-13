'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaUserFriends, FaSpinner, FaSyncAlt } from 'react-icons/fa';

interface Customer {
  id: string;
  email: string;
  name: string | null;
  status: string;
  phone: string | null;
  lastLogin: string | null;
  createdAt: string;
}

export default function StoreCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/cms/store/customers', { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const data = await res.json();
      setCustomers(data.customers || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminShell title="Store — Customers">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FaUserFriends className="text-2xl text-cyber-green" />
            <div>
              <h2 className="text-2xl font-bold">Customers</h2>
              <p className="text-text-muted text-sm">{total} account{total === 1 ? '' : 's'}</p>
            </div>
          </div>
          <button onClick={load} disabled={loading} className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-dark-lighter text-text-secondary hover:text-cyber-green disabled:opacity-50">
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
          <table className="w-full text-sm">
            <thead className="bg-dark-lighter text-text-muted text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Last login</th>
              </tr>
            </thead>
            <tbody>
              {!loading && customers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-muted">No customers yet.</td>
                </tr>
              )}
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-dark-border hover:bg-dark-lighter/40">
                  <td className="px-4 py-3">{c.email}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded text-xs bg-dark-lighter">{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">{c.lastLogin ? new Date(c.lastLogin).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
