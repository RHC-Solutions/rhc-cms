#!/usr/bin/env node
// admin-panel CLI — one-command installer for the embeddable CMS admin.
//
//   npx github:RHC-Solutions/admin_panel init     # bootstrap into the current site
//   npx github:RHC-Solutions/admin_panel update   # pull a newer panel + refresh wrappers + sync deps
//   npx github:RHC-Solutions/admin_panel apply-pack <zip|url>   # apply a design pack to the running site
//
// Prerequisites (checked at runtime by checkPrerequisites): Node >= 20.9 (init/update/
// apply-pack), git + npm (init/update). `init`/`update` must run from the root of a
// Next.js app (a package.json) — for a brand-new site, scaffold one first
// (`npx create-next-app@latest .`) THEN run init. `update` is NOT for fresh folders: it
// only upgrades a site that has already embedded the panel via `init`.
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
const STATIC_SITE = flag('static-site'); // scaffold the root catch-all that serves design packs

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

// ---------- prerequisites ----------
const MIN_NODE = '20.9.0'; // global fetch/FormData/Blob + the create-next-app the host needs
const toSemver = (v) => { const m = String(v).replace(/^v/, '').match(/(\d+)\.(\d+)\.(\d+)/); return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0]; };
const semverLt = (a, b) => { const x = toSemver(a), y = toSemver(b); for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] < y[i]; } return false; };

// Fail fast with ALL missing prerequisites at once (not one-at-a-time). `init`/`update`
// need Node, git, and npm; `apply-pack` only needs Node (it just talks HTTP to a running site).
function checkPrerequisites({ needGit = true, needNpm = true } = {}) {
  const problems = [];
  if (semverLt(process.versions.node, MIN_NODE)) {
    problems.push(`Node ${process.versions.node} is too old — admin-panel needs Node >= ${MIN_NODE} (it relies on global fetch/FormData/Blob). Upgrade Node (e.g. \`nvm install --lts\`) and retry.`);
  }
  if (needGit && !shQuiet('git', ['--version'])) {
    problems.push('git was not found on PATH — required to add/track the vendor/admin-panel submodule. Install git, then retry.');
  }
  if (needNpm && !NO_INSTALL && !shQuiet('npm', ['--version'])) {
    problems.push('npm was not found on PATH — required to install the panel deps (or pass --no-install to skip).');
  }
  if (problems.length) die(`Prerequisite check failed:\n      - ${problems.join('\n      - ')}`);
  const have = ['Node ' + process.versions.node];
  if (needGit) have.push('git');
  if (needNpm && !NO_INSTALL) have.push('npm');
  info(`Prerequisites OK — ${have.join(', ')} present.`);
}

// ---------- guards ----------
// The scaffolding hint shown when there is no package.json: a host must be a Next.js
// app before the panel can embed into it.
const SCAFFOLD_HINT =
  `      npx create-next-app@latest . --ts --app\n` +
  `      npx github:RHC-Solutions/admin_panel init${STATIC_SITE ? ' --static-site' : ' --static-site   # for a single-purpose design-pack site'}`;

