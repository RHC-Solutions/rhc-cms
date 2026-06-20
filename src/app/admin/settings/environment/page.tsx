'use client';
import { useState, useCallback, useEffect } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaKey, FaEnvelope, FaRobot, FaEye, FaEyeSlash, FaCheck, FaSync } from 'react-icons/fa';
import toast from 'react-hot-toast';

interface EnvSettings {
  // Authentication
  nextauthUrl: string;
  nextauthSecret: string;
  
  // Google Analytics
  ga4PropertyId: string;
  ga4ServiceAccountEmail: string;
  ga4PrivateKey: string;
  ga4KeyId: string;
  ga4ProjectId: string;
  
  // Cloudflare
  cloudflareApiToken: string;
  cloudflareTurnstileSiteKey: string;
  cloudflareTurnstileSecretKey: string;
  cloudflareZoneId: string;
  cloudflareAccountId: string;
  
  // Email (SMTP)
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  contactEmail: string;
  
  // Email (Office 365 OAuth2)
  office365ClientId: string;
  office365ClientSecret: string;
  office365TenantId: string;
  office365RefreshToken: string;
  
  // Google reCAPTCHA
  recaptchaSiteKey: string;
  recaptchaSecretKey: string;
  
  // Telegram
  telegramResumeBotToken: string;
  telegramResumeChatId: string;
  telegramContactBotToken: string;
  telegramContactChatId: string;
  telegramBackupBotToken: string;
  telegramBackupChatId: string;
  telegramLoginAlertBotToken: string;
  telegramLoginAlertChatId: string;
  
  // Site Configuration
  siteUrl: string;
  bookingUrl: string;
  gaId: string;
  gtmId: string;
  ipinfoToken: string;
}

type Tab = 'auth' | 'google' | 'cloudflare' | 'email' | 'recaptcha' | 'telegram' | 'site';

