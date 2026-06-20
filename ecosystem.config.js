/**
 * PM2 process file.
 *
 * Each app's `env` block is built by:
 *   1. Loading the app's own `<cwd>/.env.local` (gitignored), if present.
 *   2. Overlaying the explicit operational keys below (NODE_ENV, PORT, HOSTNAME).
 *
 * Result: every variable defined in `.env.local` is exported into the PM2-
 * managed Node process — `npm start` and any pm2 reload/restart picks them up —
 * but PM2-controlled fields (port, etc.) always win, so a stray `PORT=` in
 * `.env.local` cannot reroute the process. Secrets stay in `.env.local` and
 * are never committed to git.
 *
 * After editing or rotating any value in `.env.local`, restart with:
 *   pm2 restart <app> --update-env
 */
const fs = require('fs');
const path = require('path');

// Minimal .env parser. Intentionally avoids the `dotenv` runtime dependency so
// host sites that vendor this file don't need to install anything new.
// Supports: `KEY=value`, `KEY="quoted"`, `KEY='single quoted'`, leading
// `export `, `#` comments, blank lines, and `\n` / `\r\n` / `\t` escapes inside
// double-quoted values. Lines that don't match `KEY=...` are skipped.
function loadEnvLocal(cwd) {
  const file = path.join(cwd, '.env.local');
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return {};
    throw err;
  }
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2];
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value
        .slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"');
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1);
    } else {
      // Strip trailing inline comment (only when unquoted) and surrounding whitespace.
      const hashIdx = value.indexOf(' #');
      if (hashIdx !== -1) value = value.slice(0, hashIdx);
      value = value.trim();
    }
    out[key] = value;
  }
  return out;
}

const rhcsolutionsCwd = '/home/rhcsolutions_com/htdocs/rhcsolutions.com';
const webCheckCwd = '/home/rhcsolutions_com/htdocs/rhcsolutions.com/web-check';

module.exports = {
  apps: [
    {
      name: 'rhcsolutions',
      script: 'npm',
      args: 'start',
      cwd: rhcsolutionsCwd,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        ...loadEnvLocal(rhcsolutionsCwd),
        NODE_ENV: 'production',
        PORT: 3001,
        HOSTNAME: '0.0.0.0'
      },
      error_file: '/home/rhcsolutions_com/.pm2/logs/rhcsolutions-error.log',
      out_file: '/home/rhcsolutions_com/.pm2/logs/rhcsolutions-out.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'web-check',
      script: 'node',
      args: 'server.js',
      cwd: webCheckCwd,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        ...loadEnvLocal(webCheckCwd),
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: '/home/rhcsolutions_com/.pm2/logs/web-check-error.log',
      out_file: '/home/rhcsolutions_com/.pm2/logs/web-check-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
