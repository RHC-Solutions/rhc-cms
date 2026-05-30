import { NextRequest, NextResponse } from 'next/server';
import { getSecret } from '@adminpanel/lib/env';

interface AnalyticsReport {
  users: number;
  sessions: number;
  pageviews: number;
  avgSessionDuration: string;
  bounceRate: string;
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  topPages: Array<{
    pagePath: string;
    pageviews: number;
    users: number;
    avgSessionDuration: string;
  }>;
  topCountries: Array<{
    country: string;
    users: number;
  }>;
}

async function getGA4AccessToken(): Promise<string> {
  const serviceAccountEmail = getSecret('NEXT_PUBLIC_GA_SERVICE_ACCOUNT_EMAIL');
  let privateKey = getSecret('GA_PRIVATE_KEY');
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
  if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
      (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
    privateKey = privateKey.slice(1, -1);
  }

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Missing GA4 credentials');
  }

  // Create JWT
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const headerEncoded = btoa(JSON.stringify(header));
  const payloadEncoded = btoa(JSON.stringify(payload));

  // For production, use crypto module for signing
  try {
    const crypto = require('crypto');
    const key = crypto.createPrivateKey({
      key: privateKey,
      format: 'pem',
    });

    const message = `${headerEncoded}.${payloadEncoded}`;
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(message)
      .sign(key, 'base64');

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

    if (!tokenData.access_token) {
      throw new Error(tokenData.error || 'Failed to get access token');
    }

    return tokenData.access_token;
  } catch (error) {
    throw new Error(`Failed to authenticate with Google: ${String(error)}`);
  }
}

async function fetchGA4Report(accessToken: string, propertyId: string): Promise<AnalyticsReport> {
  // Get last 30 days of data
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const dateRange = {
    startDate: thirtyDaysAgo.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const baseUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

  // Parallelize both API calls for better performance
  const [mainResponse, pagesResponse] = await Promise.all([
    fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dateRanges: [dateRange],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
        ],
        dimensions: [
          { name: 'deviceCategory' },
        ],
      }),
    }),
    fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dateRanges: [dateRange],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'averageSessionDuration' },
        ],
        dimensions: [
          { name: 'pagePath' },
        ],
        orderBys: [
          {
            metric: { metricName: 'screenPageViews' },
            desc: true,
          },
        ],
        limit: 10,
      }),
    }),
  ]);

  if (!mainResponse.ok) {
    throw new Error(`GA4 API error: ${mainResponse.statusText}`);
  }

  // Parse both responses in parallel
  const [data, pagesData] = await Promise.all([
    mainResponse.json(),
    pagesResponse.json(),
  ]);

  // Parse main metrics
  let users = 0;
  let sessions = 0;
  let pageviews = 0;
  let avgSessionDuration = 0;
  let bounceRate = 0;
  const deviceBreakdown = { desktop: 0, mobile: 0, tablet: 0 };

  if (data.rows && Array.isArray(data.rows)) {
    data.rows.forEach((row: any) => {
      const metrics = row.metricValues || [];
      const dimensions = row.dimensionValues || [];

      if (metrics[0]) users += parseInt(metrics[0].value || 0, 10);
      if (metrics[1]) sessions += parseInt(metrics[1].value || 0, 10);
      if (metrics[2]) pageviews += parseInt(metrics[2].value || 0, 10);
      if (metrics[3]) avgSessionDuration = parseFloat(metrics[3].value || 0);
      if (metrics[4]) bounceRate = parseFloat(metrics[4].value || 0);

      // Track device breakdown
      if (dimensions[0]) {
        const device = dimensions[0].value?.toLowerCase() || 'unknown';
        if (device === 'desktop') deviceBreakdown.desktop += parseInt(metrics[0].value || 0, 10);
        else if (device === 'mobile') deviceBreakdown.mobile += parseInt(metrics[0].value || 0, 10);
        else if (device === 'tablet') deviceBreakdown.tablet += parseInt(metrics[0].value || 0, 10);
      }
    });
  }

  // Parse top pages
  const topPages: AnalyticsReport['topPages'] = [];

  if (pagesData.rows && Array.isArray(pagesData.rows)) {
    pagesData.rows.forEach((row: any) => {
      const dimensions = row.dimensionValues || [];
      const metrics = row.metricValues || [];

      topPages.push({
        pagePath: dimensions[0]?.value || 'Unknown',
        pageviews: parseInt(metrics[0]?.value || 0, 10),
        users: parseInt(metrics[1]?.value || 0, 10),
        avgSessionDuration: parseFloat(metrics[2]?.value || 0).toFixed(1),
      });
    });
  }

  return {
    users,
    sessions,
    pageviews,
    avgSessionDuration: parseFloat(avgSessionDuration.toString()).toFixed(1),
    bounceRate: parseFloat(bounceRate.toString()).toFixed(1),
    deviceBreakdown,
    topPages,
    topCountries: [],
  };
}

export async function GET() {
  try {
    const propertyId = getSecret('NEXT_PUBLIC_GA_PROPERTY_ID');

    if (!propertyId) {
      return NextResponse.json(
        { message: 'GA4 Property ID not configured' },
        { status: 400 }
      );
    }

    const accessToken = await getGA4AccessToken();
    const report = await fetchGA4Report(accessToken, propertyId);

    return NextResponse.json(report);
  } catch (error) {
    console.error('GA4 API error:', error);
    return NextResponse.json(
      { message: String(error) },
      { status: 500 }
    );
  }
}
