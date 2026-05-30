import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { revalidateAllPublic } from '@adminpanel/lib/revalidate';

const DATA_DIR = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data');
const TYPOGRAPHY_FILE = path.join(DATA_DIR, 'typography.json');

interface Typography {
  headings: {
    h1: {
      fontSize: string;
      lineHeight: string;
      fontWeight: string;
      letterSpacing: string;
    };
    h2: {
      fontSize: string;
      lineHeight: string;
      fontWeight: string;
      letterSpacing: string;
    };
    h3: {
      fontSize: string;
      lineHeight: string;
      fontWeight: string;
      letterSpacing: string;
    };
    h4: {
      fontSize: string;
      lineHeight: string;
      fontWeight: string;
      letterSpacing: string;
    };
  };
  body: {
    fontSize: string;
    lineHeight: string;
    fontWeight: string;
    letterSpacing: string;
  };
  small: {
    fontSize: string;
    lineHeight: string;
    fontWeight: string;
    letterSpacing: string;
  };
  updatedAt: string;
  updatedBy?: string;
}

const defaultTypography: Typography = {
  headings: {
    h1: {
      fontSize: '48px',
      lineHeight: '3rem',
      fontWeight: '700',
      letterSpacing: '-0.01em',
    },
    h2: {
      fontSize: '36px',
      lineHeight: '2.25rem',
      fontWeight: '700',
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '24px',
      lineHeight: '1.5rem',
      fontWeight: '600',
      letterSpacing: '0em',
    },
    h4: {
      fontSize: '20px',
      lineHeight: '1.5rem',
      fontWeight: '600',
      letterSpacing: '0em',
    },
  },
  body: {
    fontSize: '16px',
    lineHeight: '1.6rem',
    fontWeight: '400',
    letterSpacing: '0em',
  },
  small: {
    fontSize: '14px',
    lineHeight: '1.25rem',
    fontWeight: '400',
    letterSpacing: '0em',
  },
  updatedAt: new Date().toISOString(),
};

async function initTypography(): Promise<Typography> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  try {
    const data = await fs.readFile(TYPOGRAPHY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    await fs.writeFile(TYPOGRAPHY_FILE, JSON.stringify(defaultTypography, null, 2));
    return defaultTypography;
  }
}

async function checkRole(token: any) {
  if (!token || !['admin', 'editor'].includes(token.role)) {
    return false;
  }
  return true;
}

export async function GET() {
  try {
    const typography = await initTypography();
    return NextResponse.json(typography);
  } catch (error) {
    console.error('[API] GET /api/cms/typography error:', error);
    return NextResponse.json({ error: 'Failed to fetch typography' }, { status: 500 });
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
    const typography: Typography = {
      ...body,
      updatedAt: new Date().toISOString(),
      updatedBy: (token as any)?.email || 'admin',
    };

    await fs.writeFile(TYPOGRAPHY_FILE, JSON.stringify(typography, null, 2));
    console.log('[API] PUT /api/cms/typography - Typography updated by', (token as any)?.email);
    revalidateAllPublic();
    return NextResponse.json(typography);
  } catch (error) {
    console.error('[API] PUT /api/cms/typography error:', error);
    return NextResponse.json({ error: 'Failed to update typography' }, { status: 500 });
  }
}
