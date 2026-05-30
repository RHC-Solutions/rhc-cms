'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaSync, FaTrash, FaGlobe, FaShieldAlt, FaDatabase, FaNetworkWired } from 'react-icons/fa';

interface CloudflareData {
  analytics?: {
    requests?: number;
    bandwidth?: number;
    threats?: number;
    pageviews?: number;
    note?: string;
  };
  zone?: {
    id: string;
    name: string;
    status: string;
    plan: { name: string };
    nameservers: string[];
  };
  events?: any[];
  dns?: any[];
  accountId?: string;
}

export default function CloudflareIntegrationPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purging, setPurging] = useState(false);
  const [data, setData] = useState<CloudflareData | null>(null);
  const [activeTab, setActiveTab] = useState<'analytics' | 'security' | 'dns' | 'cache'>('analytics');
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/cms/cloudflare', {
        credentials: 'include',
      });
      if (res.ok) {
        const fetchedData = await res.json();
        console.log('Cloudflare data received:', {
          zone: !!fetchedData.zone,
          analytics: fetchedData.analytics,
          eventsCount: fetchedData.events?.length || 0,
          dnsCount: fetchedData.dns?.length || 0,
          accountId: fetchedData.accountId
        });
        console.log('First 3 events:', fetchedData.events?.slice(0, 3));
        setData(fetchedData);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(errorData.error || 'Failed to load Cloudflare data');
        setData(null);
      }
    } catch (error) {
      console.error('Error fetching Cloudflare data:', error);
      setError('Error fetching Cloudflare data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handlePurgeCache = async () => {
    if (!confirm('Are you sure you want to purge the entire Cloudflare cache?')) return;

    setPurging(true);
    try {
      const res = await fetch('/api/cms/cloudflare', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'purge-cache' }),
      });

      if (res.ok) {
        setError(null);
        await fetchData();
      } else {
        setError('Failed to purge cache');
      }
    } catch (error) {
      console.error('Error purging cache:', error);
      setError('Error purging cache');
    } finally {
      setPurging(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <AdminShell title="Cloudflare Integration">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4">⚙️</div>
            <p className="text-text-muted">Loading Cloudflare data...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  if (!data) {
    return (
      <AdminShell title="Cloudflare Integration">
        <div className="mb-8">
          <h1 className="heading-xl text-gradient mb-2">Cloudflare Integration</h1>
          <p className="text-text-secondary">Monitor your Cloudflare zone, analytics, and security events</p>
        </div>
        <div className="card-cyber p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Configuration Required</h2>
          <p className="text-text-muted mb-4">
            Cloudflare credentials are not configured or are invalid.
          </p>
          <a
            href="/admin/cloudflare/setup"
            className="btn-primary inline-flex items-center gap-2"
          >
            Configure Cloudflare
          </a>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Cloudflare Integration">
      <div className="mb-8">
        <h1 className="heading-xl text-gradient mb-2">Cloudflare Integration</h1>
        <p className="text-text-secondary">Monitor your Cloudflare zone, analytics, and security events</p>
      </div>

      {/* Zone Info Card */}
      {data?.zone && (
        <div className="card-cyber p-6 mb-8 border-l-4 border-l-cyan-500">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <FaGlobe className="text-cyan-400" />
                {data.zone.name}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                <div>
                  <p className="text-text-muted">Plan</p>
                  <p className="text-text-primary font-semibold">{data.zone.plan?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-text-muted">Status</p>
                  <p className="text-cyber-green font-semibold uppercase">{data.zone.status || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-text-muted">Nameservers</p>
                  <p className="text-text-primary font-mono text-xs">{data.zone.nameservers?.length || 0}</p>
                </div>
                <div>
                  <p className="text-text-muted">Zone ID</p>
                  <p className="text-text-primary font-mono text-xs">{data.zone.id?.substring(0, 8) || 'N/A'}...</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-secondary px-4 py-2 flex items-center gap-2"
            >
              <FaSync className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-dark-border">
        {(['analytics', 'security', 'dns', 'cache'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-semibold capitalize transition-colors ${
              activeTab === tab
                ? 'text-cyber-cyan border-b-2 border-cyber-cyan'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab === 'analytics' && '📊 Analytics'}
            {tab === 'security' && '🛡️ Security'}
            {tab === 'dns' && '🌐 DNS'}
            {tab === 'cache' && '⚡ Cache'}
          </button>
        ))}
      </div>

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <>
          {/* Free Plan Warning */}
          {data?.zone?.plan?.name === 'Free Website' && (
            <div className="card-cyber p-6 mb-6 border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-500/5 to-transparent">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="font-bold text-amber-400 mb-1">Analytics Not Available on Free Plan</h3>
                  <p className="text-text-muted text-sm">
                    Detailed analytics require a <strong>paid Cloudflare plan</strong> (Pro or Business).
                    Upgrade your account to see detailed traffic metrics, bandwidth usage, and threat analysis in the dashboard below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cloudflare Dashboard Link Banner */}
          <div className="card-cyber p-6 mb-6 border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-500/5 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
                  📊 Live Analytics in Cloudflare Dashboard
                </h3>
                <p className="text-text-muted text-sm mb-3">
                  View detailed real-time analytics, traffic breakdowns, and advanced metrics directly in your Cloudflare dashboard.
                </p>
              </div>
              <a
                href={`https://dash.cloudflare.com/${data?.accountId || ''}/${data?.zone?.name || ''}/analytics/traffic`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary px-6 py-3 whitespace-nowrap"
              >
                Open Cloudflare Analytics →
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-cyber p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-muted text-sm">Requests (24h)</p>
                <p className="text-3xl font-bold text-text-primary">
                  {(data?.analytics?.requests || 0).toLocaleString()}
                </p>
              </div>
              <div className="text-4xl text-blue-400 opacity-20">📨</div>
            </div>
          </div>

          <div className="card-cyber p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-muted text-sm">Bandwidth (24h)</p>
                <p className="text-3xl font-bold text-text-primary">
                  {formatBytes(data?.analytics?.bandwidth || 0)}
                </p>
              </div>
              <div className="text-4xl text-cyan-400 opacity-20">🌐</div>
            </div>
          </div>

          <div className="card-cyber p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-muted text-sm">Threats Blocked (24h)</p>
                <p className="text-3xl font-bold text-text-primary">
                  {(data?.analytics?.threats || 0).toLocaleString()}
                </p>
              </div>
              <div className="text-4xl text-red-400 opacity-20">🚫</div>
            </div>
          </div>

          <div className="card-cyber p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-muted text-sm">Page Views (24h)</p>
                <p className="text-3xl font-bold text-text-primary">
                  {(data?.analytics?.pageviews || 0).toLocaleString()}
                </p>
              </div>
              <div className="text-4xl text-green-400 opacity-20">📈</div>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          {data?.events && data.events.length > 0 ? (
            <div className="card-cyber overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-border bg-dark-lighter">
                      <th className="text-left p-4 font-semibold text-text-primary">Time</th>
                      <th className="text-left p-4 font-semibold text-text-primary">Type</th>
                      <th className="text-left p-4 font-semibold text-text-primary">IP</th>
                      <th className="text-left p-4 font-semibold text-text-primary">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.slice(0, 20).map((event: any, idx: number) => (
                      <tr key={idx} className="border-b border-dark-border hover:bg-dark-lighter transition-colors">
                        <td className="p-4 text-text-muted font-mono text-xs">
                          {new Date(event.datetime || event.occurredAt || event.when).toLocaleString()}
                        </td>
                        <td className="p-4 font-semibold">
                          {event.source || event.matchedRuleDescription || event.ruleDescription || 'Security Rule'}
                        </td>
                        <td className="p-4 font-mono text-xs text-text-secondary">
                          {event.clientIP || event.rayName || 'N/A'}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-3 py-1 rounded text-xs font-semibold ${
                              event.action === 'block' || event.action === 'drop'
                                ? 'bg-red-500/20 text-red-400'
                                : event.action === 'challenge' || event.action === 'managed_challenge' || event.action === 'js_challenge'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : event.action === 'log' || event.action === 'allow'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}
                          >
                            {event.action?.toUpperCase() || 'LOG'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 text-text-muted text-xs bg-dark-lighter border-t border-dark-border">
                Showing last {Math.min(20, data?.events?.length || 0)} of {data?.events?.length || 0} security events
              </div>
            </div>
          ) : (
            <div className="card-cyber p-8 text-center">
              <FaShieldAlt className="text-4xl text-cyber-green mx-auto mb-4 opacity-50" />
              <div className="space-y-2">
                <p className="text-text-muted">No security events found</p>
                <p className="text-xs text-text-muted">
                  Security events are shown when Cloudflare's firewall rules are triggered.
                  <br />
                  This may indicate:
                </p>
                <ul className="text-xs text-text-muted text-left max-w-md mx-auto space-y-1 mt-2">
                  <li>• No threats detected (good sign!)</li>
                  <li>• Firewall rules not configured</li>
                  <li>• Security events API requires Pro plan or higher</li>
                </ul>
                <div className="mt-4">
                  <a
                    href={`https://dash.cloudflare.com/${data?.accountId}/${data?.zone?.name}/security/events`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyber-cyan hover:text-cyber-green text-sm"
                  >
                    View in Cloudflare Dashboard →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DNS Tab */}
      {activeTab === 'dns' && (
        <div className="space-y-4">
          {data?.dns && data.dns.length > 0 ? (
            <div className="card-cyber overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-border bg-dark-lighter">
                      <th className="text-left p-4 font-semibold text-text-primary">Name</th>
                      <th className="text-left p-4 font-semibold text-text-primary">Type</th>
                      <th className="text-left p-4 font-semibold text-text-primary">Content</th>
                      <th className="text-left p-4 font-semibold text-text-primary">TTL</th>
                      <th className="text-left p-4 font-semibold text-text-primary">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dns.slice(0, 30).map((record: any, idx: number) => (
                      <tr key={idx} className="border-b border-dark-border hover:bg-dark-lighter transition-colors">
                        <td className="p-4 font-mono text-xs text-text-primary">{record.name}</td>
                        <td className="p-4 font-semibold text-cyan-400">{record.type}</td>
                        <td className="p-4 font-mono text-xs text-text-secondary break-all">{record.content}</td>
                        <td className="p-4 text-text-muted">{record.ttl === 1 ? 'Auto' : record.ttl}</td>
                        <td className="p-4">
                          <span className="px-3 py-1 rounded text-xs font-semibold bg-cyber-green/20 text-cyber-green">
                            {record.proxied ? 'Proxied' : 'DNS Only'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 text-text-muted text-xs bg-dark-lighter border-t border-dark-border">
                Showing {Math.min(30, data?.dns?.length || 0)} of {data?.dns?.length || 0} DNS records
              </div>
            </div>
          ) : (
            <div className="card-cyber p-8 text-center">
              <FaNetworkWired className="text-4xl text-cyber-blue mx-auto mb-4 opacity-50" />
              <p className="text-text-muted">No DNS records found</p>
            </div>
          )}
        </div>
      )}

      {/* Cache Tab */}
      {activeTab === 'cache' && (
        <div className="space-y-6">
          <div className="card-cyber p-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Cache Management</h3>
                <p className="text-text-muted">Purge your Cloudflare cache to refresh content</p>
              </div>
              <FaDatabase className="text-4xl text-purple-400 opacity-20" />
            </div>
          </div>

          <div className="card-cyber p-6 border-l-4 border-l-yellow-500">
            <div className="flex items-center gap-4 mb-4">
              <div className="text-3xl">⚠️</div>
              <div>
                <p className="font-semibold text-text-primary">About Cache Purge</p>
                <p className="text-text-muted text-sm">
                  Purging the cache removes all cached content. Your website will serve fresh content but may be slower initially
                  as Cloudflare rebuilds the cache.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handlePurgeCache}
            disabled={purging}
            className="btn-danger px-8 py-3 flex items-center gap-2 text-lg"
          >
            <FaTrash />
            {purging ? 'Purging...' : 'Purge Entire Cache'}
          </button>

          <div className="card-cyber p-6 bg-dark-lighter text-text-muted text-sm space-y-2">
            <p><strong>What gets cleared:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>All cached pages</li>
              <li>All cached static assets (CSS, JS, images)</li>
              <li>API responses</li>
              <li>Edge cache in all Cloudflare data centers</li>
            </ul>
            <p className="mt-4"><strong>What doesn't get cleared:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Browser cache (users' devices)</li>
              <li>Query string parameters (Cache everything rules)</li>
            </ul>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
