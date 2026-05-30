'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaUser, FaLock, FaShieldAlt, FaCheckCircle } from 'react-icons/fa';
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
          <h1 className="heading-xl text-gradient mb-2">
            🚀 Welcome to RHC Solutions CMS
          </h1>
          <p className="text-gray-400">
            {step === 1
              ? 'Let\'s set up your administrator account'
              : 'Set up Two-Factor Authentication'}
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8 transition-slide-up transition-delay-4">
          <div className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step >= 1
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              <FaUser />
            </div>
            <div
              className={`w-16 h-1 ${
                step >= 2 ? 'bg-blue-500' : 'bg-gray-700'
              }`}
            />
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step >= 2
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              <FaShieldAlt />
            </div>
          </div>
        </div>

        {/* Step 1: Admin Account */}
        {step === 1 && (
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

        {/* Step 2: 2FA Setup */}
        {step === 2 && mfaData && (
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
