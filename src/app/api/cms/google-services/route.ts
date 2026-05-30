import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSecret } from '@/lib/env';

// Google Analytics Data
async function fetchAnalyticsData(credentials: any) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.serviceAccountEmail,
        private_key: credentials.privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });

    const analyticsData = google.analyticsdata('v1beta');
    const propertyId = `properties/${credentials.propertyId}`;

    const response = await analyticsData.properties.runReport({
      auth,
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
        ],
      },
    });

    const rows = response.data.rows || [];
    const values = rows[0]?.metricValues || [];

    return {
      users: parseInt(values[0]?.value || '0'),
      sessions: parseInt(values[1]?.value || '0'),
      pageviews: parseInt(values[2]?.value || '0'),
      avgSessionDuration: parseFloat(values[3]?.value || '0').toFixed(2),
    };
  } catch (error) {
    console.error('Analytics fetch error:', error);
    return null;
  }
}

// Google Search Console Data
async function fetchSearchConsoleData(credentials: any, siteUrl: string) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.serviceAccountEmail,
        private_key: credentials.privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const searchConsole = google.searchconsole('v1');
    
    const response = await searchConsole.searchanalytics.query({
      auth,
      siteUrl,
      requestBody: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        dimensions: ['query'],
        rowLimit: 10,
      },
    });

    const rows = response.data.rows || [];
    const totalClicks = rows.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0);
    const totalImpressions = rows.reduce((sum: number, row: any) => sum + (row.impressions || 0), 0);
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : '0';
    const avgPosition = rows.length > 0 
      ? (rows.reduce((sum: number, row: any) => sum + (row.position || 0), 0) / rows.length).toFixed(1)
      : '0';

    return {
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: avgCTR,
      position: avgPosition,
      topQueries: rows.slice(0, 10).map((row: any) => ({
        query: row.keys?.[0] || '',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: ((row.ctr || 0) * 100).toFixed(2),
        position: (row.position || 0).toFixed(1),
      })),
    };
  } catch (error) {
    console.error('Search Console fetch error:', error);
    return null;
  }
}

// PageSpeed Insights Data
async function fetchPageSpeedData(url: string, apiKey?: string) {
  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile${apiKey ? `&key=${apiKey}` : ''}`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'PageSpeed API error');
    }

    const lighthouse = data.lighthouseResult;
    const categories = lighthouse?.categories || {};

    return {
      performance: Math.round((categories.performance?.score || 0) * 100),
      accessibility: Math.round((categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
      seo: Math.round((categories.seo?.score || 0) * 100),
      metrics: {
        fcp: lighthouse?.audits?.['first-contentful-paint']?.displayValue || 'N/A',
        lcp: lighthouse?.audits?.['largest-contentful-paint']?.displayValue || 'N/A',
        cls: lighthouse?.audits?.['cumulative-layout-shift']?.displayValue || 'N/A',
        tti: lighthouse?.audits?.['interactive']?.displayValue || 'N/A',
      },
    };
  } catch (error) {
    console.error('PageSpeed fetch error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Read credentials from secrets store / environment.
    // Handle private key with literal \n characters
    let privateKey = getSecret('GA_PRIVATE_KEY');
    // Convert literal \n to actual newlines if needed
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    // Remove surrounding quotes if present
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || 
        (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
      privateKey = privateKey.slice(1, -1);
    }

    const credentials = {
      propertyId: process.env.NEXT_PUBLIC_GA_PROPERTY_ID,
      serviceAccountEmail: process.env.NEXT_PUBLIC_GA_SERVICE_ACCOUNT_EMAIL,
      privateKey,
      pageSpeedApiKey: getSecret('GOOGLE_PAGESPEED_API_KEY'),
    };

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rhcsolutions.com';

    // Fetch all Google service data in parallel
    const [analytics, searchConsole, pageSpeed] = await Promise.all([
      fetchAnalyticsData(credentials),
      fetchSearchConsoleData(credentials, siteUrl),
      fetchPageSpeedData(siteUrl, credentials.pageSpeedApiKey),
    ]);

    return NextResponse.json({
      analytics: analytics || { error: 'Analytics data unavailable' },
      searchConsole: searchConsole || { error: 'Search Console data unavailable' },
      pageSpeed: pageSpeed || { error: 'PageSpeed data unavailable' },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Google Services API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Google services data' },
      { status: 500 }
    );
  }
}
