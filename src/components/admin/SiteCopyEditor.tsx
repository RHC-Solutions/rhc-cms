'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@adminpanel/components/admin/Toast';
import { FaGlobe, FaEnvelope, FaChevronDown, FaChevronRight, FaSave, FaSpinner } from 'react-icons/fa';

/**
 * Homepage + Contact-page COPY editor. This copy is page content (hero, stats,
 * CTA, contact-page sections), so it belongs with the pages — it used to be
 * misfiled under Settings. The store is unchanged: it still lives in
 * cms-data/settings.json (brand/stats/homeContent/contactContent/bookingUrl),
 * saved via /api/cms/settings which top-level-merges, so we send the full
 * deep-merged objects to preserve keys this form doesn't expose.
 */

type Step = { title?: string; desc?: string };
type CopyForm = {
  bookingUrl?: string;
  brand?: {
    valueProp?: string;
    yearsHeadlineNumber?: string;
    ctaSection?: { headingLead?: string; headingHighlight?: string; headingTrailing?: string; description?: string };
  };
  stats?: { projects?: string; projectsLabel?: string; industries?: string; industriesLabel?: string; satisfaction?: string; satisfactionLabel?: string };
  homeContent?: { hero?: { eyebrow?: string; headline?: string; highlight?: string }; industriesLabel?: string; industries?: string[] };
  contactContent?: {
    hero?: { eyebrow?: string; headline?: string; highlight?: string; lead?: string };
    expect?: { eyebrow?: string; heading?: string; highlight?: string; subcopy?: string; steps?: Step[] };
    about?: { eyebrow?: string; heading?: string; highlight?: string; paragraphs?: string[]; checklistHeading?: string; checklist?: string[] };
  };
};

const inp = 'w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan';

