import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { generateSecret, buildOtpauthURL } from '@adminpanel/lib/auth/totp';

const USERS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'users.json');
const CMS_DATA_DIR = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data');

// Complete initial setup by creating admin user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Ensure cms-data directory exists
    if (!fs.existsSync(CMS_DATA_DIR)) {
      fs.mkdirSync(CMS_DATA_DIR, { recursive: true });
    }

    // Check if setup is still needed
    let users = [];
    if (fs.existsSync(USERS_FILE)) {
      const usersContent = fs.readFileSync(USERS_FILE, 'utf-8');
      users = JSON.parse(usersContent);
      
      // Check if admin already exists
      const hasAdmin = users.some((user: any) => user.role === 'admin');
      if (hasAdmin) {
        return NextResponse.json(
          { error: 'Admin user already exists. Setup not needed.' },
          { status: 400 }
        );
      }
    }

    // Generate 2FA secret
    const totpSecret = generateSecret();
    const otpauthURL = buildOtpauthURL(totpSecret, email.toLowerCase().trim());

    // Create admin user. Shape MUST match lib/auth/users.ts (seed) and what
    // lib/auth/config.ts reads at login: bcrypt `passwordHash` (not a SHA-256
    // `password` field) and `totpEnabled` (not `mfaEnabled`). MFA is left
    // disabled here on purpose — this wizard shows a QR but never verifies a
    // code, so enabling it now would lock out anyone who mis-scans. The
    // middleware forces the verified /admin/mfa-setup flow (which generates
    // recovery codes) on first login instead.
    const now = new Date().toISOString();
    const adminUser = {
      id: crypto.randomUUID(),
      email: email.toLowerCase().trim(),
      name: name.trim(),
      passwordHash: bcrypt.hashSync(password, 10),
      role: 'admin',
      status: 'active',
      totpEnabled: false,
      recoveryCodes: [],
      lastLogin: null,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      updatedBy: 'system',
    };

    // Add to users array
    users.push(adminUser);

    // Save users file
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

    // Return success with QR code for 2FA setup
    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      mfa: {
        secret: totpSecret,
        otpauthURL: otpauthURL,
        email: adminUser.email,
      },
    });
  } catch (error) {
    console.error('Error completing setup:', error);
    return NextResponse.json(
      { error: 'Failed to complete setup' },
      { status: 500 }
    );
  }
}
