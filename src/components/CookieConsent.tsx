'use client';

import { useState, useEffect } from 'react';
import { FaCookie, FaTimes } from 'react-icons/fa';

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
}

const defaultSettings: CookieSettings = {
  bannerMessage: 'We use cookies to enhance your experience and analyze traffic.',
  bannerPosition: 'bottom',
  bannerStyle: 'bar',
  showBanner: true,
  categories: [
    { id: 'necessary', name: 'Necessary', description: 'Essential for site functionality', required: true, enabled: true },
    { id: 'analytics', name: 'Analytics', description: 'Help us understand usage patterns', required: false, enabled: false },
    { id: 'marketing', name: 'Marketing', description: 'Used for targeted advertising', required: false, enabled: false },
    { id: 'preferences', name: 'Preferences', description: 'Remember your preferences', required: false, enabled: false },
  ],
  gdprCompliant: true,
  respectDNT: true,
};

export default function CookieConsent({ initialSettings }: { initialSettings?: CookieSettings } = {}) {
  const seed = initialSettings || defaultSettings;
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [settings, setSettings] = useState<CookieSettings>(seed);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(seed.categories.filter(c => c.required).map(c => c.id))
  );
  const [loading, setLoading] = useState(!initialSettings);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (consent) {
      try {
        const parsed = JSON.parse(consent);
        setSelectedCategories(new Set(parsed));
        setShowBanner(false);
      } catch (e) {
        setShowBanner(true);
      }
    } else {
      setShowBanner(true);
    }

    if (initialSettings) return;

    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/cms/cookies');
        if (res.ok) {
          const data = await res.json();
          const loaded = (data || defaultSettings) as CookieSettings;
          setSettings(loaded);
          const prior = localStorage.getItem('cookieConsent');
          if (!prior) {
            const required = loaded.categories.filter(c => c.required).map(c => c.id);
            setSelectedCategories(new Set(required));
          }
        }
      } catch (e) {
        console.error('Failed to load cookie settings', e);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [initialSettings]);

  const persistConsent = (ids: string[]) => {
    localStorage.setItem('cookieConsent', JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: ids }));
  };

  const acceptAllCookies = () => {
    const all = settings.categories.map((c) => c.id);
    persistConsent(all);
    setSelectedCategories(new Set(all));
    setShowBanner(false);
    setShowDetails(false);
  };

  const acceptNecessaryOnly = () => {
    const required = settings.categories.filter(c => c.required).map(c => c.id);
    persistConsent(required);
    setSelectedCategories(new Set(required));
    setShowBanner(false);
    setShowDetails(false);
  };

  const acceptSelected = () => {
    persistConsent(Array.from(selectedCategories));
    setShowBanner(false);
    setShowDetails(false);
  };

  const toggleCategory = (id: string) => {
    const cats = new Set(selectedCategories);
    const isRequired = settings.categories.find(c => c.id === id)?.required;
    if (isRequired) return;
    if (cats.has(id)) {
      cats.delete(id);
    } else {
      cats.add(id);
    }
    setSelectedCategories(cats);
  };

  if (!showBanner || !settings.showBanner) return null;
  if (loading) return null;

  const positionClasses = {
    bottom: 'bottom-0',
    top: 'top-0',
    center: 'fixed inset-0 flex items-center justify-center',
  };

  if (settings.bannerStyle === 'box') {
    return (
      <div className={`fixed ${positionClasses[settings.bannerPosition]} left-0 right-0 z-50`}>
        <div className={`${settings.bannerPosition === 'center' ? '' : 'ml-4 mb-4 mr-4 md:ml-8 md:mb-8 md:mr-8'} max-w-md card-cyber`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <FaCookie className="text-cyber-green text-xl" />
              <h3 className="font-bold text-text-primary">Cookie Settings</h3>
            </div>
            <button
              onClick={acceptNecessaryOnly}
              aria-label="Reject non-essential cookies and close"
              className="text-text-secondary hover:text-text-primary"
            >
              <FaTimes aria-hidden="true" />
            </button>
          </div>

          <p className="text-text-secondary text-sm mb-4">{settings.bannerMessage}</p>

          {!showDetails ? (
            <div className="flex flex-col gap-2">
              <button onClick={acceptAllCookies} className="btn-primary w-full text-sm">
                Accept All
              </button>
              <button onClick={acceptNecessaryOnly} className="btn-secondary w-full text-sm">
                Necessary Only
              </button>
              <button onClick={() => setShowDetails(true)} className="text-cyber-blue text-sm hover:underline">
                Customize
              </button>
            </div>
          ) : (
            <div className="space-y-3 mb-4">
              {settings.categories.map((cat) => (
                <label key={cat.id} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCategories.has(cat.id)}
                    disabled={cat.required}
                    onChange={() => toggleCategory(cat.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-text-primary">{cat.name}</div>
                    <div className="text-xs text-text-secondary">{cat.description}</div>
                  </div>
                </label>
              ))}
              <div className="flex gap-2 pt-2">
                <button onClick={acceptSelected} className="btn-primary flex-1 text-sm">
                  Save
                </button>
                <button onClick={() => setShowDetails(false)} className="btn-secondary flex-1 text-sm">
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Bar style (default)
  return (
    <div className={`fixed ${positionClasses[settings.bannerPosition]} left-0 right-0 bg-dark-card border-t border-cyber-green z-50`}>
      <div className="container-custom py-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-text-secondary text-sm">{settings.bannerMessage}</p>
          </div>

          {!showDetails ? (
            <div className="flex gap-2 shrink-0">
              <button onClick={acceptNecessaryOnly} className="btn-secondary text-sm whitespace-nowrap">
                Decline
              </button>
              <button onClick={() => setShowDetails(true)} className="btn-secondary text-sm whitespace-nowrap">
                Customize
              </button>
              <button onClick={acceptAllCookies} className="btn-primary text-sm whitespace-nowrap">
                Accept All
              </button>
            </div>
          ) : (
            <div className="w-full md:w-auto md:max-w-md max-h-48 overflow-y-auto bg-dark-lighter rounded p-3 mb-2">
              {settings.categories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-2 mb-2 last:mb-0 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedCategories.has(cat.id)}
                    disabled={cat.required}
                    onChange={() => toggleCategory(cat.id)}
                  />
                  <span className="text-text-primary">{cat.name}</span>
                </label>
              ))}
              <div className="flex gap-2 mt-3">
                <button onClick={acceptSelected} className="btn-primary flex-1 text-xs">
                  Save
                </button>
                <button onClick={() => setShowDetails(false)} className="btn-secondary flex-1 text-xs">
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
