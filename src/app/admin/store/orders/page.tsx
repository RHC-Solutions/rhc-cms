'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaShoppingCart, FaSpinner, FaSyncAlt } from 'react-icons/fa';

interface OrderItem {
  name: string;
  variantLabel: string | null;
  unitAmount: number;
  quantity: number;
  lineTotal: number;
}
interface Order {
  id: string;
  orderNumber: string;
  email: string | null;
  status: string;
  totalCents: number;
  currency: string;
  items: OrderItem[];
  createdAt: string;
}

const STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled', 'refunded'];
const money = (cents: number, currency = 'usd') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(
    (cents || 0) / 100,
  );
const statusColor: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400',
  paid: 'bg-cyber-green/15 text-cyber-green',
  fulfilled: 'bg-cyber-cyan/15 text-cyber-cyan',
  cancelled: 'bg-cyber-red/15 text-cyber-red',
  refunded: 'bg-orange-500/15 text-orange-400',
};

export default function StoreOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/cms/store/orders', { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (order: Order, status: string) => {
    try {
      const res = await fetch('/api/cms/store/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      setOrders((cur) => cur.map((o) => (o.id === order.id ? { ...o, status } : o)));
    } catch (e: any) {
      setError(e?.message || 'Failed to update order');
    }
  };

  return (
    <AdminShell title="Store — Orders">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FaShoppingCart className="text-2xl text-cyber-green" />
            <h2 className="text-2xl font-bold">Orders</h2>
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
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-muted">No orders yet.</td>
                </tr>
              )}
              {orders.map((o) => (
                <Fragment key={o.id}>
                  <tr className="border-t border-dark-border hover:bg-dark-lighter/40 cursor-pointer" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                    <td className="px-4 py-3 font-mono text-xs">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-text-secondary">{o.email || '—'}</td>
                    <td className="px-4 py-3 font-medium">{money(o.totalCents, o.currency)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={o.status}
                        onChange={(e) => changeStatus(o, e.target.value)}
                        className={`px-2 py-1 rounded text-xs border-0 ${statusColor[o.status] || 'bg-dark-lighter'}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  {expanded === o.id && (
                    <tr className="bg-dark/40">
                      <td colSpan={5} className="px-4 py-3">
                        <ul className="space-y-1">
                          {o.items.map((it, i) => (
                            <li key={i} className="flex justify-between text-text-secondary text-xs">
                              <span>
                                {it.quantity}× {it.name}
                                {it.variantLabel ? ` — ${it.variantLabel}` : ''}
                              </span>
                              <span>{money(it.lineTotal, o.currency)}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
