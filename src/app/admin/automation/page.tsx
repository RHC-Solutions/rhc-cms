'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import {
  FaRobot, FaSave, FaSpinner, FaPlay, FaCheckCircle, FaTimesCircle,
  FaExternalLinkAlt, FaSyncAlt, FaFileAlt, FaChevronDown, FaChevronRight,
} from 'react-icons/fa';

type AutofixMode = 'pr' | 'off';
interface Config {
  daily: { enabled: boolean; autofix: AutofixMode };
  weekly: { enabled: boolean };
  recipientEmail: string;
  updatedAt: string | null;
}
interface Status {
  date: string; mode: string; subject: string; recipient: string; prUrl: string | null;
  finishedAt: string; seoIssues: number | null; aiFindings: number | null;
  perf: { mobile?: any; desktop?: any } | null; deps: any | null; reportPath: string;
}
interface ApiResponse {
  config: Config; status: Status | null;
  recentReports: { date: string; hasReport: boolean }[];
  running: { daily: boolean; weekly: boolean };
  report?: string | null;
}
type Message = { type: 'success' | 'error'; text: string };

export default function AutomationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [msg, setMsg] = useState<Message | null>(null);
  const [openReport, setOpenReport] = useState<string | null>(null);
  const [reportText, setReportText] = useState<string>('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/automation', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiResponse = await res.json();
      setData(json);
      setCfg(json.config);
    } catch (e: any) {
      setMsg({ type: 'error', text: `Failed to load: ${e.message}` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!cfg) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', config: cfg }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setMsg({ type: 'success', text: 'Settings saved.' });
      setCfg(json.config);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const run = async (job: 'daily' | 'weekly') => {
    setMsg(null);
    try {
      const res = await fetch('/api/admin/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', job }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setMsg({
        type: 'success',
        text: job === 'daily'
          ? 'Audit started — it runs in the background (a few minutes) and emails a summary when done.'
          : 'Dependency update started — emails a summary and opens a PR if safe updates pass.',
      });
      setTimeout(load, 1500);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    }
  };

  const viewReport = async (date: string) => {
    if (openReport === date) { setOpenReport(null); return; }
    setOpenReport(date); setReportText('Loading…');
    try {
      const res = await fetch(`/api/admin/automation?report=${date}`, { cache: 'no-store' });
      const json: ApiResponse = await res.json();
      setReportText(json.report || '(no report.md for this run)');
    } catch (e: any) {
      setReportText(`Failed to load report: ${e.message}`);
    }
  };

  if (loading || !cfg) {
    return (
      <AdminShell title="Automation">
        <div className="flex items-center gap-3 text-text-secondary p-6">
          <FaSpinner className="animate-spin" /> Loading…
        </div>
      </AdminShell>
    );
  }

  const status = data?.status;
  const running = data?.running;
  const perfCell = (s: any) =>
    s ? `perf ${s.performance ?? '–'} · seo ${s.seo ?? '–'} · a11y ${s.accessibility ?? '–'}` : '–';

  return (
    <AdminShell title="Automation">
      <div className="max-w-3xl space-y-6">
        <p className="text-text-secondary text-sm flex items-center gap-2">
          <FaRobot className="text-cyber-cyan" />
          Daily SEO / AI-readiness / performance audits and weekly dependency updates.
          Fixes arrive as a reviewable PR — nothing deploys automatically.
        </p>

        {msg && (
          <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            msg.type === 'success'
              ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
            {msg.type === 'success' ? <FaCheckCircle /> : <FaTimesCircle />}{msg.text}
          </div>
        )}

        {/* ---- Last run ---- */}
        <div className="card-cyber p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="heading-md text-text-primary">Last run</h2>
            <button onClick={load} className="text-text-muted hover:text-cyber-cyan text-sm flex items-center gap-1">
              <FaSyncAlt /> Refresh
            </button>
          </div>
          {status ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="text-text-muted">When</div>
              <div className="text-text-primary">{new Date(status.finishedAt).toLocaleString()} ({status.mode})</div>
              <div className="text-text-muted">Performance (mobile)</div>
              <div className="text-text-primary">{perfCell(status.perf?.mobile)}</div>
              <div className="text-text-muted">Performance (desktop)</div>
              <div className="text-text-primary">{perfCell(status.perf?.desktop)}</div>
              <div className="text-text-muted">SEO issues / AI findings</div>
              <div className="text-text-primary">{status.seoIssues ?? '–'} / {status.aiFindings ?? '–'}</div>
              <div className="text-text-muted">Dependencies</div>
              <div className="text-text-primary">
                {status.deps ? `${status.deps.patch} patch · ${status.deps.minor} minor · ${status.deps.major} major` : '–'}
              </div>
              <div className="text-text-muted">Emailed</div>
              <div className="text-text-primary">{status.recipient}</div>
              {status.prUrl && (
                <>
                  <div className="text-text-muted">Auto-fix PR</div>
                  <a href={status.prUrl} target="_blank" rel="noopener noreferrer"
                     className="text-cyber-cyan hover:underline flex items-center gap-1">
                    {status.prUrl.split('/').slice(-2).join(' #')} <FaExternalLinkAlt size={11} />
                  </a>
                </>
              )}
            </div>
          ) : (
            <p className="text-text-muted text-sm">No runs yet. Trigger one below.</p>
          )}

          <div className="flex flex-wrap gap-3 mt-5">
            <button onClick={() => run('daily')} disabled={running?.daily}
              className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {running?.daily ? <FaSpinner className="animate-spin" /> : <FaPlay />}
              {running?.daily ? 'Audit running…' : 'Run audit now'}
            </button>
            <button onClick={() => run('weekly')} disabled={running?.weekly}
              className="btn flex items-center gap-2 disabled:opacity-50">
              {running?.weekly ? <FaSpinner className="animate-spin" /> : <FaSyncAlt />}
              {running?.weekly ? 'Updating…' : 'Run dependency update now'}
            </button>
          </div>
        </div>

        {/* ---- Settings ---- */}
        <div className="card-cyber p-5 space-y-4">
          <h2 className="heading-md text-text-primary">Settings</h2>

          <Toggle
            label="Daily audit"
            desc="Runs every morning: SEO, AI-readiness and performance."
            checked={cfg.daily.enabled}
            onChange={(v) => setCfg({ ...cfg, daily: { ...cfg.daily, enabled: v } })}
          />

          <div className="pl-1">
            <label className="block text-sm text-text-secondary mb-1">Auto-fix mode</label>
            <select
              value={cfg.daily.autofix}
              disabled={!cfg.daily.enabled}
              onChange={(e) => setCfg({ ...cfg, daily: { ...cfg.daily, autofix: e.target.value as AutofixMode } })}
              className="w-full px-3 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:border-cyber-cyan disabled:opacity-50">
              <option value="pr">Apply safe fixes as a PR (review before merge)</option>
              <option value="off">Report only — never edit files</option>
            </select>
          </div>

          <Toggle
            label="Weekly dependency updates"
            desc="Mondays: safe patch/minor bumps as a PR after build + typecheck + lint pass. Majors stay manual."
            checked={cfg.weekly.enabled}
            onChange={(v) => setCfg({ ...cfg, weekly: { enabled: v } })}
          />

          <div className="pl-1">
            <label className="block text-sm text-text-secondary mb-1">Report email recipient</label>
            <input
              type="email"
              value={cfg.recipientEmail}
              placeholder="Defaults to ADMIN_EMAIL"
              onChange={(e) => setCfg({ ...cfg, recipientEmail: e.target.value })}
              className="w-full px-3 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:border-cyber-cyan"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-text-muted">
              {cfg.updatedAt ? `Saved ${new Date(cfg.updatedAt).toLocaleString()}` : 'Not saved yet'}
            </span>
            <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {saving ? <FaSpinner className="animate-spin" /> : <FaSave />} Save settings
            </button>
          </div>
        </div>

        {/* ---- Recent reports ---- */}
        <div className="card-cyber p-5">
          <h2 className="heading-md text-text-primary mb-3">Recent reports</h2>
          {data?.recentReports?.length ? (
            <ul className="divide-y divide-dark-border">
              {data.recentReports.map((r) => (
                <li key={r.date} className="py-2">
                  <button
                    onClick={() => r.hasReport && viewReport(r.date)}
                    disabled={!r.hasReport}
                    className="w-full flex items-center gap-2 text-left text-sm text-text-primary hover:text-cyber-cyan disabled:text-text-muted">
                    {r.hasReport ? (openReport === r.date ? <FaChevronDown /> : <FaChevronRight />) : <FaFileAlt />}
                    {r.date} {!r.hasReport && <span className="text-text-muted">(no report)</span>}
                  </button>
                  {openReport === r.date && (
                    <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap bg-dark-lighter border border-dark-border rounded-lg p-3 text-xs text-text-secondary">
                      {reportText}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-muted text-sm">No reports yet.</p>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

function Toggle({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-text-primary">{label}</div>
        <div className="text-xs text-text-muted">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-cyber-green' : 'bg-dark-border'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
