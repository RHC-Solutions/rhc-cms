import * as fs from 'fs';
import * as path from 'path';

const USERS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'users.json');

/**
 * Does a real admin account exist? Used by the first-run-allowed write endpoints
 * (design-pack apply, setup provision) as the ONLY auth signal for an
 * unauthenticated caller. It MUST fail CLOSED: only a genuinely-absent users file
 * (ENOENT) counts as first-run. Any read/parse error (EACCES, corrupt/partial JSON,
 * a misconfigured SHARED_ROOT, lock contention) returns `true` so the caller is
 * treated as "admin exists" and the unauthenticated path is denied — never the
 * reverse, which would let a transient FS error open a secret-writing endpoint.
 */
export function adminExists(): boolean {
  let raw: string;
  try {
    raw = fs.readFileSync(USERS_FILE, 'utf-8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return false; // genuine first run
    return true; // any other read error -> deny (fail closed)
  }
  try {
    const users = JSON.parse(raw);
    return Array.isArray(users) && users.some((u: any) => String(u?.role).toLowerCase() === 'admin');
  } catch {
    return true; // unparseable users.json -> deny (fail closed)
  }
}
