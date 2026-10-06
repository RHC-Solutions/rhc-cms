'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FaUser, FaLock, FaCheckCircle, FaPalette, FaCog, FaInfoCircle, FaExclamationTriangle, FaExclamationCircle, FaSpinner, FaChevronDown } from 'react-icons/fa';
import { INTEGRATIONS } from '@adminpanel/lib/integrations';
import QRCode from 'qrcode';

// Wizard steps (all pre-login, while no admin exists yet): 1) apply a design pack,
// 2) configure (domain & integrations), 3) admin account, 4) MFA.
export default function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Design-pack step state.
  const [packFile, setPackFile] = useState<File | null>(null);
  const [applyingPack, setApplyingPack] = useState(false);
  const [packResult, setPackResult] = useState<string>('');
  const [identity, setIdentity] = useState({
    siteName: '',
    tagline: '',
    contactEmail: '',
    domain: '',
  });

  const applyDesignPack = async () => {
    if (!packFile) return;
    setError('');
    setApplyingPack(true);
    setPackResult('');
    try {
      const tokens = Object.fromEntries(
        Object.entries(identity).filter(([, v]) => v.trim() !== ''),
      );
      const body = new FormData();
      body.append('pack', packFile);
      body.append('tokens', JSON.stringify(tokens));
      const res = await fetch('/api/cms/design-pack/apply', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const p = data.applied?.pages;
      setPackResult(
        `Applied "${data.packName}" — ${p ? `${p.created + p.updated} page(s), ` : ''}theme & styles set.`,
      );
      // Prefill the account email from the contact email if given.
      if (identity.contactEmail) {
        setFormData((f) => (f.email ? f : { ...f, email: identity.contactEmail }));
      }
      setTimeout(() => setStep(2), 900);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      setError(`Design pack failed: ${error.message}`);
    } finally {
      setApplyingPack(false);
    }
  };

  // Provisioning (configure) step state.
  interface ValidationResult {
    ok: boolean;
    service: string;
    message: string;
  }

  interface DnsResult {
    ok: boolean;
    type: string;
    name: string;
    action?: string;
    message?: string;
  }

  interface ProvisionResult {
    validation: ValidationResult[];
    dns: DnsResult[];
    database?: { driver: string; ok: boolean; error?: string } | null;
    restartRequired: boolean;
  }

  const [provisioning, setProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<ProvisionResult | null>(null);
  const [provision, setProvision] = useState({
    emailProvider: 'none' as 'none' | 'brevo' | 'smtp',
    brevoApiKey: '', brevoSenderEmail: '', brevoSenderName: '',
    smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '',
    cloudflareToken: '', cloudflareZoneId: '', cloudflareAccountId: '',
    dnsServerIp: '', dnsWww: true,
    dbDriver: 'sqlite' as 'sqlite' | 'postgres', dbUrl: '',
  });

  // Optional extra integration credentials collected during setup (catalog-driven).
  // Merged into the provisioned secrets; provision allow-lists via MANAGED_SECRET_KEYS.
  const [extraSecrets, setExtraSecrets] = useState<Record<string, string>>({});
  const [openIntegration, setOpenIntegration] = useState<string | null>(null);

  const submitProvision = async () => {
    setError('');
    setProvisioning(true);
    setProvisionResult(null);
    try {
      const secrets: Record<string, string> = {};
      if (provision.emailProvider === 'brevo') {
        if (provision.brevoApiKey) secrets.BREVO_API_KEY = provision.brevoApiKey;
        if (provision.brevoSenderEmail) secrets.BREVO_SENDER_EMAIL = provision.brevoSenderEmail;
        if (provision.brevoSenderName) secrets.BREVO_SENDER_NAME = provision.brevoSenderName;
      } else if (provision.emailProvider === 'smtp') {
        if (provision.smtpHost) secrets.SMTP_HOST = provision.smtpHost;
        if (provision.smtpPort) secrets.SMTP_PORT = provision.smtpPort;
        if (provision.smtpUser) secrets.SMTP_USER = provision.smtpUser;
        if (provision.smtpPass) secrets.SMTP_PASS = provision.smtpPass;
        // Persist implicit-TLS flag so runtime send matches what was tested (465 -> secure).
        if (provision.smtpHost && provision.smtpPort) secrets.SMTP_SECURE = (provision.smtpPort === '465').toString();
      }
      // Merge any optional integration credentials entered in the accordion.
      for (const [k, v] of Object.entries(extraSecrets)) {
        if (v && v.trim()) secrets[k] = v.trim();
      }
      const res = await fetch('/api/cms/setup/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: { siteName: identity.siteName, contactEmail: identity.contactEmail, domain: identity.domain },
          secrets,
          cloudflare: { apiToken: provision.cloudflareToken, zoneId: provision.cloudflareZoneId, accountId: provision.cloudflareAccountId },
          dns: provision.dnsServerIp ? { serverIp: provision.dnsServerIp, www: provision.dnsWww, proxied: true } : undefined,
          database: { driver: provision.dbDriver, url: provision.dbUrl },
          validate: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setProvisionResult({ validation: data.validation || [], dns: data.dns || [], database: data.database || null, restartRequired: !!data.restartRequired });
    } catch (e: any) {
      setError(`Configuration failed: ${e.message}`);
    } finally {
      setProvisioning(false);
    }
  };

  const [mfaData, setMfaData] = useState<{
    secret: string;
    otpauthURL: string;
    qrCodeDataURL: string;
  } | null>(null);

  const checkSetupStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/cms/setup/check');
      const data = await response.json();

      if (!data.setupNeeded) {
        // Setup not needed, set cookie and redirect to admin login
        document.cookie = 'setup-complete=true; path=/; max-age=31536000'; // 1 year
        router.push('/admin/login');
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking setup status:', error);
      setLoading(false);
    }
  }, [router]);

  // Check if setup is needed
  useEffect(() => {
    checkSetupStatus();
  }, [checkSetupStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      setError('All fields are required');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/cms/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Generate QR code from otpauthURL
        const qrCodeDataURL = await QRCode.toDataURL(data.mfa.otpauthURL);

        setMfaData({
          secret: data.mfa.secret,
          otpauthURL: data.mfa.otpauthURL,
          qrCodeDataURL,
        });

        setStep(4);
      } else {
        setError(data.error || 'Failed to create admin user');
      }
    } catch (error) {
      console.error('Error completing setup:', error);
      setError('Failed to complete setup. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = () => {
    // Set cookie to mark setup as complete
    document.cookie = 'setup-complete=true; path=/; max-age=31536000'; // 1 year
    router.push('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p role="status" className="flex items-center gap-2 text-sm text-text-secondary">
          <FaSpinner className="animate-spin" aria-hidden="true" />
          Checking setup status...
        </p>
      </div>
    );
  }

  // Branding for the header — prefer the site name the operator just typed in
  // Step 1, fall back to the hostname they're visiting (e.g. "example.com"),
  // and finally a generic label. This is computed during render (no SSR mismatch
  // because the header only renders after `loading` flips to false on the client).
  const deploymentName =
    identity.siteName.trim() ||
    (typeof window !== 'undefined' ? window.location.hostname : '') ||
    'your new site';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <p className="mb-6 text-center text-[15px] font-bold tracking-[-0.01em] text-text-primary">
          <span className="text-[var(--adm-accent)]">RHC</span> CMS
        </p>

        <div className="card-cyber p-5 sm:p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-medium text-text-muted">Step {step} of 4</p>
            <div className="flex gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={`h-1 w-6 rounded-full ${step >= n ? 'bg-[var(--adm-accent)]' : 'bg-dark-border'}`} />
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-start gap-4">
            <Image
              src="/logo.png"
              alt={deploymentName}
              width={40}
              height={40}
              priority
              unoptimized
              className="h-10 w-10 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-text-primary break-words">
                Welcome to Admin by {deploymentName}
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                {step === 1
                  ? 'Apply a design pack to your new site'
                  : step === 2
                    ? 'Configure your site — domain & integrations'
                    : step === 3
                      ? 'Let\'s set up your administrator account'
                      : 'Set up Two-Factor Authentication'}
              </p>
            </div>
          </div>
        </div>

        {/* Step 1: Design pack */}
        {step === 1 && (
          <div className="space-y-5">
            {error && <ErrorAlert message={error} />}

            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-text-secondary space-y-2">
              <div className="flex items-center gap-2 font-semibold text-text-primary">
                <FaInfoCircle className="shrink-0 text-[var(--adm-info)]" aria-hidden="true" /> What is a design pack?
              </div>
              <p>
                A portable <span className="font-mono">.zip</span> that bundles your theme,
                starter pages, navigation menu and footer. Uploading one applies all of it
                in a single click &mdash; no copy/paste, no manual page-building.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>The identity fields below fill <span className="font-mono">{'{{siteName}}'}</span>, <span className="font-mono">{'{{tagline}}'}</span>, <span className="font-mono">{'{{contactEmail}}'}</span> and <span className="font-mono">{'{{domain}}'}</span> placeholders inside the pack &mdash; leave any blank to keep the pack&apos;s default.</li>
                <li>Packs only carry <em>design</em>. Secrets, users and the database are never imported.</li>
                <li>No pack yet? Click <strong>Skip</strong> &mdash; you can apply one later from <span className="font-mono">/admin/themes</span> or build pages by hand.</li>
              </ul>
            </div>

            <div>
              <label htmlFor="setup-pack-file" className="block text-sm font-medium mb-1.5">Design pack (.zip)</label>
              <input
                id="setup-pack-file"
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => setPackFile(e.target.files?.[0] || null)}
                className="input p-1.5 text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-cyber-green/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-cyber-green hover:file:bg-cyber-green/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="pack-site-name" className="block text-sm font-medium mb-1.5">Site name</label>
                <input id="pack-site-name" autoComplete="organization" value={identity.siteName} onChange={(e) => setIdentity({ ...identity, siteName: e.target.value })}
                  placeholder="Acme Inc"
                  className="input" />
              </div>
              <div>
                <label htmlFor="pack-tagline" className="block text-sm font-medium mb-1.5">Tagline</label>
                <input id="pack-tagline" autoComplete="off" value={identity.tagline} onChange={(e) => setIdentity({ ...identity, tagline: e.target.value })}
                  className="input" />
              </div>
              <div>
                <label htmlFor="pack-contact-email" className="block text-sm font-medium mb-1.5">Contact email</label>
                <input id="pack-contact-email" type="email" autoComplete="email" value={identity.contactEmail} onChange={(e) => setIdentity({ ...identity, contactEmail: e.target.value })}
                  className="input" />
              </div>
              <div>
                <label htmlFor="pack-domain" className="block text-sm font-medium mb-1.5">Domain</label>
                <input id="pack-domain" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} value={identity.domain} onChange={(e) => setIdentity({ ...identity, domain: e.target.value })}
                  placeholder="example.com"
                  className="input" />
              </div>
            </div>
            <p className="text-text-muted text-xs">These fill {'{{siteName}}'}, {'{{tagline}}'}, {'{{contactEmail}}'} and {'{{domain}}'} placeholders in the pack.</p>

            {packResult && (
              <div role="status" className="flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-text-primary">
                <FaCheckCircle className="mt-0.5 shrink-0 text-green-400" aria-hidden="true" />
                <span>{packResult}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={applyDesignPack}
                disabled={!packFile || applyingPack}
                className="btn-primary flex-1 py-2.5"
              >
                {applyingPack ? 'Applying…' : (<><FaPalette aria-hidden="true" /> Apply design &amp; continue</>)}
              </button>
              <button
                onClick={() => { setError(''); setStep(2); }}
                disabled={applyingPack}
                className="btn-secondary py-2.5"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Configure (domain + integrations) */}
        {step === 2 && (
          <div className="space-y-5">
            {error && <ErrorAlert message={error} />}

            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-text-secondary space-y-2">
              <div className="flex items-center gap-2 font-semibold text-text-primary">
                <FaInfoCircle className="shrink-0 text-[var(--adm-info)]" aria-hidden="true" /> Connect your services
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Domain</strong> &mdash; the public URL where the site is served (e.g.&nbsp;<span className="font-mono">example.com</span>). The admin URL (<span className="font-mono">NEXTAUTH_URL</span>) is set separately and is never overwritten by this step.</li>
                <li><strong>Email delivery</strong> &mdash; powers the contact form, password resets and admin notifications. Pick <strong>Brevo</strong> (HTTP API, simplest) or <strong>SMTP</strong>. Skip if you don&apos;t need email yet.</li>
                <li><strong>Cloudflare</strong> &mdash; optional. With an API token + zone ID the wizard validates access; add a server IP and it can also create the <span className="font-mono">A</span> (and optionally <span className="font-mono">www</span>) DNS records automatically.</li>
              </ul>
              <p className="text-xs pt-1">
                Every field is optional &mdash; you can configure or change any of this later under <span className="font-mono">/admin/settings</span>. <strong>Domain and Cloudflare settings are stored in the site database</strong> and take effect after the next build and restart (e.g.&nbsp;<span className="font-mono">pm2 reload</span>).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cfg-site-name" className="block text-sm font-medium mb-1.5">Site name</label>
                <input id="cfg-site-name" autoComplete="organization" value={identity.siteName} onChange={(e) => setIdentity({ ...identity, siteName: e.target.value })}
                  className="input" />
              </div>
              <div>
                <label htmlFor="cfg-domain" className="block text-sm font-medium mb-1.5">Primary domain</label>
                <input id="cfg-domain" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} value={identity.domain} onChange={(e) => setIdentity({ ...identity, domain: e.target.value })}
                  placeholder="example.com" className="input" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="cfg-contact-email" className="block text-sm font-medium mb-1.5">Contact email</label>
                <input id="cfg-contact-email" type="email" autoComplete="email" value={identity.contactEmail} onChange={(e) => setIdentity({ ...identity, contactEmail: e.target.value })}
                  className="input" />
              </div>
            </div>

            <div className="border-t border-dark-border pt-4">
              <label htmlFor="setup-email-provider" className="block text-sm font-semibold text-text-primary mb-2">Email delivery</label>
              <select id="setup-email-provider" value={provision.emailProvider} onChange={(e) => setProvision({ ...provision, emailProvider: e.target.value as any })}
                className="input">
                <option value="none">None for now</option>
                <option value="brevo">Brevo (API)</option>
                <option value="smtp">SMTP</option>
              </select>
              {provision.emailProvider === 'brevo' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  <div className="sm:col-span-2">
                    <label htmlFor="setup-brevo-key" className="block text-sm font-medium mb-1.5">Brevo API key</label>
                    <input id="setup-brevo-key" value={provision.brevoApiKey} onChange={(e) => setProvision({ ...provision, brevoApiKey: e.target.value })} type="password" autoComplete="off" className="input" />
                  </div>
                  <div>
                    <label htmlFor="setup-brevo-sender-email" className="block text-sm font-medium mb-1.5">Sender email</label>
                    <input id="setup-brevo-sender-email" value={provision.brevoSenderEmail} onChange={(e) => setProvision({ ...provision, brevoSenderEmail: e.target.value })} type="email" autoComplete="off" className="input" />
                  </div>
                  <div>
                    <label htmlFor="setup-brevo-sender-name" className="block text-sm font-medium mb-1.5">Sender name</label>
                    <input id="setup-brevo-sender-name" value={provision.brevoSenderName} onChange={(e) => setProvision({ ...provision, brevoSenderName: e.target.value })} autoComplete="off" className="input" />
                  </div>
                </div>
              )}
              {provision.emailProvider === 'smtp' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  <div>
                    <label htmlFor="setup-smtp-host" className="block text-sm font-medium mb-1.5">SMTP host</label>
                    <input id="setup-smtp-host" value={provision.smtpHost} onChange={(e) => setProvision({ ...provision, smtpHost: e.target.value })} placeholder="smtp.example.com" autoComplete="off" autoCapitalize="none" spellCheck={false} className="input" />
                  </div>
                  <div>
                    <label htmlFor="setup-smtp-port" className="block text-sm font-medium mb-1.5">Port</label>
                    <input id="setup-smtp-port" value={provision.smtpPort} onChange={(e) => setProvision({ ...provision, smtpPort: e.target.value })} placeholder="587" inputMode="numeric" autoComplete="off" className="input" />
                  </div>
                  <div>
                    <label htmlFor="setup-smtp-user" className="block text-sm font-medium mb-1.5">Username</label>
                    <input id="setup-smtp-user" value={provision.smtpUser} onChange={(e) => setProvision({ ...provision, smtpUser: e.target.value })} autoComplete="off" autoCapitalize="none" spellCheck={false} className="input" />
                  </div>
                  <div>
                    <label htmlFor="setup-smtp-pass" className="block text-sm font-medium mb-1.5">Password</label>
                    <input id="setup-smtp-pass" value={provision.smtpPass} onChange={(e) => setProvision({ ...provision, smtpPass: e.target.value })} type="password" autoComplete="off" className="input" />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-dark-border pt-4">
              <label htmlFor="setup-db-driver" className="block text-sm font-semibold text-text-primary mb-1">Database</label>
              <p id="setup-db-hint" className="text-xs text-text-muted mb-2">SQLite is zero-config and recommended for most sites. Choose PostgreSQL for multi-instance or larger deployments — the connection is tested before it&apos;s saved.</p>
              <select id="setup-db-driver" aria-describedby="setup-db-hint" value={provision.dbDriver} onChange={(e) => setProvision({ ...provision, dbDriver: e.target.value as 'sqlite' | 'postgres' })} className="input">
                <option value="sqlite">SQLite (file-based, zero-config)</option>
                <option value="postgres">PostgreSQL (DATABASE_URL)</option>
              </select>
              {provision.dbDriver === 'postgres' && (
                <div className="mt-3">
                  <label htmlFor="setup-db-url" className="block text-sm font-medium mb-1.5">Connection URL</label>
                  <input id="setup-db-url" value={provision.dbUrl} onChange={(e) => setProvision({ ...provision, dbUrl: e.target.value })} placeholder="postgres://user:pass@host:5432/dbname" autoComplete="off" autoCapitalize="none" spellCheck={false} className="input" />
                </div>
              )}
            </div>

            <div className="border-t border-dark-border pt-4">
              <h2 className="text-sm font-semibold text-text-primary mb-2">Cloudflare (optional)</h2>
              <div>
                <label htmlFor="setup-cf-token" className="block text-sm font-medium mb-1.5">API token</label>
                <input id="setup-cf-token" value={provision.cloudflareToken} onChange={(e) => setProvision({ ...provision, cloudflareToken: e.target.value })} type="password" autoComplete="off" className="input" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <div>
                  <label htmlFor="setup-cf-zone" className="block text-sm font-medium mb-1.5">Zone ID</label>
                  <input id="setup-cf-zone" value={provision.cloudflareZoneId} onChange={(e) => setProvision({ ...provision, cloudflareZoneId: e.target.value })} autoComplete="off" spellCheck={false} className="input" />
                </div>
                <div>
                  <label htmlFor="setup-cf-account" className="block text-sm font-medium mb-1.5">Account ID</label>
                  <input id="setup-cf-account" value={provision.cloudflareAccountId} onChange={(e) => setProvision({ ...provision, cloudflareAccountId: e.target.value })} autoComplete="off" spellCheck={false} className="input" />
                </div>
              </div>
              <div className="mt-3">
                <label htmlFor="setup-dns-ip" className="block text-sm font-medium mb-1.5">Point DNS to server IP (optional)</label>
                <input id="setup-dns-ip" value={provision.dnsServerIp} onChange={(e) => setProvision({ ...provision, dnsServerIp: e.target.value })} placeholder="203.0.113.10" autoComplete="off" spellCheck={false} className="input" />
                <label className="mt-2 flex items-start gap-2 text-sm text-text-secondary cursor-pointer">
                  <input type="checkbox" className="mt-1 shrink-0" checked={provision.dnsWww} onChange={(e) => setProvision({ ...provision, dnsWww: e.target.checked })} />
                  <span>Also create a <span className="font-mono">www</span> record. Requires the API token to have DNS edit permission on the zone.</span>
                </label>
              </div>
            </div>

            {/* Optional: connect any other integration now. Same catalog as
                Settings → Integrations; provision saves the values to the site database. */}
            <div className="border-t border-dark-border pt-4">
              <h2 className="text-sm font-semibold text-text-primary mb-1">More integrations (optional)</h2>
              <p className="text-xs text-text-muted mb-3">Telegram, Stripe, reCAPTCHA, analytics and more — add any now, or later in Settings → Integrations.</p>
              <div className="space-y-2">
                {INTEGRATIONS.filter((i) => !['brevo', 'smtp', 'cloudflare', 'misc'].includes(i.id)).map((i) => {
                  const set = i.fields.filter((f) => (extraSecrets[f.envVar] || '').trim()).length;
                  return (
                    <div key={i.id} className="rounded-lg border border-dark-border overflow-hidden">
                      <button type="button" onClick={() => setOpenIntegration(openIntegration === i.id ? null : i.id)}
                        aria-expanded={openIntegration === i.id}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-text-primary hover:bg-dark-lighter transition-colors">
                        <span>{i.name}</span>
                        <span className="flex items-center gap-2 text-xs text-text-muted">
                          {set}/{i.fields.length}
                          <FaChevronDown className={`transition-transform ${openIntegration === i.id ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </span>
                      </button>
                      {openIntegration === i.id && (
                        <div className="px-3 pb-3 pt-1 space-y-3">
                          {i.fields.map((f) => (
                            <div key={f.envVar}>
                              <label htmlFor={`int-${f.envVar}`} className="block text-sm font-medium mb-1.5">{f.label}</label>
                              {f.type === 'longtext' ? (
                                <textarea id={`int-${f.envVar}`} rows={4} value={extraSecrets[f.envVar] || ''}
                                  onChange={(e) => setExtraSecrets((p) => ({ ...p, [f.envVar]: e.target.value }))}
                                  autoComplete="off" spellCheck={false}
                                  className="input text-xs font-mono" />
                              ) : (
                                <input id={`int-${f.envVar}`} type={f.type === 'secret' ? 'password' : 'text'} value={extraSecrets[f.envVar] || ''}
                                  onChange={(e) => setExtraSecrets((p) => ({ ...p, [f.envVar]: e.target.value }))}
                                  placeholder={f.example ? `e.g. ${f.example}` : undefined}
                                  autoComplete="off" spellCheck={false}
                                  className="input" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {provisionResult && (
              <div role="status" className="rounded-lg border border-dark-border bg-dark-lighter p-4 space-y-1.5 text-sm text-text-primary">
                {provisionResult.validation.length === 0 && provisionResult.dns.length === 0 && <div className="text-text-secondary">Saved.</div>}
                {provisionResult.validation.map((v, i) => (
                  <div key={`v${i}`} className="flex items-start gap-2">
                    <StatusIcon ok={v.ok} />
                    <span>{v.service}: {v.message}</span>
                  </div>
                ))}
                {provisionResult.dns.map((d, i) => (
                  <div key={`d${i}`} className="flex items-start gap-2">
                    <StatusIcon ok={d.ok} />
                    <span>DNS {d.type} {d.name}: {d.ok ? d.action : d.message}</span>
                  </div>
                ))}
                {provisionResult.database && (
                  <div className="flex items-start gap-2">
                    <StatusIcon ok={provisionResult.database.ok} />
                    <span>Database ({provisionResult.database.driver}){provisionResult.database.ok ? ' configured' : `: ${provisionResult.database.error}`}</span>
                  </div>
                )}
                {provisionResult.restartRequired && (
                  <div className="flex items-start gap-2 pt-1 text-xs text-text-secondary">
                    <FaExclamationTriangle className="mt-0.5 shrink-0 text-yellow-400" aria-hidden="true" />
                    <span>Domain/Cloudflare/database changes apply after restarting the app.</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              {/* Primary ALWAYS re-submits the latest values (so edits after a first
                  save aren't silently dropped); a separate Continue advances. */}
              <button onClick={submitProvision} disabled={provisioning}
                className={`${provisionResult ? 'btn-secondary' : 'btn-primary'} flex-1 py-2.5`}>
                {provisioning ? 'Saving…' : (<><FaCog aria-hidden="true" /> {provisionResult ? 'Re-save & validate' : 'Save & validate'}</>)}
              </button>
              {provisionResult && (
                <button onClick={() => setStep(3)} disabled={provisioning}
                  className="btn-primary py-2.5 px-6">
                  Continue <FaUser aria-hidden="true" />
                </button>
              )}
              <button onClick={() => { setError(''); setStep(3); }} disabled={provisioning}
                className="btn-secondary py-2.5">
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Admin Account */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <ErrorAlert message={error} />}

            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-text-secondary space-y-2">
              <div className="flex items-center gap-2 font-semibold text-text-primary">
                <FaInfoCircle className="shrink-0 text-[var(--adm-info)]" aria-hidden="true" /> Create the first admin
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li>This becomes the <strong>only</strong> way back into the admin until you create more accounts from <span className="font-mono">/admin/users</span>.</li>
                <li>Use a real, reachable email &mdash; it&apos;s also your login and where password-reset mail is sent.</li>
                <li>Password must be <strong>at least 8 characters</strong>; a long, unique passphrase is strongly recommended. You&apos;ll add a 2FA code on the next step.</li>
              </ul>
            </div>

            <div>
              <label htmlFor="setup-admin-name" className="block text-sm font-medium mb-1.5">
                Full name
              </label>
              <input
                id="setup-admin-name"
                type="text"
                autoComplete="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="input py-2.5"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label htmlFor="setup-admin-email" className="block text-sm font-medium mb-1.5">
                Email address
              </label>
              <input
                id="setup-admin-email"
                type="email"
                autoComplete="username"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="input py-2.5"
                placeholder="admin@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="setup-admin-password" className="block text-sm font-medium mb-1.5">
                Password
              </label>
              <input
                id="setup-admin-password"
                type="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="input py-2.5"
                placeholder="Minimum 8 characters"
                required
                minLength={8}
              />
            </div>

            <div>
              <label htmlFor="setup-admin-confirm" className="block text-sm font-medium mb-1.5">
                Confirm password
              </label>
              <input
                id="setup-admin-confirm"
                type="password"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                className="input py-2.5"
                placeholder="Re-enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-2.5"
            >
              {submitting ? (
                'Creating Account...'
              ) : (
                <>
                  Continue <FaLock aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 4: 2FA Setup */}
        {step === 4 && mfaData && (
          <div className="space-y-5">
            <div role="status" className="flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-text-primary">
              <FaCheckCircle className="mt-0.5 shrink-0 text-green-400" aria-hidden="true" />
              <span>Admin account created successfully!</span>
            </div>

            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-text-secondary space-y-2">
              <div className="flex items-center gap-2 font-semibold text-text-primary">
                <FaInfoCircle className="shrink-0 text-[var(--adm-info)]" aria-hidden="true" /> Two-factor authentication is required
              </div>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Open Google Authenticator, Authy, 1Password or any TOTP app.</li>
                <li>Scan the QR code below (or paste the secret key manually).</li>
                <li>After clicking <strong>Complete Setup</strong>, sign in with your email/password &mdash; you&apos;ll be prompted for a 6-digit code from this same authenticator entry to finish enabling 2FA. <em>You won&apos;t need to scan a second QR.</em></li>
              </ol>
            </div>

            <div className="text-center">
              <h2 className="text-base font-semibold text-text-primary mb-1">
                Scan this QR Code with your authenticator app
              </h2>
              <p className="text-sm text-text-secondary mb-4">
                Use Google Authenticator, Authy, or any TOTP-compatible app
              </p>

              <div className="bg-white p-4 rounded-lg inline-block">
                <img
                  src={mfaData.qrCodeDataURL}
                  alt="2FA QR Code"
                  className="w-64 h-64"
                />
              </div>
            </div>

            <div className="rounded-lg border border-dark-border bg-dark-lighter p-4">
              <p className="text-text-secondary text-sm mb-2">
                Can't scan? Enter this secret key manually:
              </p>
              <code className="block text-[var(--adm-info)] font-mono text-base break-all select-all">
                {mfaData.secret}
              </code>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-text-secondary">
              <FaExclamationTriangle className="mt-0.5 shrink-0 text-yellow-400" aria-hidden="true" />
              <p>
                <strong className="text-text-primary">Important:</strong> Save this secret key in a password
                manager (1Password, Bitwarden, etc.). If you lose access to your
                authenticator app and don&apos;t have the secret saved, you&apos;ll be
                locked out and need server access to reset MFA.
              </p>
            </div>

            <button
              onClick={handleFinish}
              className="btn-primary w-full py-2.5"
            >
              <FaCheckCircle aria-hidden="true" />
              Complete Setup & Go to Login
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

// Status glyph for a provisioning result line; the text beside it carries the meaning.
function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <FaCheckCircle className="mt-0.5 shrink-0 text-green-400" aria-hidden="true" />
  ) : (
    <FaExclamationTriangle className="mt-0.5 shrink-0 text-yellow-400" aria-hidden="true" />
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
      <FaExclamationCircle className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
