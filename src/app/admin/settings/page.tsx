"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@adminpanel/components/admin/AdminShell";
import IntegrationsPanel from "@adminpanel/components/admin/IntegrationsPanel";
import { FaCog, FaEnvelope, FaGlobe, FaPalette, FaShieldAlt } from "react-icons/fa";
import { useToast } from "@adminpanel/components/admin/Toast";
import { TIMEZONES, getGeoTimezone } from "@adminpanel/lib/timezones";

type SettingsTab = "general" | "integrations" | "advanced";

type SocialLink = { platform: string; url: string };
type Settings = {
  siteName: string;
  tagline: string;
  siteUrl?: string;
  bookingUrl?: string;
  contact: {
    email?: string;
    phone?: string;
    address?: string;
    telegram?: string;
  };
  footer?: {
    socialLinks?: SocialLink[];
  };
  regional?: {
    timezone?: string;
    dateFormat?: string;
    language?: string;
  };
  // Homepage / brand copy consumed by the bespoke home page (src/app/page.tsx).
  brand?: {
    valueProp?: string;
    yearsHeadlineNumber?: string;
    ctaSection?: {
      headingLead?: string;
      headingHighlight?: string;
      headingTrailing?: string;
      description?: string;
    };
  };
  stats?: {
    projects?: string;
    projectsLabel?: string;
    industries?: string;
    industriesLabel?: string;
    satisfaction?: string;
    satisfactionLabel?: string;
  };
  // Bespoke home-page copy (src/app/page.tsx + HomeHero).
  homeContent?: {
    hero?: { eyebrow?: string; headline?: string; highlight?: string };
    industriesLabel?: string;
    industries?: string[];
  };
  // Bespoke contact-page copy (src/app/contact/page.tsx).
  contactContent?: {
    hero?: { eyebrow?: string; headline?: string; highlight?: string; lead?: string };
    expect?: { eyebrow?: string; heading?: string; highlight?: string; subcopy?: string; steps?: { title?: string; desc?: string }[] };
    about?: { eyebrow?: string; heading?: string; highlight?: string; paragraphs?: string[]; checklistHeading?: string; checklist?: string[] };
  };
};

