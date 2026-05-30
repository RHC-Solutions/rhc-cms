import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  loadLandingPages,
  saveLandingPages,
  LP_TEMPLATES,
  getTemplate,
  slugify,
  type LandingPage,
} from '@/lib/cms/landing-pages';

const checkAdmin = async (request: NextRequest) => {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = (token as any)?.role;
  if (role !== 'admin' && role !== 'editor') {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { authorized: true as const };
};

export async function GET(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;
  return NextResponse.json({
    pages: loadLandingPages(),
    templates: LP_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const templateId = String(body.templateId || '');
    const tpl = getTemplate(templateId);
    if (!tpl) {
      return NextResponse.json({ error: 'Unknown template' }, { status: 400 });
    }

    const pages = loadLandingPages();
    const rawSlug = String(body.slug || tpl.defaults.title);
    let slug = slugify(rawSlug) || `lp-${Date.now()}`;
    let n = 1;
    while (pages.some((p) => p.slug === slug)) {
      slug = `${slugify(rawSlug)}-${++n}`;
    }

    const now = new Date().toISOString();
    const newPage: LandingPage = {
      id: `lp-${Date.now()}`,
      slug,
      status: 'draft',
      ...tpl.defaults,
      ...sanitize(body.overrides || {}),
      createdAt: now,
      updatedAt: now,
    };

    pages.push(newPage);
    saveLandingPages(pages);
    return NextResponse.json(newPage, { status: 201 });
  } catch (e) {
    console.error('[landing-pages] POST failed', e);
    return NextResponse.json({ error: 'Failed to create landing page' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const pages = loadLandingPages();
    const idx = pages.findIndex((p) => p.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const incoming = sanitize(body);
    if (incoming.slug && incoming.slug !== pages[idx].slug) {
      incoming.slug = slugify(incoming.slug);
      if (pages.some((p) => p.slug === incoming.slug && p.id !== id)) {
        return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
      }
    }

    pages[idx] = {
      ...pages[idx],
      ...incoming,
      id: pages[idx].id,
      createdAt: pages[idx].createdAt,
      updatedAt: new Date().toISOString(),
    };
    saveLandingPages(pages);
    return NextResponse.json(pages[idx]);
  } catch (e) {
    console.error('[landing-pages] PUT failed', e);
    return NextResponse.json({ error: 'Failed to update landing page' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const pages = loadLandingPages();
    const next = pages.filter((p) => p.id !== id);
    if (next.length === pages.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    saveLandingPages(next);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[landing-pages] DELETE failed', e);
    return NextResponse.json({ error: 'Failed to delete landing page' }, { status: 500 });
  }
}

const ALLOWED_FIELDS: (keyof LandingPage)[] = [
  'slug', 'title', 'status', 'template', 'headline', 'subheadline', 'body',
  'benefits', 'mediaUrl', 'mediaType', 'mediaFit', 'mediaHeight', 'mediaPosition',
  'formHeading', 'formSubheading',
  'ctaButtonLabel', 'successMessage', 'campaignId', 'leadEmail', 'primaryColor', 'noindex',
];

function sanitize(input: Record<string, any>): Partial<LandingPage> {
  const out: Record<string, any> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in input) out[key] = input[key];
  }
  return out as Partial<LandingPage>;
}
