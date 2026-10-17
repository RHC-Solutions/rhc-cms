/**
 * The privileged half of the CloudPanel module: a strict allowlist in front of
 * `clpctl`.
 *
 * Threat model. Every command here ultimately runs as root on the host. The web
 * app that calls it is reachable over the network, and an admin session is the
 * only thing between the internet and `site:delete`. So the rules are:
 *
 *   1. NO SHELL, EVER. We use execFile with an argv array. There is no string
 *      concatenation of a command line anywhere in this file, so shell
 *      metacharacters in a value are inert — there is no shell to interpret them.
 *   2. Values are emitted as a SINGLE argv element in `--flag=value` form. A
 *      value can therefore never be re-parsed as its own flag, which is the
 *      classic argv-injection escape (`--siteUser=x --force`).
 *   3. Every flag has a validator. Anything not matching is rejected before we
 *      spawn — allowlist, not denylist.
 *   4. Only commands in COMMANDS run. The command name is a map key, never
 *      caller-supplied text passed through to a process.
 *   5. Every value is limited to a small ASCII set (SAFE_VALUE_RE). CloudPanel's
 *      own /usr/bin/clpctl does not exec its arguments: it re-quotes them with
 *      printf %q and runs `bash -c` on the result, and a value holding any byte
 *      outside printable ASCII makes that quoting expandable — a password like
 *      `$(cmd)é...` ran `cmd` as root (2026-10-17 review). "No shell here" is
 *      not enough when the program at the other end builds one.
 *   6. Secret values never appear in an argv: they are sent on the wrapper's
 *      stdin (`--password=-`), so sudo's own log line never records them.
 *   7. Gated commands (destructive, or handing out panel access) additionally
 *      require config.allowDestructive AND a typed confirmation at the route
 *      layer, and the root-owned marker file on the host.
 *
 * The wrapper script (scripts/cloudpanel/rhc-clpctl) enforces the same allowlist
 * a second time on the root side, because a sudoers rule permitting arbitrary
 * clpctl arguments would make everything above merely advisory.
 */

import { execFile } from 'child_process';
import { access, constants } from 'fs/promises';
import { getCloudPanelConfig, type CloudPanelConfig } from './config';

export type Validator = (value: string) => boolean;

export interface FlagSpec {
  /** clpctl flag name, without the leading `--`. */
  name: string;
  required?: boolean;
  validate: Validator;
  /** Redacted in dry-run output, audit entries and logs. */
  secret?: boolean;
  /** Valueless flag, emitted as a bare `--force`. */
  boolean?: boolean;
  /** Applied to the trimmed value before `validate`, e.g. a bare file name -> full path. */
  normalize?: (value: string) => string;
  hint: string;
}

export interface CommandSpec {
  /** The clpctl verb, e.g. `site:add:nodejs`. */
  command: string;
  summary: string;
  /**
   * Gated: requires config.allowDestructive + typed confirmation (+ the
   * root-side marker). Set for verbs that delete or overwrite data AND for those
   * that hand out panel access (user:add, user:reset:password): a new CloudPanel
   * admin can do everything the destructive verbs do from CloudPanel's own UI.
   */
  destructive?: boolean;
  flags: FlagSpec[];
}

/* ---------------------------------------------------------------- validators */

const MAX_VALUE = 512;

/**
 * The only characters any value may contain, whatever its flag. Mirrors
 * SAFE_VALUE_RE in scripts/cloudpanel/rhc-clpctl. Anything else is either
 * dangerous once CloudPanel's clpctl re-quotes it for `bash -c` (any non-ASCII
 * byte) or arrives mangled (a space, comma or apostrophe gains a backslash).
 */
