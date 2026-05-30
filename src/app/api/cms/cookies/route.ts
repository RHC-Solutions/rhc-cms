import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import fs from 'fs';
import path from 'path';
import { revalidateAllPublic } from '@adminpanel/lib/revalidate';

interface CookieCategory {
  id: string;
  name: string;
  description: string;
  required: boolean;
  enabled: boolean;
}

interface CookieSettings {
  bannerMessage: string;
  bannerPosition: 'bottom' | 'top' | 'center';
  bannerStyle: 'bar' | 'box' | 'full';
  showBanner: boolean;
  categories: CookieCategory[];
  gdprCompliant: boolean;
  respectDNT: boolean;
  autoDeleteCookies: boolean;
  logConsent: boolean;
  updatedAt: string;
  updatedBy?: string;
}

const COOKIES_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'cookies.json');

const ensureDir = () => {
  const dir = path.dirname(COOKIES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const defaultSettings: CookieSettings = {
  bannerMessage: 'We use cookies to enhance your experience and analyze traffic.',
  bannerPosition: 'bottom',
  bannerStyle: 'bar',
  showBanner: true,
  categories: [
    { id: 'necessary', name: 'Necessary', description: 'Essential for site functionality', required: true, enabled: true },
    { id: 'analytics', name: 'Analytics', description: 'Help us understand usage patterns', required: false, enabled: false },
    { id: 'marketing', name: 'Marketing', description: 'Used for targeted advertising', required: false, enabled: false },
    { id: 'preferences', name: 'Preferences', description: 'Remember your preferences', required: false, enabled: false },
  ],
  gdprCompliant: true,
  respectDNT: true,
  autoDeleteCookies: true,
  logConsent: true,
  updatedAt: new Date().toISOString(),
};

const loadCookies = (): CookieSettings => {
  ensureDir();
  if (!fs.existsSync(COOKIES_FILE)) {
    return defaultSettings;
  }
  try {
    const data = fs.readFileSync(COOKIES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load cookies', e);
    return defaultSettings;
  }
};

const saveCookies = (settings: CookieSettings) => {
  ensureDir();
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(settings, null, 2));
};

const checkAuth = async (request: NextRequest): Promise<NextRequest | NextResponse> => {
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return request;
};

// GET /api/cms/cookies - Get cookie settings (public)
export async function GET() {
  try {
    const settings = loadCookies();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[API] Error fetching cookie settings:', error);
    return NextResponse.json({ error: 'Failed to fetch cookie settings' }, { status: 500 });
  }
}

// PUT /api/cms/cookies - Update cookie settings (admin only)
export async function PUT(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const cookieSettings = await request.json();
    const token = await getToken({ req: request });

    const updated: CookieSettings = {
      ...cookieSettings,
      updatedAt: new Date().toISOString(),
      updatedBy: (token as any)?.email || 'admin',
    };

    saveCookies(updated);

    revalidateAllPublic();
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[API] Error updating cookie settings:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to update cookie settings' },
      { status: 500 }
    );
  }
}

