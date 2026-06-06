'use client';

import { useState, useEffect } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaLink, FaCheck, FaExclamationTriangle, FaSave, FaEye, FaEyeSlash, FaCheckCircle, FaTimesCircle, FaVial, FaCloudflare } from 'react-icons/fa';
import type { IconType } from 'react-icons';

interface Credential {
  id: string;
  name: string;
  envVar: string;
  description: string;
  isPublic: boolean;
  dashboardLink: string;
  steps: string[];
  example: string;
  icon?: IconType;
  copied?: boolean;
}

// Setup-instruction strings are templated off the configured site so they read
// correctly on any deployment. NEXT_PUBLIC_* values are inlined at build time.
const SITE_DOMAIN = (process.env.NEXT_PUBLIC_SITE_URL || 'your-domain.com')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '') || 'your-domain.com';
const PM2_APP = process.env.NEXT_PUBLIC_PM2_APP_NAME || SITE_DOMAIN.split('.')[0] || 'your-app';

export default function CloudflareSetupPage() {
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<any>(null);
  
  // Form state for credentials
  const [formData, setFormData] = useState({
    NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY: '',
    CLOUDFLARE_TURNSTILE_SECRET_KEY: '',
    CLOUDFLARE_API_TOKEN: '',
    NEXT_PUBLIC_CLOUDFLARE_ZONE_ID: '',
    CLOUDFLARE_ACCOUNT_ID: '',
  });

  // Load current configuration
  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch('/api/admin/cloudflare/config');
        if (response.ok) {
          const data = await response.json();
          setFormData(data);
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    }
    loadConfig();
  }, []);

  const handleInputChange = (envVar: string, value: string) => {
    setFormData(prev => ({ ...prev, [envVar]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/admin/cloudflare/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save configuration' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const toggleSecretVisibility = (id: string) => {
    setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResults(null);
    setMessage(null);
    
    try {
      const response = await fetch('/api/admin/cloudflare/test', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setTestResults(data.results);
        const allSuccess = Object.values(data.results).every((r: any) => r.status === 'success');
        setMessage({ 
          type: allSuccess ? 'success' : 'error', 
          text: allSuccess ? '✅ All credentials are working!' : '⚠️ Some credentials have issues - see details below' 
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to test configuration' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to test configuration' });
    } finally {
      setTesting(false);
    }
  };

  const credentials: Credential[] = [
    {
      id: 'site-key',
      name: 'Turnstile Site Key',
      envVar: 'NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY',
      description: 'Public identifier for Cloudflare Turnstile bot protection on contact form',
      isPublic: true,
      dashboardLink: 'https://dash.cloudflare.com/?to=/:account/turnstile',
      steps: [
        'Go to Cloudflare Dashboard → Turnstile',
        'Click "Create Site" or select existing site',
        `Select domain: ${SITE_DOMAIN}`,
        'Configure settings (Managed mode recommended)',
        'Copy the Site Key from the results page',
      ],
      example: '1x00000000000000000000AA',
    },
    {
      id: 'secret-key',
      name: 'Turnstile Secret Key',
      envVar: 'CLOUDFLARE_TURNSTILE_SECRET_KEY',
      description: 'Private key for server-side verification of Turnstile tokens (keep secret!)',
      isPublic: false,
      dashboardLink: 'https://dash.cloudflare.com/?to=/:account/turnstile',
      steps: [
        'Go to Cloudflare Dashboard → Turnstile',
        'View your created site settings',
        'Copy the Secret Key (not the Site Key)',
        '⚠️ Never expose this in frontend code',
        '⚠️ Never commit to git',
      ],
      example: '1x0000000000000000000000000000000000000AA',
    },
    {
      id: 'api-token',
      name: 'Cloudflare API Token',
      envVar: 'CLOUDFLARE_API_TOKEN',
      description: 'Authentication token for server-side API calls (analytics, DNS, cache, edge cache rules)',
      isPublic: false,
      icon: FaCloudflare,
      dashboardLink: 'https://dash.cloudflare.com/profile/api-tokens',
      steps: [
        'Go to Cloudflare Dashboard → Profile → API Tokens',
        'Click "Create Token"',
        'Select "Create Custom Token" template',
        `Set Name: "${SITE_DOMAIN} Website API"`,
        'Add Permissions:',
        '  - Zone → Zone → Read',
        '  - Zone → DNS → Read',
        '  - Zone → Analytics → Read',
        '  - Zone → Cache Purge → Purge',
        '  - Zone → Cache Rules → Edit',
        `Select Zone: ${SITE_DOMAIN}`,
        'Click "Create Token" and copy immediately',
      ],
      example: 'v1.0_abc123def456ghi789jkl012mno345pqr678stu',
    },
    {
      id: 'zone-id',
      name: 'Zone ID',
      envVar: 'NEXT_PUBLIC_CLOUDFLARE_ZONE_ID',
      description: 'Unique identifier for your domain on Cloudflare',
      isPublic: true,
      dashboardLink: 'https://dash.cloudflare.com',
      steps: [
        'Go to Cloudflare Dashboard',
        `Select your domain: ${SITE_DOMAIN}`,
        'Look at the right sidebar under "API" section',
        'Copy the Zone ID (long alphanumeric string)',
        'Alternative: Click Overview tab and scroll to API section',
      ],
      example: 'e1234567890abcdef1234567890abcde',
    },
    {
      id: 'account-id',
      name: 'Account ID',
      envVar: 'CLOUDFLARE_ACCOUNT_ID',
      description: 'Unique identifier for your Cloudflare account (for Analytics Engine)',
      isPublic: true,
      dashboardLink: 'https://dash.cloudflare.com',
      steps: [
        'Go to Cloudflare Dashboard',
        'Select any domain or go to Account Home',
        'Look at the right sidebar under "API" section',
        'Copy the Account ID (appears above Zone ID)',
        'Alternative: Click your profile → Accounts',
      ],
      example: 'a1234567890bcdef1234567890bcdef12',
    },
  ];

  const toggleStep = (step: string) => {
    setCompletedSteps((prev) =>
      prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]
    );
  };

  return (
    <AdminShell title="Cloudflare Setup">
      <div className="mb-8">
        <h1 className="heading-xl text-gradient mb-2">Cloudflare Integration Setup</h1>
        <p className="text-text-secondary">Step-by-step guide to configure all required Cloudflare credentials</p>
      </div>

      {/* Quick Start Card */}
      <div className="card-cyber p-6 mb-8 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-l-4 border-l-blue-500">
        <div className="flex items-start gap-4">
          <div className="text-4xl">🚀</div>
          <div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Quick Start</h3>
            <p className="text-text-muted mb-3">You need to collect 5 credentials from Cloudflare dashboard and add them to .env.local</p>
            <div className="space-y-1 text-sm text-text-secondary">
              <p>1️⃣ Visit Cloudflare Dashboard (see links below)</p>
              <p>2️⃣ Copy the 5 credentials listed below</p>
              <p>3️⃣ Update .env.local with your credentials</p>
              <p>4️⃣ Restart application: <code className="bg-dark-lighter px-2 py-1 rounded">pm2 restart {PM2_APP} --update-env</code></p>
              <p>5️⃣ Test Turnstile on contact form and check admin dashboard</p>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button and Status */}
      {message && (
        <div className={`card-cyber p-4 mb-6 ${message.type === 'success' ? 'bg-green-500/20 border-green-500' : 'bg-red-500/20 border-red-500'}`}>
          <p className={message.type === 'success' ? 'text-green-400' : 'text-red-400'}>{message.text}</p>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <button
          onClick={handleTest}
          disabled={testing}
          className="btn-secondary flex items-center gap-2"
        >
          <FaVial />
          {testing ? 'Testing...' : 'Test Configuration'}
        </button>
        
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <FaSave />
          {saving ? 'Saving...' : 'Save All Configuration'}
        </button>
      </div>

      {/* Credentials Grid */}
      <div className="space-y-4 mb-8">
        {credentials.map((cred) => {
          const credKeyMap: Record<string, string> = {
            'site-key': 'turnstile_site_key',
            'secret-key': 'turnstile_secret_key',
            'api-token': 'api_token',
            'zone-id': 'zone_id',
            'account-id': 'account_id',
          };
          const testResult = testResults?.[credKeyMap[cred.id]];
          const isConfigured = formData[cred.envVar as keyof typeof formData]?.trim() !== '';
          
          return (
            <div key={cred.id} className="card-cyber p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="text-3xl text-cyber-cyan">
                  {cred.icon ? <cred.icon /> : (cred.isPublic ? '🌐' : '🔑')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="heading-md text-text-primary">{cred.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${cred.isPublic ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                      {cred.isPublic ? '🌐 Public' : '🔑 Secret'}
                    </span>
                    {/* Status Badge */}
                    {isConfigured ? (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-400 flex items-center gap-1">
                        <FaCheckCircle /> ✅ SET
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400 flex items-center gap-1">
                        <FaTimesCircle /> ❌ EMPTY
                      </span>
                    )}
                  </div>
                  <p className="text-text-muted text-sm mb-3">{cred.description}</p>
                  
                  {/* Test Result */}
                  {testResult && (
                    <div className={`mb-3 p-2 rounded text-sm ${
                      testResult.status === 'success' ? 'bg-green-500/20 text-green-400' :
                      testResult.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {testResult.status === 'success' && <FaCheckCircle className="inline mr-2" />}
                      {testResult.status === 'error' && <FaTimesCircle className="inline mr-2" />}
                      {testResult.message}
                    </div>
                  )}
                  
                  {/* Input Field */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      {cred.envVar}
                    </label>
                    <div className="relative">
                      <input
                        type={!cred.isPublic && !showSecrets[cred.id] ? 'password' : 'text'}
                        value={formData[cred.envVar as keyof typeof formData] || ''}
                        onChange={(e) => handleInputChange(cred.envVar, e.target.value)}
                        placeholder={cred.example}
                        className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:border-cyber-cyan focus:outline-none pr-10"
                      />
                    {!cred.isPublic && (
                      <button
                        type="button"
                        onClick={() => toggleSecretVisibility(cred.id)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-cyber-cyan"
                      >
                        {showSecrets[cred.id] ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Dashboard Link */}
                <a
                  href={cred.dashboardLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 rounded-lg transition-colors font-semibold text-sm"
                >
                  <FaLink />
                  Go to Cloudflare Dashboard
                </a>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Verification Checklist */}
      <div className="card-cyber p-6 mb-8">
        <h3 className="heading-md text-text-primary mb-4">✅ Setup Verification Checklist</h3>
        <div className="space-y-3">
          {[
            'Gathered all 5 credentials from Cloudflare dashboard',
            'Updated .env.local with actual values',
            `Restarted application (pm2 restart ${PM2_APP} --update-env)`,
            'Contact form shows Turnstile widget',
            'Can complete Turnstile challenge on contact form',
            'Can submit contact form successfully',
            'Admin dashboard loads Cloudflare data',
            'Can see analytics, security events, DNS records',
            'Cache purge button is functional',
          ].map((step, idx) => (
            <label key={idx} className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <input
                type="checkbox"
                checked={completedSteps.includes(step)}
                onChange={() => toggleStep(step)}
                className="w-5 h-5 rounded border-2 border-cyber-cyan cursor-pointer"
              />
              <span className={completedSteps.includes(step) ? 'text-text-muted line-through' : 'text-text-secondary'}>
                {step}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="card-cyber p-6">
        <h3 className="heading-md text-text-primary mb-4">🔍 Troubleshooting</h3>
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-text-primary mb-2">❌ Turnstile widget not appearing on contact form</p>
            <ul className="text-text-muted text-sm space-y-1 list-disc list-inside">
              <li>Verify NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY is correct</li>
              <li>Check it's in .env.local, not .env.production.local</li>
              <li>Restart: pm2 restart {PM2_APP} --update-env</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-text-primary mb-2">❌ "Turnstile verification failed" error</p>
            <ul className="text-text-muted text-sm space-y-1 list-disc list-inside">
              <li>Verify CLOUDFLARE_TURNSTILE_SECRET_KEY is correct</li>
              <li>Check secret key matches the site key's account</li>
              <li>Never expose secret key in frontend code</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-text-primary mb-2">❌ Admin dashboard shows no data</p>
            <ul className="text-text-muted text-sm space-y-1 list-disc list-inside">
              <li>Verify CLOUDFLARE_API_TOKEN is correct</li>
              <li>Check API token has required permissions</li>
              <li>Verify CLOUDFLARE_ZONE_ID matches {SITE_DOMAIN}</li>
              <li>Verify CLOUDFLARE_ACCOUNT_ID is correct</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-text-primary mb-2">❌ Admin dashboard shows "Unauthorized"</p>
            <ul className="text-text-muted text-sm space-y-1 list-disc list-inside">
              <li>API Token doesn't have proper permissions</li>
              <li>Create new token with all required scopes</li>
              <li>Ensure token includes: Zone.read, DNS.read, Analytics.read, Purge.purge</li>
            </ul>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
