'use client';
import { useState, useEffect } from 'react';
import type React from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaPalette, FaSave, FaTimes, FaImages } from 'react-icons/fa';

interface ThemeColors {
  primary: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  background: string;
}

interface ThemeFonts {
  primary: string;
  secondary: string;
  mono: string;
}

interface ThemeSizes {
  h1: string;
  h2: string;
  h3: string;
  body: string;
  button: string;
}

interface ThemeBranding {
  favicon?: string;
  logo?: string;
  logoAlt?: string;
  logoSize?: number;
  siteNameSize?: string;
  taglineSize?: string;
  siteNameFont?: string;
  taglineFont?: string;
  menuFont?: string;
  menuFontSize?: string;
  footerFont?: string;
  footerFontSize?: string;
}

interface Theme {
  name?: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  sizes?: ThemeSizes;
  borderRadius: string;
  shadowIntensity: 'light' | 'medium' | 'heavy';
  darkMode?: boolean;
  animations?: boolean;
  branding?: ThemeBranding;
  googleFontsApiKey?: string;
  updatedAt: string;
  updatedBy?: string;
}

const FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Space Grotesk', value: 'Space Grotesk, system-ui, sans-serif' },
  { label: 'Poppins', value: 'Poppins, system-ui, sans-serif' },
  { label: 'Roboto Slab', value: 'Roboto Slab, serif' },
  { label: 'Fira Code', value: 'Fira Code, monospace' },
  { label: 'JetBrains Mono', value: 'JetBrains Mono, Courier New, monospace' },
];

interface GoogleFontItem {
  family: string;
  category?: string;
}

interface MediaItem {
  id: string;
  filename: string;
  url: string;
  type: string;
  alt?: string;
}

const DEFAULT_THEME: Theme = {
  name: 'Terminal Green',
  colors: {
    primary: '#00FF41',
    primaryDark: '#0A0E27',
    secondary: '#00F0FF',
    accent: '#00AAFF',
    success: '#00FF88',
    error: '#FF4458',
    warning: '#FFB800',
    info: '#00F0FF',
    background: '#0B1220',
  },
  branding: {
    favicon: '/logo.png',
    logo: '/logo.png',
    logoAlt: 'RHC Solutions Logo',
    logoSize: 40,
    siteNameSize: '2rem',
    taglineSize: '0.875rem',
    siteNameFont: 'JetBrains Mono, Courier New, monospace',
    taglineFont: 'JetBrains Mono, Courier New, monospace',
    menuFont: 'Inter, system-ui, sans-serif',
    menuFontSize: '1rem',
    footerFont: 'Inter, system-ui, sans-serif',
    footerFontSize: '0.875rem',
  },
  fonts: {
    primary: 'Inter, system-ui, sans-serif',
    secondary: 'Space Grotesk, system-ui, sans-serif',
    mono: 'JetBrains Mono, Courier New, monospace',
  },
  sizes: {
    h1: '2.5rem',
    h2: '2rem',
    h3: '1.5rem',
    body: '1rem',
    button: '0.95rem',
  },
  borderRadius: '0.5rem',
  shadowIntensity: 'medium',
  darkMode: true,
  animations: true,
  googleFontsApiKey: '',
  updatedAt: new Date().toISOString(),
  updatedBy: 'admin',
};