export default function SettingsPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Settings | null>(null);
  // Raw settings as loaded, kept so we can deep-merge nested objects (brand/stats)
  // on save instead of clobbering keys the form doesn't expose (about, values, etc.).
  const [raw, setRaw] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  useEffect(() => {
    fetchSettings();
    // Deep-link support: /admin/settings?tab=integrations (used by the redirects
    // from the old /admin/integrations, /admin/analytics/setup, /admin/cloudflare/setup).
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "integrations" || t === "advanced") setActiveTab(t);
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/cms/settings", {
        credentials: "include",

      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRaw(data || {});
      const social = (data.footer?.socialLinks || []) as SocialLink[];

      // Get default timezone from geo IP if not set
      let timezone = data.regional?.timezone;
      if (!timezone) {
        timezone = await getGeoTimezone();
      }

      setForm({
        siteName: data.siteName || "",
        tagline: data.tagline || "",
        siteUrl: data.siteUrl || "https://example.com",
        bookingUrl: data.bookingUrl || "",
        contact: {
          email: data.contact?.email || "",
          phone: data.contact?.phone || "",
          address: data.contact?.address || "",
          telegram: data.contact?.telegram || "",
        },
        footer: {
          socialLinks: social,
        },
        regional: {
          timezone: timezone,
          dateFormat: data.regional?.dateFormat || "MM/DD/YYYY",
          language: data.regional?.language || "en-US",
        },
        brand: {
          valueProp: data.brand?.valueProp || "",
          yearsHeadlineNumber: data.brand?.yearsHeadlineNumber || "",
          ctaSection: {
            headingLead: data.brand?.ctaSection?.headingLead || "",
            headingHighlight: data.brand?.ctaSection?.headingHighlight || "",
            headingTrailing: data.brand?.ctaSection?.headingTrailing || "",
            description: data.brand?.ctaSection?.description || "",
          },
        },
        stats: {
          projects: data.stats?.projects || "",
          projectsLabel: data.stats?.projectsLabel || "",
          industries: data.stats?.industries || "",
          industriesLabel: data.stats?.industriesLabel || "",
          satisfaction: data.stats?.satisfaction || "",
          satisfactionLabel: data.stats?.satisfactionLabel || "",
        },
        homeContent: {
          hero: {
            eyebrow: data.homeContent?.hero?.eyebrow || "",
            headline: data.homeContent?.hero?.headline || "",
            highlight: data.homeContent?.hero?.highlight || "",
          },
          industriesLabel: data.homeContent?.industriesLabel || "",
          industries: data.homeContent?.industries || [],
        },
        contactContent: {
          hero: {
            eyebrow: data.contactContent?.hero?.eyebrow || "",
            headline: data.contactContent?.hero?.headline || "",
            highlight: data.contactContent?.hero?.highlight || "",
            lead: data.contactContent?.hero?.lead || "",
          },
          expect: {
            eyebrow: data.contactContent?.expect?.eyebrow || "",
            heading: data.contactContent?.expect?.heading || "",
            highlight: data.contactContent?.expect?.highlight || "",
            subcopy: data.contactContent?.expect?.subcopy || "",
            steps: [0, 1, 2].map((i) => ({
              title: data.contactContent?.expect?.steps?.[i]?.title || "",
              desc: data.contactContent?.expect?.steps?.[i]?.desc || "",
            })),
          },
          about: {
            eyebrow: data.contactContent?.about?.eyebrow || "",
            heading: data.contactContent?.about?.heading || "",
            highlight: data.contactContent?.about?.highlight || "",
            paragraphs: data.contactContent?.about?.paragraphs || [],
            checklistHeading: data.contactContent?.about?.checklistHeading || "",
            checklist: data.contactContent?.about?.checklist || [],
          },
        },
      });
    } catch (e) {
      console.error("Failed to load settings", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const payload = {
        siteName: form.siteName,
        tagline: form.tagline,
        siteUrl: form.siteUrl,
        bookingUrl: form.bookingUrl,
        contact: {
          email: form.contact?.email,
          phone: form.contact?.phone,
          address: form.contact?.address,
          telegram: form.contact?.telegram,
        },
        footer: {
          socialLinks: form.footer?.socialLinks || [],
        },
        regional: {
          timezone: form.regional?.timezone,
          dateFormat: form.regional?.dateFormat,
          language: form.regional?.language,
        },
        // Deep-merge onto the raw objects so keys the form doesn't expose
        // (brand.about, brand.values, stats.support, …) are preserved.
        brand: {
          ...(raw.brand || {}),
          valueProp: form.brand?.valueProp,
          yearsHeadlineNumber: form.brand?.yearsHeadlineNumber,
          ctaSection: {
            ...(raw.brand?.ctaSection || {}),
            headingLead: form.brand?.ctaSection?.headingLead,
            headingHighlight: form.brand?.ctaSection?.headingHighlight,
            headingTrailing: form.brand?.ctaSection?.headingTrailing,
            description: form.brand?.ctaSection?.description,
          },
        },
        stats: {
          ...(raw.stats || {}),
          projects: form.stats?.projects,
          projectsLabel: form.stats?.projectsLabel,
          industries: form.stats?.industries,
          industriesLabel: form.stats?.industriesLabel,
          satisfaction: form.stats?.satisfaction,
          satisfactionLabel: form.stats?.satisfactionLabel,
        },
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
            eyebrow: form.contactContent?.expect?.eyebrow,
            heading: form.contactContent?.expect?.heading,
            highlight: form.contactContent?.expect?.highlight,
            subcopy: form.contactContent?.expect?.subcopy,
            steps: (form.contactContent?.expect?.steps || []).filter((s) => (s.title || "").trim() || (s.desc || "").trim()),
          },
          about: {
            ...(raw.contactContent?.about || {}),
            eyebrow: form.contactContent?.about?.eyebrow,
            heading: form.contactContent?.about?.heading,
            highlight: form.contactContent?.about?.highlight,
            paragraphs: (form.contactContent?.about?.paragraphs || []).map((s) => s.trim()).filter(Boolean),
            checklistHeading: form.contactContent?.about?.checklistHeading,
            checklist: (form.contactContent?.about?.checklist || []).map((s) => s.trim()).filter(Boolean),
          },
        },
      };
      const res = await fetch("/api/cms/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`Save failed: ${text || res.status}`);
        return;
      }
      await fetchSettings();
    } catch (e) {
      console.error("Save settings failed", e);
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => {
    fetchSettings();
  };

;

  if (loading || !form) {
    return (
      <AdminShell title="Settings">
        <div className="p-8 text-text-secondary">Loading settings...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Settings">
      <div className="mb-8">
        <h1 className="heading-xl text-gradient mb-2">Site Settings</h1>
        <p className="text-text-secondary">Configure your website settings, integrations and infrastructure — all in one place.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-dark-border mb-8 overflow-x-auto">
        {([["general", "General"], ["integrations", "Integrations"], ["advanced", "Advanced"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 -mb-px border-b-2 font-semibold whitespace-nowrap ${activeTab === id ? "border-cyber-green text-cyber-green" : "border-transparent text-text-secondary hover:text-text-primary"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "integrations" && <IntegrationsPanel />}

      {activeTab === "advanced" && (
        <div className="card-cyber p-8 space-y-3">
          <h2 className="text-xl font-bold text-text-primary mb-1">Advanced</h2>
          <p className="text-text-secondary text-sm mb-4">Infrastructure and lower-level configuration.</p>
          <Link href="/admin/settings/environment" className="block text-cyber-cyan hover:text-cyber-green">Environment variables (.env.local) →</Link>
          <Link href="/admin/cloudflare" className="block text-cyber-cyan hover:text-cyber-green">Cloudflare dashboard (cache, DNS, WAF) →</Link>
        </div>
      )}

      {activeTab === "general" && (
      <>
      {/* General Settings */}
      <div className="card-cyber p-8 mb-8">
        <div className="flex items-center space-x-3 mb-6">
          <FaCog className="text-3xl text-cyber-green" />
          <h2 className="text-xl font-bold text-text-primary">General Settings</h2>
        </div>
        <div className="space-y-6">
          <div>
            <label className="block text-text-primary font-semibold mb-2">Site Name</label>
            <input
              type="text"
              value={form.siteName}
              onChange={(e) => setForm({ ...form, siteName: e.target.value })}
              className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                       focus:border-cyber-green focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-text-primary font-semibold mb-2">Tagline</label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                       focus:border-cyber-green focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-text-primary font-semibold mb-2">Site URL</label>
            <input
              type="url"
              value={form.siteUrl || ""}
              onChange={(e) => setForm({ ...form, siteUrl: e.target.value })}
              className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                       focus:border-cyber-green focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-text-primary font-semibold mb-2">Admin Email</label>
            <input
              type="email"
              value={form.contact?.email || ""}
              onChange={(e) => setForm({ ...form, contact: { ...(form.contact || {}), email: e.target.value } })}
              className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                       focus:border-cyber-green focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Homepage Content */}
      <div className="card-cyber p-8 mb-8">
        <div className="flex items-center space-x-3 mb-6">
          <FaGlobe className="text-3xl text-cyber-green" />
          <h2 className="text-xl font-bold text-text-primary">Homepage Content</h2>
        </div>
        <p className="text-text-secondary text-sm mb-6">
          Copy shown on the homepage hero, stats band, and the closing call-to-action.
        </p>
        <div className="space-y-6">
          <div>
            <label className="block text-text-primary font-semibold mb-2">Value proposition</label>
            <textarea
              value={form.brand?.valueProp || ""}
              onChange={(e) => setForm({ ...form, brand: { ...(form.brand || {}), valueProp: e.target.value } })}
              rows={2}
              className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary focus:border-cyber-green focus:outline-none"
            />
            <p className="text-xs text-text-muted mt-1">Hero subheading (used unless the home Hero block sets its own description).</p>
          </div>

          <div>
            <label className="block text-text-primary font-semibold mb-2">Booking URL</label>
            <input
              type="url"
              value={form.bookingUrl || ""}
              onChange={(e) => setForm({ ...form, bookingUrl: e.target.value })}
              placeholder="https://outlook.office.com/bookwithme/..."
              className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary focus:border-cyber-green focus:outline-none"
            />
            <p className="text-xs text-text-muted mt-1">Destination of the primary &quot;Book a 30-min call&quot; button.</p>
          </div>

          {/* Stats band */}
          <div>
            <label className="block text-text-primary font-semibold mb-3">Stats band</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={form.brand?.yearsHeadlineNumber || ""}
                onChange={(e) => setForm({ ...form, brand: { ...(form.brand || {}), yearsHeadlineNumber: e.target.value } })}
                placeholder="Years number, e.g. 30+"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
              />
              <div className="hidden md:block" />
              <input
                type="text"
                value={form.stats?.projects || ""}
                onChange={(e) => setForm({ ...form, stats: { ...(form.stats || {}), projects: e.target.value } })}
                placeholder="Projects number, e.g. 500+"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
              />
              <input
                type="text"
                value={form.stats?.projectsLabel || ""}
                onChange={(e) => setForm({ ...form, stats: { ...(form.stats || {}), projectsLabel: e.target.value } })}
                placeholder="Projects label, e.g. Projects delivered"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
              />
              <input
                type="text"
                value={form.stats?.industries || ""}
                onChange={(e) => setForm({ ...form, stats: { ...(form.stats || {}), industries: e.target.value } })}
                placeholder="Industries number, e.g. 15+"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
              />
              <input
                type="text"
                value={form.stats?.industriesLabel || ""}
                onChange={(e) => setForm({ ...form, stats: { ...(form.stats || {}), industriesLabel: e.target.value } })}
                placeholder="Industries label, e.g. Industries served"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
              />
              <input
                type="text"
                value={form.stats?.satisfaction || ""}
                onChange={(e) => setForm({ ...form, stats: { ...(form.stats || {}), satisfaction: e.target.value } })}
                placeholder="Satisfaction number, e.g. 98%"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
              />
              <input
                type="text"
                value={form.stats?.satisfactionLabel || ""}
                onChange={(e) => setForm({ ...form, stats: { ...(form.stats || {}), satisfactionLabel: e.target.value } })}
                placeholder="Satisfaction label, e.g. Client satisfaction"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
              />
            </div>
            <p className="text-xs text-text-muted mt-1">The first stat uses the years number with a fixed &quot;Years of excellence&quot; label.</p>
          </div>

          {/* Closing CTA band */}
          <div>
            <label className="block text-text-primary font-semibold mb-3">Closing call-to-action</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <input
                type="text"
                value={form.brand?.ctaSection?.headingLead || ""}
                onChange={(e) => setForm({ ...form, brand: { ...(form.brand || {}), ctaSection: { ...(form.brand?.ctaSection || {}), headingLead: e.target.value } } })}
                placeholder="Heading lead, e.g. Ready to transform your"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
              />
              <input
                type="text"
                value={form.brand?.ctaSection?.headingHighlight || ""}
                onChange={(e) => setForm({ ...form, brand: { ...(form.brand || {}), ctaSection: { ...(form.brand?.ctaSection || {}), headingHighlight: e.target.value } } })}
                placeholder="Highlighted word, e.g. IT infrastructure"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
              />
              <input
                type="text"
                value={form.brand?.ctaSection?.headingTrailing || ""}
                onChange={(e) => setForm({ ...form, brand: { ...(form.brand || {}), ctaSection: { ...(form.brand?.ctaSection || {}), headingTrailing: e.target.value } } })}
                placeholder="Trailing, e.g. ?"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
              />
            </div>
            <textarea
              value={form.brand?.ctaSection?.description || ""}
              onChange={(e) => setForm({ ...form, brand: { ...(form.brand || {}), ctaSection: { ...(form.brand?.ctaSection || {}), description: e.target.value } } })}
              rows={2}
              placeholder="CTA description"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
            />
          </div>

          {/* Hero headline */}
          <div>
            <label className="block text-text-primary font-semibold mb-3">Hero</label>
            <div className="space-y-3">
              <input
                type="text"
                value={form.homeContent?.hero?.eyebrow || ""}
                onChange={(e) => setForm({ ...form, homeContent: { ...(form.homeContent || {}), hero: { ...(form.homeContent?.hero || {}), eyebrow: e.target.value } } })}
                placeholder="Eyebrow, e.g. Enterprise IT · Cloud · Security"
                className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
              />
              <input
                type="text"
                value={form.homeContent?.hero?.headline || ""}
                onChange={(e) => setForm({ ...form, homeContent: { ...(form.homeContent || {}), hero: { ...(form.homeContent?.hero || {}), headline: e.target.value } } })}
                placeholder="Headline, e.g. IT infrastructure built for always-on business."
                className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
              />
              <input
                type="text"
                value={form.homeContent?.hero?.highlight || ""}
                onChange={(e) => setForm({ ...form, homeContent: { ...(form.homeContent || {}), hero: { ...(form.homeContent?.hero || {}), highlight: e.target.value } } })}
                placeholder="Highlighted phrase within the headline, e.g. always-on"
                className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
              />
              <p className="text-xs text-text-muted">The highlighted phrase must appear in the headline; it renders in the brand gradient.</p>
            </div>
          </div>

          {/* Industries strip */}
          <div>
            <label className="block text-text-primary font-semibold mb-3">Industries strip</label>
            <input
              type="text"
              value={form.homeContent?.industriesLabel || ""}
              onChange={(e) => setForm({ ...form, homeContent: { ...(form.homeContent || {}), industriesLabel: e.target.value } })}
              placeholder="Lead label, e.g. Delivering for"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan mb-2"
            />
            <textarea
              value={(form.homeContent?.industries || []).join("\n")}
              onChange={(e) => setForm({ ...form, homeContent: { ...(form.homeContent || {}), industries: e.target.value.split("\n") } })}
              rows={5}
              placeholder={"One industry per line:\nFinancial Services\nHealthcare"}
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
            />
            <p className="text-xs text-text-muted mt-1">One per line. Icons are assigned automatically by position.</p>
          </div>
        </div>
      </div>

      {/* Contact Page */}
      <div className="card-cyber p-8 mb-8">
        <div className="flex items-center space-x-3 mb-6">
          <FaEnvelope className="text-3xl text-cyber-green" />
          <h2 className="text-xl font-bold text-text-primary">Contact Page</h2>
        </div>
        <p className="text-text-secondary text-sm mb-6">Copy on the /contact page. The contact methods themselves are set under Contact Information above.</p>
        <div className="space-y-6">
          {/* Contact hero */}
          <div>
            <label className="block text-text-primary font-semibold mb-3">Hero</label>
            <div className="space-y-3">
              <input type="text" value={form.contactContent?.hero?.eyebrow || ""} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), hero: { ...(form.contactContent?.hero || {}), eyebrow: e.target.value } } })} placeholder="Eyebrow, e.g. Let's talk" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan" />
              <input type="text" value={form.contactContent?.hero?.headline || ""} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), hero: { ...(form.contactContent?.hero || {}), headline: e.target.value } } })} placeholder="Headline" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan" />
              <input type="text" value={form.contactContent?.hero?.highlight || ""} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), hero: { ...(form.contactContent?.hero || {}), highlight: e.target.value } } })} placeholder="Highlighted phrase within the headline" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan" />
              <input type="text" value={form.contactContent?.hero?.lead || ""} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), hero: { ...(form.contactContent?.hero || {}), lead: e.target.value } } })} placeholder="Lead sentence under the headline" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan" />
            </div>
          </div>

          {/* What to expect */}
          <div>
            <label className="block text-text-primary font-semibold mb-3">&quot;What to expect&quot; section</label>
            <div className="space-y-3">
              <input type="text" value={form.contactContent?.expect?.eyebrow || ""} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), expect: { ...(form.contactContent?.expect || {}), eyebrow: e.target.value } } })} placeholder="Eyebrow, e.g. What to expect" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan" />
              <input type="text" value={form.contactContent?.expect?.heading || ""} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), expect: { ...(form.contactContent?.expect || {}), heading: e.target.value } } })} placeholder="Heading" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan" />
              <input type="text" value={form.contactContent?.expect?.highlight || ""} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), expect: { ...(form.contactContent?.expect || {}), highlight: e.target.value } } })} placeholder="Highlighted phrase within the heading" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan" />
              <textarea value={form.contactContent?.expect?.subcopy || ""} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), expect: { ...(form.contactContent?.expect || {}), subcopy: e.target.value } } })} rows={2} placeholder="Intro sentence" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-dark-lighter border border-dark-border rounded p-3 space-y-2">
                  <span className="text-xs text-text-muted">Step {i + 1}</span>
                  <input
                    type="text"
                    value={form.contactContent?.expect?.steps?.[i]?.title || ""}
                    onChange={(e) => { const steps = [...(form.contactContent?.expect?.steps || [])]; while (steps.length <= i) steps.push({ title: "", desc: "" }); steps[i] = { ...steps[i], title: e.target.value }; setForm({ ...form, contactContent: { ...(form.contactContent || {}), expect: { ...(form.contactContent?.expect || {}), steps } } }); }}
                    placeholder="Step title"
                    className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                  />
                  <textarea
                    value={form.contactContent?.expect?.steps?.[i]?.desc || ""}
                    onChange={(e) => { const steps = [...(form.contactContent?.expect?.steps || [])]; while (steps.length <= i) steps.push({ title: "", desc: "" }); steps[i] = { ...steps[i], desc: e.target.value }; setForm({ ...form, contactContent: { ...(form.contactContent || {}), expect: { ...(form.contactContent?.expect || {}), steps } } }); }}
                    rows={2}
                    placeholder="Step description"
                    className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Who you're working with */}
          <div>
            <label className="block text-text-primary font-semibold mb-3">&quot;Who you&apos;re working with&quot; section</label>
            <div className="space-y-3">
              <input type="text" value={form.contactContent?.about?.eyebrow || ""} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), about: { ...(form.contactContent?.about || {}), eyebrow: e.target.value } } })} placeholder="Eyebrow" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan" />
              <input type="text" value={form.contactContent?.about?.heading || ""} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), about: { ...(form.contactContent?.about || {}), heading: e.target.value } } })} placeholder="Heading, e.g. An IT partner since 1994" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan" />
              <input type="text" value={form.contactContent?.about?.highlight || ""} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), about: { ...(form.contactContent?.about || {}), highlight: e.target.value } } })} placeholder="Highlighted phrase within the heading, e.g. 1994" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan" />
              <textarea value={(form.contactContent?.about?.paragraphs || []).join("\n")} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), about: { ...(form.contactContent?.about || {}), paragraphs: e.target.value.split("\n") } } })} rows={5} placeholder="One paragraph per line" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan" />
              <p className="text-xs text-text-muted">One paragraph per line.</p>
              <input type="text" value={form.contactContent?.about?.checklistHeading || ""} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), about: { ...(form.contactContent?.about || {}), checklistHeading: e.target.value } } })} placeholder="Checklist heading, e.g. What we help with" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan" />
              <textarea value={(form.contactContent?.about?.checklist || []).join("\n")} onChange={(e) => setForm({ ...form, contactContent: { ...(form.contactContent || {}), about: { ...(form.contactContent?.about || {}), checklist: e.target.value.split("\n") } } })} rows={6} placeholder={"One item per line. Use ' — ' to bold the lead, e.g.\nCloud & infrastructure — migration, optimization, and managed hosting."} className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan" />
              <p className="text-xs text-text-muted">One item per line. Text before &quot; — &quot; renders bold.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="card-cyber p-8 mb-8">
        <div className="flex items-center space-x-3 mb-6">
          <FaEnvelope className="text-3xl text-cyber-cyan" />
          <h2 className="text-xl font-bold text-text-primary">Contact Information</h2>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-text-primary font-semibold mb-2">Phone Number</label>
              <input
                type="tel"
                value={form.contact?.phone || ""}
                onChange={(e) => setForm({ ...form, contact: { ...(form.contact || {}), phone: e.target.value } })}
                className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                         focus:border-cyber-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-text-primary font-semibold mb-2">Contact Email</label>
              <input
                type="email"
                value={form.contact?.email || ""}
                onChange={(e) => setForm({ ...form, contact: { ...(form.contact || {}), email: e.target.value } })}
                className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                         focus:border-cyber-cyan focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-text-primary font-semibold mb-2">Business Address</label>
            <textarea
              rows={3}
              value={form.contact?.address || ""}
              onChange={(e) => setForm({ ...form, contact: { ...(form.contact || {}), address: e.target.value } })}
              className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                       focus:border-cyber-cyan focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-text-primary font-semibold mb-2">Telegram Handle</label>
            <input
              type="text"
              placeholder="@yourhandle"
              value={form.contact?.telegram || ""}
              onChange={(e) => setForm({ ...form, contact: { ...(form.contact || {}), telegram: e.target.value } })}
              className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                       focus:border-cyber-cyan focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-text-primary font-semibold mb-2">LinkedIn URL</label>
              <input
                type="url"
                value={(form.footer?.socialLinks || []).find(s => s.platform === 'linkedin')?.url || ""}
                onChange={(e) => {
                  const links = [...(form.footer?.socialLinks || [])];
                  const idx = links.findIndex(l => l.platform === 'linkedin');
                  if (idx >= 0) links[idx] = { platform: 'linkedin', url: e.target.value };
                  else links.push({ platform: 'linkedin', url: e.target.value });
                  setForm({ ...form, footer: { ...(form.footer || {}), socialLinks: links } });
                }}
                className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                         focus:border-cyber-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-text-primary font-semibold mb-2">Facebook URL</label>
              <input
                type="url"
                value={(form.footer?.socialLinks || []).find(s => s.platform === 'facebook')?.url || ""}
                onChange={(e) => {
                  const links = [...(form.footer?.socialLinks || [])];
                  const idx = links.findIndex(l => l.platform === 'facebook');
                  if (idx >= 0) links[idx] = { platform: 'facebook', url: e.target.value };
                  else links.push({ platform: 'facebook', url: e.target.value });
                  setForm({ ...form, footer: { ...(form.footer || {}), socialLinks: links } });
                }}
                className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                         focus:border-cyber-cyan focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Regional Settings */}
      <div className="card-cyber p-8 mb-8">
        <div className="flex items-center space-x-3 mb-6">
          <FaGlobe className="text-3xl text-cyber-blue" />
          <h2 className="text-xl font-bold text-text-primary">Regional Settings</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-text-primary font-semibold mb-2">Timezone</label>
            <select 
              value={form?.regional?.timezone || 'UTC'}
              onChange={(e) => form && setForm({ ...form, regional: { ...form.regional, timezone: e.target.value } })}
              className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                             focus:border-cyber-blue focus:outline-none">
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-text-primary font-semibold mb-2">Date Format</label>
            <select 
              value={form?.regional?.dateFormat || 'MM/DD/YYYY'}
              onChange={(e) => form && setForm({ ...form, regional: { ...form.regional, dateFormat: e.target.value } })}
              className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                             focus:border-cyber-blue focus:outline-none">
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
          <div>
            <label className="block text-text-primary font-semibold mb-2">Language</label>
            <select 
              value={form?.regional?.language || 'en-US'}
              onChange={(e) => form && setForm({ ...form, regional: { ...form.regional, language: e.target.value } })}
              className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                             focus:border-cyber-blue focus:outline-none">
              <option value="en-US">English (US)</option>
              <option>English (UK)</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="card-cyber p-8 mb-8">
        <div className="flex items-center space-x-3 mb-6">
          <FaShieldAlt className="text-3xl text-cyber-red" />
          <h2 className="text-xl font-bold text-text-primary">Security & Maintenance</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input type="checkbox" id="ssl" className="w-5 h-5" defaultChecked />
            <label htmlFor="ssl" className="text-text-primary">Force HTTPS (SSL)</label>
          </div>
          <div className="flex items-center space-x-3">
            <input type="checkbox" id="two-factor" className="w-5 h-5" defaultChecked />
            <label htmlFor="two-factor" className="text-text-primary">Enable two-factor authentication for admin</label>
          </div>
          <div className="flex items-center space-x-3">
            <input type="checkbox" id="auto-backup" className="w-5 h-5" defaultChecked />
            <label htmlFor="auto-backup" className="text-text-primary">Enable automatic backups</label>
          </div>
          <div className="flex items-center space-x-3">
            <input type="checkbox" id="maintenance" className="w-5 h-5" />
            <label htmlFor="maintenance" className="text-text-primary">Enable maintenance mode</label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={resetChanges}
          className="btn-secondary px-6 py-3"
        >
          Reset Unsaved Changes
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary px-8 py-3"
        >
          {saving ? "Saving..." : "Save All Settings"}
        </button>
      </div>
      </>
      )}
    </AdminShell>
  );
}
