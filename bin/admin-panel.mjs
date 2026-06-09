#!/usr/bin/env node
// admin-panel CLI — one-command installer for the embeddable CMS admin.
//
//   npx github:RHC-Solutions/admin_panel init     # bootstrap into the current site
//   npx github:RHC-Solutions/admin_panel update   # pull a newer panel + refresh wrappers + sync deps
//
// `init` is idempotent — safe to re-run. It:
//   1. adds the panel as a git submodule at vendor/admin-panel
//   2. adds the @adminpanel/* path to tsconfig.json
//   3. creates middleware.ts wired to adminAuthGate (or prints the snippet if one exists)
//   4. generates the Next route wrappers (install-into-site.mjs)
//   5. installs the runtime deps           (skip with --no-install)
//   6. scaffolds .env.local + a fresh NEXTAUTH_SECRET, and updates .gitignore
//   7. drops a renovate.json so the site auto-updates the panel + deps (--no-renovate)
//
// Flags: --submodule <path> (default vendor/admin-panel) · --url <git-url>
//        --branch <name> (submodule tracking branch, default main)
//        --no-install · --no-renovate · --yes (assume defaults) · --help
//
// Uses Node built-ins only — no dependencies.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const DEFAULT_URL = 'https://github.com/RHC-Solutions/admin_panel.git';
const SITE = process.cwd();

// ---------- arg parsing ----------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const cmd = (flag('help') || argv.includes('-h'))
  ? 'help'
  : (argv.find((a) => !a.startsWith('-')) || 'init');
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[i + 1] : def;
};
const SUBMODULE = opt('submodule', 'vendor/admin-panel');
const URL = opt('url', DEFAULT_URL);
const BRANCH = opt('branch', 'main');
const NO_INSTALL = flag('no-install');
const NO_RENOVATE = flag('no-renovate');

// ---------- tiny logger ----------
const c = (n, s) => (process.stdout.isTTY ? `\x1b[${n}m${s}\x1b[0m` : s);
const ok = (m) => console.log(`${c(32, '✓')} ${m}`);
const info = (m) => console.log(`${c(36, '•')} ${m}`);
const warn = (m) => console.log(`${c(33, '!')} ${m}`);
const skip = (m) => console.log(`${c(90, '·')} ${m} ${c(90, '(already done)')}`);
const die = (m) => { console.error(`${c(31, '✗')} ${m}`); process.exit(1); };
const sh = (file, args, o = {}) =>
  execFileSync(file, args, { cwd: SITE, stdio: 'pipe', encoding: 'utf8', ...o });
const shQuiet = (file, args) => { try { return sh(file, args); } catch { return null; } };

// ---------- guards ----------
function assertHostSite() {
  const pkgPath = path.join(SITE, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    die(`No package.json in ${SITE}.\n  Run this from the root of the site you want to add the admin to.`);
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.name === 'rhcsolutions-admin') {
      die(`This is the admin_panel repo itself — run \`init\` from a *host* site, not from inside the panel.`);
    }
  } catch { /* unreadable package.json is fine to proceed past */ }
}

const isGitRepo = () => !!shQuiet('git', ['rev-parse', '--is-inside-work-tree']);

// ---------- steps ----------
function ensureGit() {
  if (isGitRepo()) return;
  info('Initializing a git repository (required for submodules)…');
  sh('git', ['init'], { stdio: 'inherit' });
  ok('git initialized');
}

// Record the tracking branch in .gitmodules so BOTH `git submodule update --remote`
// and Renovate's git-submodules manager follow the same branch deterministically.
// Idempotent — safe to call on an already-present submodule.
function setSubmoduleBranch() {
  if (!fs.existsSync(path.join(SITE, '.gitmodules'))) return;
  shQuiet('git', ['config', '-f', '.gitmodules', `submodule.${SUBMODULE}.branch`, BRANCH]);
  shQuiet('git', ['submodule', 'sync', '--', SUBMODULE]);
}

function ensureSubmodule() {
  const abs = path.join(SITE, SUBMODULE);
  if (fs.existsSync(path.join(abs, 'src', 'app'))) { skip(`submodule present at ${SUBMODULE}`); setSubmoduleBranch(); return abs; }
  info(`Adding submodule ${URL} → ${SUBMODULE} (branch ${BRANCH}) …`);
  try {
    sh('git', ['submodule', 'add', '-b', BRANCH, '--force', URL, SUBMODULE], { stdio: 'inherit' });
  } catch {
    // Maybe registered but not checked out
    shQuiet('git', ['submodule', 'update', '--init', '--recursive', SUBMODULE]);
  }
  if (!fs.existsSync(path.join(abs, 'src', 'app'))) die(`Could not check out the submodule at ${SUBMODULE}.`);
  setSubmoduleBranch();
  ok(`submodule ready at ${SUBMODULE}`);
  return abs;
}

