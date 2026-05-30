import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import fs from 'fs';
import path from 'path';
import { setSecrets, getSecret } from '@/lib/env';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY,
      CLOUDFLARE_TURNSTILE_SECRET_KEY,
      CLOUDFLARE_API_TOKEN,
      NEXT_PUBLIC_CLOUDFLARE_ZONE_ID,
      CLOUDFLARE_ACCOUNT_ID,
    } = body;

    // Path to .env.local
    const envPath = path.join(process.cwd(), '.env.local');
    
    // Read existing .env.local if it exists
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // Update or add Cloudflare variables
    const updateOrAddEnvVar = (content: string, key: string, value: string): string => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
      } else {
        return content + (content.endsWith('\n') ? '' : '\n') + `${key}=${value}\n`;
      }
    };

    // Validate credentials before saving
    const validationResults: any = {};

    // Validate API Token by calling Cloudflare API
    if (CLOUDFLARE_API_TOKEN && CLOUDFLARE_API_TOKEN.trim() !== '') {
      try {
        const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN.trim()}`,
            'Content-Type': 'application/json',
          },
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          validationResults.api_token = { valid: true, message: 'Token verified successfully' };
        } else {
          validationResults.api_token = { valid: false, message: 'Invalid API token' };
        }
      } catch (error) {
        validationResults.api_token = { valid: false, message: 'Failed to verify token' };
      }
    }

    // Validate Zone ID with API Token
    if (CLOUDFLARE_API_TOKEN && NEXT_PUBLIC_CLOUDFLARE_ZONE_ID && NEXT_PUBLIC_CLOUDFLARE_ZONE_ID.trim() !== '') {
      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${NEXT_PUBLIC_CLOUDFLARE_ZONE_ID.trim()}`,
          {
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN.trim()}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          validationResults.zone_id = { valid: true, message: `Zone: ${data.result?.name || 'verified'}` };
        } else {
          validationResults.zone_id = { valid: false, message: 'Invalid Zone ID' };
        }
      } catch (error) {
        validationResults.zone_id = { valid: false, message: 'Failed to verify Zone ID' };
      }
    }

    // Runtime server secrets go to cms-data/secrets.json — picked up
    // immediately by getSecret() without a pm2 restart.
    setSecrets({
      CLOUDFLARE_API_TOKEN,
      CLOUDFLARE_TURNSTILE_SECRET_KEY,
      CLOUDFLARE_ACCOUNT_ID,
    });

    // NEXT_PUBLIC_* values are inlined into the client bundle at build time,
    // so they still belong in .env.local and a rebuild is required to ship a
    // change. Only touch .env.local if a NEXT_PUBLIC_* field was actually
    // submitted.
    const publicSubmitted =
      (NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY !== undefined &&
        NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY.trim() !== '') ||
      (NEXT_PUBLIC_CLOUDFLARE_ZONE_ID !== undefined &&
        NEXT_PUBLIC_CLOUDFLARE_ZONE_ID.trim() !== '');

    if (publicSubmitted) {
      if (NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY !== undefined && NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY.trim() !== '') {
        envContent = updateOrAddEnvVar(envContent, 'NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY', NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY.trim());
      }
      if (NEXT_PUBLIC_CLOUDFLARE_ZONE_ID !== undefined && NEXT_PUBLIC_CLOUDFLARE_ZONE_ID.trim() !== '') {
        envContent = updateOrAddEnvVar(envContent, 'NEXT_PUBLIC_CLOUDFLARE_ZONE_ID', NEXT_PUBLIC_CLOUDFLARE_ZONE_ID.trim());
      }
      fs.writeFileSync(envPath, envContent);
    }

    let message = 'Configuration saved successfully!';
    if (validationResults.api_token?.valid) {
      message += ' ✅ API Token verified.';
    } else if (validationResults.api_token?.valid === false) {
      message += ' ⚠️ API Token validation failed - please check it.';
    }
    if (validationResults.zone_id?.valid) {
      message += ` ✅ ${validationResults.zone_id.message}`;
    }
    if (publicSubmitted) {
      message += ' Public values (NEXT_PUBLIC_*) changed — rebuild required: npm run build && pm2 restart rhcsolutions.';
    } else {
      message += ' Server secrets are live immediately — no restart needed.';
    }

    return NextResponse.json({ 
      success: true, 
      message,
      validationResults,
    });

  } catch (error) {
    console.error('Error saving Cloudflare config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return current configuration (actual values for editing). Server secrets
    // come from cms-data/secrets.json (admin store) with .env fallback; the
    // NEXT_PUBLIC_* ones are build-time inlined and live only in process.env.
    const config = {
      NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY || '',
      CLOUDFLARE_TURNSTILE_SECRET_KEY: getSecret('CLOUDFLARE_TURNSTILE_SECRET_KEY'),
      CLOUDFLARE_API_TOKEN: getSecret('CLOUDFLARE_API_TOKEN'),
      NEXT_PUBLIC_CLOUDFLARE_ZONE_ID: process.env.NEXT_PUBLIC_CLOUDFLARE_ZONE_ID || '',
      CLOUDFLARE_ACCOUNT_ID: getSecret('CLOUDFLARE_ACCOUNT_ID'),
    };

    return NextResponse.json(config);

  } catch (error) {
    console.error('Error fetching Cloudflare config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
}
