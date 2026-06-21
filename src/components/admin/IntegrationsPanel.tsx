'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaEyeSlash,
  FaSave,
  FaLink,
  FaChevronDown,
  FaChevronRight,
  FaSpinner,
  FaFlask,
} from 'react-icons/fa';
import { INTEGRATIONS, type Integration, type IntegrationField } from '@adminpanel/lib/integrations';

type ValueMap = Record<string, string>;
type Message = { type: 'success' | 'error'; text: string };

interface TestCheck { name: string; ok: boolean; message: string; }
interface TestResult { ok: boolean; summary: string; checks: TestCheck[]; }

const INTEGRATIONS_WITHOUT_TESTS = new Set(['misc', 'cloudflare']);

export default function IntegrationsPanel() {
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<ValueMap>({});
  const [drafts, setDrafts] = useState<ValueMap>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, Message | null>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, TestResult | null>>({});

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/integrations/config', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setValues(data.values || {});
      setDrafts(data.values || {});
    } catch (err) {
      console.error('[Integrations] Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const toggleExpanded = (id: string) =>
    setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const toggleReveal = (envVar: string) =>
    setRevealed((p) => ({ ...p, [envVar]: !p[envVar] }));

  const handleDraftChange = (envVar: string, val: string) =>
    setDrafts((p) => ({ ...p, [envVar]: val }));

  const handleSave = async (integration: Integration) => {
    setSaving((p) => ({ ...p, [integration.id]: true }));
    setMessages((p) => ({ ...p, [integration.id]: null }));

    // Only send fields whose draft differs from the loaded value AND isn't
    // empty. Empty fields are skipped (the server does the same) so we don't
    // accidentally clear an unrelated secret.
    const updates: ValueMap = {};
    for (const field of integration.fields) {
      const draftVal = (drafts[field.envVar] ?? '').trim();
      if (draftVal === '') continue;
      if (draftVal === (values[field.envVar] ?? '')) continue;
      updates[field.envVar] = draftVal;
    }

    if (Object.keys(updates).length === 0) {
      setMessages((p) => ({
        ...p,
        [integration.id]: { type: 'success', text: 'No changes to save.' },
      }));
      setSaving((p) => ({ ...p, [integration.id]: false }));
      return;
    }

    try {
      const res = await fetch('/api/admin/integrations/config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: updates }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setValues((p) => ({ ...p, ...updates }));
        setMessages((p) => ({
          ...p,
          [integration.id]: { type: 'success', text: data.message || 'Saved.' },
        }));
      } else {
        setMessages((p) => ({
          ...p,
          [integration.id]: { type: 'error', text: data.error || 'Save failed' },
        }));
      }
    } catch (err: any) {
      setMessages((p) => ({
        ...p,
        [integration.id]: { type: 'error', text: err?.message || 'Network error' },
      }));
    } finally {
      setSaving((p) => ({ ...p, [integration.id]: false }));
    }
  };

  const handleTest = async (integration: Integration) => {
    setTesting((p) => ({ ...p, [integration.id]: true }));
    setTestResults((p) => ({ ...p, [integration.id]: null }));
    try {
      const res = await fetch('/api/admin/integrations/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId: integration.id }),
      });
      const data: TestResult = await res.json();
      setTestResults((p) => ({ ...p, [integration.id]: data }));
    } catch (err: any) {
      setTestResults((p) => ({
        ...p,
        [integration.id]: {
          ok: false,
          summary: err?.message || 'Network error',
          checks: [],
        },
      }));
    } finally {
      setTesting((p) => ({ ...p, [integration.id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        <FaSpinner className="animate-spin mr-3" /> Loading current values…
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="heading-xl text-gradient mb-2">Integrations</h1>
        <p className="text-text-secondary">
          Manage server-side credentials for third-party services. Saved values live in{' '}
          <code className="bg-dark-lighter px-1.5 py-0.5 rounded text-xs">cms-data/secrets.json</code>{' '}
          and take effect immediately — no <code>pm2 restart</code> required.
        </p>
      </div>

      <div className="space-y-4">
        {INTEGRATIONS.map((integration) => {
          const isOpen = expanded[integration.id] ?? false;
          const filled = integration.fields.filter((f) => (values[f.envVar] ?? '').trim() !== '').length;
          const total = integration.fields.length;
          const msg = messages[integration.id];

          return (
            <div key={integration.id} className="card-cyber overflow-hidden">
              <button
                type="button"
                onClick={() => toggleExpanded(integration.id)}
                className="w-full p-6 flex items-center gap-4 hover:bg-dark-lighter transition-colors text-left"
              >
                <div className="text-cyber-cyan text-2xl">
                  {isOpen ? <FaChevronDown /> : <FaChevronRight />}
                </div>
                <div className="flex-1">
                  <h2 className="heading-md text-text-primary">{integration.name}</h2>
                  <p className="text-text-muted text-sm mt-1">{integration.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded text-xs font-semibold ${
                      filled === total && total > 0
                        ? 'bg-green-500/20 text-green-400'
                        : filled === 0
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                  >
                    {filled} / {total} set
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="px-6 pb-6 pt-0 border-t border-dark-border">
                  {integration.dashboardLink && (
                    <a
                      href={integration.dashboardLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-cyber-cyan hover:text-cyber-green text-sm mt-4 mb-2"
                    >
                      <FaLink className="text-xs" /> Open provider dashboard
                    </a>
                  )}

                  <FieldGroup
                    fields={integration.fields}
                    drafts={drafts}
                    values={values}
                    revealed={revealed}
                    onChange={handleDraftChange}
                    onToggleReveal={toggleReveal}
                  />

                  {msg && (
                    <div
                      className={`mt-4 p-3 rounded text-sm ${
                        msg.type === 'success'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {msg.text}
                    </div>
                  )}

                  {testResults[integration.id] && (
                    <TestResultPanel result={testResults[integration.id]!} />
                  )}

                  <div className="mt-4 flex justify-end gap-2">
                    {!INTEGRATIONS_WITHOUT_TESTS.has(integration.id) && (
                      <button
                        type="button"
                        onClick={() => handleTest(integration)}
                        disabled={testing[integration.id] || saving[integration.id]}
                        title="Run a live test against the saved credentials"
                        className="flex items-center gap-2 px-4 py-2 rounded border border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {testing[integration.id] ? <FaSpinner className="animate-spin" /> : <FaFlask />}
                        {testing[integration.id] ? 'Testing…' : 'Test connection'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSave(integration)}
                      disabled={saving[integration.id]}
                      className="btn-primary flex items-center gap-2"
                    >
                      {saving[integration.id] ? <FaSpinner className="animate-spin" /> : <FaSave />}
                      {saving[integration.id] ? 'Saving…' : `Save ${integration.name}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function TestResultPanel({ result }: { result: TestResult }) {
  return (
    <div
      className={`mt-4 rounded border ${
        result.ok ? 'border-green-500/40 bg-green-500/5' : 'border-red-500/40 bg-red-500/5'
      }`}
    >
      <div
        className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold ${
          result.ok ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {result.ok ? <FaCheckCircle /> : <FaTimesCircle />}
        <span>{result.summary}</span>
      </div>
      {result.checks.length > 0 && (
        <ul className="px-3 pb-3 space-y-1 text-xs">
          {result.checks.map((c, i) => (
            <li
              key={i}
              className={`flex gap-2 ${c.ok ? 'text-text-secondary' : 'text-red-300'}`}
            >
              <span className="shrink-0">
                {c.ok ? (
                  <FaCheckCircle className="text-green-400" />
                ) : (
                  <FaTimesCircle className="text-red-400" />
                )}
              </span>
              <span className="font-mono text-text-muted">{c.name}:</span>
              <span className="flex-1 break-words">{c.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface FieldGroupProps {
  fields: IntegrationField[];
  drafts: ValueMap;
  values: ValueMap;
  revealed: Record<string, boolean>;
  onChange: (envVar: string, val: string) => void;
  onToggleReveal: (envVar: string) => void;
}

function FieldGroup({ fields, drafts, values, revealed, onChange, onToggleReveal }: FieldGroupProps) {
  // Cluster fields by `group` while preserving original order. Fields with no
  // group fall under an unnamed bucket rendered first if present.
  const groups: Array<{ name: string | null; fields: IntegrationField[] }> = [];
  for (const f of fields) {
    const groupName = f.group ?? null;
    let bucket = groups.find((g) => g.name === groupName);
    if (!bucket) {
      bucket = { name: groupName, fields: [] };
      groups.push(bucket);
    }
    bucket.fields.push(f);
  }

  return (
    <div className="space-y-6 mt-4">
      {groups.map((g, idx) => (
        <div key={idx}>
          {g.name && (
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
              {g.name}
            </h3>
          )}
          <div className="space-y-3">
            {g.fields.map((field) => {
              const isSecret = field.type === 'secret';
              const isLong = field.type === 'longtext';
              const isRevealed = revealed[field.envVar] ?? false;
              const draft = drafts[field.envVar] ?? '';
              const stored = (values[field.envVar] ?? '').trim() !== '';
              const inputType = isSecret && !isRevealed ? 'password' : 'text';

              return (
                <div key={field.envVar}>
                  <label className="flex items-center justify-between text-sm font-medium text-text-secondary mb-1.5">
                    <span>
                      {field.label}{' '}
                      <code className="text-xs text-text-muted">{field.envVar}</code>
                    </span>
                    {stored ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500/20 text-green-400 flex items-center gap-1">
                        <FaCheckCircle /> SET
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 flex items-center gap-1">
                        <FaTimesCircle /> EMPTY
                      </span>
                    )}
                  </label>

                  {isLong ? (
                    <textarea
                      value={draft}
                      onChange={(e) => onChange(field.envVar, e.target.value)}
                      placeholder={field.example || ''}
                      rows={6}
                      className="w-full px-3 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:border-cyber-cyan focus:outline-none font-mono text-xs"
                    />
                  ) : (
                    <div className="relative">
                      <input
                        type={inputType}
                        value={draft}
                        onChange={(e) => onChange(field.envVar, e.target.value)}
                        placeholder={field.example || ''}
                        className="w-full px-3 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:border-cyber-cyan focus:outline-none pr-10"
                      />
                      {isSecret && (
                        <button
                          type="button"
                          onClick={() => onToggleReveal(field.envVar)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-cyber-cyan"
                          aria-label={isRevealed ? 'Hide value' : 'Reveal value'}
                        >
                          {isRevealed ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      )}
                    </div>
                  )}

                  {field.description && (
                    <p className="text-text-muted text-xs mt-1">{field.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
