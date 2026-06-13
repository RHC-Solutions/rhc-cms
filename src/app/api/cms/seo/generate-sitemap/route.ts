import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

interface CmsPage {
  slug: string;
  status?: string;
  updatedAt?: string;
  createdAt?: string;
}

const PAGES_PATH = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'pages.json');
const PUBLIC_SITEMAP = path.join(process.cwd(), 'public', 'sitemap.xml');

async function checkAdmin(request: NextRequest) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = token && (token as any).role ? (token as any).role : null;
  return role === 'admin';
}

const loadPages = async (): Promise<CmsPage[]> => {
  try {
    const raw = await fsp.readFile(PAGES_PATH, 'utf-8');
    return JSON.parse(raw) as CmsPage[];
  } catch (error) {
    console.error('[sitemap] Failed to read pages.json', error);
    return [];
  }
};

const buildXml = (baseUrl: string, pages: CmsPage[]) => {
  const urls = pages
    .filter((p) => p.slug && (p.status ?? 'published') === 'published')
    .map((p) => {
      const lastmod = p.updatedAt || p.createdAt || new Date().toISOString().slice(0, 10);
      return `  <url>\n    <loc>${baseUrl}${p.slug}</loc>\n    <lastmod>${lastmod.slice(0, 10)}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${p.slug === '/' ? '1.0' : '0.7'}</priority>\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const pages = await loadPages();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
    const xml = buildXml(baseUrl, pages);

    fs.writeFileSync(PUBLIC_SITEMAP, xml, 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'sitemap.xml generated successfully',
      urlCount: pages.filter((p) => p.slug && (p.status ?? 'published') === 'published').length,
      baseUrl,
    });
  } catch (error) {
    console.error('Error generating sitemap.xml:', error);
    return NextResponse.json({ error: 'Failed to generate sitemap.xml' }, { status: 500 });
  }
}