const PRESET_THEMES: Array<{ name: string; description: string; theme: Theme }> = [
  {
    name: 'Cyberpunk Neon',
    description: 'High-contrast neon purples and teals on deep space black.',
    theme: {
      name: 'Cyberpunk Neon',
      colors: {
        primary: '#7C3AED',
        primaryDark: '#0A0015',
        secondary: '#22D3EE',
        accent: '#F472B6',
        success: '#22C55E',
        error: '#F43F5E',
        warning: '#FACC15',
        info: '#38BDF8',
        background: '#0B0120',
      },
      fonts: {
        primary: 'Inter, system-ui, sans-serif',
        secondary: 'Space Grotesk, system-ui, sans-serif',
        mono: 'JetBrains Mono, Courier New, monospace',
      },
      sizes: DEFAULT_THEME.sizes,
      borderRadius: '0.6rem',
      shadowIntensity: 'medium',
      darkMode: true,
      animations: true,
      branding: DEFAULT_THEME.branding,
      googleFontsApiKey: DEFAULT_THEME.googleFontsApiKey,
      updatedAt: new Date().toISOString(),
    },
  },
  {
    name: 'Cloud Bright',
    description: 'Bright sky blues and teals with crisp contrast on a dark base.',
    theme: {
      name: 'Cloud Bright',
      colors: {
        primary: '#0EA5E9',
        primaryDark: '#0B1728',
        secondary: '#38BDF8',
        accent: '#A855F7',
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        info: '#06B6D4',
        background: '#0B1728',
      },
      fonts: {
        primary: 'Inter, system-ui, sans-serif',
        secondary: 'Poppins, system-ui, sans-serif',
        mono: 'JetBrains Mono, Courier New, monospace',
      },
      sizes: DEFAULT_THEME.sizes,
      borderRadius: '0.65rem',
      shadowIntensity: 'medium',
      darkMode: true,
      animations: true,
      branding: DEFAULT_THEME.branding,
      googleFontsApiKey: DEFAULT_THEME.googleFontsApiKey,
      updatedAt: new Date().toISOString(),
    },
  },
  {
    name: 'Cintypop Glow',
    description: 'Playful synthwave pinks and teals with candy accents.',
    theme: {
      name: 'Cintypop Glow',
      colors: {
        primary: '#FF6B6B',
        primaryDark: '#0F1224',
        secondary: '#22D3EE',
        accent: '#8B5CF6',
        success: '#4ADE80',
        error: '#F43F5E',
        warning: '#FBBF24',
        info: '#38BDF8',
        background: '#0D0B1A',
      },
      fonts: {
        primary: 'Space Grotesk, system-ui, sans-serif',
        secondary: 'Inter, system-ui, sans-serif',
        mono: 'JetBrains Mono, Courier New, monospace',
      },
      sizes: DEFAULT_THEME.sizes,
      borderRadius: '0.7rem',
      shadowIntensity: 'heavy',
      darkMode: true,
      animations: true,
      branding: DEFAULT_THEME.branding,
      googleFontsApiKey: DEFAULT_THEME.googleFontsApiKey,
      updatedAt: new Date().toISOString(),
    },
  },
  {
    name: 'Cloud Dark',
    description: 'Deep navy surfaces with bright azure highlights.',
    theme: {
      name: 'Cloud Dark',
      colors: {
        primary: '#1D4ED8',
        primaryDark: '#0A1528',
        secondary: '#0EA5E9',
        accent: '#22D3EE',
        success: '#16A34A',
        error: '#DC2626',
        warning: '#F59E0B',
        info: '#60A5FA',
        background: '#0A1528',
      },
      fonts: {
        primary: 'Inter, system-ui, sans-serif',
        secondary: 'Space Grotesk, system-ui, sans-serif',
        mono: 'JetBrains Mono, Courier New, monospace',
      },
      sizes: DEFAULT_THEME.sizes,
      borderRadius: '0.55rem',
      shadowIntensity: 'medium',
      darkMode: true,
      animations: true,
      branding: DEFAULT_THEME.branding,
      googleFontsApiKey: DEFAULT_THEME.googleFontsApiKey,
      updatedAt: new Date().toISOString(),
    },
  },
  {
    name: 'Google Dark',
    description: 'Material-inspired dark palette with Google brand accents.',
    theme: {
      name: 'Google Dark',
      colors: {
        primary: '#4285F4',
        primaryDark: '#121212',
        secondary: '#34A853',
        accent: '#FBBC05',
        success: '#34A853',
        error: '#EA4335',
        warning: '#FBBC05',
        info: '#4285F4',
        background: '#121212',
      },
      fonts: {
        primary: 'Roboto, system-ui, sans-serif',
        secondary: 'Roboto, system-ui, sans-serif',
        mono: 'JetBrains Mono, Courier New, monospace',
      },
      sizes: DEFAULT_THEME.sizes,
      borderRadius: '0.5rem',
      shadowIntensity: 'medium',
      darkMode: true,
      animations: true,
      branding: DEFAULT_THEME.branding,
      googleFontsApiKey: DEFAULT_THEME.googleFontsApiKey,
      updatedAt: new Date().toISOString(),
    },
  },
  {
    name: 'Retro Terminal',
    description: 'Classic PC terminal with amber/green CRT monitor aesthetics.',
    theme: {
      name: 'Retro Terminal',
      colors: {
        primary: '#FFB000',
        primaryDark: '#000000',
        secondary: '#33FF33',
        accent: '#00FF00',
        success: '#00DD00',
        error: '#FF3333',
        warning: '#FFAA00',
        info: '#00CCCC',
        background: '#000000',
      },
      fonts: {
        primary: 'JetBrains Mono, Courier New, monospace',
        secondary: 'JetBrains Mono, Courier New, monospace',
        mono: 'JetBrains Mono, Courier New, monospace',
      },
      sizes: DEFAULT_THEME.sizes,
      borderRadius: '0.25rem',
      shadowIntensity: 'light',
      darkMode: true,
      animations: false,
      branding: DEFAULT_THEME.branding,
      googleFontsApiKey: DEFAULT_THEME.googleFontsApiKey,
      updatedAt: new Date().toISOString(),
    },
  },
];

