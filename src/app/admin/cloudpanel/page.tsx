'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FaSync,
  FaPlay,
  FaEye,
  FaExclamationTriangle,
  FaCheckCircle,
  FaLock,
  FaDatabase,
  FaUsers,
  FaGlobe,
} from 'react-icons/fa';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { useToast } from '@adminpanel/components/admin/Toast';

interface FlagDescriptor {
  name: string;
  required: boolean;
  secret: boolean;
  boolean: boolean;
  hint: string;
}
interface CommandDescriptor {
  command: string;
  summary: string;
  destructive: boolean;
  flags: FlagDescriptor[];
}
interface Config {
  enabled: boolean;
  dbPath: string;
  wrapperPath: string;
  useSudo: boolean;
  allowDestructive: boolean;
  timeoutMs: number;
}
interface Site {
  id: string | null;
  domainName: string | null;
  siteUser: string | null;
  rootDirectory: string | null;
  application: string | null;
  phpVersion: string | null;
  createdAt: string | null;
}
interface PanelUser {
  id: string | null;
  userName: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
}
interface Db {
  id: string | null;
  name: string | null;
  siteId: string | null;
}
interface Inventory {
  status: string;
  message?: string;
  sites: Site[];
  users: PanelUser[];
  databases: Db[];
  schema: {
    dbPath: string;
    tables: string[];
    siteTable: string | null;
    userTable: string | null;
    databaseTable: string | null;
  };
}
interface RunResult {
  ok: boolean;
  argv: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  dryRun: boolean;
  error?: string;
}

const CONFIRM_KEYS = ['domainName', 'userName', 'databaseName'];

