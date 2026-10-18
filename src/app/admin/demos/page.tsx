'use client';
// Product demos: list, create, reorder, publish and edit the landing-page content of each demo.
// Data: /api/cms/demos (this panel). Engines: GET /api/demos on the host site.
import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { useToast } from '@adminpanel/components/admin/Toast';
import type {
  Demo, DemoBullet, DemoCard, DemoContent, DemoFlowNode, DemoLiveTile, DemoSection, DemoSeo, DemoStat, DemoTile,
} from '@adminpanel/lib/cms/demos';
import {
  FaPlus, FaEdit, FaTrash, FaExternalLinkAlt, FaEye, FaTimes, FaCheck, FaArrowUp, FaArrowDown, FaSpinner, FaDesktop,
} from 'react-icons/fa';

// The demo application (/demos/<slug>/app) only opens for signed-in admins and editors; visitors see the landing.
const appHref = (slug: string) => `/demos/${slug}/app`;

interface EngineInfo { id: string; name: string; tagline?: string }

const EXTERNAL = '__external__';

// Mirrors slugify() in lib/cms/demos.ts, which cannot be imported here (it loads better-sqlite3).
const slugify = (s: string) =>
  String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

/** Keystroke-friendly slug cleanup: keeps a trailing "-" while typing; slugify() runs on blur. */
const slugTyping = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function DemosAdmin() {
  const { addToast } = useToast();
  const [demos, setDemos] = useState<Demo[]>([]);
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Demo | null>(null);

  const fetchDemos = useCallback(async () => {
    const res = await fetch('/api/cms/demos', { credentials: 'include' });
    if (!res.ok) {
      addToast('error', 'Failed to load demos');
      return;
    }
    const data = await res.json();
    setDemos(Array.isArray(data.demos) ? data.demos : []);
  }, [addToast]);

  const fetchEngines = useCallback(async () => {
    try {
      const res = await fetch('/api/demos', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setEngines(Array.isArray(data.engines) ? data.engines : []);
    } catch {
      // The picker falls back to "External URL" only.
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchDemos(), fetchEngines()]);
      setLoading(false);
    })();
  }, [fetchDemos, fetchEngines]);

  const handleCreate = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch('/api/cms/demos', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, status: 'draft' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addToast('error', data.error || 'Failed to create demo');
        return;
      }
      const demo = (await res.json()) as Demo;
      addToast('success', `Draft "${demo.name}" created`);
      setCreating(false);
      await fetchDemos();
      setEditing(demo);
    } finally {
      setBusy(false);
    }
  };

  /** PUT the whole demo; returns the saved row or null (errors are toasted). */
  const putDemo = async (body: Partial<Demo> & { id: string }): Promise<Demo | null> => {
    const res = await fetch('/api/cms/demos', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 409) {
      addToast('error', 'Slug already in use');
      return null;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      addToast('error', data.error || 'Failed to save');
      return null;
    }
    return (await res.json()) as Demo;
  };

  const handleSave = async (demo: Demo): Promise<boolean> => {
    setBusy(true);
    try {
      const saved = await putDemo(demo);
      if (!saved) return false;
      setDemos((list) => list.map((d) => (d.id === saved.id ? saved : d)));
      addToast('success', 'Saved');
      setEditing(null);
      return true;
    } finally {
      setBusy(false);
    }
  };

  const handleToggleStatus = async (demo: Demo) => {
    const status = demo.status === 'published' ? 'draft' : 'published';
    const saved = await putDemo({ id: demo.id, status });
    if (!saved) return;
    setDemos((list) => list.map((d) => (d.id === saved.id ? saved : d)));
    addToast('success', status === 'published' ? `"${saved.name}" published` : `"${saved.name}" set to draft`);
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= demos.length) return;
    const next = [...demos];
    [next[index], next[target]] = [next[target], next[index]];
    setDemos(next);
    const res = await fetch('/api/cms/demos', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reorder: next.map((d) => d.id) }),
    });
    if (!res.ok) {
      addToast('error', 'Failed to reorder');
      await fetchDemos();
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data.demos)) setDemos(data.demos);
  };

  const handleDelete = async (demo: Demo) => {
    if (!confirm(`Delete the demo "${demo.name}"? This removes its landing page content.`)) return;
    const res = await fetch(`/api/cms/demos?id=${encodeURIComponent(demo.id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      addToast('error', 'Failed to delete');
      return;
    }
    addToast('success', 'Deleted');
    setDemos((list) => list.filter((d) => d.id !== demo.id));
  };

  const engineName = (id: string | null) => (id ? engines.find((e) => e.id === id)?.name || id : null);

  return (
    <AdminShell title="Demos">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="heading-xl">Product demos</h1>
          <p className="text-text-secondary text-sm mt-1">
            Live demos listed at /demos. Published demos appear in the header menu and footer when flagged.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary" disabled={busy}>
          <FaPlus aria-hidden="true" /> New demo
        </button>
      </div>

      {loading ? (
        <div className="text-text-secondary"><FaSpinner className="inline animate-spin mr-2" aria-hidden="true" />Loading…</div>
      ) : demos.length === 0 ? (
        <div className="bg-dark-card border border-dashed border-dark-border rounded-xl p-12 text-center text-text-secondary">
          No demos yet. Create one to get started.
        </div>
      ) : (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-dark border-b border-dark-border text-text-muted">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Product</th>
                  <th className="text-left px-4 py-3 font-medium">Slug</th>
                  <th className="text-left px-4 py-3 font-medium">Engine</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Shown in</th>
                  <th className="text-left px-4 py-3 font-medium">Updated</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {demos.map((d, i) => (
                  <tr key={d.id} className="border-b border-dark-border last:border-0 hover:bg-dark/50">
                    <td className="px-4 py-3 text-text-primary">
                      <div className="font-medium">{d.name}</div>
                      {d.tag && <div className="text-xs text-text-muted">{d.tag}</div>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{d.product || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <a
                        href={`/demos/${d.slug}`}
                        target="_blank"
                        rel="noopener"
                        className="text-text-secondary hover:text-cyber-green"
                        title="Open the public page in a new tab"
                      >
                        /demos/{d.slug}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {d.engine ? engineName(d.engine) : (
                        <span className="inline-flex items-center gap-1.5">
                          external <FaExternalLinkAlt className="text-[10px]" aria-hidden="true" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleStatus(d)}
                        title={d.status === 'published' ? 'Set to draft' : 'Publish'}
                        aria-label={`${d.status === 'published' ? 'Set to draft' : 'Publish'} ${d.name}`}
                        className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                          d.status === 'published' ? 'bg-cyber-green/20 text-cyber-green' : 'bg-yellow-500/20 text-yellow-300'
                        }`}
                      >
                        {d.status}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {[d.showInMenu && 'Menu', d.showInFooter && 'Footer'].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">{fmtDate(d.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => handleMove(i, -1)}
                          disabled={i === 0}
                          title="Move up"
                          aria-label={`Move ${d.name} up`}
                          className="p-2 text-text-secondary hover:text-cyber-green disabled:opacity-30 disabled:hover:text-text-secondary"
                        >
                          <FaArrowUp aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleMove(i, 1)}
                          disabled={i === demos.length - 1}
                          title="Move down"
                          aria-label={`Move ${d.name} down`}
                          className="p-2 text-text-secondary hover:text-cyber-green disabled:opacity-30 disabled:hover:text-text-secondary"
                        >
                          <FaArrowDown aria-hidden="true" />
                        </button>
                        {d.engine && (
                          <a
                            href={appHref(d.slug)}
                            target="_blank"
                            rel="noopener"
                            title="Open the demo app (admins only)"
                            aria-label={`Open the ${d.name} app`}
                            className="p-2 text-text-secondary hover:text-cyber-green"
                          >
                            <FaDesktop aria-hidden="true" />
                          </a>
                        )}
                        <a
                          href={d.status === 'published' ? `/demos/${d.slug}` : `/demos/${d.slug}?preview=1`}
                          target="_blank"
                          rel="noopener"
                          title={d.status === 'published' ? 'View' : 'Preview draft'}
                          aria-label={`${d.status === 'published' ? 'View' : 'Preview'} ${d.name}`}
                          className="p-2 text-text-secondary hover:text-cyber-green"
                        >
                          <FaEye aria-hidden="true" />
                        </a>
                        <button
                          onClick={() => setEditing(d)}
                          title="Edit"
                          aria-label={`Edit ${d.name}`}
                          className="p-2 text-text-secondary hover:text-cyber-green"
                        >
                          <FaEdit aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleDelete(d)}
                          title="Delete"
                          aria-label={`Delete ${d.name}`}
                          className="p-2 text-text-secondary hover:text-red-400"
                        >
                          <FaTrash aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && (
        <NewDemoModal engines={engines} busy={busy} onCancel={() => setCreating(false)} onCreate={handleCreate} />
      )}

      {editing && (
        <EditModal
          key={editing.id}
          demo={editing}
          engines={engines}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </AdminShell>
  );
}

