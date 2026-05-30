import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { revalidateAllPublic } from '@adminpanel/lib/revalidate';

const DATA_DIR = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data');
const THEME_FILE = path.join(DATA_DIR, 'theme.json');

interface ThemeColors {
  primary: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  background: string;
}

interface ThemeFonts {
  primary: string;
  secondary: string;
  mono: string;
}

interface ThemeSizes {
  h1: string;
  h2: string;
  h3: string;
  body: string;
  button: string;
}

interface ThemeBranding {
  favicon?: string;
  logo?: string;
  logoAlt?: string;
}

interface Theme {
  name?: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  sizes?: ThemeSizes;
  borderRadius: string;
  shadowIntensity: 'light' | 'medium' | 'heavy';
  darkMode?: boolean;
  animations?: boolean;
  branding?: ThemeBranding;
  googleFontsApiKey?: string;
  updatedAt: string;
  updatedBy?: string;
}

const defaultTheme: Theme = {
  name: 'Terminal Green',
  colors: {
    primary: '#00FF41',
    primaryDark: '#0A0E27',
    secondary: '#00F0FF',
    accent: '#00AAFF',
    success: '#00FF88',
    error: '#FF4458',
    warning: '#FFB800',
    info: '#00F0FF',
    background: '#0B1220',
  },
  branding: {
    favicon: '/logo.png',
    logo: '/logo.png',
    logoAlt: 'RHC Solutions Logo',
  },
  fonts: {
    primary: 'Inter, system-ui, sans-serif',
    secondary: 'Space Grotesk, system-ui, sans-serif',
    mono: 'JetBrains Mono, Courier New, monospace',
  },
  sizes: {
    h1: '2.5rem',
    h2: '2rem',
    h3: '1.5rem',
    body: '1rem',
    button: '0.95rem',
  },
  borderRadius: '0.5rem',
  shadowIntensity: 'medium',
  darkMode: true,
  animations: true,
  googleFontsApiKey: '',
  updatedAt: new Date().toISOString(),
};

async function initTheme(): Promise<Theme> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  try {
    const data = await fs.readFile(THEME_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    await fs.writeFile(THEME_FILE, JSON.stringify(defaultTheme, null, 2));
    return defaultTheme;
  }
}

async function checkRole(token: any) {
  const role = token?.role;
  if (!role) return false;
  const normalized = String(role).toLowerCase();
  const allowed = ['administrator', 'admin', 'editor'];
  if (!allowed.includes(normalized)) {
    return false;
  }
  return true;
}

export async function GET() {
  try {
    const theme = await initTheme();
    return NextResponse.json(theme);
  } catch (error) {
    console.error('[API] GET /api/cms/theme error:', error);
    return NextResponse.json({ error: 'Failed to fetch theme' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });
    if (!(await checkRole(token))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const existing = await initTheme();
    const theme: Theme = {
      ...defaultTheme,
      ...existing,
      ...body,
      colors: { ...defaultTheme.colors, ...existing.colors, ...(body.colors || {}) },
      fonts: { ...defaultTheme.fonts, ...existing.fonts, ...(body.fonts || {}) },
      sizes: { ...defaultTheme.sizes, ...existing.sizes, ...(body.sizes || {}) },
      branding: { ...defaultTheme.branding, ...existing.branding, ...(body.branding || {}) },
      googleFontsApiKey: body.googleFontsApiKey ?? existing.googleFontsApiKey ?? defaultTheme.googleFontsApiKey,
      updatedAt: new Date().toISOString(),
      updatedBy: (token as any)?.email || 'admin',
    };

    await fs.writeFile(THEME_FILE, JSON.stringify(theme, null, 2));
    console.log('[API] PUT /api/cms/theme - Theme updated by', (token as any)?.email);
    revalidateAllPublic();
    return NextResponse.json(theme);
  } catch (error) {
    console.error('[API] PUT /api/cms/theme error:', error);
    return NextResponse.json({ error: 'Failed to update theme' }, { status: 500 });
  }
}
