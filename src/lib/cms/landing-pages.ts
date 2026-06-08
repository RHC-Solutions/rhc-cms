import fs from 'fs';
import path from 'path';

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
  const normalized = slug.replace(/^\/+|\/+$/g, '');
  return loadLandingPages().find((p) => p.slug === normalized) || null;
};

export interface LandingPageTemplate {
  id: string;
  name: string;
  description: string;
  defaults: Omit<LandingPage, 'id' | 'slug' | 'createdAt' | 'updatedAt' | 'status'>;
}

const DEFAULT_LEAD_EMAIL = 'hello@nicolinastyles.com';

export const LP_TEMPLATES: LandingPageTemplate[] = [
  {
    id: 'it-consulting',
    name: 'IT Consulting',
    description: 'Lead-gen LP for IT consulting and advisory services.',
    defaults: {
      template: 'it-consulting',
      title: 'IT Consulting that drives results',
      headline: 'Turn IT from a cost centre into a growth engine',
      subheadline: 'Modernize your stack, cut waste, and align technology with business outcomes.',
      body: 'Our consultants help you assess, plan, and execute IT initiatives — from infrastructure modernization to digital transformation — with a clear path to measurable ROI.',
      benefits: [
        { title: 'Outcome-driven roadmaps', description: 'Every engagement ends with a clear plan tied to business KPIs, not just a slide deck.', icon: 'FaRoute' },
        { title: 'Vendor-agnostic advice', description: 'We recommend what actually fits your business, not what we resell.', icon: 'FaBalanceScale' },
        { title: 'Senior consultants only', description: 'You get hands-on experts who have shipped, not junior staff in training.', icon: 'FaUserTie' },
      ],
      mediaUrl: '/uploads/1767004639953.png',
      mediaType: 'image',
      formHeading: 'Book a free consultation',
      formSubheading: 'Tell us a bit about your needs and we will get back within one business day.',
      ctaButtonLabel: 'Request my consultation',
      successMessage: 'Thanks — we received your request and will contact you shortly.',
      campaignId: '',
      leadEmail: DEFAULT_LEAD_EMAIL,
      primaryColor: '#00FF41',
      noindex: true,
    },
  },
  {
    id: 'cloud-infrastructure',
    name: 'Cloud Infrastructure',
    description: 'LP for AWS / Azure / GCP migration and managed cloud.',
    defaults: {
      template: 'cloud-infrastructure',
      title: 'Move to the cloud — without the chaos',
      headline: 'Cloud migration done right',
      subheadline: 'AWS, Azure and GCP — designed, migrated and managed by senior engineers.',
      body: 'We plan and execute cloud migrations with zero-downtime cutovers, cost guardrails and security baked in from day one.',
      benefits: [
        { title: 'Cost-optimized from day one', description: 'Right-sizing, reserved capacity and autoscaling built in.', icon: 'FaPiggyBank' },
        { title: 'Zero-downtime cutover', description: 'Phased migrations with full rollback at each step.', icon: 'FaExchangeAlt' },
        { title: 'Security baseline included', description: 'IAM, network segmentation and logging configured to industry best practice.', icon: 'FaShieldAlt' },
      ],
      mediaUrl: '/uploads/1767004639953.png',
      mediaType: 'image',
      formHeading: 'Get a cloud assessment',
      formSubheading: 'Share your current setup — we will send you a tailored roadmap and quote.',
      ctaButtonLabel: 'Get my cloud assessment',
      successMessage: 'Got it — our cloud team will reach out within one business day.',
      campaignId: '',
      leadEmail: DEFAULT_LEAD_EMAIL,
      primaryColor: '#00F0FF',
      noindex: true,
    },
  },
  {
    id: 'cyber-security',
    name: 'Cyber Security',
    description: 'LP for cyber-security audits and managed security services.',
    defaults: {
      template: 'cyber-security',
      title: 'Protect your business from cyber threats',
      headline: 'Cyber security that actually works',
      subheadline: 'Audits, penetration testing and 24/7 managed detection from a battle-tested team.',
      body: 'We help you find and close the gaps before attackers do — and respond fast when something happens.',
      benefits: [
        { title: 'Independent security audit', description: 'Vendor-neutral assessment against ISO 27001 / NIST.', icon: 'FaSearch' },
        { title: 'Penetration testing', description: 'Real-world attack simulation by certified ethical hackers.', icon: 'FaBug' },
        { title: '24/7 monitoring', description: 'Round-the-clock detection and incident response.', icon: 'FaEye' },
      ],
      mediaUrl: '/uploads/1767004639953.png',
      mediaType: 'image',
      formHeading: 'Request a security audit',
      formSubheading: 'Get a confidential conversation with a senior security consultant.',
      ctaButtonLabel: 'Request my audit',
      successMessage: 'Thanks — a security consultant will contact you confidentially within one business day.',
      campaignId: '',
      leadEmail: DEFAULT_LEAD_EMAIL,
      primaryColor: '#00AAFF',
      noindex: true,
    },
  },
  {
    id: 'cio-as-a-service',
    name: 'CIO / CISO as a Service',
    description: 'LP for fractional CIO and CISO engagements.',
    defaults: {
      template: 'cio-as-a-service',
      title: 'Fractional CIO and CISO — on demand',
      headline: 'Senior IT leadership, without the full-time cost',
      subheadline: 'Get a seasoned CIO or CISO embedded in your business for a fraction of the cost.',
      body: 'Ideal for growing companies that need strategic IT or security leadership but are not ready to hire a full-time executive.',
      benefits: [
        { title: 'Board-level expertise', description: 'Decades of experience leading IT and security at scale.', icon: 'FaUserTie' },
        { title: 'Flexible engagement', description: 'From a few days a month to embedded leadership.', icon: 'FaCalendarAlt' },
        { title: 'Hands-on execution', description: 'We do not just advise — we deliver outcomes.', icon: 'FaCogs' },
      ],
      mediaUrl: '/uploads/1767004639953.png',
      mediaType: 'image',
      formHeading: 'Talk to a fractional CIO / CISO',
      formSubheading: 'Tell us what you need — we will match you with the right senior leader.',
      ctaButtonLabel: 'Schedule my intro call',
      successMessage: 'Thanks — we will reach out to schedule your intro call within one business day.',
      campaignId: '',
      leadEmail: DEFAULT_LEAD_EMAIL,
      primaryColor: '#00FF41',
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
