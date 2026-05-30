import CMSBlockRenderer from '@adminpanel/components/cms/BlockRenderer';
import { cmsDb, CMSPage } from '@adminpanel/lib/cms/database';
import { JsonLd, SITE_URL, breadcrumbLd, serviceLd, faqLd, type FaqItem } from '@adminpanel/components/JsonLd';
import { notFound } from 'next/navigation';

const normalizeSlug = (slug: string) => {
  if (!slug) return '/';
  if (slug === '/') return '/';
  return `/${slug.replace(/^\/+/, '')}`;
};

async function loadPage(slug: string): Promise<CMSPage | null> {
  const normalized = normalizeSlug(slug);
  const page = await cmsDb.getPage(normalized);

  if (!page || page.status === 'archived') {
    return null;
  }

  return page;
}

function titleCase(segment: string) {
  return segment
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildBreadcrumbs(slug: string, pageTitle: string) {
  if (slug === '/' || slug === '') return null;
  const segments = slug.replace(/^\/+/, '').split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const items: { name: string; url: string }[] = [{ name: 'Home', url: '/' }];
  let path = '';
  segments.forEach((seg, idx) => {
    path += `/${seg}`;
    const isLast = idx === segments.length - 1;
    items.push({ name: isLast ? pageTitle : titleCase(seg), url: path });
  });
  return items;
}

export async function buildPageMetadata(slug: string) {
  const page = await loadPage(slug);
  if (!page) return { title: 'Page not found' };

  const seo = (page.seo ?? {}) as Record<string, any>;
  const title = seo.metaTitle || seo.title || page.title;
  const description = seo.metaDescription || seo.description || page.description;
  // Dynamic per-page OG image, falls back to per-page override when provided.
  const dynamicOg = `${SITE_URL}/api/og?title=${encodeURIComponent(title || 'RHC Solutions')}${
    description ? `&description=${encodeURIComponent(description)}` : ''
  }`;
  const ogImage = seo.ogImage || dynamicOg;
  const canonical = page.slug === '/' ? '/' : page.slug;

  // seo.robots takes precedence (full Next.js Metadata.robots shape).
  // seo.noindex is a simple boolean shortcut for editors.
  const robots = seo.robots
    ? seo.robots
    : seo.noindex
      ? { index: false, follow: false }
      : undefined;

  // seo.keywords accepts a string ("a, b, c") or an array; pass through to Next.
  const keywords = seo.keywords ?? undefined;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    ...(robots ? { robots } : {}),
    ...(keywords ? { keywords } : {}),
    openGraph: {
      title,
      description,
      url: page.slug,
      type: 'website',
      siteName: 'RHC Solutions',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

// Aggregate every `faq` block on the page into a single FAQPage JSON-LD.
// Per Google guidance, only one FAQPage entity should appear per URL — even
// when the page renders multiple FAQ sections.
function collectFaqItems(page: CMSPage): FaqItem[] {
  const items: FaqItem[] = [];
  for (const block of page.blocks || []) {
    if (block.type !== 'faq') continue;
    const props = (block as { props?: { items?: { question?: string; answer?: string }[] } }).props;
    for (const it of props?.items || []) {
      if (it?.question && it?.answer) items.push({ question: it.question, answer: it.answer });
    }
  }
  return items;
}

export async function renderCmsPage(slug: string) {
  const page = await loadPage(slug);
  if (!page) notFound();
  const crumbs = buildBreadcrumbs(page.slug, page.title);
  const isServiceLeaf =
    page.slug.startsWith('/services/') && page.slug.split('/').filter(Boolean).length === 2;
  const seo = (page.seo ?? {}) as Record<string, any>;
  const service = isServiceLeaf
    ? serviceLd({
        name: page.title,
        description: seo.metaDescription || page.description,
        url: page.slug,
        serviceType: page.title,
      })
    : null;
  const faqs = collectFaqItems(page);
  return (
    <>
      {crumbs && <JsonLd data={breadcrumbLd(crumbs)} />}
      {service && <JsonLd data={service} />}
      {faqs.length > 0 && <JsonLd data={faqLd(faqs)} />}
      <CMSBlockRenderer page={page} />
    </>
  );
}
