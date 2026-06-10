// Design Pack — shared types + the format contract.
//
// A design pack is a portable, versioned bundle (theme + typography + cookie
// consent + starter pages/menu/footer + assets) produced by "Claude Design" and
// applied into a fresh site. It carries DESIGN/TEMPLATE only — never secrets,
// users, analytics IDs, or real site identity (those come from the wizard).

export const PACK_FORMAT = 1;

export type ApplyMode =
  | 'merge'
  | 'overwrite'
  | 'merge-design-keys'
  | 'upsert-by-slug'
  | 'copy-if-absent';

export interface PackContents {
  theme?: ApplyMode;
  typography?: ApplyMode;
  cookies?: ApplyMode;
  settings?: ApplyMode;
  menu?: ApplyMode;
  footer?: ApplyMode;
  pages?: ApplyMode;
  assets?: ApplyMode;
}

export interface PackManifest {
  packFormat: number;          // importer rejects > PACK_FORMAT
  name: string;
  slug: string;
  version: string;
  description?: string;
  author?: string;
  createdAt?: string;          // stamped by the exporter
  minPanelVersion?: string;
  contents?: PackContents;
  tokens?: string[];           // interpolation tokens the pack uses
}

export interface PackBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;   // objects, never bare strings (editor convention)
  order: number;
}

export interface PackPage {
  id?: string;
  title: string;
  slug: string;
  description?: string;
  category?: string;
  status?: 'draft' | 'published' | 'archived';
  showInFooter?: boolean;
  blocks: PackBlock[];
  seo?: Record<string, unknown>;
}

// Values supplied by the setup wizard, substituted into {{token}} placeholders.
export interface DesignTokens {
  siteName?: string;
  tagline?: string;
  contactEmail?: string;
  domain?: string;
  [key: string]: string | undefined;
}

export interface ApplyResult {
  ok: boolean;
  packName: string;
  applied: {
    theme: boolean;
    typography: boolean;
    cookies: boolean;
    settings: boolean;
    menu: boolean;
    footer: boolean;
    pages: { created: number; updated: number };
    assets: { copied: number; skipped: number };
  };
  backupPath: string | null;
  warnings: string[];
}

// Only these top-level settings keys may travel in a pack (design/template).
// Everything else (siteName, contact, bookingUrl, stats, analytics, …) is site
// identity and is dropped on import even if a pack tries to include it.
export const DESIGN_SETTINGS_KEYS = ['brand', 'homeContent', 'contactContent', 'cta', 'ctaSection'];

// Files that must NEVER appear in a design pack (defense-in-depth; extract() and
// applyDesignPack() both reject a pack containing any of these).
export const FORBIDDEN_PACK_FILES = [
  'secrets.json',
  'users.json',
  'seo.json',
  'cms.db',
  'cms.db-wal',
  'cms.db-shm',
  'submissions.json',
  'applications.json',
  'leads.json',
  'blocked-ips.json',
];

// Filename patterns that are always rejected anywhere in the pack.
export const FORBIDDEN_PACK_PATTERNS = [/(^|\/)\.env/i];
