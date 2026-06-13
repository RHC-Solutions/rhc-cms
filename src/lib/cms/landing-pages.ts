import fs from 'fs';
import path from 'path';
import { trimSlashes } from '@adminpanel/lib/url-path';

export interface LandingPageBenefit {
  title: string;
  description: string;
  icon?: string;
}

export type MediaFit = 'cover' | 'contain';
export type MediaPosition = 'right' | 'left' | 'top';

export interface LandingPage {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  template: string;
  headline: string;
  subheadline: string;
  body: string;
  benefits: LandingPageBenefit[];
  mediaUrl: string;
  mediaType: 'image' | 'video';
  mediaFit?: MediaFit;
  mediaHeight?: number;
  mediaPosition?: MediaPosition;
  formHeading: string;
  formSubheading: string;
  ctaButtonLabel: string;
  successMessage: string;
  campaignId: string;
  leadEmail: string;
  primaryColor?: string;
  noindex: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LandingPageLead {
  id: string;
  landingPageId: string;
  landingPageSlug: string;
  landingPageTitle: string;
  name: string;
  email: string;
  phone: string;
  message?: string;
  campaignId: string;
  utm: Record<string, string>;
  referrer?: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'new' | 'contacted' | 'converted' | 'archived';
  submittedAt: string;
}

const LP_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'landing-pages.json');
const LEADS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'leads.json');

const ensureDir = () => {
  const dir = path.dirname(LP_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

export const loadLandingPages = (): LandingPage[] => {
  ensureDir();
  if (!fs.existsSync(LP_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(LP_FILE, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export const saveLandingPages = (pages: LandingPage[]) => {
  ensureDir();
  fs.writeFileSync(LP_FILE, JSON.stringify(pages, null, 2));
};

export const loadLeads = (): LandingPageLead[] => {
  ensureDir();
  if (!fs.existsSync(LEADS_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export const saveLeads = (leads: LandingPageLead[]) => {
  ensureDir();
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
};

export const findBySlug = (slug: string): LandingPage | null => {
  const normalized = trimSlashes(slug);
  return loadLandingPages().find((p) => p.slug === normalized) || null;
};

export interface LandingPageTemplate {
  id: string;
  name: string;
  description: string;
  defaults: Omit<LandingPage, 'id' | 'slug' | 'createdAt' | 'updatedAt' | 'status'>;
}

const DEFAULT_LEAD_EMAIL = 'admin.com';

export const LP_TEMPLATES: LandingPageTemplate[] = [
  {
    id: 'consultation',
    name: 'Consultation Request',
    description: 'Generic lead form for consultations and discovery calls.',
    defaults: {
      template: 'consultation',
      title: 'Book a Consultation',
      headline: 'Talk to our team about your project',
      subheadline: 'Share your goals and we will get back with a practical plan.',
      body: 'Use this page as a starting point for campaigns, partnerships, or inbound lead capture.',
      benefits: [
        { title: 'Fast response', description: 'Typical response time is within one business day.', icon: 'FaClock' },
        { title: 'Tailored guidance', description: 'Recommendations are based on your specific goals.', icon: 'FaCompass' },
        { title: 'Clear next steps', description: 'Every inquiry gets a concrete follow-up plan.', icon: 'FaListCheck' },
      ],
      mediaUrl: '/logo.png',
      mediaType: 'image',
      formHeading: 'Request a consultation',
      formSubheading: 'Tell us what you need and how to contact you.',
      ctaButtonLabel: 'Send request',
      successMessage: 'Thanks - your request was submitted successfully.',
      campaignId: '',
      leadEmail: DEFAULT_LEAD_EMAIL,
      primaryColor: '#00FF41',
      noindex: true,
    },
  },
  {
    id: 'demo-request',
    name: 'Product Demo Request',
    description: 'Generic template for demo or walkthrough campaigns.',
    defaults: {
      template: 'demo-request',
      title: 'Request a Demo',
      headline: 'See how this solution works for your team',
      subheadline: 'Book a guided walkthrough and ask questions live.',
      body: 'Ideal for software demos, onboarding sessions, or platform introductions.',
      benefits: [
        { title: 'Live walkthrough', description: 'Get a guided tour focused on your use case.', icon: 'FaDesktop' },
        { title: 'Q&A included', description: 'Discuss integrations, security, and rollout questions.', icon: 'FaComments' },
        { title: 'Implementation plan', description: 'Receive suggested next steps after the demo.', icon: 'FaTasks' },
      ],
      mediaUrl: '/logo.png',
      mediaType: 'image',
      formHeading: 'Schedule your demo',
      formSubheading: 'Choose your preferred contact details and we will coordinate with you.',
      ctaButtonLabel: 'Book demo',
      successMessage: 'Great - we will contact you to schedule your demo.',
      campaignId: '',
      leadEmail: DEFAULT_LEAD_EMAIL,
      primaryColor: '#00F0FF',
      noindex: true,
    },
  },
];

export const getTemplate = (id: string) => LP_TEMPLATES.find((t) => t.id === id) || null;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    // Runs of separators are already collapsed to a single '-' above, so a
    // single-char strip suffices. Avoids the `-+$` anchored quantifier that
    // triggers polynomial backtracking (js/polynomial-redos).
    .replace(/^-|-$/g, '')
    .slice(0, 80);
