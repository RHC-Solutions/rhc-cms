/**
 * Dependency collector. Buckets available updates into patch / minor / major
 * (so the weekly auto-updater can safely apply patch+minor via `npm update`,
 * while majors stay in the email for a manual decision) and summarizes
 * `npm audit` vulnerabilities.
 *
 * Run: node scripts/audit/collect-deps.mjs
 */
import { execSync } from 'node:child_process';
import { writeArtifact, REPO_ROOT, log } from './_lib.mjs';

// npm outdated / audit exit non-zero when they have something to report; capture
// stdout regardless of exit code.
function npmJson(cmd) {
  try {
    return JSON.parse(execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }) || '{}');
  } catch (e) {
    const out = e.stdout?.toString();
    if (out) { try { return JSON.parse(out); } catch { /* fall through */ } }
    return null;
  }
}

const parts = (v) => String(v || '').replace(/^[^\d]*/, '').split('.').map((n) => parseInt(n, 10) || 0);
function bucketFor(current, latest) {
  const [cMaj, cMin] = parts(current);
  const [lMaj, lMin] = parts(latest);
  if (lMaj > cMaj) return 'major';
  if (lMin > cMin) return 'minor';
  return 'patch';
}

async function main() {
  const date = process.argv[2];
  const buckets = { patch: [], minor: [], major: [] };

  const outdated = npmJson('npm outdated --json') || {};
  for (const [name, info] of Object.entries(outdated)) {
    const current = info.current || info.wanted;
    const latest = info.latest;
    if (!current || !latest || current === latest) continue;
    const entry = { name, current, wanted: info.wanted, latest };
    buckets[bucketFor(current, latest)].push(entry);
  }

  const audit = npmJson('npm audit --json') || {};
  const vulns = audit.metadata?.vulnerabilities || {};

  const summary = {
    patch: buckets.patch.length,
    minor: buckets.minor.length,
    major: buckets.major.length,
    vulnerabilities: vulns,
    totalOutdated: buckets.patch.length + buckets.minor.length + buckets.major.length,
  };
  writeArtifact('deps.json', { generatedAt: new Date().toISOString(), summary, buckets, vulnerabilities: vulns }, date);
  log('DEPS done:', JSON.stringify(summary));
}

main().catch((e) => { log('DEPS collector fatal:', e.message); process.exit(0); });
