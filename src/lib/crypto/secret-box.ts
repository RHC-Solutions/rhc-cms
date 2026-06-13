import crypto from 'crypto';

/**
 * Transparent AES-256-GCM encryption for at-rest secrets (cms-data/secrets.json).
 *
 * Key material is derived once (scrypt) from SECRETS_ENCRYPTION_KEY, falling back
 * to NEXTAUTH_SECRET. Encrypted values are stored as `enc:v1:<base64(iv|tag|ct)>`.
 *
 * Degradation is deliberate so a host can't brick itself:
 *  - No key material yet (pre-provision first run) → encrypt() returns plaintext;
 *    the next write (after NEXTAUTH_SECRET exists) re-encrypts everything.
 *  - Plaintext value (legacy secrets.json, no prefix) → decrypt() passes it through.
 *  - Wrong/rotated key or corrupted ciphertext → decrypt() returns '' and warns
 *    (treated as "unset" so a bad key never leaks ciphertext as a credential).
 *
 * Prefer setting a dedicated SECRETS_ENCRYPTION_KEY so rotating NEXTAUTH_SECRET
 * (which invalidates sessions) does not also make stored secrets unreadable.
 */

const PREFIX = 'enc:v1:';
const KDF_SALT = 'adminpanel-secrets-v1'; // fixed; entropy comes from the master key
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;
let cachedKeySource = '';

function masterSecret(): string {
  return (process.env.SECRETS_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || '').trim();
}

function deriveKey(): Buffer | null {
  const secret = masterSecret();
  if (!secret) return null;
  if (cachedKey && cachedKeySource === secret) return cachedKey;
  cachedKey = crypto.scryptSync(secret, KDF_SALT, 32);
  cachedKeySource = secret;
  return cachedKey;
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/** Encrypt a plaintext secret. Returns the input unchanged when no key is set
 *  or when it's already encrypted. Empty strings pass through untouched. */
export function encryptSecret(plain: string): string {
  if (typeof plain !== 'string' || plain === '') return plain;
  if (isEncrypted(plain)) return plain;
  const key = deriveKey();
  if (!key) return plain; // degraded: no key material — store plaintext
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

/** Decrypt a stored secret. Plaintext (no prefix) passes through unchanged. */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return typeof stored === 'string' ? stored : '';
  const key = deriveKey();
  if (!key) {
    console.warn('[secret-box] encrypted secret present but no key material available');
    return '';
  }
  try {
    const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    console.warn('[secret-box] failed to decrypt a secret (key rotated or value corrupted)');
    return '';
  }
}

/** Whether encryption is actually active (key material present). For diagnostics. */
export function encryptionEnabled(): boolean {
  return deriveKey() !== null;
}
