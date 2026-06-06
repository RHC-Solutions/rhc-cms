'use client';

import { useState } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaCloudflare, FaKey, FaLink, FaCheck, FaCopy, FaExclamationTriangle } from 'react-icons/fa';

interface Credential {
  id: string;
  name: string;
  envVar: string;
  description: string;
  isPublic: boolean;
  dashboardLink: string;
  steps: string[];
  example: string;
  copied?: boolean;
}

// Setup-instruction strings are templated off the configured site so they read
// correctly on any deployment. NEXT_PUBLIC_* values are inlined at build time.
const SITE_DOMAIN = (process.env.NEXT_PUBLIC_SITE_URL || 'your-domain.com')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '') || 'your-domain.com';
const PM2_APP = process.env.NEXT_PUBLIC_PM2_APP_NAME || SITE_DOMAIN.split('.')[0] || 'your-app';

export default function CloudflareSetupPage() {
  const [expandedCard, setExpandedCard] = useState<string | null>('site-key');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

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
      name: 'API Token',
      envVar: 'CLOUDFLARE_API_TOKEN',
      description: 'Authentication token for server-side API calls (analytics, DNS, cache)',
      isPublic: false,
      dashboardLink: 'https://dash.cloudflare.com/profile/api-tokens',
      steps: [
        'Go to Cloudflare Dashboard → Profile → API Tokens',
        'Click "Create Token"',
        'Select "Create Custom Token" template',
        'Set Name: "RHC Solutions Website API"',
        'Add Permissions:',
        '  - Zone → Zone → Read',
        '  - Zone → DNS → Read',
        '  - Zone → Analytics → Read',
        '  - Zone → Purge Cache → Purge',
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const toggleStep = (step: string) => {
    setCompletedSteps((prev) =>
      prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]
    );
  };

  const envTemplate = credentials
    .map((c) => `${c.envVar}=your-${c.id.replace('-', '-')}`)
    .join('\n');

  return (
    <AdminShell title="Cloudflare Setup">
      <div className="mb-8">
        <h1 className="heading-xl text-gradient mb-2 flex items-center gap-3">
          <FaCloudflare />
          Cloudflare Integration Setup
        </h1>
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

      {/* Credentials Grid */}
      <div className="space-y-4 mb-8">
        {credentials.map((cred) => (
          <div key={cred.id} className="card-cyber overflow-hidden">
            {/* Header */}
            <button
              onClick={() => setExpandedCard(expandedCard === cred.id ? null : cred.id)}
              className="w-full p-6 flex items-start justify-between hover:bg-dark-lighter transition-colors"
            >
              <div className="flex items-start gap-4 text-left flex-1">
                <div className="text-3xl">
                  {cred.isPublic ? '🟢' : '🔴'}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="heading-md text-text-primary">{cred.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${cred.isPublic ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {cred.isPublic ? 'Public' : 'Secret'}
                    </span>
                  </div>
                  <p className="text-text-muted text-sm">{cred.description}</p>
                </div>
              </div>
              <div className="text-xl text-text-secondary ml-4">
                {expandedCard === cred.id ? '▼' : '▶'}
              </div>
            </button>

            {/* Expanded Content */}
            {expandedCard === cred.id && (
              <div className="border-t border-dark-border bg-dark-lighter p-6 space-y-6">
                {/* Environment Variable */}
                <div>
                  <p className="text-text-muted text-sm mb-2">Environment Variable:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-dark p-3 rounded font-mono text-sm text-cyan-400 break-all">
                      {cred.envVar}
                    </code>
                    <button
                      onClick={() => copyToClipboard(cred.envVar, cred.id)}
                      className="btn-secondary px-3 py-2 flex items-center gap-1"
                      title="Copy environment variable name"
                    >
                      {copiedText === cred.id ? <FaCheck className="text-green-400" /> : <FaCopy />}
                    </button>
                  </div>
                </div>

                {/* Steps */}
                <div>
                  <p className="text-text-muted text-sm mb-3">Steps to find this credential:</p>
                  <ol className="space-y-2">
                    {cred.steps.map((step, idx) => (
                      <li key={idx} className="flex gap-3 items-start">
                        <span className="text-cyber-cyan font-bold min-w-6">{idx + 1}.</span>
                        <span className="text-text-secondary text-sm pt-1">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Dashboard Link */}
                <div>
                  <a
                    href={cred.dashboardLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 rounded-lg transition-colors font-semibold"
                  >
                    <FaLink />
                    Go to Cloudflare Dashboard
                  </a>
                </div>

                {/* Example */}
                <div>
                  <p className="text-text-muted text-sm mb-2">Example format:</p>
                  <code className="bg-dark p-3 rounded font-mono text-xs text-text-secondary block overflow-x-auto">
                    {cred.example}
                  </code>
                </div>

                {/* Security Note */}
                {!cred.isPublic && (
                  <div className="flex gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <FaExclamationTriangle className="text-red-400 mt-1 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="text-red-400 font-semibold mb-1">⚠️ Keep This Secret!</p>
                      <ul className="text-red-300/80 space-y-1 text-xs list-disc list-inside">
                        <li>Never share this credential</li>
                        <li>Never commit to git</li>
                        <li>Never expose in frontend code</li>
                        <li>Store in .env.local only</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* .env.local Template */}
      <div className="card-cyber p-6 mb-8">
        <h3 className="heading-md text-text-primary mb-4 flex items-center gap-2">
          <FaKey />
          .env.local Template
        </h3>
        <p className="text-text-muted text-sm mb-4">Copy this template and fill in your credentials:</p>
        <div className="flex items-start gap-2">
          <code className="flex-1 bg-dark p-4 rounded font-mono text-sm text-cyan-400 whitespace-pre overflow-x-auto text-text-secondary">
            {`NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=your-site-key
CLOUDFLARE_TURNSTILE_SECRET_KEY=your-secret-key
CLOUDFLARE_API_TOKEN=your-api-token
NEXT_PUBLIC_CLOUDFLARE_ZONE_ID=your-zone-id
CLOUDFLARE_ACCOUNT_ID=your-account-id`}
          </code>
          <button
            onClick={() => copyToClipboard(`NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=your-site-key\nCLOUDFLARE_TURNSTILE_SECRET_KEY=your-secret-key\nCLOUDFLARE_API_TOKEN=your-api-token\nNEXT_PUBLIC_CLOUDFLARE_ZONE_ID=your-zone-id\nCLOUDFLARE_ACCOUNT_ID=your-account-id`, 'template')}
            className="btn-secondary px-3 py-2 flex items-center gap-1 flex-shrink-0"
          >
            {copiedText === 'template' ? <FaCheck className="text-green-400" /> : <FaCopy />}
          </button>
        </div>
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
