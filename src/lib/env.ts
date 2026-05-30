/**
 * Utility for reading environment variables with caching
 * Reduces file I/O for .env.local reads
 *
 * Also exposes `getSecret`/`setSecrets`/`listSecrets` for admin-managed runtime
 * secrets (cms-data/secrets.json) which take precedence over .env values so
 * admins can update credentials without a pm2 restart.
 */

import * as fs from 'fs';
import * as path from 'path';
import { cache } from './cache';

const ENV_PATH = path.join(process.cwd(), '.env.local');
const SECRETS_PATH = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'secrets.json');
const ENV_CACHE_TTL = 60 * 1000; // 1 minute cache

// Mtime-based cache for cms-data/secrets.json. Picks up admin saves without a
// pm2 restart while still avoiding a disk read on every request.
let secretsCache: Record<string, string> | null = null;
let secretsCacheMtime = 0;

function loadSecrets(): Record<string, string> {
  try {
    const stat = fs.statSync(SECRETS_PATH);
    if (secretsCache && stat.mtimeMs === secretsCacheMtime) {
      return secretsCache;
    }
    const raw = fs.readFileSync(SECRETS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      secretsCache = parsed as Record<string, string>;
      secretsCacheMtime = stat.mtimeMs;
      return secretsCache;
    }
  } catch {
    // ENOENT or malformed JSON — fall through to empty
  }
  secretsCache = {};
  secretsCacheMtime = 0;
  return secretsCache;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get an environment variable value with caching
 * First checks process.env, then falls back to reading .env.local
 */
export function getEnvValue(key: string): string {
  // Check process.env first (always fresh)
  if (process.env[key]) {
    return process.env[key] as string;
  }

  // Try cache
  const cacheKey = `env:${key}`;
  const cached = cache.get<string>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Read from file
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    // Escape special regex characters in the key
    const escapedKey = escapeRegex(key);
    const match = content.match(new RegExp(`^${escapedKey}=(.*)$`, 'm'));
    const value = match ? match[1].trim() : '';
    
    // Cache for 1 minute
    cache.set(cacheKey, value, ENV_CACHE_TTL);
    
    return value;
  } catch {
    return '';
  }
}

/**
 * Get multiple environment variables at once
 */
export function getEnvValues(keys: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const key of keys) {
    result[key] = getEnvValue(key);
  }
  
  return result;
}

/**
 * Check if environment variable exists and has a value
 */
export function hasEnvValue(key: string): boolean {
  return getEnvValue(key) !== '';
}

/**
 * Clear environment variable cache
 * Useful when .env.local is updated
 */
export function clearEnvCache(): void {
  const stats = cache.getStats();
  stats.keys.forEach(key => {
    if (key.startsWith('env:')) {
      cache.delete(key);
    }
  });
}

/**
 * Read a runtime-managed secret. Prefers cms-data/secrets.json (admin-editable
 * without a restart), then falls back to .env.local / process.env. Returns ''
 * when neither has a value.
 */
export function getSecret(key: string): string {
  const fromStore = loadSecrets()[key];
  if (typeof fromStore === 'string' && fromStore.trim() !== '') {
    return fromStore.trim();
  }
  return getEnvValue(key);
}

/**
 * Write secrets to cms-data/secrets.json. Only entries whose value is a
 * non-empty trimmed string are written — empty/undefined entries are ignored
 * so the form-pre-fill round-trip doesn't blank out unrelated secrets.
 */
export function setSecrets(updates: Record<string, string | undefined>): void {
  const current = loadSecrets();
  const next: Record<string, string> = { ...current };
  for (const [k, v] of Object.entries(updates)) {
    if (typeof v === 'string' && v.trim() !== '') {
      next[k] = v.trim();
    }
  }
  fs.mkdirSync(path.dirname(SECRETS_PATH), { recursive: true });
  fs.writeFileSync(SECRETS_PATH, JSON.stringify(next, null, 2));
  try {
    fs.chmodSync(SECRETS_PATH, 0o660);
  } catch {
    // Permission-tightening is best-effort; non-fatal if it fails (e.g. on
    // platforms where the file already has tighter perms).
  }
  secretsCache = next;
  try {
    secretsCacheMtime = fs.statSync(SECRETS_PATH).mtimeMs;
  } catch {
    secretsCacheMtime = 0;
  }
}

/**
 * Return a shallow copy of every secret currently stored in
 * cms-data/secrets.json. Does NOT include .env fallbacks — callers that want
 * the merged view should iterate keys and use `getSecret` for each.
 */
export function listSecrets(): Record<string, string> {
  return { ...loadSecrets() };
}