const SAFE_VALUE_RE = /^[A-Za-z0-9 #%+,./:=@_-]+$/;

function bounded(re: RegExp): Validator {
  return (v) => typeof v === 'string' && v.length > 0 && v.length <= MAX_VALUE && re.test(v);
}

/** Hostname: 2+ labels, each 1-63 chars, no leading/trailing hyphen. */
export const isDomain: Validator = (v) => {
  if (typeof v !== 'string' || !v || v.length > 253 || v.includes('\0')) return false;
  const labels = v.toLowerCase().split('.');
  if (labels.length < 2) return false;
  return labels.every(
    (l) =>
      l.length > 0 && l.length <= 63 && /^[a-z0-9-]+$/.test(l) && !l.startsWith('-') && !l.endsWith('-'),
  );
};

/** Comma-separated, no spaces (normalizeDomainList strips them first). */
const isDomainList: Validator = (v) => {
  if (typeof v !== 'string' || !v || v.length > MAX_VALUE || /\s/.test(v)) return false;
  const parts = v.split(',');
  return parts.length <= 100 && parts.every((d) => isDomain(d));
};

const normalizeDomainList = (v: string) =>
  v
    .split(',')
    .map((d) => d.trim())
    .join(',');

/** POSIX-ish username, matching what CloudPanel accepts for a site user. */
const isSiteUser = bounded(/^[a-z_][a-z0-9_-]{0,31}$/);

const isUserName = bounded(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);

const isEmail = bounded(/^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,180}\.[A-Za-z]{2,24}$/);

/**
 * Person name: ASCII letters, '.' and '-'. No spaces or apostrophes — CloudPanel's
 * clpctl would store them with a backslash in front.
 */
const isPersonName = bounded(/^[A-Za-z][A-Za-z.-]{0,63}$/);

/**
 * Passwords: letters, digits and the punctuation that survives CloudPanel's
 * re-quoting unchanged. Anything else would either set a different password
 * than the one typed or, outside ASCII, run as a command (see SAFE_VALUE_RE).
 */