function patchTsconfig() {
  const tsPath = ['tsconfig.json', 'jsconfig.json'].map((f) => path.join(SITE, f)).find(fs.existsSync);
  const mapping = `./${SUBMODULE}/src/*`;
  if (!tsPath) {
    warn(`No tsconfig.json found — add this manually:\n      "paths": { "@adminpanel/*": ["${mapping}"] }`);
    return;
  }
  let text = fs.readFileSync(tsPath, 'utf8');
  if (text.includes('@adminpanel/*')) { skip('tsconfig @adminpanel/* path'); return; }

  const line = `"@adminpanel/*": ["${mapping}"]`;
  if (/"paths"\s*:\s*\{/.test(text)) {
    text = text.replace(/("paths"\s*:\s*\{)/, `$1\n      ${line},`);
  } else if (/"compilerOptions"\s*:\s*\{/.test(text)) {
    text = text.replace(/("compilerOptions"\s*:\s*\{)/, `$1\n    "baseUrl": ".",\n    "paths": { ${line} },`);
  } else {
    warn(`Couldn't auto-edit ${path.basename(tsPath)} — add manually:\n      "paths": { "@adminpanel/*": ["${mapping}"] }`);
    return;
  }
  fs.writeFileSync(tsPath, text);
  ok(`tsconfig: added @adminpanel/* → ${mapping}`);
}

const MIDDLEWARE_TEMPLATE = `import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminAuthGate, ADMIN_MATCHER } from '@adminpanel/admin-middleware';

// Composed by admin-panel init. Keep your own site-level concerns here
// (canonical host, CSP/security headers, caching) and call the gate.
export async function middleware(req: NextRequest) {
  const gate = await adminAuthGate(req); // login, MFA, roles, first-run setup
  if (gate) return gate;
  return NextResponse.next();
}

export const config = { matcher: [...ADMIN_MATCHER] };
`;

function wireMiddleware() {
  const existing = ['middleware.ts', 'middleware.js', 'src/middleware.ts', 'src/middleware.js']
    .map((f) => path.join(SITE, f)).find(fs.existsSync);
  if (existing) {
    const body = fs.readFileSync(existing, 'utf8');
    if (body.includes('adminAuthGate')) { skip('middleware adminAuthGate'); return; }
    warn(`You already have ${path.relative(SITE, existing)} — I won't overwrite it. Add inside your middleware():

      import { adminAuthGate, ADMIN_MATCHER } from '@adminpanel/admin-middleware';
      const gate = await adminAuthGate(req); if (gate) return gate;
      // and merge ...ADMIN_MATCHER into your config.matcher`);
    return;
  }
  const target = fs.existsSync(path.join(SITE, 'src')) ? path.join(SITE, 'middleware.ts') : path.join(SITE, 'middleware.ts');
  fs.writeFileSync(target, MIDDLEWARE_TEMPLATE);
  ok(`created ${path.relative(SITE, target)} (adminAuthGate wired)`);
}

function generateWrappers(abs, force) {
  const script = path.join(abs, 'scripts', 'install-into-site.mjs');
  if (!fs.existsSync(script)) { warn('install-into-site.mjs missing in submodule — skipping wrapper generation.'); return; }
  info('Generating route wrappers…');
  const args = [script, '--submodule', SUBMODULE, '--site', '.'];
  if (force) args.push('--force');
  sh('node', args, { stdio: 'inherit' });
}

// Install the panel's runtime deps INTO the host, pinned to the version ranges
// the panel *declares* (e.g. archiver@^8.0.0) — not bare `latest`. This keeps the
// host's deps in lockstep with the panel source: bumping the submodule to a build
// that calls the archiver-8 API also pulls archiver ^8 into the host. Caret ranges
// mean a host already on a compatible-or-newer version is left untouched; only a
// host below the range is upgraded. Run on both `init` and `update`.
function installDeps(abs) {
  if (NO_INSTALL) { warn('Skipping dependency install (--no-install). Run install-into-site.mjs --print-deps to see them.'); return; }
  let deps = {};
  try { deps = JSON.parse(fs.readFileSync(path.join(abs, 'package.json'), 'utf8')).dependencies || {}; } catch { /* */ }
  const spec = (n) => `${n}@${deps[n]}`;
  const names = Object.keys(deps).filter((n) => !n.startsWith('@types/'));
  const types = Object.keys(deps).filter((n) => n.startsWith('@types/'));
  if (!names.length) { skip('dependencies'); return; }
  info(`Installing ${names.length} runtime deps at the panel's declared versions (this can take a minute)…`);
  sh('npm', ['install', ...names.map(spec), '--legacy-peer-deps'], { stdio: 'inherit' });
  if (types.length) sh('npm', ['install', '-D', ...types.map(spec), '--legacy-peer-deps'], { stdio: 'inherit' });
  ok('dependencies installed');
}

// Safety net for (b): warn if the host is running a dep BELOW the panel's declared
// peerDependencies floor — the skew that makes panel source crash (e.g. the source
// calls `new ZipArchive` from archiver 8 but the host still has archiver 7). The
// normal init/update flow installs at the declared ranges so this is satisfied;
// this catches hosts that pinned an old version themselves or ran with --no-install.
// Built-ins only: compares the installed MAJOR against the floor's major, which is
// exactly the granularity a breaking major rename needs.
function floorMajor(range) { const m = String(range).match(/(\d+)/); return m ? parseInt(m[1], 10) : 0; }
function installedMajor(name) {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(SITE, 'node_modules', name, 'package.json'), 'utf8')).version;
    return floorMajor(v);
  } catch { return null; } // not installed — npm install will place it; nothing to warn about
}
function checkPeers(abs) {
  let peers = {};
  try { peers = JSON.parse(fs.readFileSync(path.join(abs, 'package.json'), 'utf8')).peerDependencies || {}; } catch { return; }
  const bad = [];
  for (const [name, range] of Object.entries(peers)) {
    const have = installedMajor(name);
    if (have !== null && have < floorMajor(range)) bad.push(`${name}: need ${range}, host has v${have}.x`);
  }
  if (bad.length) {
    warn(`Host deps are BELOW the panel's required minimums — panel code may crash at runtime:\n      ${bad.join('\n      ')}\n      Fix: re-run \`admin-panel update\` (or \`npm install ${Object.keys(peers).join(' ')}\`) then rebuild.`);
  } else {
    ok('peer dependency minimums satisfied');
  }
}

function scaffoldEnv(abs) {
  const envPath = path.join(SITE, '.env.local');
  const examplePath = path.join(abs, '.env.local.example');
  if (fs.existsSync(envPath)) {
    skip('.env.local (present — verify NEXTAUTH_SECRET / NEXTAUTH_URL / NEXT_PUBLIC_SITE_URL)');
    return;
  }
  let body = fs.existsSync(examplePath) ? fs.readFileSync(examplePath, 'utf8')
    : 'NEXTAUTH_SECRET=\nNEXTAUTH_URL=https://your-domain.com\nNEXT_PUBLIC_SITE_URL=https://your-domain.com\n';
  const secret = crypto.randomBytes(32).toString('base64');
  body = body.replace(/^NEXTAUTH_SECRET=.*$/m, `NEXTAUTH_SECRET=${secret}`);
  if (!/^NEXTAUTH_SECRET=/m.test(body)) body = `NEXTAUTH_SECRET=${secret}\n` + body;
  fs.writeFileSync(envPath, body);
  fs.chmodSync(envPath, 0o600);
  ok('.env.local scaffolded with a fresh NEXTAUTH_SECRET (fill in NEXTAUTH_URL / NEXT_PUBLIC_SITE_URL)');
}

function updateGitignore() {
  const giPath = path.join(SITE, '.gitignore');
  const needed = ['.env.local', 'cms-data/secrets.json', 'cms-data/users.json', 'cms-data/cms.db'];
  let body = fs.existsSync(giPath) ? fs.readFileSync(giPath, 'utf8') : '';
  const missing = needed.filter((e) => !body.split(/\r?\n/).includes(e));
  if (!missing.length) { skip('.gitignore secrets'); return; }
  body += (body.endsWith('\n') || body === '' ? '' : '\n') + '\n# admin-panel: never commit secrets\n' + missing.join('\n') + '\n';
  fs.writeFileSync(giPath, body);
  ok(`.gitignore: ignoring ${missing.join(', ')}`);
}

// Self-contained host Renovate config. Renovate keeps each site current on its own:
// the git-submodules manager (off by default — enabled here) bumps vendor/admin-panel
// to its tracked branch, and the npm manager bumps the panel's deps in the host's
// package.json. Everything arrives as a reviewable PR — nothing auto-merges, matching
// the panel's "nothing deploys automatically" policy. Flip a packageRule's automerge
// to true (with CI + branch protection) to make safe bumps hands-off.
const RENOVATE_TEMPLATE = JSON.stringify({
  $schema: 'https://docs.renovatebot.com/renovate-schema.json',
  extends: ['config:recommended', ':dependencyDashboard', ':semanticCommits'],
  'git-submodules': { enabled: true },
  schedule: ['before 6am on monday'],
  packageRules: [
    {
      description: 'Embedded admin panel: open a PR to bump vendor/admin-panel to its tracked branch. Review before merge — panel updates can be breaking.',
      matchManagers: ['git-submodules'],
      addLabels: ['admin-panel'],
      automerge: false,
    },
    {
      description: 'Group npm patch+minor into one weekly PR. Set automerge:true (with CI) to make these hands-off.',
      matchManagers: ['npm'],
      matchUpdateTypes: ['patch', 'minor'],
      groupName: 'npm patch+minor',
      automerge: false,
    },
    {
      description: 'npm major updates: one PR each, manual review.',
      matchManagers: ['npm'],
      matchUpdateTypes: ['major'],
      addLabels: ['dependencies', 'major'],
      automerge: false,
    },
  ],
}, null, 2) + '\n';

function writeRenovateConfig() {
  if (NO_RENOVATE) { warn('Skipping renovate.json (--no-renovate).'); return; }
  const candidates = ['renovate.json', 'renovate.json5', '.renovaterc', '.renovaterc.json', '.github/renovate.json'];
  const existing = candidates.map((f) => path.join(SITE, f)).find(fs.existsSync);
  if (existing) {
    const rel = path.relative(SITE, existing);
    if (!/git-submodules/.test(fs.readFileSync(existing, 'utf8'))) {
      warn(`${rel} exists but doesn't enable git-submodules — add this so Renovate also bumps ${SUBMODULE}:\n      "git-submodules": { "enabled": true }`);
    } else {
      skip(`renovate config (${rel})`);
    }
    return;
  }
  fs.writeFileSync(path.join(SITE, 'renovate.json'), RENOVATE_TEMPLATE);
  ok('renovate.json written — auto-updates vendor/admin-panel + npm deps via PRs');
}

// ---------- commands ----------
function runInit() {
  console.log(c(1, '\nadmin-panel init') + ` → ${SITE}\n`);
  assertHostSite();
  ensureGit();
  const abs = ensureSubmodule();
  patchTsconfig();
  wireMiddleware();
  generateWrappers(abs, false);
  installDeps(abs);
  checkPeers(abs);
  scaffoldEnv(abs);
  updateGitignore();
  writeRenovateConfig();
  console.log(`
${c(32, '✔ Admin panel installed.')} Next:

  1) Edit ${c(1, '.env.local')} — set NEXTAUTH_URL and NEXT_PUBLIC_SITE_URL to your domain.
  2) ${c(1, 'npm run build && npm start')}   (or pm2/systemd in production)
  3) Open ${c(1, '/admin')} → the setup wizard creates your admin account, then enroll MFA.
  4) Enable the ${c(1, 'Renovate')} app on this repo so renovate.json keeps the panel + deps current.

Full reference: ${SUBMODULE}/INSTALL.md
`);
}

function runUpdate() {
  assertHostSite();
  const abs = path.join(SITE, SUBMODULE);
  if (!fs.existsSync(path.join(abs, 'src', 'app'))) die(`No submodule at ${SUBMODULE}. Run \`init\` first.`);
  setSubmoduleBranch(); // backfill the tracking branch for hosts created before this existed
  info('Pulling latest panel…');
  sh('git', ['submodule', 'update', '--remote', SUBMODULE], { stdio: 'inherit' });
  generateWrappers(abs, true);
  // Keep the host's deps in lockstep with the new panel source. Without this a
  // host could pull source that calls a newer dep API (e.g. archiver 8's
  // `new ZipArchive`) while still resolving an older dep, and crash at runtime.
  installDeps(abs);
  checkPeers(abs);
  writeRenovateConfig(); // backfill auto-updates for hosts created before this existed
  ok('Panel updated. Rebuild: npm run build && restart your server.');
}

function runHelp() {
  console.log(`admin-panel — embeddable CMS admin installer

Usage (from your site's root):
  npx github:RHC-Solutions/admin_panel init [options]
  npx github:RHC-Solutions/admin_panel update

update pulls the newest panel source, regenerates the route wrappers, syncs the
host's deps to the versions the panel declares, and warns if any host dep is below
the panel's required minimum. Rebuild + restart afterwards.

init options:
  --submodule <path>   submodule location (default: vendor/admin-panel)
  --url <git-url>      panel repo URL (default: ${DEFAULT_URL})
  --branch <name>      submodule tracking branch (default: main)
  --no-install         don't run npm install for the panel's deps
  --no-renovate        don't write a renovate.json
  --yes                assume defaults, no prompts
  --help               this help

renovate.json (written on init/update unless --no-renovate) enables Renovate's
git-submodules + npm managers so each site auto-opens PRs that bump vendor/admin-panel
and the panel's deps. Requires the Renovate GitHub App (or self-hosted) on the repo.
`);
}

switch (cmd) {
  case 'init': runInit(); break;
  case 'update': runUpdate(); break;
  case 'help': case '--help': runHelp(); break;
  default: warn(`Unknown command "${cmd}".`); runHelp(); process.exit(1);
}
