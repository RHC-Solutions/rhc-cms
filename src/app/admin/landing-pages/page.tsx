'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { useToast } from '@adminpanel/components/admin/Toast';
import {
  FaPlus, FaEdit, FaTrash, FaExternalLinkAlt, FaCopy, FaSpinner,
  FaInbox, FaList, FaCheck, FaTimes, FaImage, FaLink,
} from 'react-icons/fa';

interface Benefit { title: string; description: string; icon?: string; }
type MediaFit = 'cover' | 'contain';
type MediaPosition = 'right' | 'left' | 'top';
interface MediaItem { id: string; url: string; filename: string; type: string; alt?: string; }

interface LandingPage {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  template: string;
  headline: string;
  subheadline: string;
  body: string;
  benefits: Benefit[];
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
interface TemplateInfo { id: string; name: string; description: string; }
interface Lead {
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
  status: 'new' | 'contacted' | 'converted' | 'archived';
  submittedAt: string;
}

export default function LandingPagesAdmin() {
  const { addToast } = useToast();
  const [tab, setTab] = useState<'pages' | 'leads'>('pages');
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LandingPage | null>(null);
  const [creating, setCreating] = useState(false);
  const [urlBuilding, setUrlBuilding] = useState<LandingPage | null>(null);

  const fetchPages = useCallback(async () => {
    const res = await fetch('/api/cms/landing-pages', { credentials: 'include' });
    if (!res.ok) {
      addToast('error', 'Failed to load landing pages');
      return;
    }
    const data = await res.json();
    setPages(data.pages || []);
    setTemplates(data.templates || []);
  }, [addToast]);

  const fetchLeads = useCallback(async () => {
    const res = await fetch('/api/cms/leads', { credentials: 'include' });
    if (!res.ok) {
      addToast('error', 'Failed to load leads');
      return;
    }
    const data = await res.json();
    setLeads(data.leads || []);
  }, [addToast]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchPages(), fetchLeads()]);
      setLoading(false);
    })();
  }, [fetchPages, fetchLeads]);

  const handleCreate = async (templateId: string, slug: string, title: string) => {
    const res = await fetch('/api/cms/landing-pages', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId, slug, overrides: title ? { title } : {} }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      addToast('error', data.error || 'Failed to create');
      return;
    }
    addToast('success', 'Landing page created');
    setCreating(false);
    await fetchPages();
  };

  const handleSave = async (lp: LandingPage) => {
    const res = await fetch('/api/cms/landing-pages', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lp),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      addToast('error', data.error || 'Failed to save');
      return;
    }
    addToast('success', 'Saved');
    setEditing(null);
    await fetchPages();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this landing page? Existing leads will be kept.')) return;
    const res = await fetch(`/api/cms/landing-pages?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      addToast('error', 'Failed to delete');
      return;
    }
    addToast('success', 'Deleted');
    await fetchPages();
  };

  const handleLeadStatus = async (id: string, status: Lead['status']) => {
    const res = await fetch('/api/cms/leads', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      addToast('error', 'Failed to update lead');
      return;
    }
    await fetchLeads();
  };

  const handleLeadDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return;
    const res = await fetch(`/api/cms/leads?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      addToast('error', 'Failed to delete lead');
      return;
    }
    addToast('success', 'Lead deleted');
    await fetchLeads();
  };

  const copyLink = (slug: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    navigator.clipboard.writeText(`${origin}/lp/${slug}`);
    addToast('success', 'Link copied');
  };

  const newLeadsCount = useMemo(() => leads.filter((l) => l.status === 'new').length, [leads]);

  return (
    <AdminShell title="Landing Pages">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gradient mb-1">Landing Pages</h1>
        <p className="text-text-secondary text-sm">
          Build campaign landing pages from templates. Leads are emailed to the address set on each LP.
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-dark-border">
        <button
          onClick={() => setTab('pages')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'pages' ? 'border-cyber-green text-cyber-green' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <FaList className="inline mr-2" />
          Pages ({pages.length})
        </button>
        <button
          onClick={() => setTab('leads')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'leads' ? 'border-cyber-green text-cyber-green' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <FaInbox className="inline mr-2" />
          Leads ({leads.length}{newLeadsCount > 0 ? ` · ${newLeadsCount} new` : ''})
        </button>
      </div>

      {loading ? (
        <div className="text-text-secondary"><FaSpinner className="inline animate-spin mr-2" />Loading…</div>
      ) : tab === 'pages' ? (
        <PagesTab
          pages={pages}
          templates={templates}
          creating={creating}
          onCreate={handleCreate}
          onStartCreate={() => setCreating(true)}
          onCancelCreate={() => setCreating(false)}
          onEdit={(p) => setEditing(p)}
          onDelete={handleDelete}
          onCopyLink={copyLink}
          onBuildUrl={(p) => setUrlBuilding(p)}
        />
      ) : (
        <LeadsTab
          leads={leads}
          onStatusChange={handleLeadStatus}
          onDelete={handleLeadDelete}
        />
      )}

      {editing && (
        <EditModal
          lp={editing}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {urlBuilding && (
        <CampaignUrlModal
          lp={urlBuilding}
          onClose={() => setUrlBuilding(null)}
        />
      )}
    </AdminShell>
  );
}

function PagesTab({
  pages, templates, creating, onCreate, onStartCreate, onCancelCreate, onEdit, onDelete, onCopyLink, onBuildUrl,
}: {
  pages: LandingPage[];
  templates: TemplateInfo[];
  creating: boolean;
  onCreate: (templateId: string, slug: string, title: string) => void;
  onStartCreate: () => void;
  onCancelCreate: () => void;
  onEdit: (p: LandingPage) => void;
  onDelete: (id: string) => void;
  onCopyLink: (slug: string) => void;
  onBuildUrl: (p: LandingPage) => void;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id || '');
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!templateId && templates[0]) setTemplateId(templates[0].id);
  }, [templates, templateId]);

  return (
    <>
      <div className="flex justify-end mb-4">
        {!creating && (
          <button
            onClick={onStartCreate}
            className="inline-flex items-center gap-2 bg-cyber-green text-dark font-semibold px-4 py-2 rounded-lg hover:bg-cyber-green/90"
          >
            <FaPlus /> New landing page
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Create from template</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-1">
              <label className="block text-sm text-text-secondary mb-1">Template</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2 text-text-primary"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="text-xs text-text-muted mt-1">
                {templates.find((t) => t.id === templateId)?.description}
              </p>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-text-secondary mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="(optional — uses template default)"
                className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2 text-text-primary"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-text-secondary mb-1">URL slug</label>
              <div className="flex items-center bg-dark border border-dark-border rounded-lg px-3">
                <span className="text-text-muted text-sm">/lp/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="my-campaign"
                  className="flex-1 bg-transparent px-2 py-2 text-text-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onCreate(templateId, slug, title)}
              disabled={!templateId}
              className="bg-cyber-green text-dark font-semibold px-4 py-2 rounded-lg hover:bg-cyber-green/90 disabled:opacity-50"
            >
              Create draft
            </button>
            <button
              onClick={onCancelCreate}
              className="bg-dark border border-dark-border text-text-secondary px-4 py-2 rounded-lg hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {pages.length === 0 ? (
        <div className="bg-dark-card border border-dashed border-dark-border rounded-xl p-12 text-center text-text-secondary">
          No landing pages yet. Create one from a template to get started.
        </div>
      ) : (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-dark border-b border-dark-border text-text-muted">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Slug</th>
                <th className="text-left px-4 py-3 font-medium">Template</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Campaign</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.id} className="border-b border-dark-border last:border-0 hover:bg-dark/50">
                  <td className="px-4 py-3 text-text-primary">{p.title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">/lp/{p.slug}</td>
                  <td className="px-4 py-3 text-text-secondary">{p.template}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                      p.status === 'published'
                        ? 'bg-cyber-green/20 text-cyber-green'
                        : 'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">{p.campaignId || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => onBuildUrl(p)}
                        title="Build campaign URL"
                        className="p-2 text-text-secondary hover:text-cyber-green"
                      >
                        <FaLink />
                      </button>
                      <button
                        onClick={() => onCopyLink(p.slug)}
                        title="Copy public link"
                        className="p-2 text-text-secondary hover:text-cyber-green"
                      >
                        <FaCopy />
                      </button>
                      <a
                        href={`/lp/${p.slug}`}
                        target="_blank"
                        rel="noopener"
                        title="Open"
                        className="p-2 text-text-secondary hover:text-cyber-green"
                      >
                        <FaExternalLinkAlt />
                      </a>
                      <button
                        onClick={() => onEdit(p)}
                        title="Edit"
                        className="p-2 text-text-secondary hover:text-cyber-green"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => onDelete(p.id)}
                        title="Delete"
                        className="p-2 text-text-secondary hover:text-red-400"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function EditModal({
  lp, onCancel, onSave,
}: { lp: LandingPage; onCancel: () => void; onSave: (lp: LandingPage) => void; }) {
  const [draft, setDraft] = useState<LandingPage>(lp);

  const set = <K extends keyof LandingPage>(k: K, v: LandingPage[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const updateBenefit = (i: number, field: keyof Benefit, value: string) => {
    const next = [...draft.benefits];
    next[i] = { ...next[i], [field]: value };
    set('benefits', next);
  };
  const addBenefit = () => set('benefits', [...draft.benefits, { title: '', description: '' }]);
  const removeBenefit = (i: number) => set('benefits', draft.benefits.filter((_, idx) => idx !== i));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-dark-card border border-dark-border rounded-xl max-w-4xl w-full my-8">
        <div className="flex items-center justify-between p-4 border-b border-dark-border sticky top-0 bg-dark-card z-10">
          <h2 className="text-xl font-bold">Edit landing page</h2>
          <button onClick={onCancel} className="p-2 text-text-secondary hover:text-text-primary">
            <FaTimes />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Title">
              <input
                type="text"
                value={draft.title}
                onChange={(e) => set('title', e.target.value)}
                className="input"
              />
            </Field>
            <Field label="URL slug">
              <div className="flex items-center bg-dark border border-dark-border rounded-lg px-3">
                <span className="text-text-muted text-sm">/lp/</span>
                <input
                  type="text"
                  value={draft.slug}
                  onChange={(e) => set('slug', e.target.value)}
                  className="flex-1 bg-transparent px-2 py-2 focus:outline-none text-text-primary"
                />
              </div>
            </Field>
            <Field label="Status">
              <select
                value={draft.status}
                onChange={(e) => set('status', e.target.value as 'draft' | 'published')}
                className="input"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </Field>
            <Field label="Primary colour">
              <ColorPicker
                value={draft.primaryColor || '#00FF41'}
                onChange={(v) => set('primaryColor', v)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Headline">
              <input
                type="text"
                value={draft.headline}
                onChange={(e) => set('headline', e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Subheadline">
              <input
                type="text"
                value={draft.subheadline}
                onChange={(e) => set('subheadline', e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <Field label="Body copy">
            <textarea
              rows={4}
              value={draft.body}
              onChange={(e) => set('body', e.target.value)}
              className="input resize-y"
            />
          </Field>

          <div className="border-t border-dark-border pt-4">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Media</h3>
            <MediaPickerField
              url={draft.mediaUrl}
              type={draft.mediaType}
              onChange={(url, type) => {
                set('mediaUrl', url);
                if (type) set('mediaType', type);
              }}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <Field label="Position">
                <select
                  value={draft.mediaPosition || 'right'}
                  onChange={(e) => set('mediaPosition', e.target.value as MediaPosition)}
                  className="input"
                >
                  <option value="right">Right of content</option>
                  <option value="left">Left of content</option>
                  <option value="top">Above content (full width)</option>
                </select>
              </Field>
              <Field label="Fit">
                <select
                  value={draft.mediaFit || 'cover'}
                  onChange={(e) => set('mediaFit', e.target.value as MediaFit)}
                  className="input"
                >
                  <option value="cover">Cover (fill, crop edges)</option>
                  <option value="contain">Contain (fit, show whole image)</option>
                </select>
                <p className="text-xs text-text-muted mt-1">Only applies when a height is set.</p>
              </Field>
              <Field label={`Height (${draft.mediaHeight || 'auto'}${draft.mediaHeight ? 'px' : ''})`}>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={800}
                    step={20}
                    value={draft.mediaHeight ?? 0}
                    onChange={(e) => set('mediaHeight', Number(e.target.value) || undefined)}
                    className="flex-1 accent-cyber-green"
                  />
                  <button
                    type="button"
                    onClick={() => set('mediaHeight', undefined)}
                    className="text-xs text-text-muted hover:text-cyber-green"
                  >
                    Auto
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-1">0 = natural aspect ratio.</p>
              </Field>
            </div>
          </div>

          <div>
            <Field label="Noindex (recommended for ad LPs)">
              <label className="inline-flex items-center gap-2 px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.noindex}
                  onChange={(e) => set('noindex', e.target.checked)}
                />
                <span className="text-sm text-text-secondary">Hide from search engines</span>
              </label>
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Benefits</h3>
              <button onClick={addBenefit} className="text-xs text-cyber-green hover:underline">
                <FaPlus className="inline mr-1" /> Add benefit
              </button>
            </div>
            <div className="space-y-2">
              {draft.benefits.map((b, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={b.title}
                    onChange={(e) => updateBenefit(i, 'title', e.target.value)}
                    placeholder="Title"
                    className="input col-span-4"
                  />
                  <input
                    type="text"
                    value={b.description}
                    onChange={(e) => updateBenefit(i, 'description', e.target.value)}
                    placeholder="Description"
                    className="input col-span-7"
                  />
                  <button
                    onClick={() => removeBenefit(i)}
                    className="col-span-1 text-text-secondary hover:text-red-400 flex items-center justify-center"
                  >
                    <FaTrash />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-dark-border pt-4">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Form</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Form heading">
                <input
                  type="text"
                  value={draft.formHeading}
                  onChange={(e) => set('formHeading', e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Form subheading">
                <input
                  type="text"
                  value={draft.formSubheading}
                  onChange={(e) => set('formSubheading', e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="CTA button label">
                <input
                  type="text"
                  value={draft.ctaButtonLabel}
                  onChange={(e) => set('ctaButtonLabel', e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Success message">
                <input
                  type="text"
                  value={draft.successMessage}
                  onChange={(e) => set('successMessage', e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Default campaign ID">
                <input
                  type="text"
                  value={draft.campaignId}
                  onChange={(e) => set('campaignId', e.target.value)}
                  placeholder="(can also be passed via ?cid=)"
                  className="input"
                />
              </Field>
              <Field label="Lead recipient email">
                <input
                  type="email"
                  value={draft.leadEmail}
                  onChange={(e) => set('leadEmail', e.target.value)}
                  className="input"
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-dark-border sticky bottom-0 bg-dark-card">
          <button
            onClick={onCancel}
            className="bg-dark border border-dark-border text-text-secondary px-4 py-2 rounded-lg hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            className="bg-cyber-green text-dark font-semibold px-4 py-2 rounded-lg hover:bg-cyber-green/90"
          >
            <FaCheck className="inline mr-2" />
            Save
          </button>
        </div>
      </div>
      <style jsx>{`
        :global(.input) {
          width: 100%;
          background: #0a0a0a;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 8px 12px;
          color: var(--text-primary, #fff);
        }
        :global(.input:focus) {
          outline: none;
          border-color: #00FF41;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-text-secondary mb-1">{label}</label>
      {children}
    </div>
  );
}

function LeadsTab({
  leads, onStatusChange, onDelete,
}: {
  leads: Lead[];
  onStatusChange: (id: string, status: Lead['status']) => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | Lead['status']>('all');
  const filtered = useMemo(() => {
    return [...leads]
      .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
      .filter((l) => filter === 'all' || l.status === filter);
  }, [leads, filter]);

  return (
    <>
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'new', 'contacted', 'converted', 'archived'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full border ${
              filter === f
                ? 'bg-cyber-green text-dark border-cyber-green'
                : 'border-dark-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-dark-card border border-dashed border-dark-border rounded-xl p-12 text-center text-text-secondary">
          No leads yet.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => (
            <details key={l.id} className="bg-dark-card border border-dark-border rounded-xl">
              <summary className="cursor-pointer p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-text-primary">{l.name}</div>
                  <div className="text-xs text-text-muted truncate">
                    {l.email} · {l.phone} · {l.landingPageTitle}
                    {l.campaignId ? ` · ${l.campaignId}` : ''}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  l.status === 'new' ? 'bg-cyber-green/20 text-cyber-green' :
                  l.status === 'contacted' ? 'bg-cyber-cyan/20 text-cyber-cyan' :
                  l.status === 'converted' ? 'bg-purple-500/20 text-purple-300' :
                  'bg-dark-border text-text-secondary'
                }`}>
                  {l.status}
                </span>
                <span className="text-xs text-text-muted whitespace-nowrap">
                  {new Date(l.submittedAt).toLocaleString()}
                </span>
              </summary>
              <div className="border-t border-dark-border p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <Row label="Email" value={<a href={`mailto:${l.email}`} className="text-cyber-green hover:underline">{l.email}</a>} />
                  <Row label="Phone" value={<a href={`tel:${l.phone}`} className="text-cyber-green hover:underline">{l.phone}</a>} />
                  <Row label="Landing page" value={<a href={`/lp/${l.landingPageSlug}`} target="_blank" rel="noopener" className="text-cyber-green hover:underline">/lp/{l.landingPageSlug}</a>} />
                  <Row label="Campaign ID" value={l.campaignId || '—'} />
                  {Object.entries(l.utm).map(([k, v]) => (
                    <Row key={k} label={k} value={v} />
                  ))}
                </div>
                {l.message && (
                  <div>
                    <div className="text-xs text-text-muted mb-1">Message</div>
                    <div className="bg-dark border border-dark-border rounded-lg p-3 text-sm whitespace-pre-line">{l.message}</div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  {(['new', 'contacted', 'converted', 'archived'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => onStatusChange(l.id, s)}
                      disabled={l.status === s}
                      className="text-xs px-3 py-1 rounded-full border border-dark-border text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Mark {s}
                    </button>
                  ))}
                  <button
                    onClick={() => onDelete(l.id)}
                    className="text-xs px-3 py-1 rounded-full border border-red-500/40 text-red-400 hover:bg-red-500/10 ml-auto"
                  >
                    <FaTrash className="inline mr-1" /> Delete
                  </button>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-text-muted shrink-0 w-28">{label}:</span>
      <span className="text-text-primary truncate">{value}</span>
    </div>
  );
}

const BRAND_SWATCHES = ['#00FF41', '#00F0FF', '#00AAFF', '#FF00AA', '#FFAA00', '#FF3B30', '#FFFFFF', '#000000'];

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const normalize = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return '#000000';
    if (!trimmed.startsWith('#')) return `#${trimmed}`;
    return trimmed;
  };
  const safe = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#00FF41';
  return (
    <div className="flex items-center gap-2 bg-dark border border-dark-border rounded-lg p-1.5">
      <input
        type="color"
        value={safe}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="w-10 h-9 rounded cursor-pointer bg-transparent border-0 p-0"
        aria-label="Pick colour"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(normalize(e.target.value).toUpperCase())}
        className="flex-1 bg-transparent px-2 py-2 text-text-primary font-mono text-sm focus:outline-none"
        spellCheck={false}
      />
      <div className="flex items-center gap-1 pr-1">
        {BRAND_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            aria-label={`Use ${c}`}
            className="w-5 h-5 rounded-full border border-dark-border hover:scale-110 transition-transform"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

function MediaPickerField({
  url,
  type,
  onChange,
}: {
  url: string;
  type: 'image' | 'video';
  onChange: (url: string, type?: 'image' | 'video') => void;
}) {
  const [picking, setPicking] = useState(false);
  const isImg = type === 'image';
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-[200px,1fr] gap-4 items-start">
        <div className="bg-dark border border-dark-border rounded-lg overflow-hidden aspect-video flex items-center justify-center">
          {url ? (
            isImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="w-full h-full object-cover" />
            ) : (
              <video src={url} muted playsInline className="w-full h-full object-cover" />
            )
          ) : (
            <FaImage className="text-3xl text-text-muted" />
          )}
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="inline-flex items-center gap-2 bg-cyber-green text-dark font-semibold px-3 py-2 rounded-lg hover:bg-cyber-green/90"
            >
              <FaImage /> Choose from gallery
            </button>
            {url && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="text-sm text-text-secondary hover:text-red-400 px-3 py-2"
              >
                Clear
              </button>
            )}
          </div>
          <div className="text-xs text-text-muted font-mono break-all">
            {url || 'No media selected'}
          </div>
          <Field label="Media type">
            <select
              value={type}
              onChange={(e) => onChange(url, e.target.value as 'image' | 'video')}
              className="input max-w-[200px]"
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </Field>
        </div>
      </div>

      {picking && (
        <MediaGalleryModal
          filterType={type}
          onPick={(item) => {
            const itemType = item.type?.startsWith('video') ? 'video' : 'image';
            onChange(item.url, itemType);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

function MediaGalleryModal({
  filterType,
  onPick,
  onClose,
}: {
  filterType: 'image' | 'video';
  onPick: (item: MediaItem) => void;
  onClose: () => void;
}) {
  const { addToast } = useToast();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/cms/media', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load media');
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      } catch (e: any) {
        addToast('error', e?.message || 'Failed to load media');
      } finally {
        setLoading(false);
      }
    })();
  }, [addToast]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const t = (i.type || '').toLowerCase();
      const matchesType =
        showAll
          ? true
          : filterType === 'video'
            ? t.startsWith('video')
            : t.startsWith('image');
      const matchesSearch =
        !search ||
        i.filename.toLowerCase().includes(search.toLowerCase()) ||
        (i.alt || '').toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [items, search, showAll, filterType]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-dark-card border border-dark-border rounded-xl max-w-5xl w-full my-8">
        <div className="flex items-center justify-between p-4 border-b border-dark-border sticky top-0 bg-dark-card z-10">
          <h2 className="text-xl font-bold">Media gallery</h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary">
            <FaTimes />
          </button>
        </div>
        <div className="p-4 border-b border-dark-border flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search filename or alt text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] bg-dark border border-dark-border rounded-lg px-3 py-2 text-text-primary"
          />
          <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Show all (ignore type filter)
          </label>
          <a
            href="/admin/media"
            target="_blank"
            rel="noopener"
            className="text-sm text-cyber-green hover:underline"
          >
            Upload new →
          </a>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="text-text-secondary py-8 text-center">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-text-secondary py-8 text-center">
              No media found. <a href="/admin/media" target="_blank" rel="noopener" className="text-cyber-green underline">Upload one</a> first.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((item) => {
                const isVid = (item.type || '').startsWith('video');
                return (
                  <button
                    key={item.id || item.url}
                    type="button"
                    onClick={() => onPick(item)}
                    className="group bg-dark border border-dark-border rounded-lg overflow-hidden hover:border-cyber-green transition-colors text-left"
                  >
                    <div className="aspect-square bg-black/30 flex items-center justify-center">
                      {isVid ? (
                        <video src={item.url} muted playsInline className="w-full h-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.url}
                          alt={item.alt || item.filename}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="text-xs text-text-primary truncate">{item.filename}</div>
                      <div className="text-[10px] text-text-muted">{item.type}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const UTM_PRESETS: { label: string; values: { utm_source: string; utm_medium: string } }[] = [
  { label: 'Google Ads',      values: { utm_source: 'google',   utm_medium: 'cpc' } },
  { label: 'Facebook Ads',    values: { utm_source: 'facebook', utm_medium: 'paid_social' } },
  { label: 'LinkedIn Ads',    values: { utm_source: 'linkedin', utm_medium: 'paid_social' } },
  { label: 'Email newsletter',values: { utm_source: 'newsletter', utm_medium: 'email' } },
  { label: 'Organic social',  values: { utm_source: 'social',   utm_medium: 'organic' } },
];

function CampaignUrlModal({ lp, onClose }: { lp: LandingPage; onClose: () => void }) {
  const { addToast } = useToast();
  const [campaignId, setCampaignId] = useState(lp.campaignId || '');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState(lp.campaignId || '');
  const [utmTerm, setUtmTerm] = useState('');
  const [utmContent, setUtmContent] = useState('');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (campaignId) params.set('cid', campaignId);
    if (utmSource) params.set('utm_source', utmSource);
    if (utmMedium) params.set('utm_medium', utmMedium);
    if (utmCampaign) params.set('utm_campaign', utmCampaign);
    if (utmTerm) params.set('utm_term', utmTerm);
    if (utmContent) params.set('utm_content', utmContent);
    const qs = params.toString();
    return `${origin}/lp/${lp.slug}${qs ? `?${qs}` : ''}`;
  }, [origin, lp.slug, campaignId, utmSource, utmMedium, utmCampaign, utmTerm, utmContent]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      addToast('success', 'Campaign URL copied');
    } catch {
      addToast('error', 'Copy failed');
    }
  };

  const applyPreset = (preset: typeof UTM_PRESETS[number]) => {
    setUtmSource(preset.values.utm_source);
    setUtmMedium(preset.values.utm_medium);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-dark-card border border-dark-border rounded-xl max-w-2xl w-full my-8">
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <div>
            <h2 className="text-xl font-bold">Build campaign URL</h2>
            <p className="text-xs text-text-muted font-mono">/lp/{lp.slug}</p>
          </div>
          <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary">
            <FaTimes />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <div className="text-sm text-text-secondary mb-2">Quick presets</div>
            <div className="flex flex-wrap gap-2">
              {UTM_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className="text-xs px-3 py-1 rounded-full border border-dark-border text-text-secondary hover:border-cyber-green hover:text-cyber-green"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Campaign ID (cid)">
            <input
              type="text"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              placeholder="e.g. cloud-q2-2026"
              className="input"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="utm_source">
              <input
                type="text"
                value={utmSource}
                onChange={(e) => setUtmSource(e.target.value)}
                placeholder="google, facebook…"
                className="input"
              />
            </Field>
            <Field label="utm_medium">
              <input
                type="text"
                value={utmMedium}
                onChange={(e) => setUtmMedium(e.target.value)}
                placeholder="cpc, email, paid_social…"
                className="input"
              />
            </Field>
            <Field label="utm_campaign">
              <input
                type="text"
                value={utmCampaign}
                onChange={(e) => setUtmCampaign(e.target.value)}
                placeholder="campaign name"
                className="input"
              />
            </Field>
            <Field label="utm_term">
              <input
                type="text"
                value={utmTerm}
                onChange={(e) => setUtmTerm(e.target.value)}
                placeholder="paid keyword (optional)"
                className="input"
              />
            </Field>
            <Field label="utm_content">
              <input
                type="text"
                value={utmContent}
                onChange={(e) => setUtmContent(e.target.value)}
                placeholder="ad variant (optional)"
                className="input"
              />
            </Field>
          </div>

          <div>
            <div className="text-sm text-text-secondary mb-1">Generated URL</div>
            <div className="bg-dark border border-dark-border rounded-lg p-3 font-mono text-xs text-cyber-green break-all">
              {url}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-dark-border">
          <button
            onClick={onClose}
            className="bg-dark border border-dark-border text-text-secondary px-4 py-2 rounded-lg hover:text-text-primary"
          >
            Close
          </button>
          <button
            onClick={handleCopy}
            className="bg-cyber-green text-dark font-semibold px-4 py-2 rounded-lg hover:bg-cyber-green/90 inline-flex items-center gap-2"
          >
            <FaCopy /> Copy URL
          </button>
        </div>
      </div>
    </div>
  );
}
