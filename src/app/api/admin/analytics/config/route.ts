import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import * as fs from 'fs';
import * as path from 'path';

async function requireAdmin(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return false;
  const role = String((token as any).role || '').toLowerCase();
  return role === 'admin' || role === 'administrator';
}

interface GA4Config {
  propertyId: string;
  serviceAccountEmail: string;
  privateKey: string;
  keyId: string;
  projectId: string;
}

const ENV_FILE = path.join(process.cwd(), '.env.local');

function getEnvValue(key: string): string {
  try {
    const content = fs.readFileSync(ENV_FILE, 'utf-8');
    const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
    if (!match) return '';
    
    let value = match[1].trim();
    
    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    // Convert literal \n to actual newlines (for private keys)
    value = value.replace(/\\n/g, '\n');
    
    return value;
  } catch {
    return '';
  }
}

function setEnvValue(key: string, value: string): void {
  try {
    let content = fs.readFileSync(ENV_FILE, 'utf-8');
    
    // If key exists, replace it
    if (content.includes(`${key}=`)) {
      content = content.replace(
        new RegExp(`^${key}=.*$`, 'm'),
        `${key}=${value}`
      );
    } else {
      // If key doesn't exist, append it
      content += `\n${key}=${value}`;
    }
    
    fs.writeFileSync(ENV_FILE, content, 'utf-8');
  } catch (error) {
    console.error('Failed to write .env.local:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const config: GA4Config = {
      propertyId: getEnvValue('NEXT_PUBLIC_GA_PROPERTY_ID'),
      serviceAccountEmail: getEnvValue('NEXT_PUBLIC_GA_SERVICE_ACCOUNT_EMAIL'),
      privateKey: getEnvValue('GA_PRIVATE_KEY'),
      keyId: getEnvValue('NEXT_PUBLIC_GA_KEY_ID'),
      projectId: getEnvValue('NEXT_PUBLIC_GA_PROJECT_ID'),
    };

    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to load configuration', error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data: GA4Config = await request.json();

    // Validate required fields
    if (!data.propertyId || !data.serviceAccountEmail || !data.privateKey) {
      return NextResponse.json(
        { message: 'Property ID, Service Account Email, and Private Key are required' },
        { status: 400 }
      );
    }

    // Validate property ID is numeric
    if (!/^\d{8,10}$/.test(data.propertyId)) {
      return NextResponse.json(
        { message: 'Property ID must be a numeric value (8-10 digits)' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!data.serviceAccountEmail.includes('gserviceaccount.com')) {
      return NextResponse.json(
        { message: 'Invalid service account email format' },
        { status: 400 }
      );
    }

    // Validate private key format
    if (!data.privateKey.includes('BEGIN') || !data.privateKey.includes('END')) {
      return NextResponse.json(
        { message: 'Invalid private key format. Must include BEGIN and END markers.' },
        { status: 400 }
      );
    }

    // Save configuration
    setEnvValue('NEXT_PUBLIC_GA_PROPERTY_ID', data.propertyId);
    setEnvValue('NEXT_PUBLIC_GA_SERVICE_ACCOUNT_EMAIL', data.serviceAccountEmail);
    setEnvValue('GA_PRIVATE_KEY', data.privateKey);
    if (data.keyId) setEnvValue('NEXT_PUBLIC_GA_KEY_ID', data.keyId);
    if (data.projectId) setEnvValue('NEXT_PUBLIC_GA_PROJECT_ID', data.projectId);

    return NextResponse.json({
      success: true,
      message: '✓ Analytics configuration saved successfully',
    });
  } catch (error) {
    console.error('Failed to save GA4 config:', error);
    return NextResponse.json(
      { message: 'Failed to save configuration', error: String(error) },
      { status: 500 }
    );
  }
}
