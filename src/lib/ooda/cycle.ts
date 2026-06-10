import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { revalidateAllPublic } from '@adminpanel/lib/revalidate';
import { scanOrphanUploads } from '@adminpanel/lib/cms/media-scan';
import {
  type ActionItem, type ActResult, type OodaPolicy, type OodaReport,
  DEFAULT_OODA_POLICY, SAFE_ACTION_TYPES,
} from './types';

const execFileP = promisify(execFile);
const ROOT = process.cwd();
const AUDIT_DIR = path.join(ROOT, 'logs', 'audit');

function readJson<T>(file: string): T | null {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) as T; } catch { return null; }
}

// ---- Observe: load the most recent audit artifacts ----
function latestAuditDate(): string | null {
  try {
    return fs.readdirSync(AUDIT_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
      .map((d) => d.name).sort().reverse()[0] ?? null;
  } catch { return null; }
}

export function observe(date?: string) {
  const d = date || latestAuditDate();
  if (!d) return { date: null, seo: null, ai: null, perf: null, deps: null };
  const dir = path.join(AUDIT_DIR, d);
  return {
    date: d,
    seo: readJson<any>(path.join(dir, 'seo.json')),
    ai: readJson<any>(path.join(dir, 'ai.json')),
    perf: readJson<any>(path.join(dir, 'perf.json')),
    deps: readJson<any>(path.join(dir, 'deps.json')),
  };
}

// ---- Orient: deterministic findings -> prioritized actions ----
export function orient(obs: ReturnType<typeof observe>): ActionItem[] {
  const items: ActionItem[] = [];
  const push = (i: ActionItem) => items.push(i);

  const { seo, ai, perf, deps } = obs;

  if (seo) {
    const issues: any[] = Array.isArray(seo.issues) ? seo.issues : [];
    const driftFields = new Set(['metaTitle', 'metaDescription', 'robots', 'canonical']);
    if (issues.some((x) => driftFields.has(x?.field))) {
      push({ id: 'sync-seo', title: 'Sync per-page SEO into the runtime DB', actionType: 'sync-seo', severity: 'medium', riskTier: 'safe', source: 'seo', detail: 'SEO metadata drift between pages.json and cms.db; re-sync is idempotent.' });
    }
    const high = issues.filter((x) => x?.severity === 'high').length;
    const med = issues.filter((x) => x?.severity === 'medium').length;
    if (issues.length) {
      push({ id: 'seo-content', title: `Fix ${issues.length} SEO issue(s)`, actionType: 'content-fix', severity: high ? 'high' : med ? 'medium' : 'low', riskTier: 'review', source: 'seo', detail: `${high} high / ${med} medium SEO issues — content edits (review via PR).` });
    }
  }

  if (ai) {
    const findings: any[] = Array.isArray(ai.findings) ? ai.findings : [];
    if (ai.summary && ai.summary.hasLlmsTxt === false) {
      push({ id: 'llms-txt', title: 'Add /llms.txt for AI crawlers', actionType: 'llms-txt', severity: 'low', riskTier: 'review', source: 'ai', detail: 'No /llms.txt found — add one (edits source/public; review).' });
    }
    if (findings.length) {
      const high = findings.filter((x) => x?.severity === 'high').length;
      push({ id: 'ai-readiness', title: `Address ${findings.length} AI-readiness finding(s)`, actionType: 'ai-readiness', severity: high ? 'high' : 'medium', riskTier: 'review', source: 'ai', detail: 'JSON-LD / crawler / content-structure improvements (review).' });
    }
  }

  if (perf?.summary?.mobile?.performance != null && perf.summary.mobile.performance < 80) {
    push({ id: 'perf', title: `Mobile performance ${perf.summary.mobile.performance}/100`, actionType: 'perf-review', severity: perf.summary.mobile.performance < 50 ? 'high' : 'medium', riskTier: 'notify', source: 'perf', detail: 'Performance below target — review opportunities in the perf report.' });
  }

  if (deps?.summary) {
    const v = deps.summary.vulnerabilities || {};
    if ((v.critical || 0) + (v.high || 0) > 0) {
      push({ id: 'dep-audit', title: `${(v.critical || 0) + (v.high || 0)} critical/high vulnerabilit(ies)`, actionType: 'dep-audit', severity: 'high', riskTier: 'notify', source: 'deps', detail: 'Run a dependency security review — never auto-applied.' });
    }
    if ((deps.summary.patch || 0) + (deps.summary.minor || 0) > 0) {
      push({ id: 'dep-update', title: `${(deps.summary.patch || 0) + (deps.summary.minor || 0)} safe dependency update(s)`, actionType: 'dep-update', severity: 'low', riskTier: 'review', source: 'deps', detail: 'Patch/minor bumps — handled by the weekly-deps PR (build+tsc+lint gated).' });
    }
    if ((deps.summary.major || 0) > 0) {
      push({ id: 'dep-major', title: `${deps.summary.major} major update(s) available`, actionType: 'dep-major', severity: 'low', riskTier: 'notify', source: 'deps', detail: 'Major bumps stay manual.' });
    }
  }

  // Proactive, always-safe: bust ISR so the latest content is served; index any
  // orphaned uploads. Both are idempotent no-ops when there's nothing to do.
  push({ id: 'revalidate', title: 'Revalidate public cache', actionType: 'revalidate', severity: 'info', riskTier: 'safe', source: 'system', detail: 'Bust ISR so the live site serves the latest content.' });
  push({ id: 'scan-media', title: 'Index orphaned uploads', actionType: 'scan-media', severity: 'info', riskTier: 'safe', source: 'system', detail: 'Index files in public/uploads not yet in media-index.json (idempotent).' });

  return items;
}

// ---- Decide: split by policy ----
export function decide(items: ActionItem[], policy: OodaPolicy) {
  const autoApply: ActionItem[] = [];
  const propose: ActionItem[] = [];
  const notify: ActionItem[] = [];
  for (const it of items) {
    if (it.riskTier === 'safe' && SAFE_ACTION_TYPES.includes(it.actionType) && policy.autoApply.includes(it.actionType)) {
      autoApply.push(it);
    } else if (it.riskTier === 'notify') {
      notify.push(it);
    } else {
      propose.push(it); // review (and any 'safe' action not in the allowlist)
    }
  }
  return { autoApply, propose, notify };
}

// ---- Act: dispatch the safe auto-apply lane (in-process / spawn node) ----
async function dispatch(item: ActionItem): Promise<ActResult> {
  try {
    switch (item.actionType) {
      case 'revalidate':
        revalidateAllPublic();
        return { actionType: item.actionType, ok: true, applied: true, message: 'Public cache revalidated.' };
      case 'scan-media': {
        const r = scanOrphanUploads('ooda');
        return { actionType: item.actionType, ok: true, applied: true, message: `Indexed ${r.indexed} orphan upload(s) of ${r.total}.` };
      }
      case 'sync-seo': {
        const scriptsDir = process.env.AUDIT_SCRIPTS_DIR ? path.join(process.env.AUDIT_SCRIPTS_DIR, '..') : path.join(ROOT, 'scripts');
        const script = path.join(scriptsDir, 'sync-seo-from-json.mjs');
        if (!fs.existsSync(script)) return { actionType: item.actionType, ok: false, applied: false, message: `sync-seo script not found at ${script}` };
        await execFileP('node', [script], { cwd: ROOT, timeout: 60_000, env: process.env });
        revalidateAllPublic();
        return { actionType: item.actionType, ok: true, applied: true, message: 'Synced pages.json SEO -> cms.db.' };
      }
      default:
        return { actionType: item.actionType, ok: false, applied: false, message: `No auto-apply handler for ${item.actionType}.` };
    }
  } catch (e) {
    return { actionType: item.actionType, ok: false, applied: false, message: (e as Error).message };
  }
}

export async function act(items: ActionItem[], dryRun: boolean): Promise<ActResult[]> {
  const out: ActResult[] = [];
  for (const it of items) {
    if (dryRun) { out.push({ actionType: it.actionType, ok: true, applied: false, message: '(dry run) would apply' }); continue; }
    out.push(await dispatch(it));
  }
  return out;
}

// ---- Cycle: O -> O -> D -> A, recorded to logs/audit/<date>/ooda.json ----
export async function runOodaCycle(opts: { policy?: Partial<OodaPolicy> } = {}): Promise<OodaReport> {
  const policy: OodaPolicy = { ...DEFAULT_OODA_POLICY, ...(opts.policy || {}) };
  const obs = observe();
  const finishedAt = new Date().toISOString();

  if (!obs.date || (!obs.seo && !obs.ai && !obs.perf && !obs.deps)) {
    return {
      ok: false, date: obs.date, dryRun: policy.dryRun,
      message: 'No audit data found — run a daily audit first (Observe stage is empty).',
      observed: { seo: false, ai: false, perf: false, deps: false },
      oriented: [], decided: { autoApply: [], propose: [], notify: [] }, acted: [], finishedAt,
    };
  }

  const oriented = orient(obs);
  const decided = decide(oriented, policy);
  const acted = await act(decided.autoApply, policy.dryRun);

  const report: OodaReport = {
    ok: true, date: obs.date, dryRun: policy.dryRun,
    observed: { seo: !!obs.seo, ai: !!obs.ai, perf: !!obs.perf, deps: !!obs.deps },
    oriented, decided, acted, finishedAt,
  };

  try {
    fs.mkdirSync(path.join(AUDIT_DIR, obs.date), { recursive: true });
    fs.writeFileSync(path.join(AUDIT_DIR, obs.date, 'ooda.json'), JSON.stringify(report, null, 2));
  } catch { /* best effort */ }

  return report;
}
