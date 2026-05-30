'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
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
      <div className="max-w-3xl mx-auto">
        <div className="card-cyber p-6">
          <h1 className="heading-xl text-gradient mb-2">Secure Your Account</h1>
          <p className="text-text-secondary mb-6">
            Set up two-factor authentication with Google Authenticator or any TOTP app. This is required for admin access.
          </p>

          {loading && <div className="text-text-secondary">Loading MFA setup...</div>}

          {!loading && enabled && (
            <div className="space-y-4">
              <div className="bg-dark-lighter border border-dark-border rounded p-4 text-text-primary">
                MFA is enabled. Keep these recovery codes safe. You must sign in again using your authenticator code.
              </div>
              {recoveryCodes && (
                <div className="bg-dark border border-dark-border rounded p-4">
                  <p className="text-text-secondary mb-2 text-sm">Recovery Codes (store securely):</p>
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm text-text-primary">
                    {recoveryCodes.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <button className="btn-primary" onClick={handleContinue}>
                  Sign out and re-login with MFA
                </button>
                <button
                  className="btn-secondary"
                  onClick={handleReset}
                  disabled={resetting || disabling}
                >
                  {resetting ? 'Resetting...' : 'Reset / Reconfigure MFA'}
                </button>
                <button
                  className="btn-danger"
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
              <div className="space-y-4">
                <div className="bg-dark-lighter border border-dark-border rounded p-4">
                  <p className="text-sm text-text-secondary mb-2">Step 1: Scan QR</p>
                  {qrData ? (
                    <img src={qrData} alt="MFA QR Code" className="w-48 h-48" />
                  ) : (
                    <div className="text-text-secondary">Generating QR...</div>
                  )}
                  {secret && (
                    <p className="text-xs text-text-muted mt-3">Secret: {secret}</p>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-dark-lighter border border-dark-border rounded p-4">
                  <p className="text-sm text-text-secondary mb-2">Step 2: Enter Code</p>
                  <form className="space-y-3" onSubmit={handleVerify}>
                    <input
                      className="input-cyber"
                      placeholder="123456"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                    />
                    {error && <p className="text-cyber-red text-sm">{error}</p>}
                    <button className="btn-primary" type="submit" disabled={saving}>
                      {saving ? 'Verifying...' : 'Verify & Enable'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
