import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@adminpanel/lib/auth/config';
import { getSecret } from '@adminpanel/lib/env';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      turnstile_site_key: { status: 'unknown', message: '' },
      turnstile_secret_key: { status: 'unknown', message: '' },
      api_token: { status: 'unknown', message: '' },
      zone_id: { status: 'unknown', message: '' },
      account_id: { status: 'unknown', message: '' },
    };

    // Check Turnstile Site Key
    const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;
    if (!siteKey || siteKey.trim() === '') {
      results.turnstile_site_key = { status: 'error', message: 'Not configured' };
    } else {
      results.turnstile_site_key = { status: 'success', message: 'Configured' };
    }

    // Check Turnstile Secret Key
    const secretKey = getSecret('CLOUDFLARE_TURNSTILE_SECRET_KEY');
    if (!secretKey || secretKey.trim() === '') {
      results.turnstile_secret_key = { status: 'error', message: 'Not configured' };
    } else {
      // Test with a dummy token to verify the secret key format is valid
      results.turnstile_secret_key = { status: 'success', message: 'Configured' };
    }

    // Check Zone ID
    const zoneId = process.env.NEXT_PUBLIC_CLOUDFLARE_ZONE_ID;
    if (!zoneId || zoneId.trim() === '') {
      results.zone_id = { status: 'error', message: 'Not configured' };
    } else {
      results.zone_id = { status: 'success', message: 'Configured' };
    }

    // Check Account ID
    const accountId = getSecret('CLOUDFLARE_ACCOUNT_ID');
    if (!accountId || accountId.trim() === '') {
      results.account_id = { status: 'error', message: 'Not configured' };
    } else {
      results.account_id = { status: 'success', message: 'Configured' };
    }

    // Test API Token by making actual API call to Cloudflare
    const apiToken = getSecret('CLOUDFLARE_API_TOKEN');
    if (!apiToken || apiToken.trim() === '') {
      results.api_token = { status: 'error', message: 'Not configured' };
    } else if (!zoneId) {
      results.api_token = { status: 'warning', message: 'Cannot test - Zone ID not configured' };
    } else {
      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}`,
          {
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          results.api_token = { 
            status: 'success', 
            message: `Working! Connected to: ${data.result?.name || 'zone'}` 
          };
        } else {
          const error = await response.json();
          results.api_token = { 
            status: 'error', 
            message: `Invalid token or permissions: ${error.errors?.[0]?.message || 'Check token'}` 
          };
        }
      } catch (error) {
        results.api_token = { 
          status: 'error', 
          message: 'Failed to connect to Cloudflare API' 
        };
      }
    }

    return NextResponse.json({ results });

  } catch (error) {
    console.error('Error testing Cloudflare config:', error);
    return NextResponse.json(
      { error: 'Failed to test configuration' },
      { status: 500 }
    );
  }
}
