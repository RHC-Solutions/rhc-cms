// Cloudflare Turnstile verification service

import { getSecret } from '@adminpanel/lib/env';

export async function verifyTurnstileToken(token: string): Promise<{ success: boolean; error?: string }> {
  const secretKey = getSecret('CLOUDFLARE_TURNSTILE_SECRET_KEY');

  if (!secretKey) {
    console.error('[Turnstile] Secret key not configured');
    return { success: false, error: 'Turnstile not configured' };
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json();

    if (data.success) {
      return { success: true };
    } else {
      console.warn('[Turnstile] Verification failed:', data['error-codes']);
      return { success: false, error: data['error-codes']?.[0] || 'Verification failed' };
    }
  } catch (error) {
    console.error('[Turnstile] Error:', error);
    return { success: false, error: 'Verification error' };
  }
}
