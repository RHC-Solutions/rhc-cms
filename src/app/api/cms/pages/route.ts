import { NextRequest, NextResponse } from 'next/server';
import { cmsDb } from '@/lib/cms/database';
import { getToken } from 'next-auth/jwt';
import { revalidateAllPublic, revalidatePageBySlug } from '@/lib/revalidate';

async function getWriterToken(request: NextRequest) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return null;
  const role = String((token as any).role || '').toLowerCase();
  if (!['admin', 'administrator', 'editor'].includes(role)) return null;
  return token;
}

// GET /api/cms/pages - Get all pages (public access)
// GET /api/cms/pages?slug=/about - Get page by slug
export async function GET(request: NextRequest) {
  try {
    console.log('[API] GET /api/cms/pages');
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const id = searchParams.get('id');

    if (id) {
      const page = await cmsDb.getPage(id);
      if (!page) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404 });
      }
      return NextResponse.json(page);
    }

    if (slug) {
      const page = await cmsDb.getPage(slug);
      if (!page) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404 });
      }
      return NextResponse.json(page);
    }

    // Public access to all published pages
    const pages = await cmsDb.getPages();
    return NextResponse.json(pages);
  } catch (error) {
    console.error('Error fetching pages:', error);
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
  }
}

// POST /api/cms/pages - Create new page
export async function POST(request: NextRequest) {
  const token = await getWriterToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const email = (token as any).email || 'admin';
    const newPage = await cmsDb.createPage({ ...body, createdBy: body.createdBy || email, updatedBy: email });
    revalidatePageBySlug(newPage?.slug);
    return NextResponse.json(newPage, { status: 201 });
  } catch (error) {
    console.error('Error creating page:', error);
    return NextResponse.json({ error: 'Failed to create page' }, { status: 500 });
  }
}

// PUT /api/cms/pages - Update existing page
export async function PUT(request: NextRequest) {
  const token = await getWriterToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const email = (token as any).email || 'admin';
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
    }

    const updatedPage = await cmsDb.updatePage(id, { ...updates, updatedBy: email });

    if (!updatedPage) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    revalidatePageBySlug(updatedPage.slug);
    return NextResponse.json(updatedPage);
  } catch (error) {
    console.error('Error updating page:', error);
    return NextResponse.json({ error: 'Failed to update page' }, { status: 500 });
  }
}

// DELETE /api/cms/pages?id=123 - Delete page
export async function DELETE(request: NextRequest) {
  if (!(await getWriterToken(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
    }

    const deleted = await cmsDb.deletePage(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    revalidateAllPublic();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting page:', error);
    return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 });
  }
}
