import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getSecret, setSecrets } from '@adminpanel/lib/env';

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

// Settings live in the site database (secrets table), not an .env file.
function getEnvValue(key: string): string {
  // Private keys may be stored with literal \n sequences.
  return getSecret(key).replace(/\\n/g, '\n');
}

function setEnvValue(key: string, value: string): void {
  setSecrets({ [key]: value });
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
