import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSecret } from '@adminpanel/lib/env';

// Google Analytics Data (GA4 Data API).
// Returns a SUPERSET so both consumers work: the legacy keys (users/pageviews/…) used
// by /admin/analytics AND the keys the dashboard reads (totalUsers, newUsers,
// screenPageViews, bounceRate, topPages, trafficSources, deviceCategory).
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
    const property = `properties/${credentials.propertyId}`;
    const dateRanges = [{ startDate: '30daysAgo', endDate: 'today' }];
    const report = (requestBody: any) =>
      analyticsData.properties.runReport({ auth, property, requestBody: { dateRanges, ...requestBody } });

    const [overall, pages, sources, devices] = await Promise.allSettled([
      report({ metrics: [
        { name: 'totalUsers' }, { name: 'newUsers' }, { name: 'sessions' },
        { name: 'screenPageViews' }, { name: 'averageSessionDuration' }, { name: 'bounceRate' },
      ] }),
      report({ dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 10 }),
      report({ dimensions: [{ name: 'sessionSourceMedium' }], metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 10 }),
      report({ dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }] }),
    ]);
    const data = (s: PromiseSettledResult<any>) => (s.status === 'fulfilled' ? s.value.data : null);

    // If the core report failed, surface that (likely a permissions/property error).
    if (overall.status !== 'fulfilled') {
      console.error('Analytics fetch error:', (overall as PromiseRejectedResult).reason?.message);
      return null;
    }

    const o = data(overall)?.rows?.[0]?.metricValues || [];
    const num = (i: number) => parseInt(o[i]?.value || '0');
    const totalUsers = num(0), newUsers = num(1), sessions = num(2), screenPageViews = num(3);
    const avgSecs = parseFloat(o[4]?.value || '0');
    const bounceRate = Math.round(parseFloat(o[5]?.value || '0') * 100); // GA4 returns a 0-1 ratio
    const avgSessionDuration = `${Math.floor(avgSecs / 60)}:${String(Math.round(avgSecs % 60)).padStart(2, '0')}`;

    const topPages = (data(pages)?.rows || []).map((r: any) => ({
      pagePath: r.dimensionValues?.[0]?.value || '',
      screenPageViews: parseInt(r.metricValues?.[0]?.value || '0'),
    }));

    const srcRows = data(sources)?.rows || [];
    const srcTotal = srcRows.reduce((s: number, r: any) => s + parseInt(r.metricValues?.[0]?.value || '0'), 0) || 1;
    const trafficSources = srcRows.map((r: any) => {
      const activeUsers = parseInt(r.metricValues?.[0]?.value || '0');
      return { sourceMedium: r.dimensionValues?.[0]?.value || 'Direct', activeUsers, percentage: Math.round((activeUsers / srcTotal) * 100) };
    });

    const devRows = data(devices)?.rows || [];
    const devTotal = devRows.reduce((s: number, r: any) => s + parseInt(r.metricValues?.[0]?.value || '0'), 0) || 1;
    const deviceCategory = devRows.map((r: any) => {
      const u = parseInt(r.metricValues?.[0]?.value || '0');
      return { deviceCategory: (r.dimensionValues?.[0]?.value || '').toLowerCase(), percentage: Math.round((u / devTotal) * 100) };
    });

    return {
      // legacy aliases (kept for /admin/analytics)
      users: totalUsers, pageviews: screenPageViews, sessions, avgSessionDuration,
      // dashboard keys
      totalUsers, newUsers, screenPageViews, bounceRate, topPages, trafficSources, deviceCategory,
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

    // Resolve the property the service account can actually read. GSC properties are
    // either URL-prefix ("https://example.com/") or Domain ("sc-domain:example.com");
    // pick whichever this account has been granted, so it works regardless of type.
    let resolvedSite = siteUrl;
    try {
      const list = await searchConsole.sites.list({ auth });
      const entries = (list.data.siteEntry || []).map((e: any) => e.siteUrl).filter(Boolean);
      if (entries.length === 0) {
        return {
          error: `Search Console access not granted. Add the service account (${credentials.serviceAccountEmail}) as a user on this property in Search Console → Settings → Users and permissions.`,
        };
      }
      const host = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      resolvedSite =
        entries.find((s: string) => s === siteUrl) ||
        entries.find((s: string) => s === `${siteUrl}/`) ||
        entries.find((s: string) => s === `sc-domain:${host}`) ||
        entries.find((s: string) => s.includes(host)) ||
        entries[0];
    } catch {
      // sites.list failed (rare) — fall through and try the configured siteUrl directly.
    }

    const response = await searchConsole.searchanalytics.query({
      auth,
      siteUrl: resolvedSite,
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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

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
