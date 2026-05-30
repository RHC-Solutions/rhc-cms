import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import * as crypto from 'crypto';

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

interface TestResult {
  field: string;
  status: 'success' | 'error' | 'warning';
  message: string;
}

async function testGoogleAnalyticsConnection(config: GA4Config): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Check Property ID
  if (!config.propertyId) {
    results.push({
      field: 'Property ID',
      status: 'error',
      message: 'Property ID is empty',
    });
  } else if (!/^\d{8,10}$/.test(config.propertyId)) {
    results.push({
      field: 'Property ID',
      status: 'error',
      message: `Invalid format. Must be 8-10 digits, got: ${config.propertyId}`,
    });
  } else {
    results.push({
      field: 'Property ID',
      status: 'success',
      message: `Valid GA4 property ID: ${config.propertyId}`,
    });
  }

  // Check Service Account Email
  if (!config.serviceAccountEmail) {
    results.push({
      field: 'Service Account Email',
      status: 'error',
      message: 'Service account email is empty',
    });
  } else if (!config.serviceAccountEmail.includes('gserviceaccount.com')) {
    results.push({
      field: 'Service Account Email',
      status: 'error',
      message: 'Invalid service account email format (must end with gserviceaccount.com)',
    });
  } else {
    results.push({
      field: 'Service Account Email',
      status: 'success',
      message: `Valid service account: ${config.serviceAccountEmail}`,
    });
  }

  // Check Private Key
  if (!config.privateKey) {
    results.push({
      field: 'Private Key',
      status: 'error',
      message: 'Private key is empty',
    });
  } else if (!config.privateKey.includes('BEGIN') || !config.privateKey.includes('END')) {
    results.push({
      field: 'Private Key',
      status: 'error',
      message: 'Invalid private key format',
    });
  } else {
    results.push({
      field: 'Private Key',
      status: 'success',
      message: 'Valid RSA private key format',
    });
  }

  // Check Project ID
  if (!config.projectId) {
    results.push({
      field: 'Project ID',
      status: 'warning',
      message: 'Project ID is optional but recommended',
    });
  } else {
    results.push({
      field: 'Project ID',
      status: 'success',
      message: `Valid project ID: ${config.projectId}`,
    });
  }

  // Test Google API authentication
  try {
    // Create JWT
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: config.serviceAccountEmail,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const message = `${headerEncoded}.${payloadEncoded}`;

    const key = crypto.createPrivateKey({
      key: config.privateKey,
      format: 'pem',
    });

    const signature = crypto
      .createSign('RSA-SHA256')
      .update(message)
      .sign(key, 'base64url');

    const jwt = `${message}.${signature}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.access_token) {
      results.push({
        field: 'Google API Access',
        status: 'success',
        message: 'Successfully obtained access token from Google',
      });
    } else {
      results.push({
        field: 'Google API Access',
        status: 'error',
        message: `Failed: ${tokenData.error || 'Unknown error'}`,
      });
    }
  } catch (error) {
    results.push({
      field: 'Google API Access',
      status: 'error',
      message: `Failed to authenticate: ${String(error).substring(0, 100)}`,
    });
  }

  return results;
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const config: GA4Config = await request.json();

    const results = await testGoogleAnalyticsConnection(config);
    const hasErrors = results.some(r => r.status === 'error');
    const status = hasErrors ? 'error' : 'success';

    return NextResponse.json({
      status,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        results: [{
          field: 'Configuration',
          status: 'error' as const,
          message: String(error),
        }],
      },
      { status: 500 }
    );
  }
}
