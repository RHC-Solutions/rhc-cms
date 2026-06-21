import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { createBackupZip, ensureBackupsDir, getSiteSlug } from './backup';

/**
 * Panel self-update helpers. Hosts embed rhc-cms as the `vendor/admin-panel`
 * git submodule; "updating" = fast-forwarding that submodule to the latest commit
 * on its tracking branch. checkForUpdate() is READ-ONLY (GitHub API). applyUpdate()
 * takes a full backup FIRST, then fast-forwards, captures the changelog, and signals
 * that a rebuild + restart is required (the running process keeps serving old code
 * until then). A lockfile prevents concurrent/overlapping updates.
 */

const execFileP = promisify(execFile);
const REPO = 'RHC-Solutions/rhc-cms';
const BRANCH = 'main';
const LOCK_FILE = '/tmp/panel-update.lock';

const HOST_ROOT = process.env.SHARED_ROOT || process.cwd();

// The panel lives at vendor/admin-panel inside a host; in the panel repo itself it
// is the cwd. Return the directory whose git history represents "the panel".
function panelDir(): string {
  const submodule = path.join(HOST_ROOT, 'vendor', 'admin-panel');
  if (fs.existsSync(path.join(submodule, '.git'))) return submodule;
  return HOST_ROOT;
}

function isSubmodule(): boolean {
  return panelDir() !== HOST_ROOT;
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileP('git', args, { cwd, timeout: 120_000, env: process.env });
  return stdout.trim();
}

export interface UpdateCheck {
  ok: boolean;
  current: string | null;       // local short SHA
  latest: string | null;        // remote short SHA
  behind: number;               // commits behind (best-effort)
  upToDate: boolean;
  version: string | null;       // local package.json version
  changelog: { sha: string; message: string }[];
  checkedAt: string;
  error?: string;
}

function localVersion(): string | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(panelDir(), 'package.json'), 'utf-8')).version || null;
  } catch { return null; }
}

/** READ-ONLY: compare the local panel SHA against the latest on the tracking branch. */
export async function checkForUpdate(): Promise<UpdateCheck> {
  const checkedAt = new Date().toISOString();
  const base: UpdateCheck = { ok: false, current: null, latest: null, behind: 0, upToDate: false, version: localVersion(), changelog: [], checkedAt };
  let current: string;
  try {
    current = await git(['rev-parse', 'HEAD'], panelDir());
  } catch (e) {
    return { ...base, error: `Could not read local panel revision: ${(e as Error).message}` };
  }
  base.current = current.slice(0, 8);

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits?sha=${BRANCH}&per_page=30`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'admin-panel-updater' },
    });
    if (!res.ok) return { ...base, error: `GitHub API ${res.status}` };
    const commits: Array<{ sha: string; commit: { message: string } }> = await res.json();
    if (!Array.isArray(commits) || commits.length === 0) return { ...base, error: 'No commits returned' };
    const latest = commits[0].sha;
    base.latest = latest.slice(0, 8);
    const idx = commits.findIndex((c) => c.sha === current);
    base.upToDate = latest === current;
    base.behind = idx === -1 ? commits.length : idx; // commits newer than local
    base.changelog = (idx === -1 ? commits : commits.slice(0, idx)).map((c) => ({
      sha: c.sha.slice(0, 8),
      message: c.commit.message.split('\n')[0],
    }));
    base.ok = true;
    return base;
  } catch (e) {
    return { ...base, error: `Update check failed: ${(e as Error).message}` };
  }
}

export interface UpdateResult {
  ok: boolean;
  backup?: string;
  fromSha?: string;
  toSha?: string;
  changelog: { sha: string; message: string }[];
  rebuildRequired: boolean;
  message: string;
}

/** Backup FIRST, then fast-forward the submodule, then capture the changelog. */
export async function applyUpdate(): Promise<UpdateResult> {
  if (fs.existsSync(LOCK_FILE)) {
    return { ok: false, changelog: [], rebuildRequired: false, message: 'An update is already in progress.' };
  }
  if (!isSubmodule()) {
    return { ok: false, changelog: [], rebuildRequired: false, message: 'Self-update only runs on a host that embeds the panel as a vendor/admin-panel submodule.' };
  }
  fs.writeFileSync(LOCK_FILE, new Date().toISOString());
  let backup: string | undefined;
  try {
    // 1) Full backup before touching anything (so a bad update is recoverable).
    ensureBackupsDir();
    const dir = path.join(HOST_ROOT, 'cms-data', 'backups');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(dir, `${getSiteSlug()}-preupdate-${stamp}.zip`);
    const made = await createBackupZip(backupPath);
    if (!made) return { ok: false, changelog: [], rebuildRequired: false, message: 'Aborted: pre-update backup failed.' };
    backup = path.basename(backupPath);

    // 2) Fast-forward the submodule to the tracking branch.
    const sub = panelDir();
    const fromSha = (await git(['rev-parse', 'HEAD'], sub)).slice(0, 8);
    await git(['fetch', 'origin', BRANCH], sub);
    let toFull: string;
    try {
      toFull = await git(['rev-parse', `origin/${BRANCH}`], sub);
    } catch {
      toFull = await git(['rev-parse', 'FETCH_HEAD'], sub);
    }
    // Only fast-forward — never force; refuse if histories diverged.
    await git(['merge', '--ff-only', toFull], sub);
    const toSha = toFull.slice(0, 8);

    // 3) Changelog between the two revisions.
    let changelog: { sha: string; message: string }[] = [];
    if (fromSha !== toSha) {
      const log = await git(['log', '--pretty=format:%h%s', `${fromSha}..${toSha}`], sub);
      changelog = log ? log.split('\n').map((l) => { const [sha, message] = l.split(''); return { sha, message }; }) : [];
    }

    return {
      ok: true,
      backup,
      fromSha,
      toSha,
      changelog,
      rebuildRequired: fromSha !== toSha,
      message: fromSha === toSha ? 'Already up to date.' : `Updated ${fromSha} → ${toSha}. Rebuild + restart required to apply.`,
    };
  } catch (e) {
    return { ok: false, backup, changelog: [], rebuildRequired: false, message: `Update failed: ${(e as Error).message}. A pre-update backup ${backup ? `(${backup}) ` : ''}was taken.` };
  } finally {
    try { fs.unlinkSync(LOCK_FILE); } catch { /* ignore */ }
  }
}
