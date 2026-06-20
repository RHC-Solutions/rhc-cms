import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30; // seconds
const DIGITS = 6;

const padStart = (value: string, length: number, pad: string) => {
  if (value.length >= length) return value;
  return pad.repeat(length - value.length) + value;
};

const base32ToBuffer = (base32: string): Buffer => {
  const clean = base32.replace(/=+$/g, '').toUpperCase();
  let bits = '';

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    bits += padStart(idx.toString(2), 5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }

  return Buffer.from(bytes);
};

const generateCounterBuffer = (counter: number) => {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  return buf;
};

const generateHotp = (secret: string, counter: number): string => {
  const key = base32ToBuffer(secret);
  const counterBuf = generateCounterBuffer(counter);
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = (code % 10 ** DIGITS).toString();
  return padStart(otp, DIGITS, '0');
};

export const generateSecret = (length = 32): string => {
  // crypto.randomInt is unbiased over [0, n); a raw `randomBytes % 32` would
  // skew the alphabet distribution (and trips js/biased-cryptographic-random).
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += BASE32_ALPHABET[crypto.randomInt(BASE32_ALPHABET.length)];
  }
  return secret;
};

export const generateTotp = (secret: string, timestamp = Date.now()): string => {
  const counter = Math.floor(timestamp / 1000 / STEP);
  return generateHotp(secret, counter);
};

export const verifyTotp = (token: string, secret: string, window = 1): boolean => {
  if (!token || !secret) return false;
  const code = token.replace(/\s+/g, '');
  const counter = Math.floor(Date.now() / 1000 / STEP);

  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const expected = generateHotp(secret, counter + errorWindow);
    if (expected === code) return true;
  }

  return false;
};

export const buildOtpauthURL = (secret: string, email: string, issuer = 'Your Site Name'): string => {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    digits: DIGITS.toString(),
    period: STEP.toString(),
    algorithm: 'SHA1',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
};

export const generateRecoveryCodes = (count = 8): string[] => {
  return Array.from({ length: count }).map(() =>
    crypto.randomBytes(5).toString('hex')
  );
};