function assertHostSite(context = 'init') {
  const pkgPath = path.join(SITE, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    if (context === 'update') {
      die(`No package.json in ${SITE} — there is nothing to update here.\n` +
          `  \`update\` upgrades a site that has ALREADY embedded the panel (it pulls a newer\n` +
          `  vendor/admin-panel + re-syncs deps). A brand-new/empty folder has not been set up yet.\n` +
          `  • New site? Scaffold a Next.js app, then run \`init\` (not \`update\`):\n` +
          SCAFFOLD_HINT + `\n` +
          `  • Existing site? cd into its root (the folder that contains package.json) and retry.`);
    }
    die(`No package.json in ${SITE}.\n` +
        `  \`init\` embeds the admin INTO a Next.js app, so it must run inside one.\n` +
        `  • Brand-new site? Scaffold the app first, then re-run init:\n` +
        SCAFFOLD_HINT + `\n` +
        `  • Existing site? cd into its root (the folder that contains package.json) and retry.`);
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
  // Next.js only detects middleware at the project root OR inside src/ — and when a
  // src/ dir exists it must live at src/middleware.ts (a root-level one is ignored).
  // Place it next to the app dir so the auth gate is actually applied.
  const target = fs.existsSync(path.join(SITE, 'src'))
    ? path.join(SITE, 'src', 'middleware.ts')
    : path.join(SITE, 'middleware.ts');
  fs.writeFileSync(target, MIDDLEWARE_TEMPLATE);
  ok(`created ${path.relative(SITE, target)} (adminAuthGate wired)`);
}

function generateWrappers(abs, force) {
  const script = path.join(abs, 'scripts', 'install-into-site.mjs');
  if (!fs.existsSync(script)) { warn('install-into-site.mjs missing in submodule — skipping wrapper generation.'); return; }
  info('Generating route wrappers…');
  const args = [script, '--submodule', SUBMODULE, '--site', '.'];
  if (force) args.push('--force');
  if (STATIC_SITE) args.push('--static-site'); // serve ingested packs at clean routes
  sh('node', args, { stdio: 'inherit' });
}

// Install the panel's runtime deps INTO the host, pinned to the version ranges
// the panel *declares* (e.g. archiver@^8.0.0) — not bare `latest`. This keeps the
// host's deps in lockstep with the panel source: bumping the submodule to a build
// that calls the archiver-8 API also pulls archiver ^8 into the host. Caret ranges
// mean a host already on a compatible-or-newer version is left untouched; only a
// host below the range is upgraded. Run on both `init` and `update`.
// Propagate the panel's *literal* dependency overrides into the host package.json so
// host installs resolve the same non-deprecated / security-patched transitive versions
// the panel pins. Example: next-auth (v4) pulls a deprecated uuid@8 transitively; the
// panel pins uuid forward, but npm does NOT carry a dependency's `overrides` into the
// consumer — only the ROOT package.json's overrides apply — so without this the host
// re-resolves the old transitive. `$`-referencing overrides (e.g. "postcss": "$postcss")
// are panel-internal and skipped; existing host overrides are never clobbered.
function propagateOverrides(abs) {
  let panelOverrides = {};
  try { panelOverrides = JSON.parse(fs.readFileSync(path.join(abs, 'package.json'), 'utf8')).overrides || {}; } catch { return; }
  const literal = Object.entries(panelOverrides).filter(([, v]) => typeof v === 'string' && !v.includes('$'));
  if (!literal.length) return;
  const pkgPath = path.join(SITE, 'package.json');
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')); } catch { return; }
  pkg.overrides = pkg.overrides || {};
  const added = [];
  for (const [name, range] of literal) {
    if (!(name in pkg.overrides)) { pkg.overrides[name] = range; added.push(`${name}@${range}`); }
  }
  if (!added.length) { skip('dependency overrides'); return; }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  ok(`overrides: pinned ${added.join(', ')} (avoids deprecated/insecure transitives)`);
}

function installDeps(abs) {
  if (NO_INSTALL) { warn('Skipping dependency install (--no-install). Run install-into-site.mjs --print-deps to see them.'); return; }
  propagateOverrides(abs); // pin transitives (e.g. uuid) BEFORE install so npm resolves them
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
  checkPrerequisites();
  assertHostSite('init');
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
  checkPrerequisites();
  assertHostSite('update');
  const abs = path.join(SITE, SUBMODULE);
  if (!fs.existsSync(path.join(abs, 'src', 'app'))) {
    die(`No panel submodule at ${SUBMODULE} — this site has not been set up yet.\n` +
        `  \`update\` only upgrades an existing embed. Run \`init\` first:\n` +
        `      npx github:RHC-Solutions/admin_panel init${STATIC_SITE ? ' --static-site' : ''}`);
  }
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

// Apply a design pack to the RUNNING site via its HTTP API. Works during first-run
// (no admin yet) for a local file upload; a remote {url} pack requires admin login.
// Uses Node 18+ global fetch/FormData/Blob — still no dependencies.
async function runApplyPack() {
  checkPrerequisites({ needGit: false, needNpm: false }); // only needs Node's global fetch
  const packArg = argv.find((a) => !a.startsWith('-') && a !== 'apply-pack');
  if (!packArg) die("Usage: admin-panel apply-pack <pack.zip | https-url> [--site-url http://localhost:3000] [--tokens '{\"siteName\":\"…\"}']");
  // strip trailing slashes linearly (no regex — avoids the polynomial-backtracking class)
  const stripTrailingSlashes = (s) => { let e = s.length; while (e > 0 && s.charCodeAt(e - 1) === 47) e--; return s.slice(0, e); };
  const siteUrl = stripTrailingSlashes(opt('site-url', 'http://localhost:3000'));
  const tokens = opt('tokens', '');
  const endpoint = `${siteUrl}/api/cms/design-pack/apply`;
  info(`Applying pack → ${endpoint}`);
  let res;
  try {
    if (/^https?:\/\//i.test(packArg)) {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: packArg, tokens: tokens ? JSON.parse(tokens) : undefined }),
      });
    } else {
      if (!fs.existsSync(packArg)) die(`Pack not found: ${packArg}`);
      const fd = new FormData();
      fd.append('pack', new Blob([fs.readFileSync(packArg)]), path.basename(packArg));
      if (tokens) fd.append('tokens', tokens);
      res = await fetch(endpoint, { method: 'POST', body: fd });
    }
  } catch (e) {
    die(`Could not reach the site at ${siteUrl} — is it running? (${e.message})`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) die(`Apply failed (HTTP ${res.status}): ${data.error || ''}`);
  ok(`Pack applied${data.packName ? `: ${data.packName}` : data.type ? ` (${data.type})` : ''}.`);
  console.log(JSON.stringify(data.applied || data.pages || data, null, 2));
}

function runHelp() {
  console.log(`admin-panel — embeddable CMS admin installer

Prerequisites:
  • Node >= ${MIN_NODE}        (uses global fetch/FormData/Blob)
  • git + npm on PATH      (init/update)
  • a Next.js app to embed into — init/update run from the app's root (where
    package.json lives). Brand-new site? Scaffold the app first, THEN init:
      npx create-next-app@latest .
      npx github:RHC-Solutions/admin_panel init --static-site   # --static-site = pack IS the site

Usage (from your site's root):
  npx github:RHC-Solutions/admin_panel init [options]
  npx github:RHC-Solutions/admin_panel update

init bootstraps the panel into the CURRENT Next.js app. update upgrades a site that
ALREADY embedded the panel — it pulls the newest panel source, regenerates the route
wrappers, syncs the host's deps to the versions the panel declares, and warns if any
host dep is below the panel's required minimum. (Running update in an empty folder does
nothing — there's no embed yet; run init first.) Rebuild + restart afterwards.

init options:
  --submodule <path>   submodule location (default: vendor/admin-panel)
  --url <git-url>      panel repo URL (default: ${DEFAULT_URL})
  --branch <name>      submodule tracking branch (default: main)
  --no-install         don't run npm install for the panel's deps
  --no-renovate        don't write a renovate.json
  --static-site        scaffold a root catch-all that serves design packs at clean
                       routes (for single-purpose pack hosts; remove your own / page)
  --yes                assume defaults, no prompts
  --help               this help

renovate.json (written on init/update unless --no-renovate) enables Renovate's
git-submodules + npm managers so each site auto-opens PRs that bump vendor/admin-panel
and the panel's deps. Requires the Renovate GitHub App (or self-hosted) on the repo.

apply-pack <zip|https-url> options:
  --site-url <url>     running site base URL (default: http://localhost:3000)
  --tokens <json>      {{token}} substitutions, e.g. '{"siteName":"Acme Inc"}'
  (file upload works during first-run; a remote URL pack requires admin login)
`);
}

switch (cmd) {
  case 'init': runInit(); break;
  case 'update': runUpdate(); break;
  case 'apply-pack': await runApplyPack(); break;
  case 'help': case '--help': runHelp(); break;
  default: warn(`Unknown command "${cmd}".`); runHelp(); process.exit(1);
}
