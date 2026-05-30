// Cloudflare API service

import { getSecret } from '@/lib/env';

interface CloudflareZoneAnalytics {
  requests: number;
  bandwidth: number;
  threats: number;
  pageviews: number;
}

export async function getZoneAnalytics(): Promise<CloudflareZoneAnalytics | null> {
  const apiToken = getSecret('CLOUDFLARE_API_TOKEN');
  const zoneId = process.env.NEXT_PUBLIC_CLOUDFLARE_ZONE_ID;

  if (!apiToken || !zoneId) {
    console.error('[Cloudflare] API token or Zone ID not configured');
    return null;
  }

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/analytics_engine/sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          SELECT 
            SUM(Requests) as requests,
            SUM(Bytes) as bandwidth,
            SUM(Threats) as threats,
            SUM(PageViews) as pageviews
          FROM Events
          WHERE Timestamp > NOW() - INTERVAL '1 day'
        `
      }),
    });

    if (!response.ok) {
      console.error('[Cloudflare] Analytics fetch failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.result?.[0] || null;
  } catch (error) {
    console.error('[Cloudflare] Error fetching analytics:', error);
    return null;
  }
}

export async function getZoneInfo() {
  const apiToken = getSecret('CLOUDFLARE_API_TOKEN');
  const zoneId = process.env.NEXT_PUBLIC_CLOUDFLARE_ZONE_ID;

  if (!apiToken || !zoneId) {
    return null;
  }

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('[Cloudflare] Error fetching zone info:', error);
    return null;
  }
}

export async function getSecurityEvents() {
  const apiToken = getSecret('CLOUDFLARE_API_TOKEN');
  const zoneId = process.env.NEXT_PUBLIC_CLOUDFLARE_ZONE_ID;

  if (!apiToken || !zoneId) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/security/events?limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error('[Cloudflare] Error fetching security events:', error);
    return null;
  }
}

export async function getDNSRecords() {
  const apiToken = getSecret('CLOUDFLARE_API_TOKEN');
  const zoneId = process.env.NEXT_PUBLIC_CLOUDFLARE_ZONE_ID;

  if (!apiToken || !zoneId) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error('[Cloudflare] Error fetching DNS records:', error);
    return null;
  }
}

export async function purgeCache() {
  const apiToken = getSecret('CLOUDFLARE_API_TOKEN');
  const zoneId = process.env.NEXT_PUBLIC_CLOUDFLARE_ZONE_ID;

  if (!apiToken || !zoneId) {
    return { success: false, error: 'API credentials not configured' };
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ purge_everything: true }),
      }
    );

    const data = await response.json();
    return { success: data.success, ...data };
  } catch (error) {
    console.error('[Cloudflare] Error purging cache:', error);
    return { success: false, error: 'Purge failed' };
  }
}