/* ---------------------------------------------------------------- New demo */

function NewDemoModal({
  engines, busy, onCancel, onCreate,
}: {
  engines: EngineInfo[];
  busy: boolean;
  onCancel: () => void;
  onCreate: (body: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  // null until the user picks: the first engine once loaded, otherwise External URL.
  const [picked, setPicked] = useState<string | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [product, setProduct] = useState('');
  const [tag, setTag] = useState('');
  const [blurb, setBlurb] = useState('');

  const source = picked ?? engines[0]?.id ?? EXTERNAL;
  const isExternal = source === EXTERNAL;
  const canCreate = name.trim().length > 0 && (!isExternal || /^https?:\/\//.test(externalUrl.trim()));

  const submit = () => {
    onCreate({
      name: name.trim(),
      slug: slug || slugify(name),
      product,
      tag,
      blurb,
      engine: isExternal ? null : source,
      externalUrl: isExternal ? externalUrl.trim() : null,
    });
  };

  return (
    <ModalFrame title="New demo" onClose={onCancel} width="max-w-2xl">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name">
            <input
              type="text"
              value={name}
              autoFocus
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              placeholder="FortiGate fleet console"
              className="input"
            />
          </Field>
          <Field label="URL slug">
            <SlugInput value={slug} onChange={(v) => { setSlugTouched(true); setSlug(v); }} />
          </Field>
          <Field label="Runs on">
            <select value={source} onChange={(e) => setPicked(e.target.value)} className="input">
              {engines.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
              <option value={EXTERNAL}>External URL</option>
            </select>
            {!isExternal && (
              <p className="text-xs text-text-muted mt-1">{engines.find((e) => e.id === source)?.tagline}</p>
            )}
          </Field>
          {isExternal && (
            <Field label="External URL" hint="Listed and linked; not rendered on this site.">
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://"
                className="input"
              />
            </Field>
          )}
          <Field label="Product">
            <input type="text" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="What it is, in a few words" className="input" />
          </Field>
          <Field label="Tag">
            <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="MSP · Network" className="input" />
          </Field>
        </div>
        <Field label="Blurb" hint="One or two sentences for the hub card and the menu.">
          <textarea rows={3} value={blurb} onChange={(e) => setBlurb(e.target.value)} className="input resize-y" />
        </Field>
      </div>
      <ModalFooter>
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
        <button onClick={submit} disabled={!canCreate || busy} className="btn-primary">
          <FaPlus aria-hidden="true" /> Create draft
        </button>
      </ModalFooter>
    </ModalFrame>
  );
}

/* ------------------------------------------------------------------- Edit */

type EditTab = 'basics' | 'hero' | 'sections' | 'flow' | 'contact';
const TABS: { id: EditTab; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'hero', label: 'Hero & live card' },
  { id: 'sections', label: 'Sections' },
  { id: 'flow', label: 'How it works' },
  { id: 'contact', label: 'Contact & SEO' },
];

type ContentObjectKey = Exclude<keyof DemoContent, 'note' | 'sections'>;

function EditModal({
  demo, engines, busy, onCancel, onSave,
}: {
  demo: Demo;
  engines: EngineInfo[];
  busy: boolean;
  onCancel: () => void;
  onSave: (demo: Demo) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Demo>(() => clone(demo));
  const [tab, setTab] = useState<EditTab>('basics');

  const set = <K extends keyof Demo>(k: K, v: Demo[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setSeo = (p: Partial<DemoSeo>) => setDraft((d) => ({ ...d, seo: { ...d.seo, ...p } }));
  const setContent = (p: Partial<DemoContent>) => setDraft((d) => ({ ...d, content: { ...d.content, ...p } }));
  const patch = <K extends ContentObjectKey>(key: K, p: Partial<DemoContent[K]>) =>
    setDraft((d) => ({ ...d, content: { ...d.content, [key]: { ...d.content[key], ...p } } as DemoContent }));

  const c = draft.content;
  const engineKnown = !draft.engine || engines.some((e) => e.id === draft.engine);
  const source = draft.engine ?? EXTERNAL;
  const publicHref = `/demos/${draft.slug}`;

  const sectionOptions = useMemo(() => c.sections.map((s) => s.id).filter(Boolean), [c.sections]);

  return (
    <ModalFrame
      title={`Edit demo: ${demo.name}`}
      onClose={onCancel}
      width="max-w-5xl"
      subtitle={
        <span className="inline-flex items-center gap-3 text-xs">
          <a href={publicHref} target="_blank" rel="noopener" className="text-cyber-green hover:underline inline-flex items-center gap-1">
            <FaExternalLinkAlt aria-hidden="true" /> View
          </a>
          {draft.status !== 'published' && (
            <a href={`${publicHref}?preview=1`} target="_blank" rel="noopener" className="text-cyber-green hover:underline inline-flex items-center gap-1">
              <FaEye aria-hidden="true" /> Preview draft
            </a>
          )}
          {draft.engine && (
            <a href={appHref(draft.slug)} target="_blank" rel="noopener" className="text-cyber-green hover:underline inline-flex items-center gap-1">
              <FaDesktop aria-hidden="true" /> Open app
            </a>
          )}
          <span className="font-mono text-text-muted">{publicHref}</span>
        </span>
      }
    >
      <div className="flex gap-1 px-4 border-b border-dark-border overflow-x-auto shrink-0" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-cyber-green text-cyber-green' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-6 overflow-y-auto">
        {tab === 'basics' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name">
                <input type="text" value={draft.name} onChange={(e) => set('name', e.target.value)} className="input" />
              </Field>
              <Field label="URL slug">
                <SlugInput value={draft.slug} onChange={(v) => set('slug', v)} />
              </Field>
              <Field label="Product" hint="What the product is, in a few words.">
                <input type="text" value={draft.product} onChange={(e) => set('product', e.target.value)} className="input" />
              </Field>
              <Field label="Tagline">
                <input type="text" value={draft.tagline} onChange={(e) => set('tagline', e.target.value)} className="input" />
              </Field>
              <Field label="Tag" hint="Audience / category chip.">
                <input type="text" value={draft.tag} onChange={(e) => set('tag', e.target.value)} placeholder="MSP · Network" className="input" />
              </Field>
              <Field label="Status">
                <select value={draft.status} onChange={(e) => set('status', e.target.value === 'published' ? 'published' : 'draft')} className="input">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </Field>
            </div>
            <Field label="Blurb" hint="One or two sentences for the hub card and the menu.">
              <textarea rows={3} value={draft.blurb} onChange={(e) => set('blurb', e.target.value)} className="input resize-y" />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Order">
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={draft.order}
                  onChange={(e) => set('order', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  className="input"
                />
              </Field>
              <Field label="Visibility">
                <div className="flex flex-col gap-1 pt-1">
                  <Check label="Show in header menu" checked={draft.showInMenu} onChange={(v) => set('showInMenu', v)} />
                  <Check label="Show in footer" checked={draft.showInFooter} onChange={(v) => set('showInFooter', v)} />
                </div>
              </Field>
            </div>
            <div className="border-t border-dark-border pt-4">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Runs on</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Engine">
                  <select
                    value={source}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraft((d) => ({ ...d, engine: v === EXTERNAL ? null : v, externalUrl: v === EXTERNAL ? d.externalUrl : null }));
                    }}
                    className="input"
                  >
                    {engines.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                    {!engineKnown && draft.engine && <option value={draft.engine}>{draft.engine} (not found on this site)</option>}
                    <option value={EXTERNAL}>External URL</option>
                  </select>
                </Field>
                {source === EXTERNAL && (
                  <Field label="External URL" hint="Listed and linked; not rendered on this site.">
                    <input
                      type="url"
                      value={draft.externalUrl || ''}
                      onChange={(e) => set('externalUrl', e.target.value || null)}
                      placeholder="https://"
                      className="input"
                    />
                  </Field>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'hero' && (
          <>
            <Group title="Hero">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Text label="Eyebrow" value={c.hero.eyebrow} onChange={(v) => patch('hero', { eyebrow: v })} />
                <Text label="Highlight" hint="The part of the headline rendered in the accent colour." value={c.hero.highlight} onChange={(v) => patch('hero', { highlight: v })} />
              </div>
              <Text label="Headline" value={c.hero.headline} onChange={(v) => patch('hero', { headline: v })} />
              <Area label="Lead" rows={3} value={c.hero.lead} onChange={(v) => patch('hero', { lead: v })} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Text label="Primary CTA" hint="Admin only: the public button is “Book a live walkthrough”." value={c.hero.primaryCta} onChange={(v) => patch('hero', { primaryCta: v })} />
                <Text label="Secondary CTA" value={c.hero.secondaryCta} onChange={(v) => patch('hero', { secondaryCta: v })} />
                <Text label="Secondary href" placeholder="#section-id" hint="Links into the app are not shown publicly." value={c.hero.secondaryHref} onChange={(v) => patch('hero', { secondaryHref: v })} />
              </div>
            </Group>
            <Group title="Live card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Text label="Title" value={c.live.title} onChange={(v) => patch('live', { title: v })} />
                <Text label="Footnote" value={c.live.footnote} onChange={(v) => patch('live', { footnote: v })} />
              </div>
              <Repeatable<DemoLiveTile>
                title="Tiles"
                hint="Each figure reads `key` from the engine's /landing JSON."
                items={c.live.tiles}
                max={8}
                blank={() => ({ label: '', key: '' })}
                onChange={(tiles) => patch('live', { tiles })}
                render={(t, update) => (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <input type="text" value={t.label} onChange={(e) => update({ label: e.target.value })} placeholder="Label" className="input" aria-label="Tile label" />
                    <input type="text" value={t.key} onChange={(e) => update({ key: e.target.value })} placeholder="key" className="input font-mono" aria-label="Tile key" />
                    <select value={t.format || 'number'} onChange={(e) => update({ format: e.target.value as DemoLiveTile['format'] })} className="input" aria-label="Tile format">
                      <option value="number">number</option>
                      <option value="percent">percent</option>
                      <option value="bytes">bytes</option>
                      <option value="text">text</option>
                    </select>
                    <input type="text" value={t.of || ''} onChange={(e) => update({ of: e.target.value || undefined })} placeholder="of (denominator key)" className="input font-mono" aria-label="Tile denominator key" />
                  </div>
                )}
              />
            </Group>
          </>
        )}

        {tab === 'sections' && (
          <Repeatable<DemoSection>
            title="Product screens"
            hint="One card per part of the product on the public page. Preview path and CTA point into the app, which only admins can open; they are not shown publicly."
            items={c.sections}
            max={12}
            blank={() => ({ id: '', kicker: '', title: '', highlight: '', bullets: [], preview: '/app', cta: 'Open', flip: false })}
            onChange={(sections) => setContent({ sections })}
            render={(s, update, i) => (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Text label="Id" hint="Anchor, e.g. vpn" value={s.id} onChange={(v) => update({ id: slugTyping(v) })} mono />
                  <Text label="Kicker" value={s.kicker} onChange={(v) => update({ kicker: v })} />
                  <Text label="Highlight" value={s.highlight || ''} onChange={(v) => update({ highlight: v })} />
                </div>
                <Text label="Title" value={s.title} onChange={(v) => update({ title: v })} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Text label="Preview path" placeholder="/app/vpn" value={s.preview} onChange={(v) => update({ preview: v })} mono />
                  <Text label="CTA" value={s.cta} onChange={(v) => update({ cta: v })} />
                  <div className="pt-6">
                    <Check label="Flip (preview on the left)" checked={!!s.flip} onChange={(v) => update({ flip: v })} />
                  </div>
                </div>
                <Repeatable<DemoBullet>
                  title={`Bullets for section ${i + 1}`}
                  items={s.bullets}
                  max={8}
                  compact
                  blank={() => ({ b: '', text: '' })}
                  onChange={(bullets) => update({ bullets })}
                  render={(b, upd) => (
                    <div className="grid grid-cols-1 md:grid-cols-[1fr,2fr] gap-2">
                      <input type="text" value={b.b} onChange={(e) => upd({ b: e.target.value })} placeholder="Bold lead" className="input" aria-label="Bullet lead" />
                      <input type="text" value={b.text} onChange={(e) => upd({ text: e.target.value })} placeholder="Text" className="input" aria-label="Bullet text" />
                    </div>
                  )}
                />
              </div>
            )}
          />
        )}

        {tab === 'flow' && (
          <>
            <Group title="How it works">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Text label="Kicker" value={c.flow.kicker} onChange={(v) => patch('flow', { kicker: v })} />
                <Text label="Title" value={c.flow.title} onChange={(v) => patch('flow', { title: v })} />
                <Text label="Highlight" value={c.flow.highlight} onChange={(v) => patch('flow', { highlight: v })} />
              </div>
              <Area label="Lead" rows={2} value={c.flow.lead} onChange={(v) => patch('flow', { lead: v })} />
              <Repeatable<DemoFlowNode>
                title="Nodes"
                hint="The pipeline diagram, left to right."
                items={c.flow.nodes}
                max={8}
                compact
                blank={() => ({ title: '', sub: '' })}
                onChange={(nodes) => patch('flow', { nodes })}
                render={(n, update) => (
                  <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,auto] gap-2 items-center">
                    <input type="text" value={n.title} onChange={(e) => update({ title: e.target.value })} placeholder="Title" className="input" aria-label="Node title" />
                    <input type="text" value={n.sub} onChange={(e) => update({ sub: e.target.value })} placeholder="Subtitle" className="input" aria-label="Node subtitle" />
                    <Check label="Highlight" checked={!!n.hl} onChange={(v) => update({ hl: v })} />
                  </div>
                )}
              />
              <Repeatable<DemoCard>
                title="Cards"
                items={c.flow.cards}
                max={12}
                compact
                blank={() => ({ num: '', title: '', text: '' })}
                onChange={(cards) => patch('flow', { cards })}
                render={(k, update) => (
                  <div className="grid grid-cols-1 md:grid-cols-[4rem,1fr,2fr] gap-2">
                    <input type="text" value={k.num || ''} onChange={(e) => update({ num: e.target.value })} placeholder="01" className="input font-mono" aria-label="Card number" />
                    <input type="text" value={k.title} onChange={(e) => update({ title: e.target.value })} placeholder="Title" className="input" aria-label="Card title" />
                    <input type="text" value={k.text} onChange={(e) => update({ text: e.target.value })} placeholder="Text" className="input" aria-label="Card text" />
                  </div>
                )}
              />
              <Repeatable<DemoStat>
                title="Stats"
                items={c.flow.stats}
                max={6}
                compact
                blank={() => ({ n: '', l: '' })}
                onChange={(stats) => patch('flow', { stats })}
                render={(s, update) => (
                  <div className="grid grid-cols-1 md:grid-cols-[8rem,1fr] gap-2">
                    <input type="text" value={s.n} onChange={(e) => update({ n: e.target.value })} placeholder="99.9%" className="input font-mono" aria-label="Stat figure" />
                    <input type="text" value={s.l} onChange={(e) => update({ l: e.target.value })} placeholder="Label" className="input" aria-label="Stat label" />
                  </div>
                )}
              />
            </Group>

            <Group title="Why (for your team)">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Text label="Kicker" value={c.why.kicker} onChange={(v) => patch('why', { kicker: v })} />
                <Text label="Title" value={c.why.title} onChange={(v) => patch('why', { title: v })} />
                <Text label="Highlight" value={c.why.highlight} onChange={(v) => patch('why', { highlight: v })} />
              </div>
              <Repeatable<DemoCard>
                title="Cards"
                items={c.why.cards}
                max={12}
                compact
                blank={() => ({ title: '', text: '' })}
                onChange={(cards) => patch('why', { cards })}
                render={(k, update) => (
                  <div className="grid grid-cols-1 md:grid-cols-[1fr,2fr] gap-2">
                    <input type="text" value={k.title} onChange={(e) => update({ title: e.target.value })} placeholder="Title" className="input" aria-label="Card title" />
                    <input type="text" value={k.text} onChange={(e) => update({ text: e.target.value })} placeholder="Text" className="input" aria-label="Card text" />
                  </div>
                )}
              />
            </Group>

            <Group title="Tiles (app shortcuts: admin only, not shown on the public page)">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Text label="Kicker" value={c.tiles.kicker} onChange={(v) => patch('tiles', { kicker: v })} />
                <Text label="Title" value={c.tiles.title} onChange={(v) => patch('tiles', { title: v })} />
                <Text label="Highlight" value={c.tiles.highlight} onChange={(v) => patch('tiles', { highlight: v })} />
              </div>
              <Area label="Lead" rows={2} value={c.tiles.lead} onChange={(v) => patch('tiles', { lead: v })} />
              <Repeatable<DemoTile>
                title="Items"
                hint={sectionOptions.length ? `Section anchors on this page: ${sectionOptions.join(', ')}` : undefined}
                items={c.tiles.items}
                max={16}
                compact
                blank={() => ({ label: '', sub: '', path: '/app' })}
                onChange={(items) => patch('tiles', { items })}
                render={(t, update) => (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input type="text" value={t.label} onChange={(e) => update({ label: e.target.value })} placeholder="Label" className="input" aria-label="Tile label" />
                    <input type="text" value={t.sub} onChange={(e) => update({ sub: e.target.value })} placeholder="Subtitle" className="input" aria-label="Tile subtitle" />
                    <input type="text" value={t.path} onChange={(e) => update({ path: e.target.value })} placeholder="/app/path" className="input font-mono" aria-label="Tile path" />
                  </div>
                )}
              />
            </Group>
          </>
        )}

        {tab === 'contact' && (
          <>
            <Group title="Contact">
              <Area label="Lead" rows={2} value={c.contact.lead} onChange={(v) => patch('contact', { lead: v })} />
              <Text label="Message placeholder" value={c.contact.placeholder} onChange={(v) => patch('contact', { placeholder: v })} />
              <Area label="Footer note" hint="Trademark / not-affiliated sentence." rows={2} value={c.note} onChange={(v) => setContent({ note: v })} />
            </Group>
            <Group title="SEO">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Text label="Meta title" value={draft.seo.title || ''} onChange={(v) => setSeo({ title: v || undefined })} />
                <Text label="OG image URL" value={draft.seo.ogImage || ''} onChange={(v) => setSeo({ ogImage: v || undefined })} mono />
              </div>
              <Area label="Meta description" rows={2} value={draft.seo.description || ''} onChange={(v) => setSeo({ description: v || undefined })} />
              <Check label="Noindex (hide from search engines)" checked={!!draft.seo.noindex} onChange={(v) => setSeo({ noindex: v || undefined })} />
            </Group>
          </>
        )}
      </div>

      <ModalFooter>
        <button onClick={onCancel} className="btn-secondary" disabled={busy}>Cancel</button>
        <button onClick={() => onSave(draft)} className="btn-primary" disabled={busy}>
          {busy ? <FaSpinner className="animate-spin" aria-hidden="true" /> : <FaCheck aria-hidden="true" />}
          Save
        </button>
      </ModalFooter>
    </ModalFrame>
  );
}

/* --------------------------------------------------------------- Helpers */

function ModalFrame({
  title, subtitle, width, onClose, children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  width: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-dark-card border border-dark-border rounded-xl w-full ${width} max-h-[92vh] flex flex-col overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-4 p-4 border-b border-dark-border shrink-0">
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate">{title}</h2>
            {subtitle && <div className="mt-1">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary shrink-0" aria-label="Close">
            <FaTimes aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-2 p-4 border-t border-dark-border shrink-0">{children}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-text-secondary mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
    </div>
  );
}

function Text({
  label, value, onChange, placeholder, hint, mono,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; mono?: boolean }) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`input${mono ? ' font-mono' : ''}`}
      />
    </Field>
  );
}

function Area({
  label, value, onChange, rows, hint,
}: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <textarea rows={rows || 3} value={value} onChange={(e) => onChange(e.target.value)} className="input resize-y" />
    </Field>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-text-secondary">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function SlugInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center bg-dark border border-dark-border rounded-lg px-3">
      <span className="text-text-muted text-sm">/demos/</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(slugTyping(e.target.value))}
        onBlur={(e) => onChange(slugify(e.target.value))}
        placeholder="my-demo"
        className="flex-1 bg-transparent px-2 py-2 text-text-primary focus:outline-none"
        spellCheck={false}
      />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t first:border-t-0 border-dark-border pt-4 first:pt-0 space-y-4">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

/** A list of rows with add / remove / move up / move down. */
function Repeatable<T>({
  title, hint, items, onChange, blank, render, max, compact,
}: {
  title: string;
  hint?: string;
  items: T[];
  onChange: (items: T[]) => void;
  blank: () => T;
  render: (item: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode;
  max?: number;
  compact?: boolean;
}) {
  const atMax = max !== undefined && items.length >= max;
  const update = (i: number, p: Partial<T>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="min-w-0">
          <h4 className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-text-secondary`}>
            {title} <span className="font-normal text-text-muted">({items.length}{max ? `/${max}` : ''})</span>
          </h4>
          {hint && <p className="text-xs text-text-muted">{hint}</p>}
        </div>
        <button
          type="button"
          onClick={() => onChange([...items, blank()])}
          disabled={atMax}
          className="text-xs text-cyber-green hover:underline disabled:opacity-40 disabled:no-underline whitespace-nowrap"
        >
          <FaPlus className="inline mr-1" aria-hidden="true" /> Add
        </button>
      </div>
      {items.length === 0 ? (
        <div className="border border-dashed border-dark-border rounded-lg px-3 py-2 text-xs text-text-muted">None yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className={`flex gap-2 items-start bg-dark border border-dark-border rounded-lg ${compact ? 'p-2' : 'p-3'}`}>
              <div className="flex-1 min-w-0">{render(item, (p) => update(i, p), i)}</div>
              <div className="flex flex-col sm:flex-row gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="p-1.5 text-text-muted hover:text-cyber-green disabled:opacity-30"
                  aria-label={`Move item ${i + 1} up`}
                  title="Move up"
                >
                  <FaArrowUp className="text-xs" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  className="p-1.5 text-text-muted hover:text-cyber-green disabled:opacity-30"
                  aria-label={`Move item ${i + 1} down`}
                  title="Move down"
                >
                  <FaArrowDown className="text-xs" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="p-1.5 text-text-muted hover:text-red-400"
                  aria-label={`Remove item ${i + 1}`}
                  title="Remove"
                >
                  <FaTrash className="text-xs" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
