import { ADMIN_NAV, type AdminNavEntry } from './admin-nav';

export interface AdminSearchEntry {
  id: string;
  title: string;
  description: string;
  href: string;
  keywords: string[];
}

// The index is DERIVED from the single nav source (admin-nav.ts) so it can never
// drift from the sidebar again. Settings-field entries are appended on top of this
// by registerSearchEntries() (PR9) so search also covers individual settings.
function flattenNav(items: AdminNavEntry[], parent?: AdminNavEntry): AdminSearchEntry[] {
  const out: AdminSearchEntry[] = [];
  for (const it of items) {
    const childHrefs = new Set((it.children || []).map((c) => c.href));
    // Skip a container parent whose href just points at one of its children
    // (e.g. "Store" → /admin/store/products) — the child entry already covers it.
    if (!it.children || !childHrefs.has(it.href)) {
      out.push({
        id: it.href.replace(/^\/admin\/?/, '').replace(/\//g, '-') || 'dashboard',
        title: parent ? `${parent.name} — ${it.name}` : it.name,
        description: it.description || '',
        href: it.href,
        keywords: it.keywords || [],
      });
    }
    if (it.children) out.push(...flattenNav(it.children, it));
  }
  return out;
}

const NAV_ENTRIES = flattenNav(ADMIN_NAV);

// Extra entries registered by feature code (e.g. the consolidated settings schema
// in PR9). Kept separate so the nav-derived base stays clean.
const EXTRA_ENTRIES: AdminSearchEntry[] = [];
export function registerSearchEntries(entries: AdminSearchEntry[]) {
  for (const e of entries) {
    if (!EXTRA_ENTRIES.some((x) => x.id === e.id)) EXTRA_ENTRIES.push(e);
  }
}

export const ADMIN_SEARCH_INDEX: AdminSearchEntry[] = NAV_ENTRIES;

// Fuzzy search function
export function searchAdmin(query: string) {
  if (!query.trim()) return [];
  const INDEX = [...ADMIN_SEARCH_INDEX, ...EXTRA_ENTRIES];

  const lowerQuery = query.toLowerCase();

  return INDEX
    .map((item) => {
      let score = 0;
      
      // Title match (highest priority)
      if (item.title.toLowerCase() === lowerQuery) score += 100;
      if (item.title.toLowerCase().startsWith(lowerQuery)) score += 50;
      if (item.title.toLowerCase().includes(lowerQuery)) score += 30;
      
      // Description match
      if (item.description.toLowerCase().includes(lowerQuery)) score += 20;
      
      // Keywords match
      for (const keyword of item.keywords) {
        if (keyword === lowerQuery) score += 40;
        if (keyword.startsWith(lowerQuery)) score += 20;
        if (keyword.includes(lowerQuery)) score += 10;
      }
      
      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
