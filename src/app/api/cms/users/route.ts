import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { validatePassword } from '@adminpanel/lib/auth/password';

export interface CMSUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor';
  status: 'active' | 'disabled';
  lastLogin?: string | null;
  passwordHash?: string;
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

const USERS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'users.json');

// Default seed emails derive from the site domain so a fresh site doesn't
// inherit example.com addresses. Override with SEED_ADMIN_EMAIL.
const SEED_DOMAIN = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://example.com')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '') || 'example.com';
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || `admin@${SEED_DOMAIN}`;

const ensureUsersFile = (): CMSUser[] => {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const defaultPassword = bcrypt.hashSync('admin123', 10);
  const defaults: CMSUser[] = [
    {
      id: '1',
      name: 'Admin User',
      email: SEED_ADMIN_EMAIL,
      role: 'admin',
      status: 'active',
      passwordHash: defaultPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      updatedBy: 'system',
      totpEnabled: false,
      recoveryCodes: [],
      mfaRequired: false,
    },
  ];

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaults, null, 2));
    return defaults;
  }

  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed: CMSUser[] = JSON.parse(data);
    if (!parsed || parsed.length === 0) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(defaults, null, 2));
      return defaults;
    }
    return parsed;
  } catch (error) {
    console.error('Failed to read users file, recreating defaults', error);
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaults, null, 2));
    return defaults;
  }
};

const sanitizeUser = (user: CMSUser) => {
  const { passwordHash, totpSecret, totpTempSecret, recoveryCodes, ...rest } = user;
  return rest;
};

const saveUsers = (users: CMSUser[]) => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

async function checkAdmin(request: NextRequest) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = token && (token as any).role ? (token as any).role : null;
  if (role !== 'admin') {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized: admin role required' }, { status: 403 }),
      email: null as string | null,
    };
  }

  const email = token && (token as any).email ? (token as any).email : 'admin';
  return { authorized: true, email };
}

export async function GET(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;

  const users = ensureUsersFile();
  return NextResponse.json(users.map(sanitizeUser));
}

export async function POST(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const { name, email, role, password, status } = body || {};

    if (!name || !email || !role || !password) {
      return NextResponse.json({ error: 'Name, email, role, and password are required' }, { status: 400 });
    }

    // Validate password against NIST guidelines
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          error: 'Password does not meet security requirements',
          details: passwordValidation.errors,
        },
        { status: 400 }
      );
    }

    const users = ensureUsersFile();
    const exists = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const newUser: CMSUser = {
      id: Date.now().toString(),
      name,
      email,
      role,
      status: status || 'active',
      passwordHash: bcrypt.hashSync(password, 10),
      lastLogin: null,
      createdAt: now,
      updatedAt: now,
      createdBy: auth.email || 'admin',
      updatedBy: auth.email || 'admin',
      totpEnabled: false,
      recoveryCodes: [],
    };

    users.push(newUser);
    saveUsers(users);

    return NextResponse.json(sanitizeUser(newUser), { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const { id, password, mfaAction, ...updates } = body || {};
    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const users = ensureUsersFile();
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const target = users[index];

    if (updates.email) {
      const emailExists = users.some(
        (u) => u.id !== id && u.email.toLowerCase() === (updates.email as string).toLowerCase()
      );
      if (emailExists) {
        return NextResponse.json({ error: 'Another user already uses this email' }, { status: 409 });
      }
    }

    const now = new Date().toISOString();
    const updated: CMSUser = {
      ...target,
      ...updates,
      updatedAt: now,
      updatedBy: auth.email || 'admin',
    };

    const isDisablingAdmin =
      target.role === 'admin' && (updated.status === 'disabled' || updated.role !== 'admin');

    if (isDisablingAdmin) {
      const otherAdmins = users.filter(
        (u) => u.id !== id && u.role === 'admin' && u.status !== 'disabled'
      );
      if (otherAdmins.length === 0) {
        return NextResponse.json({ error: 'At least one active admin must remain' }, { status: 400 });
      }
    }

    if (password) {
      // Validate password against NIST guidelines
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return NextResponse.json(
          {
            error: 'Password does not meet security requirements',
            details: passwordValidation.errors,
          },
          { status: 400 }
        );
      }
      updated.passwordHash = bcrypt.hashSync(password, 10);
    }

    // Handle MFA administrative actions (disable or reset)
    if (mfaAction === 'disable' || mfaAction === 'reset') {
      updated.totpEnabled = false;
      updated.totpSecret = undefined;
      updated.totpTempSecret = undefined;
      updated.recoveryCodes = undefined;
      updated.mfaRequired = mfaAction === 'reset'; // reset = force re-enroll on next login
    }

    users[index] = updated;
    saveUsers(users);

    return NextResponse.json(sanitizeUser(updated));
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const users = ensureUsersFile();
    const target = users.find((u) => u.id === id);
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const remainingAdmins = users.filter((u) => u.role === 'admin' && u.id !== id && u.status !== 'disabled');
    if (target.role === 'admin' && remainingAdmins.length === 0) {
      return NextResponse.json({ error: 'At least one active admin must remain' }, { status: 400 });
    }

    const filtered = users.filter((u) => u.id !== id);
    saveUsers(filtered);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
