import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const USERS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'users.json');

// Check if initial setup is needed (no admin users exist)
export async function GET(request: NextRequest) {
  try {
    // Check if users.json exists and has admin users
    if (!fs.existsSync(USERS_FILE)) {
      return NextResponse.json({ 
        setupNeeded: true,
        reason: 'No users file found'
      });
    }

    const usersContent = fs.readFileSync(USERS_FILE, 'utf-8');
    const users = JSON.parse(usersContent);

    // Check if any admin users exist
    const hasAdmin = users.some((user: any) => user.role === 'admin');

    if (!hasAdmin) {
      return NextResponse.json({ 
        setupNeeded: true,
        reason: 'No admin users found'
      });
    }

    return NextResponse.json({ 
      setupNeeded: false,
      reason: 'Admin user exists'
    });
  } catch (error) {
    console.error('Error checking setup status:', error);
    return NextResponse.json({ 
      setupNeeded: true,
      reason: 'Error reading users file'
    });
  }
}
