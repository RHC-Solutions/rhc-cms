'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { signOut } from 'next-auth/react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { useToast } from '@adminpanel/components/admin/Toast';
import { validatePassword } from '@adminpanel/lib/auth/password';
import { FaUser, FaKey, FaShieldAlt, FaSave, FaSpinner } from 'react-icons/fa';

interface Account {
  id: string;
  name: string;
  email: string;
  role: string;
  totpEnabled?: boolean;
}

export default function AccountPage() {
  const { addToast } = useToast();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  // profile
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // 2fa
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [mfaBusy, setMfaBusy] = useState(false);

  const load = async () => {
    try {
      const [acc, mfa] = await Promise.all([
        fetch('/api/cms/account', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/cms/mfa', { credentials: 'include' }).then((r) => r.json()),
      ]);
      setAccount(acc);
      setName(acc?.name || '');
      setEmail(acc?.email || '');
      setMfaEnabled(!!mfa?.enabled);
    } catch {
      addToast('error', 'Failed to load account');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reauth = async () => {
    addToast('info', 'Signing you out — please sign in again with your new credentials.');
    const base = process.env.NEXT_PUBLIC_SITE_URL || '';
    setTimeout(() => signOut({ callbackUrl: `${base}/admin/login` }), 1200);
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch('/api/cms/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      addToast('success', 'Profile updated');
      if (data.reauthRequired) await reauth();
      else setAccount((a) => (a ? { ...a, name, email } : a));
    } catch (e: any) {
      addToast('error', e?.message || 'Save failed');
    } finally {
      setSavingProfile(false);
    }
  };

  const pwCheck = newPassword ? validatePassword(newPassword) : null;
  const savePassword = async () => {
    if (newPassword !== confirmPassword) {
      addToast('error', 'New passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch('/api/cms/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password change failed');
      addToast('success', 'Password changed');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      if (data.reauthRequired) await reauth();
    } catch (e: any) {
      addToast('error', e?.message || 'Password change failed');
    } finally {
      setSavingPassword(false);
    }
  };

  const beginEnroll = async () => {
    setMfaBusy(true);
    try {
      const res = await fetch('/api/cms/mfa', { credentials: 'include' });
      const data = await res.json();
      if (data.enabled) { setMfaEnabled(true); return; }
      setSecret(data.secret || null);
      setQr(data.otpauthUrl ? await QRCode.toDataURL(data.otpauthUrl) : null);
      setEnrolling(true);
    } catch {
      addToast('error', 'Could not start 2FA setup');
    } finally {
      setMfaBusy(false);
    }
  };

  const confirmEnroll = async () => {
    setMfaBusy(true);
    try {
      const res = await fetch('/api/cms/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid code');
      setMfaEnabled(true);
      setEnrolling(false);
      setRecoveryCodes(data.recoveryCodes || []);
      setCode('');
      addToast('success', 'Two-factor authentication enabled');
    } catch (e: any) {
      addToast('error', e?.message || 'Invalid code');
    } finally {
      setMfaBusy(false);
    }
  };

  const disableMfa = async () => {
    if (!confirm('Disable two-factor authentication for your account?')) return;
    setMfaBusy(true);
    try {
      const res = await fetch('/api/cms/mfa', { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to disable 2FA');
      setMfaEnabled(false);
      setRecoveryCodes(null);
      addToast('success', 'Two-factor authentication disabled');
    } catch (e: any) {
      addToast('error', e?.message || 'Failed to disable 2FA');
    } finally {
      setMfaBusy(false);
    }
  };

  const inputCls = 'w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary focus:border-cyber-cyan focus:outline-none';

  return (
    <AdminShell title="Account">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="heading-md text-gradient">Your account</h1>
          <p className="text-text-secondary text-sm mt-1">
            {loading ? 'Loading…' : account ? <>Signed in as <span className="font-mono">{account.email}</span> · role <span className="font-mono">{account.role}</span></> : 'Could not load account'}
          </p>
        </div>

        {/* Profile */}
        <section className="card-cyber p-6">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4"><FaUser className="text-cyber-green" /> Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-text-primary font-semibold mb-2">Name</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-text-primary font-semibold mb-2">Email</label>
              <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <p className="text-text-muted text-xs mt-1">Changing your email signs you out — you&apos;ll sign in again with the new address.</p>
            </div>
            <button onClick={saveProfile} disabled={savingProfile || loading} className="inline-flex items-center gap-2 bg-cyber-green text-dark font-semibold px-4 py-2 rounded-lg hover:bg-cyber-green/90 disabled:opacity-60">
              {savingProfile ? <FaSpinner className="animate-spin" /> : <FaSave />} Save profile
            </button>
          </div>
        </section>

        {/* Password */}
        <section className="card-cyber p-6">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4"><FaKey className="text-cyber-green" /> Password</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-text-primary font-semibold mb-2">Current password</label>
              <input className={inputCls} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <label className="block text-text-primary font-semibold mb-2">New password</label>
              <input className={inputCls} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              {pwCheck && (
                <p className={`text-xs mt-1 ${pwCheck.valid ? 'text-cyber-green' : 'text-orange-400'}`}>
                  Strength: {pwCheck.strength}{pwCheck.errors[0] ? ` — ${pwCheck.errors[0]}` : ''}
                </p>
              )}
            </div>
            <div>
              <label className="block text-text-primary font-semibold mb-2">Confirm new password</label>
              <input className={inputCls} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button onClick={savePassword} disabled={savingPassword || !currentPassword || !newPassword || !(pwCheck?.valid)} className="inline-flex items-center gap-2 bg-cyber-green text-dark font-semibold px-4 py-2 rounded-lg hover:bg-cyber-green/90 disabled:opacity-60">
              {savingPassword ? <FaSpinner className="animate-spin" /> : <FaSave />} Change password
            </button>
            <p className="text-text-muted text-xs">Changing your password signs you out of this session.</p>
          </div>
        </section>

        {/* Two-Factor */}
        <section className="card-cyber p-6">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4"><FaShieldAlt className="text-cyber-green" /> Two-factor authentication</h2>
          {recoveryCodes ? (
            <div>
              <p className="text-cyber-green font-semibold mb-2">2FA enabled. Save these recovery codes somewhere safe:</p>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-dark border border-dark-border rounded-lg p-4">
                {recoveryCodes.map((c) => <span key={c}>{c}</span>)}
              </div>
            </div>
          ) : mfaEnabled ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-text-secondary text-sm">Two-factor authentication is <span className="text-cyber-green font-semibold">enabled</span> on your account.</p>
              <button onClick={disableMfa} disabled={mfaBusy} className="px-4 py-2 rounded-lg bg-dark-lighter text-text-secondary hover:text-cyber-red hover:bg-cyber-red/10 disabled:opacity-60">
                {mfaBusy ? <FaSpinner className="animate-spin" /> : 'Disable'}
              </button>
            </div>
          ) : enrolling ? (
            <div className="space-y-4">
              <p className="text-text-secondary text-sm">Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.</p>
              {qr && <img src={qr} alt="2FA QR code" className="w-44 h-44 bg-white p-2 rounded-lg" />}
              {secret && <p className="text-text-muted text-xs font-mono break-all">Manual key: {secret}</p>}
              <input className={`${inputCls} max-w-[200px] tracking-widest`} inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              <div className="flex gap-2">
                <button onClick={confirmEnroll} disabled={mfaBusy || code.length !== 6} className="inline-flex items-center gap-2 bg-cyber-green text-dark font-semibold px-4 py-2 rounded-lg hover:bg-cyber-green/90 disabled:opacity-60">
                  {mfaBusy ? <FaSpinner className="animate-spin" /> : 'Confirm & enable'}
                </button>
                <button onClick={() => setEnrolling(false)} className="px-4 py-2 rounded-lg text-text-secondary hover:text-text-primary">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-text-secondary text-sm">Add a second factor (authenticator app) for stronger account security.</p>
              <button onClick={beginEnroll} disabled={mfaBusy} className="inline-flex items-center gap-2 bg-cyber-green text-dark font-semibold px-4 py-2 rounded-lg hover:bg-cyber-green/90 disabled:opacity-60">
                {mfaBusy ? <FaSpinner className="animate-spin" /> : 'Enable 2FA'}
              </button>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
