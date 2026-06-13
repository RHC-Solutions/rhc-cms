'use client';

import { Suspense, useState, useEffect } from 'react';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FaLock, FaEnvelope, FaSpinner, FaKey } from 'react-icons/fa';

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
        setResetMessage('✓ ' + data.message);
        setResetEmail('');
        setTimeout(() => {
          setResetMode(false);
          setResetMessage('');
        }, 5000);
      } else {
        setResetMessage('✗ ' + (data.error || 'Failed to reset password'));
      }
    } catch (err) {
      console.error('Reset error:', err);
      setResetMessage('✗ An error occurred. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Checking system status...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-md border border-blue-500/20"
      >
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="w-16 h-16 mx-auto mb-4 flex items-center justify-center"
          >
            <Image
              src="/logo.png"
              alt="Your Site Name"
              width={64}
              height={64}
              priority
              unoptimized
              className="w-16 h-16 object-contain"
            />
          </motion.div>
          <h1 className="heading-xl text-gradient mb-2">RHC Admin</h1>
          <p className="text-slate-400">{resetMode ? 'Reset Your Password' : 'Sign in to manage your content'}</p>
        </div>

        {/* Error Message */}
        {error && !resetMode && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-6"
          >
            {error}
          </motion.div>
        )}

        {/* Reset Message */}
        {resetMessage && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`px-4 py-3 rounded-lg mb-6 ${
              resetMessage.startsWith('✓') 
                ? 'bg-green-500/10 border border-green-500/50 text-green-400'
                : 'bg-red-500/10 border border-red-500/50 text-red-400'
            }`}
          >
            {resetMessage}
          </motion.div>
        )}

        {/* Password Reset Form */}
        {resetMode ? (
          <form onSubmit={handlePasswordReset} className="space-y-6">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-slate-300 mb-2">
                Admin Email Address
              </label>
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="admin@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <motion.button
                type="submit"
                disabled={resetLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-linear-to-r from-blue-500 to-cyan-500 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {resetLoading ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </motion.button>

              <button
                type="button"
                onClick={() => {
                  setResetMode(false);
                  setResetMessage('');
                  setResetEmail('');
                }}
                className="w-full text-slate-400 hover:text-white transition-colors py-2"
              >
                Back to Login
              </button>
            </div>

            <div className="mt-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700 text-xs text-slate-400">
              <p className="mb-2"><strong>⚠️ Security Notice:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>A new 64-character password will be generated</li>
                <li>It will be sent to whichever recovery channel this site has configured &mdash; email (Brevo or SMTP), or, if email isn&apos;t set up, your admin Telegram chat</li>
                <li>2FA will be disabled (re-enable after login)</li>
                <li>Only available for admin accounts</li>
              </ul>
            </div>
          </form>
        ) : (
          <>
            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
              Email Address
            </label>
            <div className="relative">
              <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="admin@example.com"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
              Password
            </label>
            <div className="relative">
              <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* TOTP Input */}
          <div>
            <label htmlFor="totp" className="block text-sm font-medium text-slate-300 mb-2">
              Authenticator Code
            </label>
            <div className="relative">
              <FaKey className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="totp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="123456 or recovery code"
              />
            </div>
          </div>

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-linear-to-r from-blue-500 to-cyan-500 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </motion.button>
        </form>

        {/* Forgot Password Link */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setResetMode(true);
              setError('');
            }}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Forgot password? Send me a new one
          </button>
        </div>

        {/* Security Note */}
        <div className="mt-8 p-4 bg-slate-900/50 rounded-lg border border-slate-700 text-xs text-slate-400">
          Enter your authenticator code (or recovery code) after the password.
        </div>
        </>
        )}
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-linear-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}
