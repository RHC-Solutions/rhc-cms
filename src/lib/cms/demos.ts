// Product demos: live, synthetic-data demonstrations of RHC products, managed in /admin/demos.
//
// Storage is the `demos` table of cms-data/cms.db (created on first use, like `pages`). The host
// site renders /demos and /demos/<slug> from these rows and runs the demo engine named in `engine`;
// a demo with `externalUrl` instead (e.g. one hosted elsewhere) is listed and linked, not rendered.
// Reads are uncached: the admin PUT and the public render run in different module instances.
import Database from 'better-sqlite3';
import path from 'path';

export type DemoStatus = 'draft' | 'published';

/** One figure on the landing page's live card: `key` in the engine's /landing JSON. */
export interface DemoLiveTile {
  label: string;
  key: string;
  /** number (default): thousands separators · percent: "68.6%" · bytes: "274 GB" · text: as is */
  format?: 'number' | 'percent' | 'bytes' | 'text';
  /** Denominator key for "x / y" figures, e.g. online of devices. */
  of?: string;
}
export interface DemoBullet { b: string; text: string }
/** A product screen: a live preview of one app page beside a short list of what it does. */
export interface DemoSection {
  id: string;
  kicker: string;
  title: string;
  highlight?: string;
  bullets: DemoBullet[];
  /** App path previewed in the frame, e.g. /app/vpn */
  preview: string;
  cta: string;
  flip?: boolean;
}
export interface DemoFlowNode { title: string; sub: string; hl?: boolean }
export interface DemoCard { num?: string; title: string; text: string }
export interface DemoStat { n: string; l: string }
export interface DemoTile { label: string; sub: string; path: string }
/** A narrated walkthrough of the product, shown on the public landing. */
export interface DemoVideo {
  id: string;
  title: string;
  /** One line under the title. */
  summary: string;
  /** Site path or https URL of the .mp4 */
  src: string;
  /** Still shown before playback (.jpg/.png) */
  poster: string;
  /** WebVTT captions, optional */
  captions: string;
  /** Length in seconds (shown on the card, used in VideoObject structured data) */
  duration: number;
  /** Id of the product section this video walks through: that card links to it. */
  section: string;
}

export interface DemoContent {
  hero: { eyebrow: string; headline: string; highlight: string; lead: string; primaryCta: string; secondaryCta: string; secondaryHref: string };
  live: { title: string; tiles: DemoLiveTile[]; footnote: string };
  sections: DemoSection[];
  flow: { kicker: string; title: string; highlight: string; lead: string; nodes: DemoFlowNode[]; cards: DemoCard[]; stats: DemoStat[] };
  why: { kicker: string; title: string; highlight: string; cards: DemoCard[] };
  tiles: { kicker: string; title: string; highlight: string; lead: string; items: DemoTile[] };
  videos: { kicker: string; title: string; highlight: string; lead: string; items: DemoVideo[] };
  contact: { lead: string; placeholder: string };
  /** Trademark / not-affiliated sentence shown in the footer note. */
  note: string;
}

export interface DemoSeo { title?: string; description?: string; ogImage?: string; noindex?: boolean }

export interface Demo {
  id: string;
  slug: string;
  name: string;
  /** What the product is, in a few words: "FortiGate fleet console" */
  product: string;
  tagline: string;
  /** Audience / category chip: "MSP · Network" */
  tag: string;
  /** One or two sentences for the hub card and the menu */
  blurb: string;
  status: DemoStatus;
  order: number;
  showInMenu: boolean;
  showInFooter: boolean;
  /** Engine id from the host site's registry, or null for an external demo */
  engine: string | null;
  externalUrl: string | null;
  content: DemoContent;
  seo: DemoSeo;
  createdAt: string;
  updatedAt: string;
}

/** The fields the admin may set; everything else is derived. */
export const DEMO_FIELDS = [
  'slug', 'name', 'product', 'tagline', 'tag', 'blurb', 'status', 'order', 'showInMenu', 'showInFooter',
  'engine', 'externalUrl', 'content', 'seo',
] as const satisfies readonly (keyof Demo)[];

export class DemoSlugInUse extends Error {
  constructor(slug: string) { super(`Slug already in use: ${slug}`); this.name = 'DemoSlugInUse'; }
}