export default function EnvironmentSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('auth');
  const [loading, setLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingBot, setTestingBot] = useState<string | null>(null);
  const [settings, setSettings] = useState<EnvSettings>({
    nextauthUrl: '',
    nextauthSecret: '',
    ga4PropertyId: '',
    ga4ServiceAccountEmail: '',
    ga4PrivateKey: '',
    ga4KeyId: '',
    ga4ProjectId: '',
    cloudflareApiToken: '',
    cloudflareTurnstileSiteKey: '',
    cloudflareTurnstileSecretKey: '',
    cloudflareZoneId: '',
    cloudflareAccountId: '',
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPass: '',
    contactEmail: '',
    office365ClientId: '',
    office365ClientSecret: '',
    office365TenantId: '',
    office365RefreshToken: '',
    recaptchaSiteKey: '',
    recaptchaSecretKey: '',
    telegramResumeBotToken: '',
    telegramResumeChatId: '',
    telegramContactBotToken: '',
    telegramContactChatId: '',
    telegramBackupBotToken: '',
    telegramBackupChatId: '',
    telegramLoginAlertBotToken: '',
    telegramLoginAlertChatId: '',
    siteUrl: '',
    bookingUrl: '',
    gaId: '',
    gtmId: '',
    ipinfoToken: '',
  });

  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/environment');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        toast.success('✓ Settings loaded successfully');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const testTelegramBot = async (botType: string, tokenField: keyof EnvSettings, chatIdField: keyof EnvSettings, botName: string) => {
    const botToken = settings[tokenField];
    const chatId = settings[chatIdField];

    if (!botToken || !chatId) {
      toast.error(`Please enter both ${botName} token and chat ID first`);
      return;
    }

    setTestingBot(botType);
    try {
      const response = await fetch('/api/admin/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken, chatId, botName }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to test bot');
    } finally {
      setTestingBot(null);
    }
  };

  const handleChange = (field: keyof EnvSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value.trim() }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/environment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('✓ Settings saved successfully!');
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save settings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSecret = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <AdminShell title="Environment Settings">
      <div className="mb-8">
        <h1 className="heading-xl text-gradient mb-2">Environment Configuration</h1>
        <p className="text-text-secondary">Manage all application settings from .env.local</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-dark-border overflow-x-auto">
        {[
          { key: 'auth', label: '🔐 Auth', icon: FaKey },
          { key: 'google', label: '📊 Google', icon: FaKey },
          { key: 'cloudflare', label: '☁️ Cloudflare', icon: FaKey },
          { key: 'email', label: '📧 Email', icon: FaEnvelope },
          { key: 'recaptcha', label: '🤖 reCAPTCHA', icon: FaRobot },
          { key: 'telegram', label: '💬 Telegram', icon: FaRobot },
          { key: 'site', label: '🌐 Site', icon: FaKey },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as Tab)}
            className={`px-4 py-3 font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'text-cyber-cyan border-b-2 border-cyber-cyan'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-6 mb-8">
        {/* Auth Tab */}
        {activeTab === 'auth' && (
          <>
            <div className="card-dark p-6">
              <label className="block text-lg font-bold text-text-primary mb-2">NextAuth URL</label>
              <input
                type="text"
                value={settings.nextauthUrl}
                onChange={(e) => handleChange('nextauthUrl', e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-cyber-green"
              />
              <p className="text-xs text-text-secondary mt-2">Your site URL for authentication</p>
            </div>

            <div className="card-dark p-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-lg font-bold text-text-primary">NextAuth Secret</label>
                <button onClick={() => toggleSecret('nextauthSecret')} className="text-text-secondary">
                  {showSecrets['nextauthSecret'] ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              <input
                type={showSecrets['nextauthSecret'] ? 'text' : 'password'}
                value={settings.nextauthSecret}
                onChange={(e) => handleChange('nextauthSecret', e.target.value)}
                placeholder="Generate with: openssl rand -base64 32"
                className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-red-500"
              />
              <p className="text-xs text-text-secondary mt-2">🔐 Keep this secret! Generate new with openssl rand -base64 32</p>
            </div>
          </>
        )}

        {/* Google Tab */}
        {activeTab === 'google' && (
          <>
            {/* GA4 fields */}
            {[
              { field: 'ga4PropertyId' as const, label: 'GA4 Property ID', placeholder: '123456789' },
              { field: 'ga4ServiceAccountEmail' as const, label: 'Service Account Email', placeholder: 'service-account@project.iam.gserviceaccount.com' },
              { field: 'ga4KeyId' as const, label: 'Key ID', placeholder: 'abc123...' },
              { field: 'ga4ProjectId' as const, label: 'Project ID', placeholder: 'my-project' },
            ].map(({ field, label, placeholder }) => (
              <div key={field} className="card-dark p-6">
                <label className="block text-lg font-bold text-text-primary mb-2">{label}</label>
                <input
                  type="text"
                  value={settings[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-cyber-cyan"
                />
              </div>
            ))}

            {/* Private Key */}
            <div className="card-dark p-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-lg font-bold text-text-primary">GA4 Private Key</label>
                <button onClick={() => toggleSecret('ga4PrivateKey')} className="text-text-secondary">
                  {showSecrets['ga4PrivateKey'] ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              <textarea
                value={settings.ga4PrivateKey}
                onChange={(e) => handleChange('ga4PrivateKey', e.target.value)}
                placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-red-500 font-mono text-xs h-32 resize-none"
              />
            </div>
          </>
        )}

        {/* Cloudflare Tab */}
        {activeTab === 'cloudflare' && (
          <>
            {[
              { field: 'cloudflareApiToken' as const, label: 'API Token', secret: true },
              { field: 'cloudflareZoneId' as const, label: 'Zone ID', secret: false },
              { field: 'cloudflareAccountId' as const, label: 'Account ID', secret: false },
              { field: 'cloudflareTurnstileSiteKey' as const, label: 'Turnstile Site Key', secret: false },
              { field: 'cloudflareTurnstileSecretKey' as const, label: 'Turnstile Secret Key', secret: true },
            ].map(({ field, label, secret }) => (
              <div key={field} className="card-dark p-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-lg font-bold text-text-primary">{label}</label>
                  {secret && (
                    <button onClick={() => toggleSecret(field)} className="text-text-secondary">
                      {showSecrets[field] ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  )}
                </div>
                <input
                  type={secret && !showSecrets[field] ? 'password' : 'text'}
                  value={settings[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-orange-500"
                />
              </div>
            ))}
          </>
        )}

        {/* Email Tab */}
        {activeTab === 'email' && (
          <>
            <div className="mb-6 p-4 bg-dark-lighter border border-dark-border rounded-lg">
              <h3 className="text-lg font-bold text-cyber-cyan mb-2">📧 Email Configuration</h3>
              <p className="text-text-secondary text-sm">Choose either SMTP (Gmail, etc.) or Office 365 OAuth2 (modern authentication)</p>
            </div>
            
            <div className="mb-6 p-4 bg-dark-lighter border border-cyber-cyan rounded-lg">
              <h4 className="text-md font-bold text-cyber-cyan mb-4">SMTP Configuration (Gmail, Outlook, etc.)</h4>
              {[
                { field: 'smtpHost' as const, label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
                { field: 'smtpPort' as const, label: 'SMTP Port', placeholder: '587' },
                { field: 'smtpUser' as const, label: 'SMTP User', placeholder: 'your-email@gmail.com' },
                { field: 'smtpPass' as const, label: 'SMTP Password', secret: true, placeholder: 'Your app password' },
              ].map(({ field, label, placeholder, secret }) => (
                <div key={field} className="card-dark p-6 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-lg font-bold text-text-primary">{label}</label>
                    {secret && (
                      <button onClick={() => toggleSecret(field)} className="text-text-secondary">
                        {showSecrets[field] ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    )}
                  </div>
                  <input
                    type={secret && !showSecrets[field] ? 'password' : 'text'}
                    value={settings[field]}
                    onChange={(e) => handleChange(field, e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>

            <div className="mb-6 p-4 bg-dark-lighter border border-cyber-green rounded-lg">
              <h4 className="text-md font-bold text-cyber-green mb-4">Office 365 OAuth2 (Modern Authentication)</h4>
              <p className="text-text-secondary text-xs mb-4">Get these from: <a href="https://entra.microsoft.com" target="_blank" rel="noopener noreferrer" className="text-cyber-cyan hover:underline">Microsoft Entra Admin Center</a> → App registrations</p>
              {[
                { field: 'office365TenantId' as const, label: 'Tenant ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
                { field: 'office365ClientId' as const, label: 'Client ID (Application ID)', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
                { field: 'office365ClientSecret' as const, label: 'Client Secret', secret: true, placeholder: 'Your client secret value' },
                { field: 'office365RefreshToken' as const, label: 'Refresh Token', secret: true, placeholder: 'Obtained after first authentication' },
              ].map(({ field, label, placeholder, secret }) => (
                <div key={field} className="card-dark p-6 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-lg font-bold text-text-primary">{label}</label>
                    {secret && (
                      <button onClick={() => toggleSecret(field)} className="text-text-secondary">
                        {showSecrets[field] ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    )}
                  </div>
                  <input
                    type={secret && !showSecrets[field] ? 'password' : 'text'}
                    value={settings[field]}
                    onChange={(e) => handleChange(field, e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-green-500"
                  />
                </div>
              ))}
            </div>

            <div className="card-dark p-6">
              <label className="block text-lg font-bold text-text-primary mb-2">Contact Email (Reply-To)</label>
              <input
                type="text"
                value={settings.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-blue-500"
              />
            </div>
          </>
        )}

        {/* Disabled old code section - keeping for reference */}
        {false && (
          <>
            {[
              { field: 'smtpHost' as const, label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
              { field: 'smtpPort' as const, label: 'SMTP Port', placeholder: '587' },
              { field: 'smtpUser' as const, label: 'SMTP User', placeholder: 'your-email@gmail.com' },
              { field: 'smtpPass' as const, label: 'SMTP Password', secret: true, placeholder: 'Your app password' },
              { field: 'contactEmail' as const, label: 'Contact Email', placeholder: 'admin@example.com' },
            ].map(({ field, label, placeholder, secret }) => (
              <div key={field} className="card-dark p-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-lg font-bold text-text-primary">{label}</label>
                  {secret && (
                    <button onClick={() => toggleSecret(field)} className="text-text-secondary">
                      {showSecrets[field] ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  )}
                </div>
                <input
                  type={secret && !showSecrets[field] ? 'password' : 'text'}
                  value={settings[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}
          </>
        )}

        {/* reCAPTCHA Tab */}
        {activeTab === 'recaptcha' && (
          <>
            {[
              { field: 'recaptchaSiteKey' as const, label: 'reCAPTCHA Site Key' },
              { field: 'recaptchaSecretKey' as const, label: 'reCAPTCHA Secret Key', secret: true },
            ].map(({ field, label, secret }) => (
              <div key={field} className="card-dark p-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-lg font-bold text-text-primary">{label}</label>
                  {secret && (
                    <button onClick={() => toggleSecret(field)} className="text-text-secondary">
                      {showSecrets[field] ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  )}
                </div>
                <input
                  type={secret && !showSecrets[field] ? 'password' : 'text'}
                  value={settings[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-purple-500"
                />
              </div>
            ))}
          </>
        )}

        {/* Telegram Tab */}
        {activeTab === 'telegram' && (
          <>
            {/* Resume Bot */}
            <div className="card-dark p-6 border-l-4 border-purple-500">
              <h3 className="text-lg font-bold text-purple-400 mb-4">📝 Resume/Careers Bot</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-md font-bold text-text-primary">Bot Token</label>
                    <button onClick={() => toggleSecret('telegramResumeBotToken')} className="text-text-secondary">
                      {showSecrets['telegramResumeBotToken'] ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <input
                    type={showSecrets['telegramResumeBotToken'] ? 'text' : 'password'}
                    value={settings.telegramResumeBotToken}
                    onChange={(e) => handleChange('telegramResumeBotToken', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-md font-bold text-text-primary mb-2">Chat ID</label>
                  <input
                    type="text"
                    value={settings.telegramResumeChatId}
                    onChange={(e) => handleChange('telegramResumeChatId', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-purple-500"
                  />
                </div>
                <button
                  onClick={() => testTelegramBot('resume', 'telegramResumeBotToken', 'telegramResumeChatId', 'Resume Bot')}
                  disabled={testingBot === 'resume'}
                  className="btn-secondary w-full disabled:opacity-50"
                >
                  {testingBot === 'resume' ? 'Testing...' : '🧪 Test Resume Bot'}
                </button>
              </div>
            </div>

            {/* Contact Bot */}
            <div className="card-dark p-6 border-l-4 border-cyan-500">
              <h3 className="text-lg font-bold text-cyan-400 mb-4">💬 Contact Form Bot</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-md font-bold text-text-primary">Bot Token</label>
                    <button onClick={() => toggleSecret('telegramContactBotToken')} className="text-text-secondary">
                      {showSecrets['telegramContactBotToken'] ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <input
                    type={showSecrets['telegramContactBotToken'] ? 'text' : 'password'}
                    value={settings.telegramContactBotToken}
                    onChange={(e) => handleChange('telegramContactBotToken', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-md font-bold text-text-primary mb-2">Chat ID</label>
                  <input
                    type="text"
                    value={settings.telegramContactChatId}
                    onChange={(e) => handleChange('telegramContactChatId', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <button
                  onClick={() => testTelegramBot('contact', 'telegramContactBotToken', 'telegramContactChatId', 'Contact Bot')}
                  disabled={testingBot === 'contact'}
                  className="btn-secondary w-full disabled:opacity-50"
                >
                  {testingBot === 'contact' ? 'Testing...' : '🧪 Test Contact Bot'}
                </button>
              </div>
            </div>

            {/* Backup Bot */}
            <div className="card-dark p-6 border-l-4 border-green-500">
              <h3 className="text-lg font-bold text-green-400 mb-4">💾 Backup Notifications Bot</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-md font-bold text-text-primary">Bot Token</label>
                    <button onClick={() => toggleSecret('telegramBackupBotToken')} className="text-text-secondary">
                      {showSecrets['telegramBackupBotToken'] ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <input
                    type={showSecrets['telegramBackupBotToken'] ? 'text' : 'password'}
                    value={settings.telegramBackupBotToken}
                    onChange={(e) => handleChange('telegramBackupBotToken', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-md font-bold text-text-primary mb-2">Chat ID</label>
                  <input
                    type="text"
                    value={settings.telegramBackupChatId}
                    onChange={(e) => handleChange('telegramBackupChatId', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-green-500"
                  />
                </div>
                <button
                  onClick={() => testTelegramBot('backup', 'telegramBackupBotToken', 'telegramBackupChatId', 'Backup Bot')}
                  disabled={testingBot === 'backup'}
                  className="btn-secondary w-full disabled:opacity-50"
                >
                  {testingBot === 'backup' ? 'Testing...' : '🧪 Test Backup Bot'}
                </button>
              </div>
            </div>

            {/* Login Alert Bot */}
            <div className="card-dark p-6 border-l-4 border-yellow-500">
              <h3 className="text-lg font-bold text-yellow-400 mb-4">🔐 Login Alert Bot</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-md font-bold text-text-primary">Bot Token</label>
                    <button onClick={() => toggleSecret('telegramLoginAlertBotToken')} className="text-text-secondary">
                      {showSecrets['telegramLoginAlertBotToken'] ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <input
                    type={showSecrets['telegramLoginAlertBotToken'] ? 'text' : 'password'}
                    value={settings.telegramLoginAlertBotToken}
                    onChange={(e) => handleChange('telegramLoginAlertBotToken', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-md font-bold text-text-primary mb-2">Chat ID</label>
                  <input
                    type="text"
                    value={settings.telegramLoginAlertChatId}
                    onChange={(e) => handleChange('telegramLoginAlertChatId', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-yellow-500"
                  />
                </div>
                <button
                  onClick={() => testTelegramBot('login', 'telegramLoginAlertBotToken', 'telegramLoginAlertChatId', 'Login Alert Bot')}
                  disabled={testingBot === 'login'}
                  className="btn-secondary w-full disabled:opacity-50"
                >
                  {testingBot === 'login' ? 'Testing...' : '🧪 Test Login Alert Bot'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Site Tab */}
        {activeTab === 'site' && (
          <>
            {[
              { field: 'siteUrl' as const, label: 'Site URL', placeholder: 'https://example.com' },
              { field: 'bookingUrl' as const, label: 'Booking URL', placeholder: 'https://outlook.office.com/...' },
              { field: 'gaId' as const, label: 'Google Analytics ID', placeholder: 'G-XXXXXXXXXX' },
              { field: 'gtmId' as const, label: 'Google Tag Manager ID', placeholder: 'GTM-XXXXXXX' },
              { field: 'ipinfoToken' as const, label: 'IPInfo Token', secret: true, placeholder: 'Your IPInfo token' },
            ].map(({ field, label, placeholder, secret }) => (
              <div key={field} className="card-dark p-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-lg font-bold text-text-primary">{label}</label>
                  {secret && (
                    <button onClick={() => toggleSecret(field)} className="text-text-secondary">
                      {showSecrets[field] ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  )}
                </div>
                <input
                  type={secret && !showSecrets[field] ? 'password' : 'text'}
                  value={settings[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-green-500"
                />
              </div>
            ))}
          </>
        )}
      </div>

      {/* Save Button */}
      <div className="flex gap-4">
        <button
          onClick={handleSave}
          disabled={loading}
          className="btn-primary flex items-center space-x-2 disabled:opacity-50"
        >
          <FaCheck />
          <span>{loading ? 'Saving...' : 'Save All Settings'}</span>
        </button>
        <button
          onClick={loadSettings}
          disabled={loading}
          className="btn-secondary flex items-center space-x-2 disabled:opacity-50"
        >
          <FaSync className={loading ? 'animate-spin' : ''} />
          <span>Reload from Server</span>
        </button>
      </div>

      {/* Warning */}
      <div className="card-cyber p-4 mt-8 border-l-4 border-red-500">
        <p className="text-sm text-red-400">
          ⚠️ <strong>Warning:</strong> All settings are sensitive credentials. Change these carefully and never share them. After saving, remember to restart the application.
        </p>
      </div>
    </AdminShell>
  );
}
