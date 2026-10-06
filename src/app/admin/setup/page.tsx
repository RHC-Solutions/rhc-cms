'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
import QRCode from 'qrcode';

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

  const [mfaData, setMfaData] = useState<{
    secret: string;
    otpauthURL: string;
    qrCodeDataURL: string;
  } | null>(null);

  // Check if setup is needed
  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
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
  };

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

        setStep(2);
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

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-[15px] font-bold tracking-[-0.01em] text-text-primary">
          <span className="text-[var(--adm-accent)]">RHC</span> Admin
        </p>

        <div className="card-cyber p-5 sm:p-8">
          {/* Header */}
          <p className="text-xs font-medium text-text-muted">Step {step} of 2</p>
          <h1 className="mt-1 text-xl font-semibold text-text-primary">
            {step === 1 ? 'Set up your administrator account' : 'Set up two-factor authentication'}
          </h1>
          <p className="mt-1 mb-6 text-sm text-text-secondary">
            {step === 1
              ? 'Welcome. Create the first admin account to finish setting up the panel.'
              : 'Required to sign in. Use Google Authenticator, Authy, or any TOTP-compatible app.'}
          </p>

          {/* Step 1: Admin Account */}
          {step === 1 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
                >
                  <FaExclamationCircle className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="setup-name" className="block text-sm font-medium mb-1.5">
                  Full name
                </label>
                <input
                  id="setup-name"
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
                <label htmlFor="setup-email" className="block text-sm font-medium mb-1.5">
                  Email address
                </label>
                <input
                  id="setup-email"
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
                <label htmlFor="setup-password" className="block text-sm font-medium mb-1.5">
                  Password
                </label>
                <input
                  id="setup-password"
                  type="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  aria-describedby="setup-password-hint"
                  className="input py-2.5"
                  required
                  minLength={8}
                />
                <p id="setup-password-hint" className="mt-1.5 text-xs text-text-muted">
                  At least 8 characters.
                </p>
              </div>

              <div>
                <label htmlFor="setup-confirm-password" className="block text-sm font-medium mb-1.5">
                  Confirm password
                </label>
                <input
                  id="setup-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  className="input py-2.5"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-2.5"
              >
                {submitting ? (
                  <>
                    <FaSpinner className="animate-spin" aria-hidden="true" />
                    Creating account...
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </form>
          )}

          {/* Step 2: 2FA Setup */}
          {step === 2 && mfaData && (
            <div className="space-y-5">
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-cyber-green/40 bg-cyber-green/10 px-3 py-2.5 text-sm text-cyber-green"
              >
                <FaCheckCircle className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>Admin account created.</span>
              </div>

              <div className="text-center">
                <p className="mb-3 text-sm text-text-secondary">
                  Scan this QR code with your authenticator app.
                </p>
                <div className="inline-block rounded-lg bg-white p-3">
                  <img
                    src={mfaData.qrCodeDataURL}
                    alt="QR code for two-factor authentication"
                    className="w-48 h-48 sm:w-56 sm:h-56"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-dark-border bg-dark-lighter p-3">
                <p className="mb-1 text-sm text-text-secondary">
                  Can't scan? Enter this secret key manually:
                </p>
                <code className="block break-all select-all text-sm text-text-primary">
                  {mfaData.secret}
                </code>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
                <FaExclamationTriangle className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  <strong>Important:</strong> Save this secret key in a safe
                  place. You'll need your authenticator app to log in.
                </span>
              </div>

              <button
                type="button"
                onClick={handleFinish}
                className="btn-primary w-full py-2.5"
              >
                Complete setup and go to login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
