'use client';
import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { useToast } from '@adminpanel/components/admin/Toast';
import { FaCookie, FaCheck, FaTimes, FaShieldAlt, FaSave } from 'react-icons/fa';

interface CookieCategory {
  id: string;
  name: string;
  description: string;
  required: boolean;
  enabled: boolean;
}

interface CookieSettings {
  bannerMessage: string;
  bannerPosition: 'bottom' | 'top' | 'center';
  bannerStyle: 'bar' | 'box' | 'full';
  showBanner: boolean;
  categories: CookieCategory[];
  gdprCompliant: boolean;
  respectDNT: boolean;
  autoDeleteCookies: boolean;
  logConsent: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export default function CookieSettings() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CookieSettings | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/cookies', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        // The API returns cookie settings directly
        setSettings(data && Object.keys(data).length > 0 ? data : getDefaultSettings());
      } else {
        addToast('error', 'Failed to load cookie settings');
        setSettings(getDefaultSettings());
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      addToast('error', 'Failed to load cookie settings');
      setSettings(getDefaultSettings());
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!settings) return;

      setSaving(true);
      try {
        const res = await fetch('/api/cms/cookies', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        });

        if (res.ok) {
          const data = await res.json();
          setSettings(data || settings);
          addToast('success', '✓ Cookie settings saved successfully!');
        } else {
          addToast('error', 'Failed to save cookie settings');
        }
      } catch (error) {
        console.error('Save failed:', error);
        addToast('error', 'Failed to save cookie settings');
      } finally {
        setSaving(false);
      }
    },
    [settings, addToast]
  );

  const toggleCategory = useCallback(
    (id: string) => {
      if (!settings) return;
      const category = settings.categories.find((c) => c.id === id);
      if (category?.required) return;

      setSettings({
        ...settings,
        categories: settings.categories.map((c) =>
          c.id === id ? { ...c, enabled: !c.enabled } : c
        ),
      });
    },
    [settings]
  );

  const updateSetting = useCallback((key: keyof CookieSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }, [settings]);

  if (loading || !settings) {
    return (
      <AdminShell title="Cookie Settings">
        <div className="text-center p-8 text-text-secondary">Loading cookie settings...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Cookie Settings">
      <form onSubmit={handleSave}>
        <div className="mb-8">
          <h1 className="heading-xl text-gradient mb-2">GDPR Cookie Management</h1>
          <p className="text-text-secondary">Configure cookie consent and compliance settings</p>
        </div>

        {/* Cookie Banner Settings */}
        <div className="card-cyber p-8 mb-8">
          <div className="flex items-start space-x-4 mb-6">
          <FaCookie className="text-4xl text-cyber-green shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold text-text-primary mb-2">Cookie Consent Banner</h2>
              <p className="text-text-secondary mb-6">Manage how visitors consent to cookies on your website</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-text-primary font-semibold mb-2">Banner Message</label>
              <textarea
                rows={3}
                value={settings.bannerMessage}
                onChange={(e) => updateSetting('bannerMessage', e.target.value)}
                className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                         focus:border-cyber-green focus:outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-text-primary font-semibold mb-2">Banner Position</label>
                <select
                  value={settings.bannerPosition}
                  onChange={(e) => updateSetting('bannerPosition', e.target.value as 'bottom' | 'top' | 'center')}
                  className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                           focus:border-cyber-cyan focus:outline-none transition-colors"
                >
                  <option value="bottom">Bottom</option>
                  <option value="top">Top</option>
                  <option value="center">Center Modal</option>
                </select>
              </div>
              <div>
                <label className="block text-text-primary font-semibold mb-2">Banner Style</label>
                <select
                  value={settings.bannerStyle}
                  onChange={(e) => updateSetting('bannerStyle', e.target.value as 'bar' | 'box' | 'full')}
                  className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                           focus:border-cyber-cyan focus:outline-none transition-colors"
                >
                  <option value="bar">Bar</option>
                  <option value="box">Box</option>
                  <option value="full">Full Width</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="show-banner"
                checked={settings.showBanner}
                onChange={(e) => updateSetting('showBanner', e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
              <label htmlFor="show-banner" className="text-text-primary cursor-pointer">
                Display cookie consent banner
              </label>
            </div>
          </div>
        </div>

        {/* Cookie Categories */}
        <div className="card-cyber p-8 mb-8">
          <h2 className="heading-md text-gradient mb-6">Cookie Categories</h2>
          <div className="space-y-4">
            {settings.categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between p-4 bg-dark-lighter rounded-lg">
                <div className="flex-1">
                  <h3 className="text-text-primary font-semibold mb-1 flex items-center space-x-2">
                    <span>{category.name}</span>
                    {category.required && (
                      <span className="text-xs px-2 py-1 bg-cyber-red/20 text-cyber-red rounded-full">Required</span>
                    )}
                  </h3>
                  <p className="text-text-secondary text-sm">{category.description}</p>
                </div>
                <div className="flex items-center space-x-4">
                  {category.enabled ? (
                    <FaCheck className="text-cyber-green text-xl" />
                  ) : (
                    <FaTimes className="text-cyber-red text-xl" />
                  )}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={category.enabled}
                      onChange={() => toggleCategory(category.id)}
                      disabled={category.required}
                    />
                    <div
                      className={`w-11 h-6 bg-dark-card rounded-full peer peer-checked:bg-cyber-green transition-colors ${
                        category.required ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <div className="w-5 h-5 bg-white rounded-full transform transition-transform peer-checked:translate-x-5 translate-x-0.5 translate-y-0.5" />
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance & Privacy */}
        <div className="card-cyber p-8 mb-8">
          <div className="flex items-start space-x-4 mb-6">
          <FaShieldAlt className="text-4xl text-cyber-cyan shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold text-text-primary mb-2">Privacy & Compliance</h2>
              <p className="text-text-secondary mb-6">Ensure your website meets GDPR and privacy regulations</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="gdpr-compliant"
                checked={settings.gdprCompliant}
                onChange={(e) => updateSetting('gdprCompliant', e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
              <label htmlFor="gdpr-compliant" className="text-text-primary cursor-pointer">
                Enable GDPR compliance mode
              </label>
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="do-not-track"
                checked={settings.respectDNT}
                onChange={(e) => updateSetting('respectDNT', e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
              <label htmlFor="do-not-track" className="text-text-primary cursor-pointer">
                Respect Do Not Track browser settings
              </label>
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="auto-delete"
                checked={settings.autoDeleteCookies}
                onChange={(e) => updateSetting('autoDeleteCookies', e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
              <label htmlFor="auto-delete" className="text-text-primary cursor-pointer">
                Automatically delete cookies after 30 days
              </label>
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="consent-log"
                checked={settings.logConsent}
                onChange={(e) => updateSetting('logConsent', e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
              <label htmlFor="consent-log" className="text-text-primary cursor-pointer">
                Log consent actions for compliance
              </label>
            </div>
          </div>

          <div className="mt-6 p-4 bg-dark-lighter rounded-lg border border-cyber-cyan/30">
            <p className="text-sm text-text-secondary">
              <strong className="text-cyber-cyan">Privacy Policy Link:</strong> Make sure your privacy policy is up to date and linked in the cookie banner.
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-cyber-green hover:underline ml-2">
                View Privacy Policy →
              </a>
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary px-8 py-3 flex items-center gap-2"
          >
            <FaSave />
            <span>{saving ? 'Saving...' : 'Save Cookie Settings'}</span>
          </button>
        </div>

        <div className="text-xs text-text-muted mt-4 text-right">
          {settings.updatedAt && <p>Last updated: {new Date(settings.updatedAt).toLocaleString()}</p>}
        </div>
      </form>
    </AdminShell>
  );
}

function getDefaultSettings(): CookieSettings {
  return {
    bannerMessage:
      "We use cookies to enhance your browsing experience and analyze site traffic. By clicking 'Accept', you consent to our use of cookies.",
    bannerPosition: 'bottom',
    bannerStyle: 'bar',
    showBanner: true,
    categories: [
      {
        id: 'necessary',
        name: 'Necessary',
        description: 'Essential for basic site functionality',
        required: true,
        enabled: true,
      },
      {
        id: 'analytics',
        name: 'Analytics',
        description: 'Help us understand how visitors interact with the website',
        required: false,
        enabled: false,
      },
      {
        id: 'marketing',
        name: 'Marketing',
        description: 'Used for advertising and retargeting',
        required: false,
        enabled: false,
      },
      {
        id: 'preferences',
        name: 'Preferences',
        description: 'Remember your preferences and personalize content',
        required: false,
        enabled: false,
      },
    ],
    gdprCompliant: true,
    respectDNT: true,
    autoDeleteCookies: false,
    logConsent: true,
    updatedAt: new Date().toISOString(),
  };
}