export default function CloudPanelPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [commands, setCommands] = useState<CommandDescriptor[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState('');
  const [params, setParams] = useState<Record<string, string | boolean>>({});
  const [confirm, setConfirm] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const { addToast } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cms/cloudpanel');
      if (!res.ok) {
        addToast('error', res.status === 401 ? 'Admin access required' : 'Failed to load CloudPanel state');
        return;
      }
      const data = await res.json();
      setConfig(data.config);
      setInventory(data.inventory);
      setCommands(data.commands || []);
      setExcluded(data.excludedCommands || []);
    } catch {
      addToast('error', 'Failed to load CloudPanel state');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const saveConfig = async (patch: Partial<Config>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/cms/cloudpanel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'config', config: patch }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', data.error || 'Failed to save');
        return;
      }
      setConfig(data.config);
      addToast('success', 'Configuration saved');
      load();
    } catch {
      addToast('error', 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const spec = useMemo(() => commands.find((c) => c.command === selected) || null, [commands, selected]);

  // The value the operator must retype for a destructive command.
  const confirmTarget = useMemo(() => {
    if (!spec?.destructive) return null;
    for (const key of CONFIRM_KEYS) {
      const v = params[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  }, [spec, params]);

  const run = async (dryRun: boolean) => {
    if (!spec) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/cms/cloudpanel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          command: spec.command,
          params,
          dryRun,
          confirm: dryRun ? undefined : confirm,
        }),
      });
      const data = await res.json();
      if (!res.ok && data?.error && !data?.argv) {
        addToast('error', data.error);
        setResult(null);
        return;
      }
      setResult(data);
      if (dryRun) addToast('info', 'Dry run — nothing was executed');
      else if (data.ok) {
        addToast('success', `${spec.command} completed`);
        setConfirm('');
        load();
      } else addToast('error', data.error || 'Command failed');
    } catch {
      addToast('error', 'Request failed');
    } finally {
      setRunning(false);
    }
  };

  const statusTone = (status?: string) =>
    status === 'ok'
      ? 'border-green-500/30 bg-green-500/10 text-green-200'
      : status === 'disabled'
        ? 'border-gray-500/30 bg-gray-500/10 text-text-secondary'
        : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-100';

  if (loading) {
    return (
      <AdminShell title="CloudPanel">
        <div className="p-8 text-center text-text-muted">Loading CloudPanel…</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="CloudPanel">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="heading-xl">CloudPanel</h1>
            <p className="text-text-secondary text-sm mt-1">
              Manage sites, databases and panel users on the CloudPanel server this panel runs on.
            </p>
          </div>
          <button onClick={load} className="btn-secondary">
            <FaSync aria-hidden="true" /> Refresh
          </button>
        </div>

        {/* Connection status */}
        <div className={`rounded-lg border p-4 text-sm ${statusTone(inventory?.status)}`}>
          <div className="flex items-center gap-2 font-semibold">
            {inventory?.status === 'ok' ? (
              <FaCheckCircle aria-hidden="true" />
            ) : (
              <FaExclamationTriangle aria-hidden="true" />
            )}
            {inventory?.status === 'ok'
              ? `Connected — ${inventory.sites.length} site(s), ${inventory.users.length} panel user(s)`
              : inventory?.message || 'CloudPanel not connected'}
          </div>
          {inventory?.status !== 'ok' && (
            <p className="mt-2 text-text-secondary">
              Setup instructions live in <code>docs/CLOUDPANEL.md</code>. Write actions work independently of
              database access.
            </p>
          )}
        </div>

        {/* Configuration */}
        <div className="card-dark space-y-4">
          <h2 className="heading-md">Configuration</h2>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={!!config?.enabled}
              disabled={saving}
              onChange={(e) => saveConfig({ enabled: e.target.checked })}
              className="w-4 h-4"
            />
            <span>
              <span className="font-medium text-text-primary">Enable the CloudPanel module</span>
              <span className="block text-sm text-text-muted">
                Off by default. Nothing reads or executes while disabled.
              </span>
            </span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={!!config?.allowDestructive}
              disabled={saving || !config?.enabled}
              onChange={(e) => saveConfig({ allowDestructive: e.target.checked })}
              className="w-4 h-4"
            />
            <span>
              <span className="font-medium text-text-primary">Allow gated commands</span>
              <span className="block text-sm text-text-muted">
                Destructive commands (site:delete, user:delete, db:import, certificate replacement) and the ones
                that hand out panel access (user:add, user:reset:password, user:disable:mfa). Also requires the
                root-owned marker file <code>/etc/rhc-clpctl-allow-destructive</code> on the host; this switch
                alone is not enough.
              </span>
            </span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={!!config?.useSudo}
              disabled={saving || !config?.enabled}
              onChange={(e) => saveConfig({ useSudo: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="font-medium text-text-primary">Invoke the wrapper through sudo</span>
          </label>

          <div className="grid md:grid-cols-2 gap-4 pt-2">
            <div>
              <label htmlFor="cp-db-path" className="block text-sm mb-1">
                CloudPanel database (read-only)
              </label>
              <input
                id="cp-db-path"
                defaultValue={config?.dbPath || ''}
                onBlur={(e) => e.target.value !== config?.dbPath && saveConfig({ dbPath: e.target.value })}
                className="input font-mono"
              />
            </div>
            <div>
              <label htmlFor="cp-wrapper-path" className="block text-sm mb-1">
                Root wrapper path
              </label>
              <input
                id="cp-wrapper-path"
                defaultValue={config?.wrapperPath || ''}
                onBlur={(e) =>
                  e.target.value !== config?.wrapperPath && saveConfig({ wrapperPath: e.target.value })
                }
                className="input font-mono"
              />
            </div>
          </div>
        </div>

        {/* Sites */}
        <Section title="Sites" icon={<FaGlobe aria-hidden="true" />} count={inventory?.sites.length ?? 0}>
          <Table
            headers={['Domain', 'Site user', 'Type', 'PHP', 'Root directory']}
            rows={(inventory?.sites || []).map((s) => [
              s.domainName ?? '—',
              s.siteUser ?? '—',
              s.application ?? '—',
              s.phpVersion ?? '—',
              s.rootDirectory ?? '—',
            ])}
            empty="No sites readable. Check database access in docs/CLOUDPANEL.md."
          />
        </Section>

        {/* Panel users */}
        <Section title="Panel users" icon={<FaUsers aria-hidden="true" />} count={inventory?.users.length ?? 0}>
          <Table
            headers={['Username', 'Email', 'Role', 'Status']}
            rows={(inventory?.users || []).map((u) => [
              u.userName ?? '—',
              u.email ?? '—',
              u.role ?? '—',
              u.status ?? '—',
            ])}
            empty="No panel users readable."
          />
        </Section>

        {/* Databases */}
        <Section
          title="Databases"
          icon={<FaDatabase aria-hidden="true" />}
          count={inventory?.databases.length ?? 0}
        >
          <Table
            headers={['Name', 'Site ID']}
            rows={(inventory?.databases || []).map((d) => [d.name ?? '—', d.siteId ?? '—'])}
            empty="No databases readable."
          />
        </Section>

        {/* Command runner */}
        <div className="card-dark space-y-4">
          <div>
            <h2 className="heading-md">Run a command</h2>
            <p className="text-sm text-text-secondary mt-1">
              Every command is allowlisted and checked again on the host before it runs. Preview first: it shows
              the exact argument list, with passwords masked.
            </p>
          </div>

          <select
            aria-label="Command"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setParams({});
              setConfirm('');
              setResult(null);
            }}
            disabled={!config?.enabled}
            className="input"
          >
            <option value="">Select a command…</option>
            {commands.map((c) => (
              <option key={c.command} value={c.command}>
                {c.command} — {c.summary}
                {c.destructive ? ' (gated)' : ''}
              </option>
            ))}
          </select>

          {spec && (
            <>
              {spec.destructive && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 flex gap-2">
                  <FaLock className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    Gated. Requires the “Allow gated commands” switch above, the root-owned marker file on the
                    host, and retyping the target below.
                  </span>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {spec.flags.map((flag) =>
                  flag.boolean ? (
                    <label key={flag.name} className="flex items-center gap-2 self-end">
                      <input
                        type="checkbox"
                        checked={params[flag.name] === true}
                        onChange={(e) => setParams((p) => ({ ...p, [flag.name]: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <span className="font-mono text-sm text-text-primary">--{flag.name}</span>
                    </label>
                  ) : (
                    <div key={flag.name}>
                      <label htmlFor={`cp-flag-${flag.name}`} className="block text-sm mb-1 font-mono">
                        --{flag.name}
                        {flag.required && <span className="text-red-400"> *</span>}
                      </label>
                      <input
                        id={`cp-flag-${flag.name}`}
                        type={flag.secret ? 'password' : 'text'}
                        autoComplete="new-password"
                        value={(params[flag.name] as string) || ''}
                        placeholder={flag.hint}
                        onChange={(e) => setParams((p) => ({ ...p, [flag.name]: e.target.value }))}
                        className="input"
                      />
                    </div>
                  ),
                )}
              </div>

              {spec.destructive && (
                <div>
                  <label htmlFor="cp-confirm" className="block text-sm mb-1">
                    Retype <span className="font-mono text-red-300">{confirmTarget || 'the target'}</span> to
                    confirm
                  </label>
                  <input
                    id="cp-confirm"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="input"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button onClick={() => run(true)} disabled={running} className="btn-secondary">
                  <FaEye aria-hidden="true" /> Preview
                </button>
                <button
                  onClick={() => run(false)}
                  disabled={
                    running ||
                    !config?.enabled ||
                    (spec.destructive && (!confirmTarget || confirm !== confirmTarget))
                  }
                  className={spec.destructive ? 'btn-danger' : 'btn-primary'}
                >
                  <FaPlay aria-hidden="true" /> {running ? 'Running…' : 'Run'}
                </button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-3 pt-2">
              <div>
                <div className="text-xs text-text-muted mb-1">
                  {result.dryRun ? 'Would run (dry run)' : 'Executed'}
                </div>
                <pre className="bg-dark-input border border-dark-border rounded-lg p-3 text-xs text-text-primary overflow-x-auto whitespace-pre-wrap break-all">
                  clpctl {result.argv.join(' ')}
                </pre>
              </div>
              {!result.dryRun && (
                <div className="text-sm text-text-muted">
                  exit {result.exitCode ?? '—'} · {result.durationMs} ms
                </div>
              )}
              {result.error && (
                <pre className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 overflow-x-auto whitespace-pre-wrap">
                  {result.error}
                </pre>
              )}
              {result.stdout && (
                <pre className="bg-dark-input border border-dark-border rounded-lg p-3 text-xs text-text-secondary overflow-x-auto whitespace-pre-wrap">
                  {result.stdout}
                </pre>
              )}
            </div>
          )}

          {excluded.length > 0 && (
            <p className="text-xs text-text-muted pt-3 border-t border-dark-border">
              Intentionally not available here: <span className="font-mono">{excluded.join(', ')}</span>. See
              docs/CLOUDPANEL.md for why.
            </p>
          )}
        </div>

        {/* Diagnostics */}
        {inventory && (
          <details className="card-dark">
            <summary className="cursor-pointer font-medium text-text-primary">Diagnostics</summary>
            <div className="mt-3 text-sm text-text-secondary space-y-1 font-mono">
              <div>db: {inventory.schema.dbPath}</div>
              <div>site table: {inventory.schema.siteTable ?? '(not found)'}</div>
              <div>user table: {inventory.schema.userTable ?? '(not found)'}</div>
              <div>database table: {inventory.schema.databaseTable ?? '(not found)'}</div>
              <div className="break-all">tables: {inventory.schema.tables.join(', ') || '(none)'}</div>
            </div>
          </details>
        )}
      </div>
    </AdminShell>
  );
}

function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-dark-border flex items-center gap-2 font-semibold text-text-primary">
        <span className="text-text-muted">{icon}</span> {title}{' '}
        <span className="text-text-muted font-normal">({count})</span>
      </div>
      {children}
    </div>
  );
}

function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  if (rows.length === 0) return <div className="p-6 text-center text-text-muted text-sm">{empty}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-dark-lighter text-text-muted text-left">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-dark-border hover:bg-dark-lighter/40">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-text-secondary font-mono text-xs">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
