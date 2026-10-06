'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { FaCheckCircle } from 'react-icons/fa';
import AdminShell from '@adminpanel/components/admin/AdminShell';

interface MfaInitResponse {
  enabled: boolean;
  secret?: string;
  otpauthUrl?: string;
}

export default function MfaSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/cms/mfa', { credentials: 'include' });
        const data = (await res.json()) as MfaInitResponse;
        if (data.enabled) {
          setEnabled(true);
          setLoading(false);
          return;
        }
        if (data.secret && data.otpauthUrl) {
          setSecret(data.secret);
          setOtpauthUrl(data.otpauthUrl);
          const qr = await QRCode.toDataURL(data.otpauthUrl);
          setQrData(qr);
        }
      } catch (err) {
        setError('Failed to initialize MFA');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/cms/mfa', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Invalid code');
        return;
      }
      setEnabled(true);
      setRecoveryCodes(data.recoveryCodes || []);
    } catch (err) {
      setError('Verification failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    setError('');
    setDisabling(true);
    try {
      const res = await fetch('/api/cms/mfa', { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to disable MFA');
        return;
      }
      setEnabled(false);
      setRecoveryCodes(null);
      setCode('');
      // Reload to generate a fresh secret so the user can re-enroll
      const reload = await fetch('/api/cms/mfa', { credentials: 'include' });
      const init = (await reload.json()) as MfaInitResponse;
      setSecret(init.secret || null);
      setOtpauthUrl(init.otpauthUrl || null);
      setQrData(init.otpauthUrl ? await QRCode.toDataURL(init.otpauthUrl) : null);
    } catch {
      setError('Failed to disable MFA');
    } finally {
      setDisabling(false);
    }
  };

  const handleReset = async () => {
    setError('');
    setResetting(true);
    try {
      // Disable existing MFA first
      await handleDisable();
    } finally {
      setResetting(false);
    }
  };

  const handleContinue = async () => {
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://rhcsolutions.com';
    const callbackUrl = `${base}/admin/login`;
    await signOut({ callbackUrl });
  };

  return (
    <AdminShell title="MFA Setup">
      <div className="max-w-3xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="heading-xl">Two-factor authentication</h1>
            <p className="text-text-secondary text-sm mt-1">
              Required for admin access. Use Google Authenticator or any TOTP app.
            </p>
          </div>
        </div>

        <div className="card-cyber p-6">
          {loading && <p role="status" className="text-text-secondary">Loading MFA setup...</p>}

          {!loading && enabled && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-cyber-green/40 bg-cyber-green/10 p-4 text-sm text-text-primary">
                <FaCheckCircle className="mt-0.5 shrink-0 text-cyber-green" aria-hidden="true" />
                <span>
                  MFA is enabled. Keep these recovery codes safe. You must sign in again using your authenticator code.
                </span>
              </div>
              {recoveryCodes && (
                <div className="bg-dark border border-dark-border rounded-lg p-4">
                  <p className="text-text-secondary mb-2 text-sm">Recovery codes (store securely):</p>
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm text-text-primary">
                    {recoveryCodes.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {error && <p role="alert" className="text-cyber-red text-sm">{error}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn-primary" onClick={handleContinue}>
                  Sign out and re-login with MFA
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleReset}
                  disabled={resetting || disabling}
                >
                  {resetting ? 'Resetting...' : 'Reset / Reconfigure MFA'}
                </button>
                <button
                  type="button"
                  className="btn-danger sm:ml-auto"
                  onClick={handleDisable}
                  disabled={disabling || resetting}
                >
                  {disabling ? 'Disabling...' : 'Disable MFA'}
                </button>
              </div>
            </div>
          )}

          {!loading && !enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-dark-lighter border border-dark-border rounded-lg p-4">
                <h2 className="text-sm font-semibold text-text-primary mb-3">1. Scan the QR code</h2>
                {qrData ? (
                  <img src={qrData} alt="QR code for your authenticator app" className="w-48 h-48 rounded-md" />
                ) : (
                  <p className="text-sm text-text-secondary">Generating QR...</p>
                )}
                {secret && (
                  <>
                    <p className="text-xs text-text-muted mt-3">Can't scan? Enter this key manually:</p>
                    <code className="mt-1 block break-all select-all text-sm text-text-primary">{secret}</code>
                  </>
                )}
              </div>
              <div className="bg-dark-lighter border border-dark-border rounded-lg p-4">
                <h2 className="text-sm font-semibold text-text-primary mb-3">2. Enter the code</h2>
                <form className="space-y-3" onSubmit={handleVerify}>
                  <div>
                    <label htmlFor="mfa-code" className="block text-sm mb-1.5">
                      6-digit code from your app
                    </label>
                    <input
                      id="mfa-code"
                      type="text"
                      className="input-cyber"
                      placeholder="123456"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      required
                    />
                  </div>
                  {error && <p role="alert" className="text-cyber-red text-sm">{error}</p>}
                  <button className="btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
