import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export type Role = 'admin' | 'editor';
export type Status = 'active' | 'disabled';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: Status;
  passwordHash: string;
  lastLogin?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  totpEnabled?: boolean;
  totpSecret?: string;
  totpTempSecret?: string;
  recoveryCodes?: string[];
  mfaRequired?: boolean;
}

export const USERS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'users.json');

const ensureDir = () => {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Default seed emails are derived from the site domain so a fresh site doesn't
// inherit example.com addresses. Override explicitly with SEED_ADMIN_EMAIL.
// (On a normal first run the /admin/setup wizard creates the real admin and
// this seed never fires.)
const seedDomain = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://example.com')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '') || 'example.com';
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || `admin@${seedDomain}`;

const seedUsers = (): StoredUser[] => {
  const seedPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const passwordHash = bcrypt.hashSync(seedPassword, 10);
  const now = new Date().toISOString();
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn('[Users] SEED_ADMIN_PASSWORD not set — seeding with default. Change the admin password immediately after first login.');
  }
  return [
    {
      id: '1',
      name: 'Admin User',
      email: SEED_ADMIN_EMAIL,
      role: 'admin',
      status: 'active',
      passwordHash,
      lastLogin: null,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      updatedBy: 'system',
      totpEnabled: false,
      recoveryCodes: [],
    },
  ];
};

export const loadUsers = (): StoredUser[] => {
  ensureDir();

  if (!fs.existsSync(USERS_FILE)) {
    const seeded = seedUsers();
    fs.writeFileSync(USERS_FILE, JSON.stringify(seeded, null, 2));
    return seeded;
  }

  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed: StoredUser[] = JSON.parse(data);

    if (!parsed || parsed.length === 0) {
      const seeded = seedUsers();
      fs.writeFileSync(USERS_FILE, JSON.stringify(seeded, null, 2));
      return seeded;
    }

    return parsed;
  } catch (error) {
    console.error('[Users] Failed to read users file, recreating defaults', error);
    const seeded = seedUsers();
    fs.writeFileSync(USERS_FILE, JSON.stringify(seeded, null, 2));
    return seeded;
  }
};

export const saveUsers = (users: StoredUser[]) => {
  ensureDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

export const sanitizeUser = (user: StoredUser) => {
  const { passwordHash, totpSecret, totpTempSecret, ...rest } = user;
  return rest;
};

export const findUserByEmail = (email: string): StoredUser | undefined => {
  const users = loadUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
};
