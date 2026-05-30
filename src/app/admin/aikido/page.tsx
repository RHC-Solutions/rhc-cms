'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaShieldAlt, FaExternalLinkAlt, FaCheckCircle, FaExclamationTriangle, FaSync } from 'react-icons/fa';

type AikidoStatus = {
  ideTokenConfigured?: boolean;
  apiTokenConfigured?: boolean;
  dashboardUrl?: string;
  issuesUrl?: string;
  counts?: {
    total?: number;
    bySeverity?: Record<string, number>;
  };
  fetchError?: string;
  error?: string;
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info', 'unknown'];
const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-red-400 border-red-500/50 bg-red-500/10',
  high: 'text-orange-400 border-orange-500/50 bg-orange-500/10',
  medium: 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10',
  low: 'text-blue-400 border-blue-500/50 bg-blue-500/10',
  info: 'text-text-secondary border-dark-border bg-dark-card',
  unknown: 'text-text-secondary border-dark-border bg-dark-card',
};

export default function AikidoPage() {
  const [status, setStatus] = useState<AikidoStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/aikido', { credentials: 'include' });
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      setStatus({ error: e instanceof Error ? e.message : 'Failed to load' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const severityCounts = status?.counts?.bySeverity || {};
  const sortedSeverities = SEVERITY_ORDER.filter((s) => severityCounts[s] !== undefined);

  return (
    <AdminShell title="Security (Aikido)">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaShieldAlt className="text-3xl text-cyber-green" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Security (Aikido)</h1>
              <p className="text-sm text-text-secondary">Dependency and code vulnerability scanner</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
            aria-label="Refresh"
          >
            <FaSync className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh
          </button>
        </header>

        {/* Token status */}
        <section className="card-cyber p-6 space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TokenStatus
              label="IDE token (AIKIDO_IDE_TOKEN)"
              ok={!!status?.ideTokenConfigured}
              hint="Used by Aikido editor plugins. Cannot read the public API."
            />
            <TokenStatus
              label="API token (AIKIDO_API_TOKEN)"
              ok={!!status?.apiTokenConfigured}
              hint="Generate in Aikido → Settings → API. Required to display counts here."
            />
          </div>
          {!status?.apiTokenConfigured && (
            <div className="border border-yellow-500/30 bg-yellow-500/5 rounded p-4 text-sm text-text-secondary">
              No Public API token configured. To display live issue counts here, generate one at{' '}
              <a
                href="https://app.aikido.dev/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyber-cyan underline"
              >
                Aikido → Settings → API
              </a>{' '}
              and paste it into the Aikido card on{' '}
              <a href="/admin/integrations" className="text-cyber-cyan underline">
                /admin/integrations
              </a>{' '}
              — it saves to <code className="text-cyber-green">cms-data/secrets.json</code> and
              takes effect immediately (no pm2 restart).
            </div>
          )}
          <div className="text-xs text-text-muted pt-2 border-t border-dark-border">
            Tokens are managed on{' '}
            <a href="/admin/integrations" className="text-cyber-cyan underline">
              /admin/integrations
            </a>
            . This page is the read-only operational view.
          </div>
        </section>

        {/* Issue counts */}
        {status?.apiTokenConfigured && (
          <section className="card-cyber p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Open issues</h2>
            {loading ? (
              <p className="text-text-secondary">Loading…</p>
            ) : status?.fetchError ? (
              <div className="border border-red-500/30 bg-red-500/5 rounded p-4 text-sm">
                <p className="font-semibold text-red-400 flex items-center gap-2">
                  <FaExclamationTriangle aria-hidden="true" /> Aikido API call failed
                </p>
                <p className="text-text-secondary mt-2 break-all">{status.fetchError}</p>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-5xl font-bold text-gradient">
                    {status?.counts?.total ?? 0}
                  </span>
                  <span className="text-text-secondary">total open</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {sortedSeverities.map((sev) => (
                    <div
                      key={sev}
                      className={`border rounded p-3 ${SEVERITY_COLOR[sev] || SEVERITY_COLOR.unknown}`}
                    >
                      <div className="text-2xl font-bold">{severityCounts[sev]}</div>
                      <div className="text-xs uppercase tracking-wide">{sev}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* Links */}
        <section className="card-cyber p-6 space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">Open in Aikido</h2>
          <div className="flex flex-wrap gap-3">
            <a
              href={status?.dashboardUrl || 'https://app.aikido.dev/'}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2"
            >
              <FaExternalLinkAlt aria-hidden="true" />
              Dashboard
            </a>
            <a
              href={status?.issuesUrl || 'https://app.aikido.dev/issues'}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary inline-flex items-center gap-2"
            >
              <FaExternalLinkAlt aria-hidden="true" />
              Issues
            </a>
          </div>
        </section>

        {/* Notes */}
        <section className="text-xs text-text-secondary">
          <p>
            <strong>Note on the recent axios advisories:</strong> this repo does not depend on{' '}
            <code>axios</code> (verified via <code>npm ls axios</code> and <code>package-lock.json</code>) — those
            CVEs do not apply here. If your Aikido report still shows them, re-scan in Aikido.
          </p>
        </section>
      </div>
    </AdminShell>
  );
}

function TokenStatus({ label, ok, hint }: { label: string; ok: boolean; hint: string }) {
  return (
    <div className={`border rounded p-4 ${ok ? 'border-cyber-green/40 bg-cyber-green/5' : 'border-dark-border bg-dark-card'}`}>
      <div className="flex items-center gap-2 mb-1">
        {ok ? (
          <FaCheckCircle className="text-cyber-green" aria-hidden="true" />
        ) : (
          <FaExclamationTriangle className="text-text-muted" aria-hidden="true" />
        )}
        <span className="font-semibold text-text-primary">{label}</span>
      </div>
      <p className="text-xs text-text-secondary">{hint}</p>
    </div>
  );
}