const isPassword = bounded(/^[A-Za-z0-9#%+./:=@_-]{8,128}$/);
const PASSWORD_HINT = '8-128 characters: letters, digits and # % + . / : = @ _ -';

/** Dotted version, e.g. `22`, `8.3`, `3.12`. */
const isVersion = bounded(/^[0-9]{1,3}(\.[0-9]{1,3}){0,2}$/);

const isPort: Validator = (v) => /^[0-9]{1,5}$/.test(v) && Number(v) >= 1 && Number(v) <= 65535;

const isDbIdent = bounded(/^[A-Za-z0-9_-]{1,64}$/);

/** CloudPanel's three panel roles. */
const isRole = bounded(/^(admin|site-manager|user)$/);

const isStatus = bounded(/^(0|1|active|inactive|enabled|disabled)$/i);

const isTimezone = bounded(
  /^(UTC|[A-Za-z][A-Za-z_-]{0,31}\/[A-Za-z0-9_+-]{1,48}(\/[A-Za-z0-9_+-]{1,48})?)$/,
);

/** Words separated by single spaces, each starting with a letter or digit. */
const isTemplateName: Validator = (v) =>
  typeof v === 'string' && v.length <= 64 && /^[A-Za-z0-9][A-Za-z0-9._-]*( [A-Za-z0-9][A-Za-z0-9._-]*)*$/.test(v);

/** http(s) URL only — this becomes an nginx proxy_pass target. */
const isHttpUrl: Validator = (v) => {
  // Same shape as the wrapper's URL_RE: no query strings, IPv6 brackets or quoting.
  if (typeof v !== 'string' || v.length > MAX_VALUE || !/^https?:\/\/[A-Za-z0-9._:/-]+$/.test(v)) return false;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return false;
  }
  return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
};

/*
 * File arguments. clpctl reads and writes them AS ROOT, so "any absolute path"
 * meant `db:export --file=/etc/passwd` overwrote any file on the host, and a
 * certificate or import path could make root read any file. Each is confined to
 * one fixed directory holding bare file names only. These MUST match
 * EXPORT_DIR / IMPORT_DIR in scripts/cloudpanel/rhc-clpctl, which enforces the
 * same rule root-side (plus root ownership of the directory and no symlinks).
 */
export const EXPORT_DIR = '/var/backups/rhc-clpctl';
export const IMPORT_DIR = '/var/lib/rhc-clpctl/import';
const FILE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** A bare file name may be given; it is placed in `dir`. */
const inDir = (dir: string) => (v: string) => (v.includes('/') ? v : `${dir}/${v}`);

const isFileIn =
  (dir: string): Validator =>
  (v) =>
    typeof v === 'string' && v.startsWith(`${dir}/`) && FILE_NAME_RE.test(v.slice(dir.length + 1));

const exportFile = (hint: string): Omit<FlagSpec, 'name'> => ({
  required: true,
  normalize: inDir(EXPORT_DIR),
  validate: isFileIn(EXPORT_DIR),
  hint: `${hint}, written to ${EXPORT_DIR}/`,
});

const importFile = (hint: string, required = true): Omit<FlagSpec, 'name'> => ({
  required,
  normalize: inDir(IMPORT_DIR),
  validate: isFileIn(IMPORT_DIR),
  hint: `${hint}, read from ${IMPORT_DIR}/`,
});

/* ----------------------------------------------------------------- commands */

const SITE_USER_FLAGS: FlagSpec[] = [
  { name: 'siteUser', required: true, validate: isSiteUser, hint: 'lowercase system user, e.g. "acme"' },
  { name: 'siteUserPassword', required: true, validate: isPassword, secret: true, hint: PASSWORD_HINT },
];

export const COMMANDS: Record<string, CommandSpec> = {
  'site:add:nodejs': {
    command: 'site:add:nodejs',
    summary: 'Create a Node.js site (nginx vhost + system user)',
    flags: [
      { name: 'domainName', required: true, validate: isDomain, hint: 'example.com' },
      { name: 'nodejsVersion', required: true, validate: isVersion, hint: 'e.g. 22' },
      { name: 'appPort', required: true, validate: isPort, hint: '1-65535' },
      ...SITE_USER_FLAGS,
    ],
  },
  'site:add:static': {
    command: 'site:add:static',
    summary: 'Create a static site',
    flags: [
      { name: 'domainName', required: true, validate: isDomain, hint: 'example.com' },
      ...SITE_USER_FLAGS,
    ],
  },
  'site:add:php': {
    command: 'site:add:php',
    summary: 'Create a PHP site',
    flags: [
      { name: 'domainName', required: true, validate: isDomain, hint: 'example.com' },
      { name: 'phpVersion', required: true, validate: isVersion, hint: 'e.g. 8.3' },
      { name: 'vhostTemplate', required: true, validate: isTemplateName, hint: 'e.g. "Generic"' },
      ...SITE_USER_FLAGS,
    ],
  },
  'site:add:python': {
    command: 'site:add:python',
    summary: 'Create a Python site',
    flags: [
      { name: 'domainName', required: true, validate: isDomain, hint: 'example.com' },
      { name: 'pythonVersion', required: true, validate: isVersion, hint: 'e.g. 3.12' },
      { name: 'appPort', required: true, validate: isPort, hint: '1-65535' },
      ...SITE_USER_FLAGS,
    ],
  },
  'site:add:reverse-proxy': {
    command: 'site:add:reverse-proxy',
    summary: 'Create a reverse-proxy site',
    flags: [
      { name: 'domainName', required: true, validate: isDomain, hint: 'example.com' },
      { name: 'reverseProxyUrl', required: true, validate: isHttpUrl, hint: 'http://127.0.0.1:3000' },
      ...SITE_USER_FLAGS,
    ],
  },
  'lets-encrypt:install:certificate': {
    command: 'lets-encrypt:install:certificate',
    summary: 'Issue and install a Let\u2019s Encrypt certificate',
    flags: [
      { name: 'domainName', required: true, validate: isDomain, hint: 'example.com' },
      {
        name: 'subjectAlternativeName',
        normalize: normalizeDomainList,
        validate: isDomainList,
        hint: 'comma-separated extra domains',
      },
    ],
  },
  'db:add': {
    command: 'db:add',
    summary: 'Create a database and database user for a site',
    flags: [
      { name: 'domainName', required: true, validate: isDomain, hint: 'owning site' },
      { name: 'databaseName', required: true, validate: isDbIdent, hint: 'e.g. acme_prod' },
      { name: 'databaseUserName', required: true, validate: isDbIdent, hint: 'e.g. acme' },
      {
        name: 'databaseUserPassword',
        required: true,
        validate: isPassword,
        secret: true,
        hint: PASSWORD_HINT,
      },
    ],
  },
  'db:export': {
    command: 'db:export',
    summary: 'Export a database to a dump file',
    flags: [
      { name: 'databaseName', required: true, validate: isDbIdent, hint: 'database to export' },
      { name: 'file', ...exportFile('file name, e.g. acme.sql.gz') },
    ],
  },
  'user:add': {
    command: 'user:add',
    summary: 'Create a CloudPanel panel user',
    destructive: true,
    flags: [
      { name: 'userName', required: true, validate: isUserName, hint: 'login name' },
      { name: 'email', required: true, validate: isEmail, hint: 'user@example.com' },
      { name: 'firstName', required: true, validate: isPersonName, hint: 'letters, "." or "-", no spaces' },
      { name: 'lastName', required: true, validate: isPersonName, hint: 'letters, "." or "-", no spaces' },
      { name: 'password', required: true, validate: isPassword, secret: true, hint: PASSWORD_HINT },
      { name: 'role', required: true, validate: isRole, hint: 'admin, site-manager or user' },
      {
        name: 'sites',
        normalize: normalizeDomainList,
        validate: isDomainList,
        hint: 'comma-separated domains (user role)',
      },
      { name: 'timezone', validate: isTimezone, hint: 'e.g. Europe/Berlin' },
      { name: 'status', validate: isStatus, hint: '0 or 1' },
    ],
  },
  'user:reset:password': {
    command: 'user:reset:password',
    summary: 'Reset a panel user\u2019s password',
    destructive: true,
    flags: [
      { name: 'userName', required: true, validate: isUserName, hint: 'login name' },
      { name: 'password', required: true, validate: isPassword, secret: true, hint: PASSWORD_HINT },
    ],
  },
  'user:list': { command: 'user:list', summary: 'List panel users', flags: [] },
  'cloudflare:update:ips': {
    command: 'cloudflare:update:ips',
    summary: 'Refresh Cloudflare IP ranges in nginx (restores real visitor IPs)',
    flags: [],
  },
  'vhost-templates:list': { command: 'vhost-templates:list', summary: 'List vhost templates', flags: [] },

  /* ---- destructive: gated by config.allowDestructive + typed confirmation ----
   * (user:add and user:reset:password above are gated the same way) */

  'site:delete': {
    command: 'site:delete',
    summary: 'Delete a site, its vhost, its files and its system user',
    destructive: true,
    flags: [
      { name: 'domainName', required: true, validate: isDomain, hint: 'example.com' },
      { name: 'force', boolean: true, validate: () => true, hint: 'skip clpctl\u2019s own prompt' },
    ],
  },
  'user:delete': {
    command: 'user:delete',
    summary: 'Delete a CloudPanel panel user',
    destructive: true,
    flags: [{ name: 'userName', required: true, validate: isUserName, hint: 'login name' }],
  },
  'user:disable:mfa': {
    command: 'user:disable:mfa',
    summary: 'Disable two-factor auth for a panel user',
    destructive: true,
    flags: [{ name: 'userName', required: true, validate: isUserName, hint: 'login name' }],
  },
  'db:import': {
    command: 'db:import',
    summary: 'Import a dump into a database (overwrites existing data)',
    destructive: true,
    flags: [
      { name: 'databaseName', required: true, validate: isDbIdent, hint: 'target database' },
      { name: 'file', ...importFile('dump file name') },
    ],
  },
  'site:install:certificate': {
    command: 'site:install:certificate',
    summary: 'Replace a site\u2019s TLS certificate with your own',
    destructive: true,
    flags: [
      { name: 'domainName', required: true, validate: isDomain, hint: 'example.com' },
      { name: 'privateKey', ...importFile('key file name') },
      { name: 'certificate', ...importFile('certificate file name') },
      { name: 'certificateChain', ...importFile('chain file name', false) },
    ],
  },
};

/**
 * Deliberately NOT exposed: `db:show:master-credentials` (hands the global MySQL
 * root credentials to anyone with an admin session — read it on the box instead)
 * and `cloudpanel:enable/disable:basic-auth` (can lock the operator out of
 * CloudPanel itself from a CMS screen). Both remain one `clpctl` away on the host.
 */
export const EXCLUDED_COMMANDS = [
  'db:show:master-credentials',
  'cloudpanel:enable:basic-auth',
  'cloudpanel:disable:basic-auth',
];

export interface CommandDescriptor {
  command: string;
  summary: string;
  destructive: boolean;
  flags: Array<{ name: string; required: boolean; secret: boolean; boolean: boolean; hint: string }>;
}

export function listCommands(): CommandDescriptor[] {
  return Object.values(COMMANDS).map((spec) => ({
    command: spec.command,
    summary: spec.summary,
    destructive: !!spec.destructive,
    flags: spec.flags.map((f) => ({
      name: f.name,
      required: !!f.required,
      secret: !!f.secret,
      boolean: !!f.boolean,
      hint: f.hint,
    })),
  }));
}

/* ------------------------------------------------------------------ builder */

export class ClpctlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClpctlValidationError';
  }
}

