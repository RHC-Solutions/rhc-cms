'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaLanguage, FaSpinner, FaSave, FaPlus, FaTrash } from 'react-icons/fa';

interface Locale {
  code: string;
  label: string;
  enabled: boolean;
}
interface I18nConfig {
  defaultLocale: string;
  locales: Locale[];
  autoTranslate: boolean;
}

export default function I18nPage() {
  const [config, setConfig] = useState<I18nConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // test translate
  const [testText, setTestText] = useState('');
  const [testTarget, setTestTarget] = useState('');
  const [testResult, setTestResult] = useState('');
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/cms/i18n', { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const data = await res.json();
      setConfig(data.config);
    } catch (e: any) {
      setError(e?.message || 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/cms/i18n', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (!testText.trim() || !testTarget.trim()) return;
    setTesting(true);
    setTestResult('');
    try {
      const res = await fetch('/api/cms/i18n/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: [testText], target: testTarget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTestResult(data.translations?.[0] || '');
    } catch (e: any) {
      setTestResult(`Error: ${e?.message || 'failed'}`);
    } finally {
      setTesting(false);
    }
  };

  const setLocale = (i: number, patch: Partial<Locale>) =>
    setConfig((c) => (c ? { ...c, locales: c.locales.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) } : c));

  const input = 'px-3 py-2 rounded-lg bg-dark border border-dark-border text-text-primary focus:border-cyber-green focus:outline-none';

  return (
    <AdminShell title="Languages">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FaLanguage className="text-2xl text-cyber-green" />
            <h2 className="text-2xl font-bold">Languages</h2>
          </div>
          <button onClick={save} disabled={saving || !config} className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-linear-to-r from-cyber-green to-cyber-cyan text-dark font-semibold disabled:opacity-50">
            {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
            <span>Save</span>
          </button>
        </div>

        {error && <div className="mb-4 px-4 py-3 rounded-lg bg-cyber-red/10 border border-cyber-red/40 text-cyber-red text-sm">{error}</div>}
        {saved && <div className="mb-4 px-4 py-3 rounded-lg bg-cyber-green/10 border border-cyber-green/40 text-cyber-green text-sm">Saved.</div>}

        {loading || !config ? (
          <div className="text-text-muted"><FaSpinner className="animate-spin inline mr-2" />Loading…</div>
        ) : (
          <div className="space-y-6">
            <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Default (source) language</label>
                  <select className={input + ' w-full'} value={config.defaultLocale} onChange={(e) => setConfig({ ...config, defaultLocale: e.target.value })}>
                    {config.locales.map((l) => <option key={l.code} value={l.code}>{l.label} ({l.code})</option>)}
                  </select>
                </div>
                <label className="flex items-center space-x-2 text-sm pb-2">
                  <input type="checkbox" checked={config.autoTranslate} onChange={(e) => setConfig({ ...config, autoTranslate: e.target.checked })} />
                  <span>Auto-translate on demand (calls the provider on cache miss)</span>
                </label>
              </div>
            </div>

            <div className="bg-dark-card border border-dark-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">Locales</span>
                <button onClick={() => setConfig({ ...config, locales: [...config.locales, { code: '', label: '', enabled: true }] })} className="text-cyber-cyan text-xs hover:text-cyber-green flex items-center space-x-1">
                  <FaPlus /> <span>Add locale</span>
                </button>
              </div>
              {config.locales.map((l, i) => (
                <div key={i} className="flex items-center space-x-2 mb-2">
                  <input className={input + ' w-24'} placeholder="code" value={l.code} onChange={(e) => setLocale(i, { code: e.target.value })} />
                  <input className={input + ' flex-1'} placeholder="label" value={l.label} onChange={(e) => setLocale(i, { label: e.target.value })} />
                  <label className="flex items-center space-x-1 text-xs text-text-secondary">
                    <input type="checkbox" checked={l.enabled} onChange={(e) => setLocale(i, { enabled: e.target.checked })} />
                    <span>enabled</span>
                  </label>
                  <button onClick={() => setConfig({ ...config, locales: config.locales.filter((_, idx) => idx !== i) })} className="text-cyber-red/80 hover:text-cyber-red" disabled={l.code === config.defaultLocale}><FaTrash /></button>
                </div>
              ))}
            </div>

            <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-3">
              <span className="font-medium">Test translation</span>
              <p className="text-text-muted text-xs">Requires a Google Translate API key in Integrations.</p>
              <div className="flex items-center space-x-2">
                <input className={input + ' flex-1'} placeholder="Text to translate" value={testText} onChange={(e) => setTestText(e.target.value)} />
                <input className={input + ' w-24'} placeholder="target" value={testTarget} onChange={(e) => setTestTarget(e.target.value)} />
                <button onClick={runTest} disabled={testing} className="px-4 py-2 rounded-lg bg-dark-lighter text-text-secondary hover:text-cyber-green disabled:opacity-50">
                  {testing ? <FaSpinner className="animate-spin" /> : 'Translate'}
                </button>
              </div>
              {testResult && <div className="px-3 py-2 rounded-lg bg-dark border border-dark-border text-text-primary text-sm">{testResult}</div>}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
