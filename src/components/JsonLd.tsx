type JsonLdObject = Record<string, unknown>;

export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const json = JSON.stringify(data);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

export type SiteSettingsLike = {
  siteName?: string;
  tagline?: string;
  brand?: {
    tagline?: string;
    foundingYear?: number | string;
    valueProp?: string;
  };
  contact?: {
    email?: string;
    phone?: string;
    socials?: {
      linkedin?: string;
      twitter?: string;
      facebook?: string;
      instagram?: string;
      github?: string;
    };
  };
};

export function organizationLd(settings?: SiteSettingsLike | null): JsonLdObject {
  const c = settings?.contact;
  const brand = settings?.brand;
  const sameAs = c?.socials
    ? Object.values(c.socials).filter((v): v is string => typeof v === 'string' && v.length > 0)
    : [];

  const data: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings?.siteName || 'Your Site Name',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description:
      brand?.valueProp ||
      'Describe your organization and services here.',
    foundingDate: String(brand?.foundingYear || ''),
    slogan: brand?.tagline || settings?.tagline || '',
  };

  if (sameAs.length) data.sameAs = sameAs;

  if (c?.email || c?.phone) {
    data.contactPoint = {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      ...(c?.email ? { email: c.email } : {}),
      ...(c?.phone ? { telephone: c.phone } : {}),
      areaServed: 'Worldwide',
      availableLanguage: ['en'],
    };
  }

  return data;
}

export function websiteLd(settings?: SiteSettingsLike | null): JsonLdObject {
  const description =
    settings?.brand?.valueProp ||
    settings?.tagline ||
    'Describe your website and offerings here.';
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: settings?.siteName || 'Your Site Name',
    url: SITE_URL,
    description,
    inLanguage: 'en',
    publisher: { '@type': 'Organization', name: settings?.siteName || 'Your Site Name' },
  };
}

export type ServiceLdInput = {
  name: string;
  description?: string;
  url?: string;
  serviceType?: string;
  areaServed?: string | string[];
  providerName?: string;
};

export function serviceLd(input: ServiceLdInput): JsonLdObject {
  const url = input.url
    ? input.url.startsWith('http')
      ? input.url
      : `${SITE_URL}${input.url}`
    : undefined;
  const data: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: input.name,
    serviceType: input.serviceType || input.name,
    provider: {
      '@type': 'Organization',
      name: input.providerName || 'Your Site Name',
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
    },
    areaServed: input.areaServed || 'Worldwide',
  };
  if (input.description) data.description = input.description;
  if (url) data.url = url;
  return data;
}

export type FaqItem = { question: string; answer: string };

export function faqLd(items: FaqItem[]): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: { '@type': 'Answer', text: it.answer },
    })),
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: it.name,
      item: it.url.startsWith('http') ? it.url : `${SITE_URL}${it.url}`,
    })),
  };
}

export type JobPostingLike = {
  id?: string;
  title: string;
  description?: string;
  location?: string;
  type?: string;
  postedAt?: string;
  validThrough?: string;
  remote?: boolean;
  department?: string;
};

export function jobPostingLd(job: JobPostingLike, organizationName: string): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description || job.title,
    datePosted: job.postedAt || new Date().toISOString(),
    validThrough:
      job.validThrough ||
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    employmentType: (job.type || 'FULL_TIME').toUpperCase().replace(/[\s-]/g, '_'),
    hiringOrganization: {
      '@type': 'Organization',
      name: organizationName,
      sameAs: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
    },
    jobLocation: job.remote
      ? {
          '@type': 'Place',
          address: { '@type': 'PostalAddress', addressCountry: 'Worldwide' },
        }
      : {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: job.location || 'Remote',
          },
        },
    ...(job.remote ? { applicantLocationRequirements: { '@type': 'Country', name: 'Worldwide' }, jobLocationType: 'TELECOMMUTE' } : {}),
    ...(job.department ? { occupationalCategory: job.department } : {}),
  };
}