export default function SiteCopyEditor() {
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [raw, setRaw] = useState<Record<string, any>>({});
  const [form, setForm] = useState<CopyForm>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/settings', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRaw(data || {});
      setForm({
        bookingUrl: data.bookingUrl || '',
        brand: {
          valueProp: data.brand?.valueProp || '',
          yearsHeadlineNumber: data.brand?.yearsHeadlineNumber || '',
          ctaSection: {
            headingLead: data.brand?.ctaSection?.headingLead || '',
            headingHighlight: data.brand?.ctaSection?.headingHighlight || '',
            headingTrailing: data.brand?.ctaSection?.headingTrailing || '',
            description: data.brand?.ctaSection?.description || '',
          },
        },
        stats: {
          projects: data.stats?.projects || '', projectsLabel: data.stats?.projectsLabel || '',
          industries: data.stats?.industries || '', industriesLabel: data.stats?.industriesLabel || '',
          satisfaction: data.stats?.satisfaction || '', satisfactionLabel: data.stats?.satisfactionLabel || '',
        },
        homeContent: {
          hero: {
            eyebrow: data.homeContent?.hero?.eyebrow || '', headline: data.homeContent?.hero?.headline || '', highlight: data.homeContent?.hero?.highlight || '',
          },
          industriesLabel: data.homeContent?.industriesLabel || '',
          industries: data.homeContent?.industries || [],
        },
        contactContent: {
          hero: {
            eyebrow: data.contactContent?.hero?.eyebrow || '', headline: data.contactContent?.hero?.headline || '',
            highlight: data.contactContent?.hero?.highlight || '', lead: data.contactContent?.hero?.lead || '',
          },
          expect: {
            eyebrow: data.contactContent?.expect?.eyebrow || '', heading: data.contactContent?.expect?.heading || '',
            highlight: data.contactContent?.expect?.highlight || '', subcopy: data.contactContent?.expect?.subcopy || '',
            steps: [0, 1, 2].map((i) => ({ title: data.contactContent?.expect?.steps?.[i]?.title || '', desc: data.contactContent?.expect?.steps?.[i]?.desc || '' })),
          },
          about: {
            eyebrow: data.contactContent?.about?.eyebrow || '', heading: data.contactContent?.about?.heading || '',
            highlight: data.contactContent?.about?.highlight || '', paragraphs: data.contactContent?.about?.paragraphs || [],
            checklistHeading: data.contactContent?.about?.checklistHeading || '', checklist: data.contactContent?.about?.checklist || [],
          },
        },
      });
      setLoaded(true);
    } catch {
      addToast('error', 'Failed to load page copy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !loaded && !loading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      // settings PUT does a top-level merge, so send FULL deep-merged objects to
      // preserve sub-keys the form doesn't expose (brand.about, stats.support, …).
      const payload = {
        bookingUrl: form.bookingUrl,
        brand: {
          ...(raw.brand || {}),
          valueProp: form.brand?.valueProp,
          yearsHeadlineNumber: form.brand?.yearsHeadlineNumber,
          ctaSection: { ...(raw.brand?.ctaSection || {}), ...(form.brand?.ctaSection || {}) },
        },
        stats: { ...(raw.stats || {}), ...(form.stats || {}) },
        homeContent: {
          ...(raw.homeContent || {}),
          hero: { ...(raw.homeContent?.hero || {}), ...(form.homeContent?.hero || {}) },
          industriesLabel: form.homeContent?.industriesLabel,
          industries: (form.homeContent?.industries || []).map((s) => s.trim()).filter(Boolean),
        },
        contactContent: {
          ...(raw.contactContent || {}),
          hero: { ...(raw.contactContent?.hero || {}), ...(form.contactContent?.hero || {}) },
          expect: {
            ...(raw.contactContent?.expect || {}),
            eyebrow: form.contactContent?.expect?.eyebrow, heading: form.contactContent?.expect?.heading,
            highlight: form.contactContent?.expect?.highlight, subcopy: form.contactContent?.expect?.subcopy,
            steps: (form.contactContent?.expect?.steps || []).filter((s) => (s.title || '').trim() || (s.desc || '').trim()),
          },
          about: {
            ...(raw.contactContent?.about || {}),
            eyebrow: form.contactContent?.about?.eyebrow, heading: form.contactContent?.about?.heading, highlight: form.contactContent?.about?.highlight,
            paragraphs: (form.contactContent?.about?.paragraphs || []).map((s) => s.trim()).filter(Boolean),
            checklistHeading: form.contactContent?.about?.checklistHeading,
            checklist: (form.contactContent?.about?.checklist || []).map((s) => s.trim()).filter(Boolean),
          },
        },
      };
      const res = await fetch('/api/cms/settings', {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      addToast('success', 'Page copy saved');
      await load();
    } catch {
      addToast('error', 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-cyber mb-6 overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full p-5 flex items-center gap-3 hover:bg-dark-lighter transition-colors text-left">
        <span className="text-cyber-cyan text-xl">{open ? <FaChevronDown /> : <FaChevronRight />}</span>
        <FaGlobe className="text-cyber-green text-xl" />
        <div className="flex-1">
          <h2 className="text-lg font-bold text-text-primary">Homepage &amp; Contact page copy</h2>
          <p className="text-text-muted text-sm">Hero, stats, CTA and contact-page sections — the editable copy for <code>/</code> and <code>/contact</code>.</p>
        </div>
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-dark-border">
          {loading || !loaded ? (
            <div className="py-10 text-center text-text-muted"><FaSpinner className="animate-spin inline mr-2" /> Loading…</div>
          ) : (
            <div className="space-y-8 pt-6">
              {/* Homepage */}
              <div>
                <h3 className="text-base font-bold text-text-primary mb-4 flex items-center gap-2"><FaGlobe className="text-cyber-green" /> Homepage</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-text-primary font-semibold mb-2">Value proposition</label>
                    <textarea value={form.brand?.valueProp || ''} onChange={(e) => setForm({ ...form, brand: { ...(form.brand || {}), valueProp: e.target.value } })} rows={2} className={inp} />
                    <p className="text-xs text-text-muted mt-1">Hero subheading (used unless the home Hero block sets its own description).</p>
                  </div>
                  <div>
                    <label className="block text-text-primary font-semibold mb-2">Booking URL</label>
                    <input type="url" value={form.bookingUrl || ''} onChange={(e) => setForm({ ...form, bookingUrl: e.target.value })} placeholder="https://outlook.office.com/bookwithme/..." className={inp} />
                    <p className="text-xs text-text-muted mt-1">Destination of the primary &quot;Book a 30-min call&quot; button.</p>
                  </div>
                  <div>
                    <label className="block text-text-primary font-semibold mb-3">Stats band</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input type="text" value={form.brand?.yearsHeadlineNumber || ''} onChange={(e) => setForm({ ...form, brand: { ...(form.brand || {}), yearsHeadlineNumber: e.target.value } })} placeholder="Years number, e.g. 30+" className={inp} />
                      <div className="hidden md:block" />
                      <input type="text" value={form.stats?.projects || ''} onChange={(e) => setForm({ ...form, stats: { ...(form.stats || {}), projects: e.target.value } })} placeholder="Projects number, e.g. 500+" className={inp} />
                      <input type="text" value={form.stats?.projectsLabel || ''} onChange={(e) => setForm({ ...form, stats: { ...(form.stats || {}), projectsLabel: e.target.value } })} placeholder="Projects label" className={inp} />
                      <input type="text" value={form.stats?.industries || ''} onChange={(e) => setForm({ ...form, stats: { ...(form.stats || {}), industries: e.target.value } })} placeholder="Industries number, e.g. 15+" className={inp} />
                      <input type="text" value={form.stats?.industriesLabel || ''} onChange={(e) => setForm({ ...form, stats: { ...(form.stats || {}), industriesLabel: e.target.value } })} placeholder="Industries label" className={inp} />
                      <input type="text" value={form.stats?.satisfaction || ''} onChange={(e) => setForm({ ...form, stats: { ...(form.stats || {}), satisfaction: e.target.value } })} placeholder="Satisfaction number, e.g. 98%" className={inp} />
                      <input type="text" value={form.stats?.satisfactionLabel || ''} onChange={(e) => setForm({ ...form, stats: { ...(form.stats || {}), satisfactionLabel: e.target.value } })} placeholder="Satisfaction label" className={inp} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-text-primary font-semibold mb-3">Closing call-to-action</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      <input type="text" value={form.brand?.ctaSection?.headingLead || ''} onChange={(e) => setForm({ ...form, brand: { ...(form.brand || {}), ctaSection: { ...(form.brand?.ctaSection || {}), headingLead: e.target.value } } })} placeholder="Heading lead" className={inp} />
                      <input type="text" value={form.brand?.ctaSection?.headingHighlight || ''} onChange={(e) => setForm({ ...form, brand: { ...(form.brand || {}), ctaSection: { ...(form.brand?.ctaSection || {}), headingHighlight: e.target.value } } })} placeholder="Highlighted word" className={inp} />
                      <input type="text" value={form.brand?.ctaSection?.headingTrailing || ''} onChange={(e) => setForm({ ...form, brand: { ...(form.brand || {}), ctaSection: { ...(form.brand?.ctaSection || {}), headingTrailing: e.target.value } } })} placeholder="Trailing, e.g. ?" className={inp} />
                    </div>
                    <textarea value={form.brand?.ctaSection?.description || ''} onChange={(e) => setForm({ ...form, brand: { ...(form.brand || {}), ctaSection: { ...(form.brand?.ctaSection || {}), description: e.target.value } } })} rows={2} placeholder="CTA description" className={inp} />
                  </div>
                  <div>
                    <label className="block text-text-primary font-semibold mb-3">Hero</label>
                    <div className="space-y-3">
                      <input type="text" value={form.homeContent?.hero?.eyebrow || ''} onChange={(e) => setForm({ ...form, homeContent: { ...(form.homeContent || {}), hero: { ...(form.homeContent?.hero || {}), eyebrow: e.target.value } } })} placeholder="Eyebrow" className={inp} />
                      <input type="text" value={form.homeContent?.hero?.headline || ''} onChange={(e) => setForm({ ...form, homeContent: { ...(form.homeContent || {}), hero: { ...(form.homeContent?.hero || {}), headline: e.target.value } } })} placeholder="Headline" className={inp} />
                      <input type="text" value={form.homeContent?.hero?.highlight || ''} onChange={(e) => setForm({ ...form, homeContent: { ...(form.homeContent || {}), hero: { ...(form.homeContent?.hero || {}), highlight: e.target.value } } })} placeholder="Highlighted phrase within the headline" className={inp} />
                      <p className="text-xs text-text-muted">The highlighted phrase must appear in the headline; it renders in the brand gradient.</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-text-primary font-semibold mb-3">Industries strip</label>
                    <input type="text" value={form.homeContent?.industriesLabel || ''} onChange={(e) => setForm({ ...form, homeContent: { ...(form.homeContent || {}), industriesLabel: e.target.value } })} placeholder="Lead label, e.g. Delivering for" className={`${inp} mb-2`} />
                    <textarea value={(form.homeContent?.industries || []).join('\n')} onChange={(e) => setForm({ ...form, homeContent: { ...(form.homeContent || {}), industries: e.target.value.split('\n') } })} rows={5} placeholder={'One industry per line:\nFinancial Services\nHealthcare'} className={inp} />
                    <p className="text-xs text-text-muted mt-1">One per line. Icons are assigned automatically by position.</p>
                  </div>
                </div>
              </div>

              {/* Contact page */}
              <div>
                <h3 className="text-base font-bold text-text-primary mb-4 flex items-center gap-2"><FaEnvelope className="text-cyber-green" /> Contact page</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-text-primary font-semibold mb-3">Hero</label>
                    <div className="space-y-3">
                      <input type="text" value={form.contactContent?.hero?.eyebrow || ''} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), hero: { ...(form.contactContent?.hero || {}), eyebrow: e.target.value } } })} placeholder="Eyebrow, e.g. Let's talk" className={inp} />
                      <input type="text" value={form.contactContent?.hero?.headline || ''} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), hero: { ...(form.contactContent?.hero || {}), headline: e.target.value } } })} placeholder="Headline" className={inp} />
                      <input type="text" value={form.contactContent?.hero?.highlight || ''} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), hero: { ...(form.contactContent?.hero || {}), highlight: e.target.value } } })} placeholder="Highlighted phrase within the headline" className={inp} />
                      <input type="text" value={form.contactContent?.hero?.lead || ''} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), hero: { ...(form.contactContent?.hero || {}), lead: e.target.value } } })} placeholder="Lead sentence under the headline" className={inp} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-text-primary font-semibold mb-3">&quot;What to expect&quot; section</label>
                    <div className="space-y-3">
                      <input type="text" value={form.contactContent?.expect?.eyebrow || ''} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), expect: { ...(form.contactContent?.expect || {}), eyebrow: e.target.value } } })} placeholder="Eyebrow" className={inp} />
                      <input type="text" value={form.contactContent?.expect?.heading || ''} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), expect: { ...(form.contactContent?.expect || {}), heading: e.target.value } } })} placeholder="Heading" className={inp} />
                      <input type="text" value={form.contactContent?.expect?.highlight || ''} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), expect: { ...(form.contactContent?.expect || {}), highlight: e.target.value } } })} placeholder="Highlighted phrase within the heading" className={inp} />
                      <textarea value={form.contactContent?.expect?.subcopy || ''} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), expect: { ...(form.contactContent?.expect || {}), subcopy: e.target.value } } })} rows={2} placeholder="Intro sentence" className={inp} />
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="bg-dark-lighter border border-dark-border rounded p-3 space-y-2">
                          <span className="text-xs text-text-muted">Step {i + 1}</span>
                          <input type="text" value={form.contactContent?.expect?.steps?.[i]?.title || ''} onChange={(e) => { const steps = [...(form.contactContent?.expect?.steps || [])]; while (steps.length <= i) steps.push({ title: '', desc: '' }); steps[i] = { ...steps[i], title: e.target.value }; setForm({ ...form, contactContent: { ...(form.contactContent || {}), expect: { ...(form.contactContent?.expect || {}), steps } } }); }} placeholder="Step title" className={inp} />
                          <textarea value={form.contactContent?.expect?.steps?.[i]?.desc || ''} onChange={(e) => { const steps = [...(form.contactContent?.expect?.steps || [])]; while (steps.length <= i) steps.push({ title: '', desc: '' }); steps[i] = { ...steps[i], desc: e.target.value }; setForm({ ...form, contactContent: { ...(form.contactContent || {}), expect: { ...(form.contactContent?.expect || {}), steps } } }); }} rows={2} placeholder="Step description" className={inp} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-text-primary font-semibold mb-3">&quot;Who you&apos;re working with&quot; section</label>
                    <div className="space-y-3">
                      <input type="text" value={form.contactContent?.about?.eyebrow || ''} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), about: { ...(form.contactContent?.about || {}), eyebrow: e.target.value } } })} placeholder="Eyebrow" className={inp} />
                      <input type="text" value={form.contactContent?.about?.heading || ''} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), about: { ...(form.contactContent?.about || {}), heading: e.target.value } } })} placeholder="Heading, e.g. An IT partner since 1994" className={inp} />
                      <input type="text" value={form.contactContent?.about?.highlight || ''} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), about: { ...(form.contactContent?.about || {}), highlight: e.target.value } } })} placeholder="Highlighted phrase within the heading" className={inp} />
                      <textarea value={(form.contactContent?.about?.paragraphs || []).join('\n')} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), about: { ...(form.contactContent?.about || {}), paragraphs: e.target.value.split('\n') } } })} rows={5} placeholder="One paragraph per line" className={inp} />
                      <input type="text" value={form.contactContent?.about?.checklistHeading || ''} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), about: { ...(form.contactContent?.about || {}), checklistHeading: e.target.value } } })} placeholder="Checklist heading" className={inp} />
                      <textarea value={(form.contactContent?.about?.checklist || []).join('\n')} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), about: { ...(form.contactContent?.about || {}), checklist: e.target.value.split('\n') } } })} rows={6} placeholder={"One item per line. Use ' — ' to bold the lead."} className={inp} />
                      <p className="text-xs text-text-muted">One item per line. Text before &quot; — &quot; renders bold.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={save} disabled={saving} className="btn-primary px-6 py-2 flex items-center gap-2">
                  {saving ? <FaSpinner className="animate-spin" /> : <FaSave />} {saving ? 'Saving…' : 'Save page copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
