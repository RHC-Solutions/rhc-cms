'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FaUser, FaLock, FaShieldAlt, FaCheckCircle, FaPalette, FaCog } from 'react-icons/fa';
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
    } catch (e: any) {
      setError(`Design pack failed: ${e.message}`);
    } finally {
      setApplyingPack(false);
    }
  };

  // Provisioning (configure) step state.
  const [provisioning, setProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<{ validation: any[]; dns: any[]; restartRequired: boolean } | null>(null);
  const [provision, setProvision] = useState({
    emailProvider: 'none' as 'none' | 'brevo' | 'smtp',
    brevoApiKey: '', brevoSenderEmail: '', brevoSenderName: '',
    smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '',
    cloudflareToken: '', cloudflareZoneId: '', cloudflareAccountId: '',
    dnsServerIp: '', dnsWww: true,
  });

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
      const res = await fetch('/api/cms/setup/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: { siteName: identity.siteName, contactEmail: identity.contactEmail, domain: identity.domain },
          secrets,
          cloudflare: { apiToken: provision.cloudflareToken, zoneId: provision.cloudflareZoneId, accountId: provision.cloudflareAccountId },
          dns: provision.dnsServerIp ? { serverIp: provision.dnsServerIp, www: provision.dnsWww, proxied: true } : undefined,
          validate: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setProvisionResult({ validation: data.validation || [], dns: data.dns || [], restartRequired: !!data.restartRequired });
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <div className="text-white text-xl">Checking setup status...</div>
      </div>
    );
  }

  return (
    <div className="transition-stage">
      <div className="transition-overlay" />
      <div className="min-h-screen flex items-center justify-center p-4 transition-container">
        <div className="bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full p-8 border border-gray-700 transition-card transition-delay-2">
        {/* Header */}
        <div className="text-center mb-8 transition-slide-up transition-delay-3">
          <Image
            src="/logo.png"
            alt="RHC Solutions"
            width={64}
            height={64}
            priority
            className="w-16 h-16 object-contain mx-auto mb-4"
          />
          <h1 className="heading-xl text-gradient mb-2">
            Welcome to Admin by RHC Solutions
          </h1>
          <p className="text-gray-400">
            {step === 1
              ? 'Apply a design pack to your new site'
              : step === 2
                ? 'Configure your site — domain & integrations'
                : step === 3
                  ? 'Let\'s set up your administrator account'
                  : 'Set up Two-Factor Authentication'}
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8 transition-slide-up transition-delay-4">
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
              <FaPalette />
            </div>
            <div className={`w-10 h-1 ${step >= 2 ? 'bg-blue-500' : 'bg-gray-700'}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
              <FaCog />
            </div>
            <div className={`w-10 h-1 ${step >= 3 ? 'bg-blue-500' : 'bg-gray-700'}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
              <FaUser />
            </div>
            <div className={`w-10 h-1 ${step >= 4 ? 'bg-blue-500' : 'bg-gray-700'}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= 4 ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
              <FaShieldAlt />
            </div>
          </div>
        </div>

        {/* Step 1: Design pack */}
        {step === 1 && (
          <div className="space-y-5 transition-slide-up transition-delay-5">
            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">{error}</div>
            )}
            <p className="text-gray-400 text-sm">
              If Claude Design produced a pack for this site, upload it here to apply the theme,
              starter pages, menu and footer. You can skip this and design later.
            </p>

            <div>
              <label className="block text-gray-300 font-semibold mb-2">Design pack (.zip)</label>
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => setPackFile(e.target.files?.[0] || null)}
                className="w-full text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-500 file:text-white hover:file:bg-blue-600 bg-gray-700 rounded-lg border border-gray-600 p-2"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={identity.siteName} onChange={(e) => setIdentity({ ...identity, siteName: e.target.value })}
                placeholder="Site name (e.g. Acme Inc)"
                className="bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
              <input value={identity.tagline} onChange={(e) => setIdentity({ ...identity, tagline: e.target.value })}
                placeholder="Tagline"
                className="bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
              <input value={identity.contactEmail} onChange={(e) => setIdentity({ ...identity, contactEmail: e.target.value })}
                placeholder="Contact email"
                className="bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
              <input value={identity.domain} onChange={(e) => setIdentity({ ...identity, domain: e.target.value })}
                placeholder="Domain (e.g. example.com)"
                className="bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
            </div>
            <p className="text-gray-500 text-xs">These fill {'{{siteName}}'}, {'{{tagline}}'}, {'{{contactEmail}}'} and {'{{domain}}'} placeholders in the pack.</p>

            {packResult && (
              <div className="bg-green-900 bg-opacity-30 border border-green-700 text-green-200 px-4 py-3 rounded flex items-center gap-2">
                <FaCheckCircle /> {packResult}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={applyDesignPack}
                disabled={!packFile || applyingPack}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
              >
                {applyingPack ? 'Applying…' : (<><FaPalette /> Apply design &amp; continue</>)}
              </button>
              <button
                onClick={() => { setError(''); setStep(2); }}
                disabled={applyingPack}
                className="bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-3 px-6 rounded-lg transition"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Configure (domain + integrations) */}
        {step === 2 && (
          <div className="space-y-5 transition-slide-up transition-delay-5">
            {error && <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">{error}</div>}
            <p className="text-gray-400 text-sm">
              Set your domain and connect the services you&apos;ll launch with. All optional — you can do this later in <span className="font-mono">/admin</span>. Domain changes require an application restart to reload startup configuration/environment variables.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={identity.siteName} onChange={(e) => setIdentity({ ...identity, siteName: e.target.value })}
                placeholder="Site name" className="bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
              <input value={identity.domain} onChange={(e) => setIdentity({ ...identity, domain: e.target.value })}
                placeholder="Primary domain (e.g. example.com)" className="bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
              <input value={identity.contactEmail} onChange={(e) => setIdentity({ ...identity, contactEmail: e.target.value })}
                placeholder="Contact email" className="sm:col-span-2 bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
            </div>

            <div className="border-t border-gray-700 pt-4">
              <label className="block text-gray-300 font-semibold mb-2 text-sm">Email delivery</label>
              <select value={provision.emailProvider} onChange={(e) => setProvision({ ...provision, emailProvider: e.target.value as any })}
                className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none">
                <option value="none">None for now</option>
                <option value="brevo">Brevo (API)</option>
                <option value="smtp">SMTP</option>
              </select>
              {provision.emailProvider === 'brevo' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <input value={provision.brevoApiKey} onChange={(e) => setProvision({ ...provision, brevoApiKey: e.target.value })} placeholder="Brevo API key" type="password" className="sm:col-span-2 bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
                  <input value={provision.brevoSenderEmail} onChange={(e) => setProvision({ ...provision, brevoSenderEmail: e.target.value })} placeholder="Sender email" className="bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
                  <input value={provision.brevoSenderName} onChange={(e) => setProvision({ ...provision, brevoSenderName: e.target.value })} placeholder="Sender name" className="bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
                </div>
              )}
              {provision.emailProvider === 'smtp' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <input value={provision.smtpHost} onChange={(e) => setProvision({ ...provision, smtpHost: e.target.value })} placeholder="SMTP host" className="bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
                  <input value={provision.smtpPort} onChange={(e) => setProvision({ ...provision, smtpPort: e.target.value })} placeholder="Port (587)" className="bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
                  <input value={provision.smtpUser} onChange={(e) => setProvision({ ...provision, smtpUser: e.target.value })} placeholder="Username" className="bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
                  <input value={provision.smtpPass} onChange={(e) => setProvision({ ...provision, smtpPass: e.target.value })} placeholder="Password" type="password" className="bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
                </div>
              )}
            </div>

            <div className="border-t border-gray-700 pt-4">
              <label className="block text-gray-300 font-semibold mb-2 text-sm">Cloudflare (optional)</label>
              <input value={provision.cloudflareToken} onChange={(e) => setProvision({ ...provision, cloudflareToken: e.target.value })} placeholder="API token" type="password" className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <input value={provision.cloudflareZoneId} onChange={(e) => setProvision({ ...provision, cloudflareZoneId: e.target.value })} placeholder="Zone ID" className="bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
                <input value={provision.cloudflareAccountId} onChange={(e) => setProvision({ ...provision, cloudflareAccountId: e.target.value })} placeholder="Account ID" className="bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
              </div>
              <div className="mt-3">
                <input value={provision.dnsServerIp} onChange={(e) => setProvision({ ...provision, dnsServerIp: e.target.value })} placeholder="Point DNS to server IP (optional, e.g. 203.0.113.10)" className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none" />
                <label className="mt-2 flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                  <input type="checkbox" checked={provision.dnsWww} onChange={(e) => setProvision({ ...provision, dnsWww: e.target.checked })} />
                  <span>Also create a <span className="font-mono">www</span> record. Requires the API token to have DNS edit permission on the zone.</span>
                </label>
              </div>
            </div>

            {provisionResult && (
              <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3 space-y-1 text-sm">
                {provisionResult.validation.length === 0 && provisionResult.dns.length === 0 && <div className="text-gray-300">Saved.</div>}
                {provisionResult.validation.map((v: { ok: boolean; service: string; message: string }, i: number) => (
                  <div key={`v${i}`} className={v.ok ? 'text-green-300' : 'text-yellow-300'}>
                    {v.ok ? '✓' : '⚠'} {v.service}: {v.message}
                  </div>
                ))}
                {provisionResult.dns.map((d: { ok: boolean; type: string; name: string; action?: string; message?: string }, i: number) => (
                  <div key={`d${i}`} className={d.ok ? 'text-green-300' : 'text-yellow-300'}>
                    {d.ok ? '✓' : '⚠'} DNS {d.type} {d.name}: {d.ok ? d.action : d.message}
                  </div>
                ))}
                {provisionResult.restartRequired && <div className="text-yellow-200 text-xs">⚠ Domain/Cloudflare changes apply after restarting the app.</div>}
              </div>
            )}

            <div className="flex gap-3">
              {/* Primary ALWAYS re-submits the latest values (so edits after a first
                  save aren't silently dropped); a separate Continue advances. */}
              <button onClick={submitProvision} disabled={provisioning}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2">
                {provisioning ? 'Saving…' : (<><FaCog /> {provisionResult ? 'Re-save & validate' : 'Save & validate'}</>)}
              </button>
              {provisionResult && (
                <button onClick={() => setStep(3)} disabled={provisioning}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center gap-2">
                  Continue <FaUser />
                </button>
              )}
              <button onClick={() => { setError(''); setStep(3); }} disabled={provisioning}
                className="bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-3 px-6 rounded-lg transition">
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Admin Account */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-6 transition-slide-up transition-delay-5">
            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label className="block text-gray-300 font-semibold mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 font-semibold mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none"
                placeholder="admin@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 font-semibold mb-2">
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none"
                placeholder="Minimum 8 characters"
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-gray-300 font-semibold mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none"
                placeholder="Re-enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
            >
              {submitting ? (
                'Creating Account...'
              ) : (
                <>
                  Continue <FaLock />
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 4: 2FA Setup */}
        {step === 4 && mfaData && (
          <div className="space-y-6 transition-slide-up transition-delay-5">
            <div className="bg-green-900 bg-opacity-30 border border-green-700 text-green-200 px-4 py-3 rounded flex items-center gap-2">
              <FaCheckCircle />
              <span>Admin account created successfully!</span>
            </div>

            <div className="text-center">
              <h3 className="text-xl font-semibold text-white mb-4">
                Scan this QR Code with your authenticator app
              </h3>
              <p className="text-gray-400 mb-6">
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

            <div className="bg-gray-700 p-4 rounded-lg">
              <p className="text-gray-300 text-sm mb-2">
                Can't scan? Enter this secret key manually:
              </p>
              <code className="text-blue-300 font-mono text-lg break-all">
                {mfaData.secret}
              </code>
            </div>

            <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 text-yellow-200 px-4 py-3 rounded text-sm">
              ⚠️ <strong>Important:</strong> Save this secret key in a safe
              place. You'll need your authenticator app to log in.
            </div>

            <button
              onClick={handleFinish}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
            >
              <FaCheckCircle />
              Complete Setup & Go to Login
            </button>
          </div>
        )}
        </div>
      </div>
      <style jsx>{`
        .transition-stage {
          position: relative;
          min-height: 100vh;
          background: radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.12), transparent 25%),
            radial-gradient(circle at 80% 0%, rgba(168, 85, 247, 0.12), transparent 30%),
            #0b1020;
          overflow: hidden;
        }

        .transition-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(17, 24, 39, 0.92), rgba(15, 23, 42, 0.92));
          z-index: 0;
          animation: transition-overlay 1s ease forwards;
          transform-origin: right;
        }

        .transition-container {
          position: relative;
          z-index: 1;
          animation: transition-expand 0.8s ease forwards;
          transform: translateX(1200px);
        }

        .transition-card {
          animation: transition-slide-up 0.8s ease forwards;
          transform: translateY(80px);
          opacity: 0;
        }

        .transition-slide-up {
          animation: transition-slide-up 0.8s ease forwards;
          transform: translateY(80px);
          opacity: 0;
        }

        .transition-delay-1 { animation-delay: 0.15s; }
        .transition-delay-2 { animation-delay: 0.25s; }
        .transition-delay-3 { animation-delay: 0.35s; }
        .transition-delay-4 { animation-delay: 0.45s; }
        .transition-delay-5 { animation-delay: 0.55s; }

        @keyframes transition-expand {
          from { transform: translateX(1200px); }
          to { transform: translateX(0); }
        }

        @keyframes transition-slide-up {
          from { transform: translateY(80px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes transition-overlay {
          from { transform: scaleX(1.1); opacity: 0; }
          to { transform: scaleX(1); opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .transition-container,
          .transition-card,
          .transition-slide-up,
          .transition-overlay {
            animation: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
