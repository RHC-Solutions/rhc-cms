import * as fs from 'fs';
import * as path from 'path';

interface BlockedIP {
  ip: string;
  failedAttempts: number;
  firstAttempt: number; // Timestamp
  lastAttempt: number;  // Timestamp
  blockedUntil: number; // Timestamp (7 days from last attempt)
}

const BLOCKED_IPS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'blocked-ips.json');
const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

function loadBlockedIPs(): BlockedIP[] {
  try {
    if (fs.existsSync(BLOCKED_IPS_FILE)) {
      const data = fs.readFileSync(BLOCKED_IPS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[IPBlocker] Error loading blocked IPs:', error);
  }
  return [];
}

function saveBlockedIPs(ips: BlockedIP[]) {
  try {
    fs.writeFileSync(BLOCKED_IPS_FILE, JSON.stringify(ips, null, 2));
  } catch (error) {
    console.error('[IPBlocker] Error saving blocked IPs:', error);
  }
}

function isIPBlocked(ip: string): boolean {
  const blockedIPs = loadBlockedIPs();
  const blocked = blockedIPs.find((b) => b.ip === ip);

  if (!blocked) return false;

  const now = Date.now();

  // Check if block has expired
  if (now > blocked.blockedUntil) {
    // Remove expired block
    const updated = blockedIPs.filter((b) => b.ip !== ip);
    saveBlockedIPs(updated);
    return false;
  }

  return true;
}

function recordFailedAttempt(ip: string): { isNowBlocked: boolean; attemptsLeft: number } {
  const blockedIPs = loadBlockedIPs();
  const now = Date.now();

  let ipRecord = blockedIPs.find((b) => b.ip === ip);

  if (!ipRecord) {
    ipRecord = {
      ip,
      failedAttempts: 1,
      firstAttempt: now,
      lastAttempt: now,
      blockedUntil: now + BLOCK_DURATION,
    };
    blockedIPs.push(ipRecord);
  } else {
    ipRecord.failedAttempts += 1;
    ipRecord.lastAttempt = now;
    ipRecord.blockedUntil = now + BLOCK_DURATION; // Reset block timer on each attempt
  }

  saveBlockedIPs(blockedIPs);

  const isNowBlocked = ipRecord.failedAttempts >= MAX_FAILED_ATTEMPTS;
  const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - ipRecord.failedAttempts);

  return { isNowBlocked, attemptsLeft };
}

function getBlockedIPInfo(ip: string): { isBlocked: boolean; attemptsLeft: number; hoursRemaining: number } | null {
  const blockedIPs = loadBlockedIPs();
  const ipRecord = blockedIPs.find((b) => b.ip === ip);

  if (!ipRecord) {
    return null;
  }

  const now = Date.now();
  const isBlocked = ipRecord.blockedUntil > now && ipRecord.failedAttempts >= MAX_FAILED_ATTEMPTS;
  const hoursRemaining = isBlocked ? Math.ceil((ipRecord.blockedUntil - now) / (60 * 60 * 1000)) : 0;

  return {
    isBlocked,
    attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - ipRecord.failedAttempts),
    hoursRemaining,
  };
}

function clearBlockedIP(ip: string) {
  const blockedIPs = loadBlockedIPs();
  const updated = blockedIPs.filter((b) => b.ip !== ip);
  saveBlockedIPs(updated);
}

function cleanupExpiredBlocks() {
  const blockedIPs = loadBlockedIPs();
  const now = Date.now();
  const active = blockedIPs.filter((b) => b.blockedUntil > now);

  if (active.length !== blockedIPs.length) {
    saveBlockedIPs(active);
  }
}

export {
  isIPBlocked,
  recordFailedAttempt,
  getBlockedIPInfo,
  clearBlockedIP,
  cleanupExpiredBlocks,
};
