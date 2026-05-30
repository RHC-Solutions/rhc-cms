'use client';
import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { useToast } from '@/components/admin/Toast';
import { motion } from 'framer-motion';
import { FaFont, FaSave, FaPalette, FaRuler } from 'react-icons/fa';

interface TypographyData {
  fonts?: Record<string, string>;
  fontWeights?: Record<string, number>;
  colors?: Record<string, any>;
  headings?: Record<string, any>;
  body?: Record<string, any>;
  small?: Record<string, any>;
  sizes?: Record<string, string>;
  lineHeights?: Record<string, string>;
  letterSpacing?: Record<string, string>;
  updatedAt: string;
  updatedBy?: string;
}

export default function TypographyManagement() {
  const { addToast } = useToast();
  const [typography, setTypography] = useState<TypographyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<TypographyData | null>(null);
  const [activeTab, setActiveTab] = useState<'headings' | 'body' | 'fonts' | 'colors'>('headings');

  const fetchTypography = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/typography', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setTypography(data);
        setFormData(data);
      }
    } catch (error) {
      console.error('Failed to fetch typography:', error);
      addToast('error', 'Failed to load typography');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchTypography();
  }, [fetchTypography]);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData) return;

      setSaving(true);
      try {
        const res = await fetch('/api/cms/typography', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            updatedAt: new Date().toISOString(),
            updatedBy: 'admin',
          }),
        });

        if (res.ok) {
          const updated = await res.json();
          setTypography(updated);
          addToast('success', '✓ Typography saved successfully!');
        } else {
          addToast('error', 'Failed to save typography');
        }
      } catch (error) {
        console.error('Save failed:', error);
        addToast('error', 'Failed to save typography');
      } finally {
        setSaving(false);
      }
    },
    [formData, addToast]
  );

  const updateNested = useCallback((path: string[], value: any) => {
    if (!formData) return;
    const newData = { ...formData };
    let current = newData as any;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) current[path[i]] = {};
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    setFormData(newData);
  }, [formData]);

  if (loading || !formData) {
    return (
      <AdminShell title="Typography Management">
        <div className="text-center p-8 text-text-secondary">Loading typography...</div>
      </AdminShell>
    );
  }

  const headings = [
    { key: 'h1', label: 'Heading 1' },
    { key: 'h2', label: 'Heading 2' },
    { key: 'h3', label: 'Heading 3' },
    { key: 'h4', label: 'Heading 4' },
    { key: 'h5', label: 'Heading 5' },
    { key: 'h6', label: 'Heading 6' },
  ];

  const tabs = [
    { id: 'headings', label: 'Headings', icon: FaFont },
    { id: 'body', label: 'Body & Small', icon: FaRuler },
    { id: 'fonts', label: 'Fonts', icon: FaFont },
    { id: 'colors', label: 'Colors', icon: FaPalette },
  ];

  return (
    <AdminShell title="Typography Management">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="heading-xl text-gradient mb-2">Typography & Design System</h1>
          <p className="text-text-secondary">Manage fonts, sizes, colors, and text styles</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="card-cyber p-4 mb-6 flex gap-2 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
              activeTab === id
                ? 'bg-neon-green text-dark font-bold'
                : 'bg-dark-card text-text-secondary hover:bg-dark-lighter'
            }`}
          >
            <Icon className="text-sm" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Headings Tab */}
        {activeTab === 'headings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {headings.map(({ key, label }) => {
              const style = formData.headings?.[key];
              if (!style) return null;
              return (
                <div key={key} className="card-cyber p-6">
                  <h2 className="text-lg font-bold text-text-primary mb-4">{label}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="text-text-secondary text-sm font-medium block mb-2">Font Size</label>
                      <input
                        type="text"
                        value={style.fontSize || ''}
                        onChange={(e) => updateNested(['headings', key, 'fontSize'], e.target.value)}
                        className="w-full bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary"
                        placeholder="e.g., 48px"
                      />
                    </div>
                    <div>
                      <label className="text-text-secondary text-sm font-medium block mb-2">Line Height</label>
                      <input
                        type="text"
                        value={style.lineHeight || ''}
                        onChange={(e) => updateNested(['headings', key, 'lineHeight'], e.target.value)}
                        className="w-full bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary"
                        placeholder="e.g., 3rem"
                      />
                    </div>
                    <div>
                      <label className="text-text-secondary text-sm font-medium block mb-2">Font Weight</label>
                      <input
                        type="text"
                        value={style.fontWeight || ''}
                        onChange={(e) => updateNested(['headings', key, 'fontWeight'], e.target.value)}
                        className="w-full bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary"
                        placeholder="e.g., 700"
                      />
                    </div>
                    <div>
                      <label className="text-text-secondary text-sm font-medium block mb-2">Letter Spacing</label>
                      <input
                        type="text"
                        value={style.letterSpacing || ''}
                        onChange={(e) => updateNested(['headings', key, 'letterSpacing'], e.target.value)}
                        className="w-full bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary"
                        placeholder="e.g., -0.01em"
                      />
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-dark-lighter rounded border border-dark-border">
                    <p className="text-xs text-text-secondary mb-2">Preview:</p>
                    <div
                      style={{
                        fontSize: style.fontSize,
                        lineHeight: style.lineHeight,
                        fontWeight: style.fontWeight,
                        letterSpacing: style.letterSpacing,
                      }}
                      className="text-text-primary"
                    >
                      The quick brown fox
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Body & Small Tab */}
        {activeTab === 'body' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Body */}
            <div className="card-cyber p-6">
              <h2 className="text-lg font-bold text-text-primary mb-4">Body Text</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="text-text-secondary text-sm font-medium block mb-2">Font Size</label>
                  <input
                    type="text"
                    value={formData.body?.fontSize || ''}
                    onChange={(e) => updateNested(['body', 'fontSize'], e.target.value)}
                    className="w-full bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary"
                    placeholder="e.g., 16px"
                  />
                </div>
                <div>
                  <label className="text-text-secondary text-sm font-medium block mb-2">Line Height</label>
                  <input
                    type="text"
                    value={formData.body?.lineHeight || ''}
                    onChange={(e) => updateNested(['body', 'lineHeight'], e.target.value)}
                    className="w-full bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary"
                    placeholder="e.g., 1.6rem"
                  />
                </div>
                <div>
                  <label className="text-text-secondary text-sm font-medium block mb-2">Font Weight</label>
                  <input
                    type="text"
                    value={formData.body?.fontWeight || ''}
                    onChange={(e) => updateNested(['body', 'fontWeight'], e.target.value)}
                    className="w-full bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary"
                    placeholder="e.g., 400"
                  />
                </div>
                <div>
                  <label className="text-text-secondary text-sm font-medium block mb-2">Letter Spacing</label>
                  <input
                    type="text"
                    value={formData.body?.letterSpacing || ''}
                    onChange={(e) => updateNested(['body', 'letterSpacing'], e.target.value)}
                    className="w-full bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary"
                    placeholder="e.g., 0em"
                  />
                </div>
              </div>
              <div className="p-4 bg-dark-lighter rounded border border-dark-border">
                <p className="text-xs text-text-secondary mb-2">Preview:</p>
                <div
                  style={{
                    fontSize: formData.body?.fontSize,
                    lineHeight: formData.body?.lineHeight,
                    fontWeight: formData.body?.fontWeight,
                    letterSpacing: formData.body?.letterSpacing,
                  }}
                  className="text-text-primary"
                >
                  The quick brown fox jumps over the lazy dog. This is body text.
                </div>
              </div>
            </div>

            {/* Small */}
            <div className="card-cyber p-6">
              <h2 className="text-lg font-bold text-text-primary mb-4">Small Text</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="text-text-secondary text-sm font-medium block mb-2">Font Size</label>
                  <input
                    type="text"
                    value={formData.small?.fontSize || ''}
                    onChange={(e) => updateNested(['small', 'fontSize'], e.target.value)}
                    className="w-full bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary"
                    placeholder="e.g., 14px"
                  />
                </div>
                <div>
                  <label className="text-text-secondary text-sm font-medium block mb-2">Line Height</label>
                  <input
                    type="text"
                    value={formData.small?.lineHeight || ''}
                    onChange={(e) => updateNested(['small', 'lineHeight'], e.target.value)}
                    className="w-full bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary"
                    placeholder="e.g., 1.25rem"
                  />
                </div>
                <div>
                  <label className="text-text-secondary text-sm font-medium block mb-2">Font Weight</label>
                  <input
                    type="text"
                    value={formData.small?.fontWeight || ''}
                    onChange={(e) => updateNested(['small', 'fontWeight'], e.target.value)}
                    className="w-full bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary"
                    placeholder="e.g., 400"
                  />
                </div>
                <div>
                  <label className="text-text-secondary text-sm font-medium block mb-2">Letter Spacing</label>
                  <input
                    type="text"
                    value={formData.small?.letterSpacing || ''}
                    onChange={(e) => updateNested(['small', 'letterSpacing'], e.target.value)}
                    className="w-full bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary"
                    placeholder="e.g., 0em"
                  />
                </div>
              </div>
              <div className="p-4 bg-dark-lighter rounded border border-dark-border">
                <p className="text-xs text-text-secondary mb-2">Preview:</p>
                <div
                  style={{
                    fontSize: formData.small?.fontSize,
                    lineHeight: formData.small?.lineHeight,
                    fontWeight: formData.small?.fontWeight,
                    letterSpacing: formData.small?.letterSpacing,
                  }}
                  className="text-text-secondary"
                >
                  This is small text used for captions and labels.
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Fonts Tab */}
        {activeTab === 'fonts' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="card-cyber p-6">
              <h2 className="text-lg font-bold text-text-primary mb-4">Font Families</h2>
              {Object.entries(formData.fonts || {}).map(([key, value]) => (
                <div key={key} className="mb-4">
                  <label className="text-text-secondary text-sm font-medium block mb-2 capitalize">{key}</label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => updateNested(['fonts', key], e.target.value)}
                    className="w-full bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary"
                  />
                </div>
              ))}
            </div>

            <div className="card-cyber p-6">
              <h2 className="text-lg font-bold text-text-primary mb-4">Font Weights</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(formData.fontWeights || {}).map(([key, value]) => (
                  <div key={key}>
                    <label className="text-text-secondary text-sm font-medium block mb-2 capitalize">{key}</label>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => updateNested(['fontWeights', key], parseInt(e.target.value))}
                      className="w-full bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Colors Tab */}
        {activeTab === 'colors' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="card-cyber p-6">
              <h2 className="text-lg font-bold text-text-primary mb-4">Color Palette</h2>
              <div className="space-y-4">
                {Object.entries(formData.colors || {}).map(([key, value]) => {
                  if (typeof value === 'string') {
                    return (
                      <div key={key} className="flex items-center gap-4">
                        <label className="text-text-secondary text-sm font-medium capitalize w-32">{key}</label>
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="color"
                            value={value}
                            onChange={(e) => updateNested(['colors', key], e.target.value)}
                            className="w-16 h-10 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => updateNested(['colors', key], e.target.value)}
                            className="flex-1 bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary text-sm"
                          />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={key} className="border-t border-dark-border pt-4">
                      <p className="text-text-secondary text-sm font-medium capitalize mb-3">{key}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(value).map(([subKey, subValue]) => (
                          <div key={subKey} className="flex items-center gap-2">
                            <input
                              type="color"
                              value={subValue as string}
                              onChange={(e) => updateNested(['colors', key, subKey], e.target.value)}
                              className="w-12 h-8 rounded cursor-pointer"
                            />
                            <input
                              type="text"
                              value={subValue as string}
                              onChange={(e) => updateNested(['colors', key, subKey], e.target.value)}
                              className="flex-1 bg-dark border-2 border-dark-border rounded px-3 py-2 text-text-primary text-sm"
                              placeholder={subKey}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Save Button */}
        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          <FaSave />
          <span>{saving ? 'Saving...' : 'Save Typography Settings'}</span>
        </button>
      </form>

      <div className="text-xs text-text-muted mt-8 p-4 bg-dark-card rounded border border-dark-border">
        <p>Last updated: {new Date(formData.updatedAt).toLocaleString()}</p>
        {formData.updatedBy && <p>By: {formData.updatedBy}</p>}
      </div>
    </AdminShell>
  );
}
