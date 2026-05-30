import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { cmsDb } from '@adminpanel/lib/cms/database';
import fs from 'fs';
import path from 'path';
import { revalidateAllPublic } from '@adminpanel/lib/revalidate';

async function requireWriter(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return false;
  const role = String((token as any).role || '').toLowerCase();
  return ['admin', 'administrator', 'editor'].includes(role);
}

// GET /api/cms/settings - Get site settings
export async function GET() {
  try {
    // Ensure settings file exists by reading settings (which initializes if needed)
    const settings = await cmsDb.getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT /api/cms/settings - Update site settings
export async function PUT(request: NextRequest) {
  if (!(await requireWriter(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const updatedSettings = await cmsDb.updateSettings(body);
    revalidateAllPublic();
    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