export default function ThemeManagement() {

  const [theme, setTheme] = useState<Theme | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Theme | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [pickerFor, setPickerFor] = useState<'favicon' | 'logo' | null>(null);
  const [fontPickerFor, setFontPickerFor] = useState<keyof ThemeFonts | null>(null);
  const [fontResults, setFontResults] = useState<GoogleFontItem[]>([]);
  const [fontLoading, setFontLoading] = useState(false);
  const [fontSearch, setFontSearch] = useState('');
  const [fontError, setFontError] = useState<string | null>(null);
  const [customPresets, setCustomPresets] = useState<Array<{ name: string; description: string; theme: Theme }>>([]);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  useEffect(() => {
    fetchTheme();
    fetchMedia();
    loadCustomPresets();
  }, []);

  const loadCustomPresets = () => {
    try {
      const stored = localStorage.getItem('theme-custom-presets');
      if (stored) {
        setCustomPresets(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load custom presets:', error);
    }
  };

  const saveAsPreset = () => {
    if (!formData || !presetName.trim()) {
      alert('Please enter a preset name');
      return;
    }
    const newPreset = {
      name: presetName,
      description: `Custom preset: ${presetName}`,
      theme: { ...formData },
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    localStorage.setItem('theme-custom-presets', JSON.stringify(updated));
    setPresetName('');
    setShowSavePreset(false);
    alert(`Preset "${presetName}" saved!`);
  };

  const deletePreset = (presetName: string) => {
    if (!confirm(`Delete preset "${presetName}"?`)) return;
    const updated = customPresets.filter((p) => p.name !== presetName);
    setCustomPresets(updated);
    localStorage.setItem('theme-custom-presets', JSON.stringify(updated));
  };

  const fetchMedia = async () => {
    setMediaLoading(true);
    try {
      const res = await fetch('/api/cms/media', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMedia(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to load media:', error);
    } finally {
      setMediaLoading(false);
    }
  };

  const fetchTheme = async () => {
    try {
      const res = await fetch('/api/cms/theme', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const merged: Theme = {
          ...DEFAULT_THEME,
          ...data,
          colors: { ...DEFAULT_THEME.colors, ...(data?.colors || {}) },
          fonts: { ...DEFAULT_THEME.fonts, ...(data?.fonts || {}) },
          sizes: { ...DEFAULT_THEME.sizes, ...(data?.sizes || {}) },
          branding: { ...DEFAULT_THEME.branding, ...(data?.branding || {}) },
        };
        setTheme(merged);
        setFormData(merged);
      }
    } catch (error) {
      console.error('Failed to fetch theme:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGoogleFonts = async (force = false) => {
    if (!force && (fontResults.length || fontLoading)) return;
    const apiKey = formData?.googleFontsApiKey || process.env.NEXT_PUBLIC_GOOGLE_FONTS_API_KEY;
    if (!apiKey) {
      setFontError('Set NEXT_PUBLIC_GOOGLE_FONTS_API_KEY to enable Google Fonts search.');
      return;
    }
    setFontError(null);
    setFontLoading(true);
    try {
      const res = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=${apiKey}`);
      if (!res.ok) {
        setFontError('Failed to load Google Fonts.');
        return;
      }
      const data = await res.json();
      const items: GoogleFontItem[] = Array.isArray(data.items)
        ? data.items.map((item: any) => ({ family: item.family, category: item.category }))
        : [];
      setFontResults(items);
    } catch (error) {
      console.error('Google Fonts fetch failed', error);
      setFontError('Failed to load Google Fonts.');
    } finally {
      setFontLoading(false);
    }
  };

  const openFontPicker = (target: keyof ThemeFonts) => {
    setFontPickerFor(target);
    loadGoogleFonts();
  };

  const applyFont = (family: string) => {
    if (!formData || !fontPickerFor) return;
    const fallback = fontPickerFor === 'mono' ? 'monospace' : 'sans-serif';
    const stack = `${family}, ${fallback}`;
    setFormData({
      ...formData,
      fonts: { ...formData.fonts, [fontPickerFor]: stack },
    });
    setFontPickerFor(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    setSaving(true);
    try {
      const res = await fetch('/api/cms/theme', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const updated = await res.json();
        setTheme(updated);
        setFormData(updated);
        // Reload the page to apply theme changes
        window.location.reload();
      } else {
        const message = await res.text();
        console.error(`Failed to save theme: ${message || res.status}`);
      }
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !formData) {
    return (
      <AdminShell title="Theme Management">
        <div className="text-center p-8">Loading theme...</div>
      </AdminShell>
    );
  }

  const selectMedia = (item: MediaItem) => {
    if (!formData || !pickerFor) return;
    setFormData({
      ...formData,
      branding: {
        ...(formData.branding || {}),
        [pickerFor]: item.url,
        ...(pickerFor === 'logo' && item.alt ? { logoAlt: item.alt } : {}),
      },
    });
    setPickerFor(null);
  };

  return (
    <AdminShell title="Theme Management">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="heading-xl text-gradient mb-2">Theme Settings</h1>
          <p className="text-text-secondary">Manage colors, fonts, and visual appearance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2 space-y-8">
          {/* Presets */}
          <div className="card-cyber p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="heading-lg text-gradient">Theme Presets</h2>
              <button
                type="button"
                onClick={() => setShowSavePreset(!showSavePreset)}
                className="btn-secondary px-4 py-2 text-sm"
              >
                {showSavePreset ? 'Cancel' : '+ Save as Preset'}
              </button>
            </div>

            {showSavePreset && (
              <div className="bg-dark border border-dark-border rounded-lg p-4 mb-4">
                <label className="block text-text-primary font-semibold mb-2">Preset Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="e.g., My Custom Theme"
                    className="flex-1 bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                  />
                  <button
                    type="button"
                    onClick={saveAsPreset}
                    className="btn-primary px-4 py-2"
                  >
                    <FaSave />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-secondary mb-3">Built-in Presets</h3>
              {PRESET_THEMES.map((preset) => (
                <div
                  key={preset.name}
                  className="bg-dark border border-dark-border hover:border-cyber-cyan rounded-lg p-3 flex items-center justify-between gap-4 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-text-primary">{preset.name}</div>
                    <div className="text-xs text-text-secondary mt-0.5">{preset.description}</div>
                    <div className="flex gap-1.5 mt-2">
                      {Object.values(preset.theme.colors).slice(0, 6).map((c, idx) => (
                        <span key={idx} className="w-5 h-5 rounded border border-dark-border" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData || !formData.sizes) return;
                      const now = new Date().toISOString();
                      const presetSizes = (preset.theme.sizes || {}) as Partial<ThemeSizes>;
                      setFormData({
                        ...formData,
                        ...preset.theme,
                        name: preset.name,
                        colors: { ...formData.colors, ...preset.theme.colors },
                        fonts: { ...formData.fonts, ...preset.theme.fonts },
                        sizes: {
                          h1: presetSizes.h1 || formData.sizes.h1,
                          h2: presetSizes.h2 || formData.sizes.h2,
                          h3: presetSizes.h3 || formData.sizes.h3,
                          body: presetSizes.body || formData.sizes.body,
                          button: presetSizes.button || formData.sizes.button,
                        },
                        branding: { ...formData.branding, ...(preset.theme.branding || {}) },
                        updatedAt: now,
                      });
                    }}
                    className="btn-secondary px-4 py-2 text-sm whitespace-nowrap"
                  >
                    Apply
                  </button>
                </div>
              ))}

              {customPresets.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-text-secondary mb-3 mt-6">Custom Presets</h3>
                  {customPresets.map((preset) => (
                    <div
                      key={preset.name}
                      className="bg-dark border border-dark-border hover:border-cyber-cyan rounded-lg p-3 flex items-center justify-between gap-4 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-text-primary">{preset.name}</div>
                        <div className="text-xs text-text-secondary mt-0.5">{preset.description}</div>
                        <div className="flex gap-1.5 mt-2">
                          {Object.values(preset.theme.colors).slice(0, 6).map((c, idx) => (
                            <span key={idx} className="w-5 h-5 rounded border border-dark-border" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!formData || !formData.sizes) return;
                            const now = new Date().toISOString();
                            const presetSizes = (preset.theme.sizes || {}) as Partial<ThemeSizes>;
                            setFormData({
                              ...formData,
                              ...preset.theme,
                              name: preset.name,
                              colors: { ...formData.colors, ...preset.theme.colors },
                              fonts: { ...formData.fonts, ...preset.theme.fonts },
                              sizes: {
                                h1: presetSizes.h1 || formData.sizes.h1,
                                h2: presetSizes.h2 || formData.sizes.h2,
                                h3: presetSizes.h3 || formData.sizes.h3,
                                body: presetSizes.body || formData.sizes.body,
                                button: presetSizes.button || formData.sizes.button,
                              },
                              branding: { ...formData.branding, ...(preset.theme.branding || {}) },
                              updatedAt: now,
                            });
                          }}
                          className="btn-secondary px-4 py-2 text-sm"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePreset(preset.name)}
                          className="bg-cyber-red/20 hover:bg-cyber-red/30 text-cyber-red px-3 py-2 rounded text-sm transition-colors"
                        >
                          <FaTimes />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-8">
            {/* Theme Meta */}
            <div className="card-cyber p-6">
              <h2 className="heading-lg text-gradient mb-6">Theme Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-primary font-semibold mb-2">Theme Name</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-dark border-2 border-dark-border rounded-lg px-4 py-3 text-text-primary"
                    placeholder="e.g., Terminal Green"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-text-primary font-semibold">Dark Mode</label>
                  <input
                    type="checkbox"
                    checked={!!formData.darkMode}
                    onChange={(e) => setFormData({ ...formData, darkMode: e.target.checked })}
                    className="toggle toggle-primary"
                  />
                  <label className="text-text-primary font-semibold">Animations</label>
                  <input
                    type="checkbox"
                    checked={!!formData.animations}
                    onChange={(e) => setFormData({ ...formData, animations: e.target.checked })}
                    className="toggle toggle-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-text-primary font-semibold mb-2">Google Fonts API Key</label>
                  <input
                    type="text"
                    value={formData.googleFontsApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, googleFontsApiKey: e.target.value })}
                    className="w-full bg-dark border-2 border-dark-border rounded-lg px-4 py-3 text-text-primary"
                    placeholder="NEXT_PUBLIC key (public)"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    Public key; stored with the theme. Set if env var is not available.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="space-y-2">
                  <label className="block text-text-primary font-semibold">Favicon</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPickerFor('favicon')}
                      className="btn-secondary flex items-center gap-2 w-full justify-center"
                    >
                      <FaImages /> Choose from Media
                    </button>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={formData.branding?.favicon || ''}
                    className="w-full bg-dark border-2 border-dark-border rounded-lg px-4 py-3 text-text-primary"
                    placeholder="Select a favicon"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-text-primary font-semibold">Logo</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPickerFor('logo')}
                      className="btn-secondary flex items-center gap-2 w-full justify-center"
                    >
                      <FaImages /> Choose from Media
                    </button>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={formData.branding?.logo || ''}
                    className="w-full bg-dark border-2 border-dark-border rounded-lg px-4 py-3 text-text-primary"
                    placeholder="Select a logo"
                  />
                </div>
                <div>
                  <label className="block text-text-primary font-semibold mb-2">Logo Alt Text</label>
                  <input
                    type="text"
                    value={formData.branding?.logoAlt || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        branding: { ...(formData.branding || {}), logoAlt: e.target.value },
                      })
                    }
                    className="w-full bg-dark border-2 border-dark-border rounded-lg px-4 py-3 text-text-primary"
                    placeholder="RHC Solutions"
                  />
                </div>
              </div>

              {/* Size Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-text-primary font-semibold mb-2">
                    Logo Size: {formData.branding?.logoSize || 40}px
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="120"
                    step="5"
                    value={formData.branding?.logoSize || 40}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        branding: { ...(formData.branding || {}), logoSize: Number(e.target.value) },
                      })
                    }
                    className="w-full h-2 bg-dark-border rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-text-muted mt-1">
                    <span>20px</span>
                    <span>120px</span>
                  </div>
                  {formData.branding?.logo && (
                    <div className="mt-2 flex items-center justify-center p-2 bg-dark-lighter rounded">
                      <img 
                        src={formData.branding.logo} 
                        alt="Logo Preview" 
                        style={{ width: `${formData.branding.logoSize || 40}px`, height: `${formData.branding.logoSize || 40}px` }}
                        className="object-contain"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-text-primary font-semibold mb-2">
                    Site Name Size: {formData.branding?.siteNameSize || '2rem'}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.125"
                    value={parseFloat(formData.branding?.siteNameSize || '2')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        branding: { ...(formData.branding || {}), siteNameSize: `${e.target.value}rem` },
                      })
                    }
                    className="w-full h-2 bg-dark-border rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-text-muted mt-1">
                    <span>1rem</span>
                    <span>5rem</span>
                  </div>
                  <div className="mt-2">
                    <label className="block text-text-secondary text-xs mb-1">Font Family</label>
                    <select
                      value={formData.branding?.siteNameFont || 'JetBrains Mono, Courier New, monospace'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          branding: { ...(formData.branding || {}), siteNameFont: e.target.value },
                        })
                      }
                      className="w-full bg-dark border border-dark-border rounded px-2 py-1 text-text-primary text-sm"
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 p-2 bg-dark-lighter rounded text-center">
                    <span 
                      className="text-text-primary font-bold"
                      style={{ 
                        fontSize: formData.branding?.siteNameSize || '2rem',
                        fontFamily: formData.branding?.siteNameFont || 'JetBrains Mono, Courier New, monospace'
                      }}
                    >
                      RHC Solutions
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-text-primary font-semibold mb-2">
                    Tagline Size: {formData.branding?.taglineSize || '0.875rem'}
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.125"
                    value={parseFloat(formData.branding?.taglineSize || '0.875')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        branding: { ...(formData.branding || {}), taglineSize: `${e.target.value}rem` },
                      })
                    }
                    className="w-full h-2 bg-dark-border rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-text-muted mt-1">
                    <span>0.5rem</span>
                    <span>2rem</span>
                  </div>
                  <div className="mt-2">
                    <label className="block text-text-secondary text-xs mb-1">Font Family</label>
                    <select
                      value={formData.branding?.taglineFont || 'JetBrains Mono, Courier New, monospace'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          branding: { ...(formData.branding || {}), taglineFont: e.target.value },
                        })
                      }
                      className="w-full bg-dark border border-dark-border rounded px-2 py-1 text-text-primary text-sm"
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 p-2 bg-dark-lighter rounded text-center">
                    <span 
                      className="text-accent"
                      style={{ 
                        fontSize: formData.branding?.taglineSize || '0.875rem',
                        fontFamily: formData.branding?.taglineFont || 'JetBrains Mono, Courier New, monospace'
                      }}
                    >
                      &gt; We Just Do IT
                    </span>
                  </div>
                </div>
              </div>

              {/* Menu & Footer Typography */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-dark-border">
                {/* Menu Font Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-cyber-cyan mb-4">Navigation Menu</h3>
                  <div>
                    <label className="block text-text-primary font-semibold mb-2">
                      Font Size: {formData.branding?.menuFontSize || '1rem'}
                    </label>
                    <input
                      type="range"
                      min="0.75"
                      max="1.5"
                      step="0.125"
                      value={parseFloat(formData.branding?.menuFontSize || '1')}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          branding: { ...(formData.branding || {}), menuFontSize: `${e.target.value}rem` },
                        })
                      }
                      className="w-full h-2 bg-dark-border rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-text-muted mt-1">
                      <span>0.75rem</span>
                      <span>1.5rem</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-text-secondary text-sm mb-2">Font Family</label>
                    <select
                      value={formData.branding?.menuFont || 'Inter, system-ui, sans-serif'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          branding: { ...(formData.branding || {}), menuFont: e.target.value },
                        })
                      }
                      className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary"
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="p-3 bg-dark-lighter rounded text-center">
                    <span 
                      className="text-text-primary"
                      style={{ 
                        fontSize: formData.branding?.menuFontSize || '1rem',
                        fontFamily: formData.branding?.menuFont || 'Inter, system-ui, sans-serif'
                      }}
                    >
                      Home • About • Services • Contact
                    </span>
                  </div>
                </div>

                {/* Footer Font Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-cyber-cyan mb-4">Footer</h3>
                  <div>
                    <label className="block text-text-primary font-semibold mb-2">
                      Font Size: {formData.branding?.footerFontSize || '0.875rem'}
                    </label>
                    <input
                      type="range"
                      min="0.75"
                      max="1.25"
                      step="0.125"
                      value={parseFloat(formData.branding?.footerFontSize || '0.875')}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          branding: { ...(formData.branding || {}), footerFontSize: `${e.target.value}rem` },
                        })
                      }
                      className="w-full h-2 bg-dark-border rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-text-muted mt-1">
                      <span>0.75rem</span>
                      <span>1.25rem</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-text-secondary text-sm mb-2">Font Family</label>
                    <select
                      value={formData.branding?.footerFont || 'Inter, system-ui, sans-serif'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          branding: { ...(formData.branding || {}), footerFont: e.target.value },
                        })
                      }
                      className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary"
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="p-3 bg-dark-lighter rounded text-center">
                    <span 
                      className="text-text-secondary"
                      style={{ 
                        fontSize: formData.branding?.footerFontSize || '0.875rem',
                        fontFamily: formData.branding?.footerFont || 'Inter, system-ui, sans-serif'
                      }}
                    >
                      Quick Links • Services • Contact Us
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Colors Section */}
            <div className="card-cyber p-6">
              <h2 className="heading-lg text-gradient mb-6 flex items-center gap-2">
                <FaPalette /> Colors
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(formData.colors).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-text-primary font-semibold mb-2 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={value}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            colors: { ...formData.colors, [key]: e.target.value },
                          })
                        }
                        className="w-16 h-12 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={value}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            colors: { ...formData.colors, [key]: e.target.value },
                          })
                        }
                        className="flex-1 bg-dark border-2 border-dark-border rounded-lg px-3 py-2 text-text-primary font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fonts Section */}
            <div className="card-cyber p-6">
              <h2 className="heading-lg text-gradient mb-6">Fonts</h2>
              <div className="space-y-4">
                {Object.entries(formData.fonts).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-text-primary font-semibold mb-2 capitalize">
                      {key} Font
                    </label>
                    <div className="flex flex-col gap-2">
                    <select
                      value={value}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fonts: { ...formData.fonts, [key]: e.target.value },
                        })
                      }
                      className="w-full bg-dark border-2 border-dark-border rounded-lg px-4 py-3 text-text-primary"
                    >
                      {FONT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value} style={{ fontFamily: option.value }}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary flex-1"
                        onClick={() => openFontPicker(key as keyof ThemeFonts)}
                      >
                        Browse Google Fonts
                      </button>
                    </div>
                    </div>
                    <p
                      className="text-text-secondary text-sm mt-2"
                      style={{ fontFamily: value }}
                    >
                      The quick brown fox jumps over the lazy dog.
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Size Scale */}
            <div className="card-cyber p-6">
              <h2 className="heading-lg text-gradient mb-6">Font Sizes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {formData.sizes &&
                  Object.entries(formData.sizes).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-text-primary font-semibold mb-2 uppercase">
                        {key}
                      </label>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={value}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              sizes: { ...formData.sizes, [key]: e.target.value } as ThemeSizes,
                            })
                          }
                          className="flex-1 bg-dark border-2 border-dark-border rounded-lg px-4 py-3 text-text-primary"
                          placeholder="e.g., 1rem"
                        />
                        <input
                          type="range"
                          min="0.5"
                          max="5"
                          step="0.1"
                          value={parseFloat(value) || 1}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              sizes: { ...formData.sizes, [key]: `${e.target.value}rem` } as ThemeSizes,
                            })
                          }
                          className="w-24"
                        />
                      </div>
                      <div
                        className="bg-dark border border-dark-border rounded-lg px-4 py-3 text-text-primary"
                        style={{ fontSize: value }}
                      >
                        {key === 'h1' && 'Heading 1 Sample'}
                        {key === 'h2' && 'Heading 2 Sample'}
                        {key === 'h3' && 'Heading 3 Sample'}
                        {key === 'body' && 'Body text sample: The quick brown fox jumps over the lazy dog.'}
                        {key === 'button' && <span className="inline-block px-4 py-2 bg-cyber-cyan/20 rounded">Button Sample</span>}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Other Settings */}
            <div className="card-cyber p-6">
              <h2 className="heading-lg text-gradient mb-6">Other Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-text-primary font-semibold mb-2">Border Radius</label>
                  <input
                    type="text"
                    value={formData.borderRadius}
                    onChange={(e) => setFormData({ ...formData, borderRadius: e.target.value })}
                    className="w-full bg-dark border-2 border-dark-border rounded-lg px-4 py-3 text-text-primary"
                    placeholder="e.g., 0.5rem"
                  />
                </div>

                <div>
                  <label className="block text-text-primary font-semibold mb-2">Shadow Intensity</label>
                  <select
                    value={formData.shadowIntensity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shadowIntensity: e.target.value as 'light' | 'medium' | 'heavy',
                      })
                    }
                    className="w-full bg-dark border-2 border-dark-border rounded-lg px-4 py-3 text-text-primary"
                  >
                    <option value="light">Light</option>
                    <option value="medium">Medium</option>
                    <option value="heavy">Heavy</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <FaSave />
              <span>{saving ? 'Saving...' : 'Save Theme'}</span>
            </button>
          </form>
        </div>

        {/* Preview Panel */}
        <div className="card-cyber p-6 h-fit sticky top-20">
          <h2 className="heading-lg text-gradient mb-6">Preview</h2>
          
          {/* Color Swatches */}
          <div className="mb-6">
            <p className="text-text-secondary text-sm mb-3">Color Palette</p>
            <div className="space-y-2">
              {Object.entries(formData.colors).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded border border-dark-border"
                    style={{ backgroundColor: value }}
                  />
                  <span className="text-text-secondary text-sm capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Typography Preview */}
          <div className="mb-6 border-t border-dark-border pt-6">
            <p className="text-text-secondary text-sm mb-3">Typography</p>
            <div className="space-y-3">
              <div style={{ fontFamily: formData.fonts.primary }}>
                <p className="text-text-muted text-xs">Primary Font</p>
                <p className="text-text-primary">The quick brown fox jumps</p>
              </div>
              <div style={{ fontFamily: formData.fonts.secondary }}>
                <p className="text-text-muted text-xs">Secondary Font</p>
                <p className="text-text-primary">The quick brown fox jumps</p>
              </div>
              <div style={{ fontFamily: formData.fonts.mono }}>
                <p className="text-text-muted text-xs">Mono Font</p>
                <p className="text-text-primary text-sm">const x = 42;</p>
              </div>
            </div>
          </div>

          {/* Sizes Preview */}
          {formData.sizes && (
            <div className="mb-6 border-t border-dark-border pt-6 space-y-2">
              <p className="text-text-secondary text-sm">Size Scale</p>
              <p style={{ fontSize: formData.sizes.h1, fontFamily: formData.fonts.primary }} className="text-text-primary">
                Heading 1
              </p>
              <p style={{ fontSize: formData.sizes.h2, fontFamily: formData.fonts.primary }} className="text-text-primary">
                Heading 2
              </p>
              <p style={{ fontSize: formData.sizes.h3, fontFamily: formData.fonts.secondary }} className="text-text-primary">
                Heading 3
              </p>
              <p style={{ fontSize: formData.sizes.body, fontFamily: formData.fonts.primary }} className="text-text-secondary">
                Body text preview
              </p>
              <button
                style={{ fontSize: formData.sizes.button, borderRadius: formData.borderRadius }}
                className="btn-primary mt-2"
                type="button"
              >
                Button Preview
              </button>
            </div>
          )}

          {/* Branding Preview */}
          <div className="mb-6 border-t border-dark-border pt-6 space-y-2">
            <p className="text-text-secondary text-sm">Branding</p>
            <div className="flex items-center gap-3">
              {formData.branding?.favicon && (
                <img src={formData.branding.favicon} alt="Favicon" className="w-8 h-8 rounded" />
              )}
              {formData.branding?.logo && (
                <img src={formData.branding.logo} alt={formData.branding.logoAlt || 'Logo'} className="h-10" />
              )}
            </div>
            <p className="text-text-muted text-xs">Alt: {formData.branding?.logoAlt || 'Not set'}</p>
          </div>

          {/* Toggles */}
          <div className="mb-6 border-t border-dark-border pt-6 space-y-1 text-text-secondary text-sm">
            <p>Dark mode: {formData.darkMode ? 'Enabled' : 'Disabled'}</p>
            <p>Animations: {formData.animations ? 'Enabled' : 'Disabled'}</p>
          </div>

          {/* Last Updated */}
          <div className="text-xs text-text-muted border-t border-dark-border pt-4">
            <p>Last updated: {new Date(formData.updatedAt).toLocaleString()}</p>
            {formData.updatedBy && <p>By: {formData.updatedBy}</p>}
          </div>
        </div>
      </div>

      {/* Media Picker Modal */}
      {pickerFor && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-cyber w-full max-w-5xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-dark-border px-4 py-3">
              <div>
                <p className="text-sm text-text-secondary">Select media for {pickerFor}</p>
                <p className="heading-md text-text-primary">Media Library</p>
              </div>
              <button className="text-text-secondary hover:text-cyber-red" onClick={() => setPickerFor(null)}>
                <FaTimes />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[65vh]">
              {mediaLoading ? (
                <p className="text-text-secondary">Loading media...</p>
              ) : media.length === 0 ? (
                <div className="text-text-secondary space-y-2">
                  <p>No media found.</p>
                  <a className="text-cyber-cyan underline" href="/admin/media" target="_blank" rel="noreferrer">
                    Open media library
                  </a>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {media
                    .filter((item) => item.type?.startsWith('image'))
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectMedia(item)}
                        className="group border border-dark-border rounded-lg overflow-hidden bg-dark-lighter hover:border-cyber-green focus:border-cyber-green focus:outline-none"
                      >
                        <div className="aspect-square w-full overflow-hidden">
                          <img src={item.url} alt={item.alt || item.filename} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-2 text-left">
                          <p className="text-text-primary text-sm truncate">{item.filename}</p>
                          <p className="text-text-muted text-xs truncate">{item.alt || 'No alt text'}</p>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Google Fonts Picker */}
      {fontPickerFor && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-cyber w-full max-w-5xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-dark-border px-4 py-3">
              <div>
                <p className="text-sm text-text-secondary">Select font for {fontPickerFor}</p>
                <p className="heading-md text-text-primary">Google Fonts</p>
              </div>
              <button className="text-text-secondary hover:text-cyber-red" onClick={() => setFontPickerFor(null)}>
                <FaTimes />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[65vh]">
              {!process.env.NEXT_PUBLIC_GOOGLE_FONTS_API_KEY && (
                <div className="text-cyber-red text-sm">
                  Add NEXT_PUBLIC_GOOGLE_FONTS_API_KEY to use Google Fonts search.
                </div>
              )}
              {fontError && <div className="text-cyber-red text-sm">{fontError}</div>}
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  value={fontSearch}
                  onChange={(e) => setFontSearch(e.target.value)}
                  placeholder="Search Google Fonts..."
                  className="flex-1 bg-dark border-2 border-dark-border rounded-lg px-4 py-3 text-text-primary"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => loadGoogleFonts(true)}
                  disabled={fontLoading}
                >
                  {fontLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {fontLoading ? (
                <p className="text-text-secondary">Loading fonts...</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {fontResults
                    .filter((item) =>
                      item.family.toLowerCase().includes(fontSearch.toLowerCase())
                    )
                    .slice(0, 150)
                    .map((item) => (
                      <button
                        key={item.family}
                        type="button"
                        onClick={() => applyFont(item.family)}
                        className="text-left border border-dark-border rounded-lg p-3 bg-dark hover:border-cyber-green"
                        style={{ fontFamily: `${item.family}, ${fontPickerFor === 'mono' ? 'monospace' : 'sans-serif'}` }}
                      >
                        <p className="text-text-primary font-semibold">{item.family}</p>
                        <p className="text-text-secondary text-sm">{item.category || 'Unknown category'}</p>
                        <p className="text-text-muted text-xs mt-1">The quick brown fox jumps over the lazy dog.</p>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
