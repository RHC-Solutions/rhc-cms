"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@adminpanel/components/admin/AdminShell";
import IntegrationsPanel from "@adminpanel/components/admin/IntegrationsPanel";
import { FaCog, FaEnvelope, FaGlobe, FaShieldAlt } from "react-icons/fa";
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
        // NOTE: homepage/contact copy (brand/stats/homeContent/contactContent/
        // bookingUrl) is edited in the Pages editor (SiteCopyEditor) now, so this
        // payload intentionally does NOT include it — saving General settings must
        // never clobber page copy that was edited elsewhere.
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

      {/* Homepage & Contact page copy moved to the Pages editor */}
      <div className="card-cyber p-6 mb-8">
        <p className="text-text-secondary text-sm">
          Homepage and Contact-page copy (hero, stats, CTA, contact sections) now lives in the{" "}
          <Link href="/admin/pages" className="text-cyber-cyan hover:text-cyber-green font-semibold">Pages editor</Link>.
        </p>
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
