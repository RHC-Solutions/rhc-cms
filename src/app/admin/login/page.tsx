'use client';

import { Suspense, useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaSpinner, FaExclamationCircle, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Default to a safe post-login page to avoid loops
  const callbackUrl = searchParams.get('callbackUrl') || '/admin/dashboard';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  // Colour/icon of resetMessage; set alongside every non-empty message.
  const [resetStatus, setResetStatus] = useState<'success' | 'error'>('error');

  // Check if initial setup is needed
  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const response = await fetch('/api/cms/setup/check');
      const data = await response.json();

      if (data.setupNeeded) {
        // Setup needed, redirect to wizard
        router.push('/admin/setup');
      } else {
        // Setup complete, set cookie
        document.cookie = 'setup-complete=true; path=/; max-age=31536000'; // 1 year
        setCheckingSetup(false);
      }
    } catch (error) {
      console.error('Error checking setup status:', error);
      setCheckingSetup(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setLoading(true);

    // Get client IP address and location (prefer internal API, fallback to ipify)
    let clientIp = 'unknown';
    let clientCountry = 'Unknown';
    let clientCity = 'Unknown';
    
    try {
      const ipResponse = await fetch('/api/ip', { cache: 'no-store' });
      const ipData = await ipResponse.json();
      clientIp = ipData.ip || clientIp;
      clientCountry = ipData.country || clientCountry;
      clientCity = ipData.city || clientCity;
    } catch (err) {
      console.log('Could not fetch IP from internal API');
    }

    if (clientIp === 'unknown') {
      try {
        const ipifyResponse = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
        const ipifyData = await ipifyResponse.json();
        clientIp = ipifyData.ip || clientIp;
      } catch (err) {
        console.log('Could not fetch IP from ipify');
      }
    }

    try {
      const result = await signIn('credentials', {
        email,
        password,
        totp,
        ip: clientIp,
        country: clientCountry,
        city: clientCity,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else if (result?.ok) {
        router.push(callbackUrl);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage('');

    setResetLoading(true);

    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setResetStatus('success');
        setResetMessage(data.message);
        setResetEmail('');
        setTimeout(() => {
          setResetMode(false);
          setResetMessage('');
        }, 5000);
      } else {
        setResetStatus('error');
        setResetMessage(data.error || 'Failed to reset password');
      }
    } catch (err) {
      console.error('Reset error:', err);
      setResetStatus('error');
      setResetMessage('An error occurred. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p role="status" className="flex items-center gap-2 text-sm text-text-secondary">
          <FaSpinner className="animate-spin" aria-hidden="true" />
          Checking system status...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-[15px] font-bold tracking-[-0.01em] text-text-primary">
          <span className="text-[var(--adm-accent)]">RHC</span> CMS
        </p>

        <div className="card-cyber p-5 sm:p-8">
          <h1 className="text-xl font-semibold text-text-primary">
            {resetMode ? 'Reset your password' : 'Sign in'}
          </h1>
          <p className="mt-1 mb-6 text-sm text-text-secondary">
            {resetMode ? 'A new password will be sent to your configured Telegram.' : 'Sign in to manage your content.'}
          </p>

          {/* Error Message */}
          {error && !resetMode && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
            >
              <FaExclamationCircle className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Reset Message */}
          {resetMessage && (
            <div
              role={resetStatus === 'success' ? 'status' : 'alert'}
              className={`mb-5 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                resetStatus === 'success'
                  ? 'border-cyber-green/40 bg-cyber-green/10 text-cyber-green'
                  : 'border-red-500/40 bg-red-500/10 text-red-300'
              }`}
            >
              {resetStatus === 'success' ? (
                <FaCheckCircle className="mt-0.5 shrink-0" aria-hidden="true" />
              ) : (
                <FaExclamationCircle className="mt-0.5 shrink-0" aria-hidden="true" />
              )}
              <span>{resetMessage}</span>
            </div>
          )}

          {/* Password Reset Form */}
          {resetMode ? (
            <form onSubmit={handlePasswordReset} className="space-y-5">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium mb-1.5">
                  Admin email address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="username"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="input py-2.5"
                  placeholder="admin@example.com"
                  required
                />
              </div>

              <div className="rounded-lg border border-dark-border bg-dark-lighter p-3 text-sm text-text-secondary">
                <p className="mb-1.5 flex items-center gap-2 font-medium text-text-primary">
                  <FaExclamationTriangle className="shrink-0 text-amber-300" aria-hidden="true" />
                  Security notice
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>A new 64-character password will be generated</li>
                  <li>Password will be sent to your configured Telegram</li>
                  <li>2FA will be disabled (re-enable after login)</li>
                  <li>Only available for admin accounts</li>
                </ul>
              </div>


              <button
                type="submit"
                disabled={resetLoading}
                className="btn-primary w-full py-2.5"
              >
                {resetLoading ? (
                  <>
                    <FaSpinner className="animate-spin" aria-hidden="true" />
                    Resetting...
                  </>
                ) : (
                  'Reset password'
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(false);
                    setResetMessage('');
                    setResetEmail('');
                  }}
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input py-2.5"
                    placeholder="admin@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="input py-2.5"
                  />
                </div>

                <div>
                  <label htmlFor="totp" className="block text-sm font-medium mb-1.5">
                    Authenticator code
                  </label>
                  <input
                    id="totp"
                    type="text"
                    autoComplete="one-time-code"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={totp}
                    onChange={(e) => setTotp(e.target.value)}
                    aria-describedby="totp-hint"
                    className="input py-2.5"
                    placeholder="123456"
                  />
                  <p id="totp-hint" className="mt-1.5 text-xs text-text-muted">
                    The 6-digit code from your authenticator app, or a recovery code.
                  </p>
                </div>


                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5"
                >
                  {loading ? (
                    <>
                      <FaSpinner className="animate-spin" aria-hidden="true" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>

              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(true);
                    setError('');
                  }}
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Forgot password? Reset via Telegram
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center px-4">
        <p role="status" className="flex items-center gap-2 text-sm text-text-secondary">
          <FaSpinner className="animate-spin" aria-hidden="true" />
          Loading...
        </p>
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}
