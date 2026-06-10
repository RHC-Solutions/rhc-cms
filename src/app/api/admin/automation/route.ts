import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { runOodaCycle } from '@adminpanel/lib/ooda/cycle';
import { DEFAULT_OODA_POLICY, SAFE_ACTION_TYPES, type ActionType } from '@adminpanel/lib/ooda/types';

export const runtime = 'nodejs';

// /api/admin/* is NOT covered by middleware — every handler authenticates itself.
async function requireAdmin(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return false;
  const role = String((token as any).role || '').toLowerCase();
  return role === 'admin' || role === 'administrator';
}

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'cms-data', 'automation.json');
const STATUS_PATH = path.join(ROOT, 'logs', 'audit', 'status.json');
const AUDIT_DIR = path.join(ROOT, 'logs', 'audit');
const LOCKS: Record<'daily' | 'weekly', string> = {
  daily: '/tmp/rhc-audit.lock',
  weekly: '/tmp/rhc-deps.lock',
};

const DEFAULT_CONFIG = {
  daily: { enabled: true, autofix: 'pr' as 'pr' | 'off' },
  weekly: { enabled: true },
  ooda: { ...DEFAULT_OODA_POLICY },
  recipientEmail: '',
  updatedAt: null as string | null,
};

// Keep an allow-listed autoApply set; never persist a non-safe action type.
function sanitizeAutoApply(v: unknown): ActionType[] {
  const arr = Array.isArray(v) ? v : DEFAULT_OODA_POLICY.autoApply;
  return arr.filter((a): a is ActionType => SAFE_ACTION_TYPES.includes(a as ActionType));
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function loadConfig() {
  const raw = readJson<any>(CONFIG_PATH, {});
  return {
    daily: {
      enabled: raw?.daily?.enabled !== false,
      autofix: raw?.daily?.autofix === 'off' ? 'off' : 'pr',
    },
    weekly: { enabled: raw?.weekly?.enabled !== false },
    ooda: {
      enabled: raw?.ooda?.enabled === true,
      autoApply: sanitizeAutoApply(raw?.ooda?.autoApply),
      dryRun: raw?.ooda?.dryRun !== false, // default dry-run unless explicitly disabled
    },
    recipientEmail: typeof raw?.recipientEmail === 'string' ? raw.recipientEmail : '',
    updatedAt: raw?.updatedAt ?? null,
  };
}

// Most recent logs/audit/<date>/ooda.json (last OODA cycle), for the admin card.
function latestOodaReport() {
  try {
    const dates = fs.readdirSync(AUDIT_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
      .map((d) => d.name).sort().reverse();
    for (const d of dates) {
      const p = path.join(AUDIT_DIR, d, 'ooda.json');
      if (fs.existsSync(p)) return readJson<any>(p, null);
    }
  } catch { /* none */ }
  return null;
}

function listRecentReports(limit = 7) {
  try {
    return fs
      .readdirSync(AUDIT_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
      .map((d) => d.name)
      .sort()
      .reverse()
      .slice(0, limit)
      .map((date) => {
        const rp = path.join(AUDIT_DIR, date, 'report.md');
        return { date, hasReport: fs.existsSync(rp) };
      });
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const status = readJson<any>(STATUS_PATH, null);
  let report: string | null = null;
  const wanted = new URL(request.url).searchParams.get('report');
  if (wanted && /^\d{4}-\d{2}-\d{2}$/.test(wanted)) {
    try {
      report = fs.readFileSync(path.join(AUDIT_DIR, wanted, 'report.md'), 'utf-8');
    } catch {
      report = null;
    }
  }
  const running = {
    daily: fs.existsSync(LOCKS.daily),
    weekly: fs.existsSync(LOCKS.weekly),
  };
  return NextResponse.json(
    { config: loadConfig(), status, recentReports: listRecentReports(), running, report, oodaReport: latestOodaReport() },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ---- Save config ----
  if (body?.action === 'save') {
    const c = body.config || {};
    const next = {
      daily: {
        enabled: c?.daily?.enabled !== false,
        autofix: c?.daily?.autofix === 'off' ? 'off' : 'pr',
      },
      weekly: { enabled: c?.weekly?.enabled !== false },
      ooda: {
        enabled: c?.ooda?.enabled === true,
        autoApply: sanitizeAutoApply(c?.ooda?.autoApply),
        dryRun: c?.ooda?.dryRun !== false,
      },
      recipientEmail:
        typeof c?.recipientEmail === 'string' ? c.recipientEmail.trim() : '',
      updatedAt: new Date().toISOString(),
    };
    if (next.recipientEmail && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(next.recipientEmail)) {
      return NextResponse.json({ error: 'Invalid recipient email' }, { status: 400 });
    }
    try {
      fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
      try { fs.chmodSync(CONFIG_PATH, 0o660); } catch { /* best effort */ }
    } catch (e: any) {
      return NextResponse.json({ error: `Save failed: ${e.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, config: next });
  }

  // ---- Trigger a run (detached; the script's own lockfile prevents overlap) ----
  if (body?.action === 'run') {
    const job: 'daily' | 'weekly' = body.job === 'weekly' ? 'weekly' : 'daily';
    if (fs.existsSync(LOCKS[job])) {
      return NextResponse.json({ error: `A ${job} run is already in progress` }, { status: 409 });
    }
    const script = job === 'weekly' ? 'weekly-deps.sh' : 'daily-audit.sh';
    // Embedded (submodule) sites run the admin from the host root, so the audit
    // scripts live under vendor/admin-panel/scripts/audit, not <host>/scripts.
    // AUDIT_SCRIPTS_DIR lets a host point at the real location; the standalone
    // repo falls back to its own ./scripts/audit.
    const scriptsDir = process.env.AUDIT_SCRIPTS_DIR || path.join(ROOT, 'scripts', 'audit');
    const scriptPath = path.join(scriptsDir, script);
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: `Script not found: ${scriptPath}. Set AUDIT_SCRIPTS_DIR if the admin is embedded as a submodule.` },
        { status: 500 },
      );
    }
    try {
      const child = spawn('bash', [scriptPath], {
        cwd: ROOT,
        detached: true,
        stdio: 'ignore',
        env: process.env,
      });
      child.unref();
    } catch (e: any) {
      return NextResponse.json({ error: `Spawn failed: ${e.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, started: job });
  }

  // ---- Run an OODA self-improvement cycle (in-process) ----
  if (body?.action === 'ooda') {
    const cfg = loadConfig();
    try {
      const report = await runOodaCycle({
        policy: {
          enabled: cfg.ooda.enabled,
          autoApply: cfg.ooda.autoApply,
          // A manual trigger may force a dry-run preview, or run live; default to the saved setting.
          dryRun: typeof body?.dryRun === 'boolean' ? body.dryRun : cfg.ooda.dryRun,
        },
      });
      return NextResponse.json(report, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e: any) {
      return NextResponse.json({ error: `OODA cycle failed: ${e.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