const DB_PATH = process.env.CMS_DB_PATH || path.join(process.env.SHARED_ROOT || process.cwd(), 'cms-data', 'cms.db');
let db: Database.Database | null = null;
function store(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS demos (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        product TEXT DEFAULT '',
        tagline TEXT DEFAULT '',
        tag TEXT DEFAULT '',
        blurb TEXT DEFAULT '',
        status TEXT DEFAULT 'draft',
        sortOrder INTEGER DEFAULT 0,
        showInMenu INTEGER DEFAULT 1,
        showInFooter INTEGER DEFAULT 0,
        engine TEXT,
        externalUrl TEXT,
        content TEXT,
        seo TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_demos_status_order ON demos(status, sortOrder);
    `);
  }
  return db;
}

export const slugify = (s: string) =>
  String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

export function emptyContent(): DemoContent {
  return {
    hero: { eyebrow: '', headline: '', highlight: '', lead: '', primaryCta: 'Open the live demo', secondaryCta: '', secondaryHref: '' },
    live: { title: 'Live', tiles: [], footnote: '' },
    sections: [],
    flow: { kicker: 'How it works', title: '', highlight: '', lead: '', nodes: [], cards: [], stats: [] },
    why: { kicker: 'For your team', title: '', highlight: '', cards: [] },
    tiles: { kicker: 'See it for yourself', title: 'Click anything.', highlight: 'It is all live.', lead: '', items: [] },
    videos: { kicker: 'Watch the walkthrough', title: 'See it running,', highlight: 'step by step', lead: '', items: [] },
    contact: { lead: '', placeholder: '' },
    note: '',
  };
}

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : v == null ? '' : String(v).slice(0, max));
// Media paths: site-relative or https only (they end up in src attributes and structured data).
const mediaUrl = (v: unknown) => { const u = str(v, 300).trim(); return /^\/(?!\/)/.test(u) || /^https:\/\//.test(u) ? u : ''; };
const arr = <T>(v: unknown, map: (x: Record<string, unknown>) => T, max = 40): T[] =>
  Array.isArray(v) ? v.slice(0, max).filter((x) => x && typeof x === 'object').map((x) => map(x as Record<string, unknown>)) : [];

/** Fill a partial/foreign content object out to the full shape so renderers never see undefined. */
export function normalizeContent(raw: unknown): DemoContent {
  const d = emptyContent();
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const hero = c.hero || {}, live = c.live || {}, flow = c.flow || {}, why = c.why || {}, tiles = c.tiles || {}, contact = c.contact || {};
  const videos = c.videos || {};
  return {
    hero: { eyebrow: str(hero.eyebrow, 120), headline: str(hero.headline, 200), highlight: str(hero.highlight, 120), lead: str(hero.lead, 800),
      primaryCta: str(hero.primaryCta, 60) || d.hero.primaryCta, secondaryCta: str(hero.secondaryCta, 60), secondaryHref: str(hero.secondaryHref, 200) },
    live: { title: str(live.title, 60) || d.live.title, footnote: str(live.footnote, 300),
      tiles: arr(live.tiles, (t) => ({ label: str(t.label, 60), key: str(t.key, 60), format: (['number', 'percent', 'bytes', 'text'] as const).find((f) => f === t.format), of: t.of ? str(t.of, 60) : undefined }), 8) },
    sections: arr(c.sections, (s) => ({ id: slugify(str(s.id || s.title, 60)) || 'section', kicker: str(s.kicker, 80), title: str(s.title, 160), highlight: str(s.highlight, 100),
      bullets: arr(s.bullets, (b) => ({ b: str(b.b, 120), text: str(b.text, 400) }), 8), preview: str(s.preview, 120), cta: str(s.cta, 60), flip: !!s.flip }), 12),
    flow: { kicker: str(flow.kicker, 80) || d.flow.kicker, title: str(flow.title, 160), highlight: str(flow.highlight, 100), lead: str(flow.lead, 600),
      nodes: arr(flow.nodes, (n) => ({ title: str(n.title, 60), sub: str(n.sub, 80), hl: !!n.hl }), 8),
      cards: arr(flow.cards, (k) => ({ num: str(k.num, 4), title: str(k.title, 100), text: str(k.text, 400) }), 12),
      stats: arr(flow.stats, (s) => ({ n: str(s.n, 20), l: str(s.l, 100) }), 6) },
    why: { kicker: str(why.kicker, 80) || d.why.kicker, title: str(why.title, 160), highlight: str(why.highlight, 100),
      cards: arr(why.cards, (k) => ({ title: str(k.title, 100), text: str(k.text, 400) }), 12) },
    tiles: { kicker: str(tiles.kicker, 80) || d.tiles.kicker, title: str(tiles.title, 120) || d.tiles.title, highlight: str(tiles.highlight, 80), lead: str(tiles.lead, 400),
      items: arr(tiles.items, (t) => ({ label: str(t.label, 60), sub: str(t.sub, 100), path: str(t.path, 120) }), 16) },
    videos: { kicker: str(videos.kicker, 80) || d.videos.kicker, title: str(videos.title, 160) || d.videos.title, highlight: str(videos.highlight, 100), lead: str(videos.lead, 400),
      items: arr(videos.items, (v) => ({ id: slugify(str(v.id || v.title, 60)) || 'walkthrough', title: str(v.title, 120), summary: str(v.summary, 240),
        src: mediaUrl(v.src), poster: mediaUrl(v.poster), captions: mediaUrl(v.captions),
        duration: Math.max(0, Math.min(36000, Math.round(Number(v.duration) || 0))), section: slugify(str(v.section, 60)) }), 12) },
    contact: { lead: str(contact.lead, 600), placeholder: str(contact.placeholder, 200) },
    note: str(c.note, 400),
  };
}

function normalizeSeo(raw: unknown): DemoSeo {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: DemoSeo = {};
  if (s.title) out.title = str(s.title, 120);
  if (s.description) out.description = str(s.description, 320);
  if (s.ogImage) out.ogImage = str(s.ogImage, 300);
  if (s.noindex) out.noindex = true;
  return out;
}

function parseJson(text: unknown): unknown {
  if (typeof text !== 'string' || !text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

function rowToDemo(row: Record<string, any>): Demo {
  return {
    id: row.id, slug: row.slug, name: row.name, product: row.product || '', tagline: row.tagline || '', tag: row.tag || '', blurb: row.blurb || '',
    status: row.status === 'published' ? 'published' : 'draft', order: Number(row.sortOrder) || 0,
    showInMenu: row.showInMenu === 1, showInFooter: row.showInFooter === 1,
    engine: row.engine || null, externalUrl: row.externalUrl || null,
    content: normalizeContent(parseJson(row.content)), seo: normalizeSeo(parseJson(row.seo)),
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

/** Whitelist and coerce an incoming body to the editable fields. */
export function sanitizeDemo(input: Record<string, unknown>): Partial<Demo> {
  const out: Partial<Demo> = {};
  if ('slug' in input) out.slug = slugify(str(input.slug, 80));
  if ('name' in input) out.name = str(input.name, 80).trim();
  if ('product' in input) out.product = str(input.product, 120);
  if ('tagline' in input) out.tagline = str(input.tagline, 160);
  if ('tag' in input) out.tag = str(input.tag, 60);
  if ('blurb' in input) out.blurb = str(input.blurb, 400);
  if ('status' in input) out.status = input.status === 'published' ? 'published' : 'draft';
  if ('order' in input) out.order = Math.max(0, Math.min(9999, Math.floor(Number(input.order) || 0)));
  if ('showInMenu' in input) out.showInMenu = !!input.showInMenu;
  if ('showInFooter' in input) out.showInFooter = !!input.showInFooter;
  if ('engine' in input) out.engine = input.engine ? str(input.engine, 60).replace(/[^a-z0-9_-]/gi, '') : null;
  if ('externalUrl' in input) { const u = str(input.externalUrl, 300).trim(); out.externalUrl = /^https?:\/\//.test(u) ? u : null; }
  if ('content' in input) out.content = normalizeContent(input.content);
  if ('seo' in input) out.seo = normalizeSeo(input.seo);
  return out;
}

export function listDemos(opts?: { status?: DemoStatus }): Demo[] {
  try {
    const rows = opts?.status
      ? store().prepare('SELECT * FROM demos WHERE status = ? ORDER BY sortOrder, name').all(opts.status)
      : store().prepare('SELECT * FROM demos ORDER BY sortOrder, name').all();
    return (rows as Record<string, any>[]).map(rowToDemo);
  } catch (e) {
    console.error('[demos] list failed', e);
    return [];
  }
}

export function getDemo(slugOrId: string): Demo | null {
  try {
    const row = store().prepare('SELECT * FROM demos WHERE slug = ? OR id = ? LIMIT 1').get(slugOrId, slugOrId) as Record<string, any> | undefined;
    return row ? rowToDemo(row) : null;
  } catch (e) {
    console.error('[demos] get failed', e);
    return null;
  }
}

function slugTaken(slug: string, exceptId?: string): boolean {
  const row = store().prepare('SELECT id FROM demos WHERE slug = ?').get(slug) as { id: string } | undefined;
  return !!row && row.id !== exceptId;
}

export function createDemo(input: Record<string, unknown>): Demo {
  const s = sanitizeDemo(input);
  const name = s.name || 'New demo';
  const base = s.slug || slugify(name) || `demo-${Date.now()}`;
  let slug = base, n = 1;
  while (slugTaken(slug)) slug = `${base}-${++n}`;
  const now = new Date().toISOString();
  const maxOrder = (store().prepare('SELECT MAX(sortOrder) AS m FROM demos').get() as { m: number | null }).m ?? -1;
  const demo: Demo = {
    id: `demo-${Date.now()}`, slug, name, product: s.product || '', tagline: s.tagline || '', tag: s.tag || '', blurb: s.blurb || '',
    status: s.status || 'draft', order: s.order ?? maxOrder + 1, showInMenu: s.showInMenu ?? true, showInFooter: s.showInFooter ?? false,
    engine: s.engine ?? null, externalUrl: s.externalUrl ?? null, content: s.content || emptyContent(), seo: s.seo || {},
    createdAt: now, updatedAt: now,
  };
  store().prepare(`INSERT INTO demos (id, slug, name, product, tagline, tag, blurb, status, sortOrder, showInMenu, showInFooter, engine, externalUrl, content, seo, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    demo.id, demo.slug, demo.name, demo.product, demo.tagline, demo.tag, demo.blurb, demo.status, demo.order, demo.showInMenu ? 1 : 0, demo.showInFooter ? 1 : 0,
    demo.engine, demo.externalUrl, JSON.stringify(demo.content), JSON.stringify(demo.seo), now, now);
  return demo;
}

/** Merge-update; throws DemoSlugInUse on a clash; returns null when the id is unknown. */
export function updateDemo(id: string, input: Record<string, unknown>): Demo | null {
  const existing = getDemo(id);
  if (!existing) return null;
  const s = sanitizeDemo(input);
  if (s.slug !== undefined && !s.slug) delete s.slug; // empty slug keeps the old one
  if (s.slug && s.slug !== existing.slug && slugTaken(s.slug, existing.id)) throw new DemoSlugInUse(s.slug);
  if (s.name !== undefined && !s.name) delete s.name;
  const demo: Demo = { ...existing, ...s, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
  store().prepare(`UPDATE demos SET slug=?, name=?, product=?, tagline=?, tag=?, blurb=?, status=?, sortOrder=?, showInMenu=?, showInFooter=?, engine=?, externalUrl=?, content=?, seo=?, updatedAt=? WHERE id=?`).run(
    demo.slug, demo.name, demo.product, demo.tagline, demo.tag, demo.blurb, demo.status, demo.order, demo.showInMenu ? 1 : 0, demo.showInFooter ? 1 : 0,
    demo.engine, demo.externalUrl, JSON.stringify(demo.content), JSON.stringify(demo.seo), demo.updatedAt, demo.id);
  return demo;
}

export function deleteDemo(id: string): boolean {
  return store().prepare('DELETE FROM demos WHERE id = ?').run(id).changes > 0;
}

/** Persist a new order: ids in display order; unknown ids are ignored. */
export function reorderDemos(ids: string[]): void {
  const stmt = store().prepare('UPDATE demos SET sortOrder = ?, updatedAt = ? WHERE id = ?');
  const now = new Date().toISOString();
  const tx = store().transaction((list: string[]) => { list.forEach((id, i) => stmt.run(i, now, id)); });
  tx(ids.filter((x) => typeof x === 'string').slice(0, 500));
}

/** Insert-or-replace by slug, for seeding and imports. */
export function upsertDemoBySlug(input: Record<string, unknown>): Demo {
  const slug = slugify(str(input.slug, 80));
  const existing = slug ? getDemo(slug) : null;
  if (existing) return updateDemo(existing.id, input) as Demo;
  return createDemo(input);
}

/** Public URL of a demo on this site, or its external home. */
export const demoHref = (d: Pick<Demo, 'slug' | 'externalUrl'>) => d.externalUrl || `/demos/${d.slug}`;