export interface BuiltCommand {
  spec: CommandSpec;
  /** argv passed to the wrapper. Secret flags appear as `--flag=-`. */
  args: string[];
  /** Same argv with secrets masked. Safe for logs, audit and the UI. */
  safeArgs: string[];
  /** Secret values, in argv order, for the wrapper's stdin. Never logged. */
  stdin: string[];
}

/**
 * Validate params against the spec and build the argv. Throws
 * ClpctlValidationError on anything unexpected — unknown command, unknown flag,
 * missing required flag, or a value the validator rejects.
 */
export function buildCommand(command: string, params: Record<string, unknown>): BuiltCommand {
  const spec = Object.prototype.hasOwnProperty.call(COMMANDS, command) ? COMMANDS[command] : undefined;
  if (!spec) throw new ClpctlValidationError(`Unknown or disallowed command: ${String(command)}`);

  const known = new Set(spec.flags.map((f) => f.name));
  for (const key of Object.keys(params || {})) {
    if (!known.has(key)) throw new ClpctlValidationError(`Unknown flag for ${spec.command}: ${key}`);
  }

  const args: string[] = [spec.command];
  const safeArgs: string[] = [spec.command];
  const stdin: string[] = [];

  for (const flag of spec.flags) {
    const raw = params ? params[flag.name] : undefined;

    if (flag.boolean) {
      if (raw === true || raw === 'true') {
        args.push(`--${flag.name}`);
        safeArgs.push(`--${flag.name}`);
      } else if (flag.required) {
        throw new ClpctlValidationError(`Missing required flag --${flag.name}`);
      }
      continue;
    }

    if (raw === undefined || raw === null || raw === '') {
      if (flag.required) throw new ClpctlValidationError(`Missing required flag --${flag.name}`);
      continue;
    }

    if (typeof raw !== 'string' && typeof raw !== 'number') {
      throw new ClpctlValidationError(`Flag --${flag.name} must be a string`);
    }
    const trimmed = String(raw).trim();
    const value = flag.normalize ? flag.normalize(trimmed) : trimmed;
    if (!SAFE_VALUE_RE.test(value)) {
      throw new ClpctlValidationError(
        `Invalid value for --${flag.name}: only letters, digits, spaces and # % + , . / : = @ _ - are allowed`,
      );
    }
    if (!flag.validate(value)) {
      throw new ClpctlValidationError(`Invalid value for --${flag.name} (expected ${flag.hint})`);
    }

    // Single argv element: the value can never be re-read as a separate flag.
    // A secret goes to stdin instead, so no argv (or sudo log line) holds it.
    if (flag.secret) {
      args.push(`--${flag.name}=-`);
      stdin.push(value);
    } else {
      args.push(`--${flag.name}=${value}`);
    }
    safeArgs.push(`--${flag.name}=${flag.secret ? '********' : value}`);
  }

  return { spec, args, safeArgs, stdin };
}

