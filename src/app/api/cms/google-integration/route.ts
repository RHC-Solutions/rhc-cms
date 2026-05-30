import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import fs from 'fs';
import path from 'path';
import { revalidateAllPublic } from '@adminpanel/lib/revalidate';

interface GoogleIntegrationStatus {
  gtmId: string;
  ga4Id: string;
  searchConsoleVerified: boolean;
  verificationMeta: string;
  lastVerificationCheck: string;
  sitemapSubmitted: boolean;
  sitemapLastSubmitted: string;
  robotsTxtSubmitted: boolean;
  robotsTxtLastSubmitted: string;
  autoSubmitEnabled: boolean;
}

const STATUS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'google-integration.json');

const defaultStatus: GoogleIntegrationStatus = {
  gtmId: '',
  ga4Id: '',
  searchConsoleVerified: false,
  verificationMeta: '',
  lastVerificationCheck: '',
  sitemapSubmitted: false,
  sitemapLastSubmitted: '',
  robotsTxtSubmitted: false,
  robotsTxtLastSubmitted: '',
  autoSubmitEnabled: false,
};

const ensureDir = (filepath: string) => {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const loadStatus = (): GoogleIntegrationStatus => {
  ensureDir(STATUS_FILE);
  if (!fs.existsSync(STATUS_FILE)) {
    return defaultStatus;
  }
  try {
    const data = fs.readFileSync(STATUS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load Google integration status', e);
    return defaultStatus;
  }
};

const saveStatus = (status: GoogleIntegrationStatus) => {
  ensureDir(STATUS_FILE);
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
};

const checkAuth = async (request: NextRequest) => {
  const token = await getToken({ req: request });
  if (!token) {
    return null;
  }
  return token;
};

// GET /api/cms/google-integration - Get integration status
export async function GET() {
  try {
    const status = loadStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('[API] Error fetching Google integration status:', error);
    return NextResponse.json({ error: 'Failed to fetch integration status' }, { status: 500 });
  }
}

// POST /api/cms/google-integration/verify - Verify Search Console connection
export async function POST(request: NextRequest) {
  const token = await checkAuth(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    const status = loadStatus();

    if (action === 'verify-search-console') {
      // In a real implementation, this would check with Google Search Console API
      // For now, we'll mark as verified if meta tag is set
      status.searchConsoleVerified = !!status.verificationMeta;
      status.lastVerificationCheck = new Date().toISOString();
    } else if (action === 'submit-sitemap') {
      // In a real implementation, this would submit to Google Search Console API
      // For now, we'll just mark as submitted
      status.sitemapSubmitted = true;
      status.sitemapLastSubmitted = new Date().toISOString();
    } else if (action === 'submit-robots') {
      // In a real implementation, this would submit to Google Search Console API
      status.robotsTxtSubmitted = true;
      status.robotsTxtLastSubmitted = new Date().toISOString();
    } else if (action === 'toggle-auto-submit') {
      status.autoSubmitEnabled = body.enabled;
    }

    saveStatus(status);
    revalidateAllPublic();
    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('[API] Error updating Google integration:', error);
    return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 });
  }
}

// PUT /api/cms/google-integration - Update integration settings
export async function PUT(request: NextRequest) {
  const token = await checkAuth(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const status = loadStatus();

    // Update integration settings
    if (body.gtmId !== undefined) status.gtmId = body.gtmId;
    if (body.ga4Id !== undefined) status.ga4Id = body.ga4Id;
    if (body.verificationMeta !== undefined) status.verificationMeta = body.verificationMeta;
    if (body.autoSubmitEnabled !== undefined) status.autoSubmitEnabled = body.autoSubmitEnabled;

    saveStatus(status);
    revalidateAllPublic();
    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('[API] Error updating Google integration:', error);
    return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 });
  }
}
