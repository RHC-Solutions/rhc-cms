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
        <FaSpinner className="animate-spin mr-3" aria-hidden="true" /> Loading current values…
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <h2 className="heading-md">Integrations</h2>
        <p className="text-text-secondary text-sm mt-1">
          Manage server-side credentials for third-party services. Saved values are stored in the site database
          and take effect immediately — no <code>pm2 restart</code> required.
        </p>
      </div>

      <div className="rounded-lg border border-dark-border bg-dark-card divide-y divide-dark-border overflow-hidden">
        {INTEGRATIONS.map((integration) => {
          const isOpen = expanded[integration.id] ?? false;
          const filled = integration.fields.filter((f) => (values[f.envVar] ?? '').trim() !== '').length;
          const total = integration.fields.length;
          const msg = messages[integration.id];

          return (
            <div key={integration.id}>
              <button
                type="button"
                onClick={() => toggleExpanded(integration.id)}
                aria-expanded={isOpen}
                title={integration.description}
                className={`w-full px-4 py-2.5 flex items-center gap-3 hover:bg-dark-lighter transition-colors text-left ${
                  isOpen ? 'bg-dark-lighter' : ''
                }`}
              >
                <span className="text-cyber-cyan text-xs shrink-0" aria-hidden="true">
                  {isOpen ? <FaChevronDown /> : <FaChevronRight />}
                </span>
                <span className="min-w-0 truncate sm:shrink-0 text-sm font-semibold text-text-primary">{integration.name}</span>
                {!isOpen && (
                  <span className="hidden sm:block flex-1 min-w-0 truncate text-xs text-text-muted">
                    {integration.description}
                  </span>
                )}
                <span
                  className={`ml-auto shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold ${
                    filled === total && total > 0
                      ? 'bg-green-500/20 text-green-400'
                      : filled === 0
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {filled} / {total} set
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pt-3 pb-4 border-t border-dark-border">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-text-muted">
                    <p className="flex-1 min-w-[16rem]">{integration.description}</p>
                    {integration.dashboardLink && (
                      <a
                        href={integration.dashboardLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-cyber-cyan hover:text-cyber-green shrink-0"
                      >
                        <FaLink aria-hidden="true" /> Open provider dashboard
                      </a>
                    )}
                  </div>

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
                      className={`mt-3 px-3 py-2 rounded text-sm ${
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

                  <div className="mt-3 flex justify-end gap-2">
                    {!INTEGRATIONS_WITHOUT_TESTS.has(integration.id) && (
                      <button
                        type="button"
                        onClick={() => handleTest(integration)}
                        disabled={testing[integration.id] || saving[integration.id]}
                        title="Run a live test against the saved credentials"
                        className="btn-secondary px-3 py-1.5"
                      >
                        {testing[integration.id] ? <FaSpinner className="animate-spin" aria-hidden="true" /> : <FaFlask aria-hidden="true" />}
                        {testing[integration.id] ? 'Testing…' : 'Test connection'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSave(integration)}
                      disabled={saving[integration.id]}
                      className="btn-primary px-3 py-1.5"
                    >
                      {saving[integration.id] ? <FaSpinner className="animate-spin" aria-hidden="true" /> : <FaSave aria-hidden="true" />}
                      {saving[integration.id] ? 'Saving…' : 'Save'}
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
      className={`mt-3 rounded border ${
        result.ok ? 'border-green-500/40 bg-green-500/5' : 'border-red-500/40 bg-red-500/5'
      }`}
    >
      <div
        className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold ${
          result.ok ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {result.ok ? <FaCheckCircle className="shrink-0" aria-hidden="true" /> : <FaTimesCircle className="shrink-0" aria-hidden="true" />}
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
                  <FaCheckCircle className="text-green-400" aria-hidden="true" />
                ) : (
                  <FaTimesCircle className="text-red-400" aria-hidden="true" />
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
    <div className="space-y-4 mt-3">
      {groups.map((g, idx) => (
        <div key={idx}>
          {g.name && (
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
              {g.name}
            </h3>
          )}
          <div className="grid gap-x-4 gap-y-3 md:grid-cols-2 items-start">
            {g.fields.map((field) => {
              const isSecret = field.type === 'secret';
              const isLong = field.type === 'longtext';
              const isRevealed = revealed[field.envVar] ?? false;
              const draft = drafts[field.envVar] ?? '';
              const stored = (values[field.envVar] ?? '').trim() !== '';
              const inputType = isSecret && !isRevealed ? 'password' : 'text';
              const inputId = `integration-field-${field.envVar}`;

              return (
                <div key={field.envVar} className={isLong ? 'md:col-span-2' : undefined}>
                  <label htmlFor={inputId} className="flex items-center justify-between gap-2 text-xs font-medium text-text-secondary mb-1">
                    <span className="min-w-0 break-words">
                      {field.label}{' '}
                      <code className="text-xs text-text-muted">{field.envVar}</code>
                    </span>
                    {stored ? (
                      <span className="shrink-0 px-1.5 py-px rounded text-[10px] font-semibold bg-green-500/20 text-green-400 flex items-center gap-1">
                        <FaCheckCircle aria-hidden="true" /> SET
                      </span>
                    ) : (
                      <span className="shrink-0 px-1.5 py-px rounded text-[10px] font-semibold bg-red-500/20 text-red-400 flex items-center gap-1">
                        <FaTimesCircle aria-hidden="true" /> EMPTY
                      </span>
                    )}
                  </label>

                  {isLong ? (
                    <textarea
                      id={inputId}
                      value={draft}
                      onChange={(e) => onChange(field.envVar, e.target.value)}
                      placeholder={field.example || ''}
                      rows={4}
                      className="w-full px-2.5 py-1.5 bg-dark-lighter border border-dark-border rounded-md text-text-primary focus:border-cyber-cyan focus:outline-none font-mono text-xs"
                    />
                  ) : (
                    <div className="relative">
                      <input
                        id={inputId}
                        type={inputType}
                        value={draft}
                        onChange={(e) => onChange(field.envVar, e.target.value)}
                        placeholder={field.example || ''}
                        className="w-full px-2.5 py-1.5 text-sm bg-dark-lighter border border-dark-border rounded-md text-text-primary focus:border-cyber-cyan focus:outline-none pr-9"
                      />
                      {isSecret && (
                        <button
                          type="button"
                          onClick={() => onToggleReveal(field.envVar)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-cyber-cyan"
                          aria-label={isRevealed ? 'Hide value' : 'Reveal value'}
                        >
                          {isRevealed ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                        </button>
                      )}
                    </div>
                  )}

                  {field.description && (
                    <p className="text-text-muted text-xs mt-0.5">{field.description}</p>
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