/* ------------------------------------------------------------------- runner */

export interface ExecResult {
  ok: boolean;
  /** Redacted argv — exactly what a dry run would have shown. */
  argv: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  dryRun: boolean;
  error?: string;
}

const MAX_BUFFER = 1024 * 1024; // 1 MiB of clpctl output is already pathological

function preflightMessage(config: CloudPanelConfig, err: any): string {
  const code = err?.code;
  if (code === 'ENOENT') {
    return `Wrapper not found at ${config.wrapperPath}. Install it from scripts/cloudpanel/rhc-clpctl — see docs/CLOUDPANEL.md.`;
  }
  if (code === 'EACCES') {
    return `Wrapper at ${config.wrapperPath} is not executable by the panel's system user.`;
  }
  return String(err?.message || err);
}

/**
 * Run an allowlisted clpctl command through the root wrapper.
 *
 * `dryRun` returns the exact redacted argv without spawning anything — that is
 * what the UI shows in its confirmation step.
 */
export async function runCommand(
  command: string,
  params: Record<string, unknown>,
  opts: { dryRun?: boolean } = {},
): Promise<ExecResult> {
  const config = await getCloudPanelConfig();
  const built = buildCommand(command, params);
  const started = Date.now();

  const base = { argv: built.safeArgs, dryRun: !!opts.dryRun };
  const inert = { exitCode: null, stdout: '', stderr: '', durationMs: 0 };

  if (!config.enabled) {
    return { ...base, ...inert, ok: false, error: 'The CloudPanel module is disabled.' };
  }
  if (built.spec.destructive && !config.allowDestructive) {
    return {
      ...base,
      ...inert,
      ok: false,
      error: `"${built.spec.command}" is destructive and destructive actions are disabled for this panel.`,
    };
  }
  if (opts.dryRun) {
    return { ...base, ...inert, ok: true };
  }

  try {
    await access(config.wrapperPath, constants.X_OK);
  } catch (err) {
    return { ...base, ...inert, ok: false, error: preflightMessage(config, err) };
  }

  // `sudo -n` fails immediately rather than blocking on a password prompt that
  // no one is there to answer.
  const file = config.useSudo ? 'sudo' : config.wrapperPath;
  const argv = config.useSudo ? ['-n', config.wrapperPath, ...built.args] : built.args;

  return new Promise<ExecResult>((resolve) => {
    const child = execFile(
      file,
      argv,
      {
        timeout: config.timeoutMs,
        maxBuffer: MAX_BUFFER,
        killSignal: 'SIGKILL',
        windowsHide: true,
        // Minimal environment: the child runs as root and has no business
        // inheriting NEXTAUTH_SECRET, DATABASE_URL or any other panel secret.
        // Cast because Next augments ProcessEnv to require NODE_ENV, and
        // deliberately NOT passing it is the entire point of this object.
        env: {
          PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
          LANG: 'C.UTF-8',
        } as unknown as NodeJS.ProcessEnv,
      },
      (err: Error | null, stdout: string | Buffer, stderr: string | Buffer) => {
        const durationMs = Date.now() - started;
        const out = String(stdout || '');
        const errOut = String(stderr || '');
        if (err) {
          const anyErr = err as any;
          const killed = anyErr.killed || anyErr.signal === 'SIGKILL';
          resolve({
            ...base,
            ok: false,
            exitCode: typeof anyErr.code === 'number' ? anyErr.code : null,
            stdout: out,
            stderr: errOut,
            durationMs,
            error: killed
              ? `Command timed out after ${config.timeoutMs} ms and was killed.`
              : errOut.trim() || anyErr.message || 'Command failed',
          });
          return;
        }
        resolve({ ...base, ok: true, exitCode: 0, stdout: out, stderr: errOut, durationMs });
      },
    );
    // Secrets, one per line, in the order of their `--flag=-` arguments. The
    // wrapper may exit before reading them (a refused command); the resulting
    // EPIPE must not become an unhandled error that takes the server down.
    child.stdin?.on('error', () => {});
    child.stdin?.end(built.stdin.map((v) => `${v}\n`).join(''));
  });
}
