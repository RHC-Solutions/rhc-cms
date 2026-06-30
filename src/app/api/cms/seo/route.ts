import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import fs from 'fs';
import path from 'path';
import { revalidateAllPublic } from '@adminpanel/lib/revalidate';

interface SEOSettings {
  title: string;
  metaDescription: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  // Google Services
  googleTagManagerId: string;
  googleAnalytics4Id: string;
  googleSearchConsoleVerification: string;
  bingWebmasterVerification?: string;
  // Ahrefs Integration
  ahrefsId: string;
  ahrefsApiKey: string;
  ahrefsDomain: string;
  ahrefsDataKey?: string;
  updatedAt: string;
  updatedBy?: string;
}

const SEO_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'seo.json');

const defaultSettings: SEOSettings = {
  title: 'RHC Solutions - Professional IT Consulting Since 1994',
  metaDescription: 'Expert IT consulting and professional services. Cloud infrastructure, cyber security, business continuity, and virtual office support since 1994.',
  keywords: 'IT consulting, cyber security, cloud infrastructure, professional services',
  ogTitle: 'RHC Solutions | Professional IT Consulting',
  ogDescription: 'We Just Do IT - Professional IT consulting services since 1994.',
  ogImage: '/logo.png',
  googleTagManagerId: process.env.NEXT_PUBLIC_GTM_ID || '',
  googleAnalytics4Id: process.env.NEXT_PUBLIC_GA4_ID || '',
  googleSearchConsoleVerification: '',
  bingWebmasterVerification: '',
  ahrefsId: '',
  ahrefsApiKey: '',
  ahrefsDomain: '',
  ahrefsDataKey: '',
  updatedAt: new Date().toISOString(),
};

const ensureDir = (filepath: string) => {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const loadSEO = (): SEOSettings => {
  ensureDir(SEO_FILE);
  if (!fs.existsSync(SEO_FILE)) {
    return defaultSettings;
  }
  try {
    const data = fs.readFileSync(SEO_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load SEO settings', e);
    return defaultSettings;
  }
};

const saveSEO = (settings: SEOSettings) => {
  ensureDir(SEO_FILE);
  fs.writeFileSync(SEO_FILE, JSON.stringify(settings, null, 2));
};

const checkAuth = async (request: NextRequest): Promise<NextRequest | NextResponse> => {
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return request;
};

// Fields that must never be returned to unauthenticated callers.
// The endpoint is in middleware.ts `publicApiEndpoints` (GET-only) so the
// public site can read GA/GTM IDs etc. without auth, but secrets and PII
// in seo.json must be scrubbed for non-admin callers.
const SENSITIVE_SEO_FIELDS = ['ahrefsId', 'ahrefsApiKey', 'ipinfoToken', 'updatedBy'] as const;

const scrubForPublic = (settings: SEOSettings): Partial<SEOSettings> => {
  const out: Record<string, any> = { ...settings };
  for (const k of SENSITIVE_SEO_FIELDS) delete out[k];
  return out as Partial<SEOSettings>;
};

// GET /api/cms/seo - Get SEO settings (scrubbed for unauthenticated callers)
export async function GET(request: NextRequest) {
  try {
    const settings = loadSEO();
    const token = await getToken({ req: request });
    const role = (token as any)?.role;
    const isPrivileged = role === 'admin' || role === 'editor';
    const body = isPrivileged ? settings : scrubForPublic(settings);
    // Override the global /api/* public cache (next.config.mjs) — the response
    // varies by auth, and the privileged variant must never be served from a
    // shared cache to an anonymous caller.
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('[API] Error fetching SEO settings:', error);
    return NextResponse.json({ error: 'Failed to fetch SEO settings' }, { status: 500 });
  }
}

// PUT /api/cms/seo - Update SEO settings
export async function PUT(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const token = await getToken({ req: request });

    const updated: SEOSettings = {
      ...body,
      updatedAt: new Date().toISOString(),
      updatedBy: (token as any)?.email || 'admin',
    };

    // Save SEO settings
    saveSEO(updated);

    revalidateAllPublic();
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[API] Error updating SEO settings:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to update SEO settings' },
      { status: 500 }
    );
  }
}
