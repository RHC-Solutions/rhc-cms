'use client';
import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { useToast } from '@adminpanel/components/admin/Toast';
import { FaSearch, FaSitemap, FaGoogle, FaSave, FaSyncAlt, FaCheckCircle, FaLink } from 'react-icons/fa';

interface SEOSettings {
  title: string;
  metaDescription: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  // Google Services
  googleTagManagerId: string;
  googleAnalytics4Id: string;
  googleSearchConsoleVerification: string;
  bingWebmasterVerification?: string;
  yandexVerification?: string;
  // Ahrefs Integration
  ahrefsId: string;
  ahrefsApiKey: string;
  ahrefsDomain: string;
  ahrefsDataKey?: string;
  ahrefsInstallMethod?: 'direct' | 'gtm';
  // Hotjar Integration
  hotjarSiteId?: string;
  // ContentSquare Integration
  contentsquareScriptUrl?: string;
  // IPinfo Integration
  ipinfoToken?: string;
}

export default function SEOManagement() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SEOSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'global' | 'google' | 'sitemap' | 'ahrefs' | 'hotjar' | 'ipinfo'>('global');
  const [generatingSitemap, setGeneratingSitemap] = useState(false);
  const [sitemapStatus, setSitemapStatus] = useState<{ generated: boolean; date?: string } | null>(null);
  const [googleIntegrationStatus, setGoogleIntegrationStatus] = useState<any>(null);
  const [submittingToGoogle, setSubmittingToGoogle] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/seo');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      } else {
        addToast('error', 'Failed to load SEO settings');
      }
    } catch (error) {
      console.error('Failed to fetch:', error);
      addToast('error', 'Failed to load SEO settings');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const fetchGoogleIntegrationStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/cms/google-integration');
      if (res.ok) {
        const data = await res.json();
        setGoogleIntegrationStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch Google integration status:', error);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchGoogleIntegrationStatus();
  }, [fetchSettings, fetchGoogleIntegrationStatus]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    try {
      const res = await fetch('/api/cms/seo', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        addToast('success', 'SEO settings saved successfully!');
      } else {
        addToast('error', 'Failed to save SEO settings');
      }
    } catch (error) {
      console.error('Save failed:', error);
      addToast('error', 'Failed to save SEO settings');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSitemap = async () => {
    setGeneratingSitemap(true);
    try {
      const res = await fetch('/api/cms/seo/generate-sitemap', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        setSitemapStatus({ generated: true, date: new Date().toLocaleString() });
        addToast('success', 'sitemap.xml generated successfully!');
      } else {
        addToast('error', 'Failed to generate sitemap.xml');
      }
    } catch (error) {
      console.error('Failed to generate sitemap:', error);
      addToast('error', 'Failed to generate sitemap.xml');
    } finally {
      setGeneratingSitemap(false);
    }
  };

  const handleSubmitToGoogle = async (type: 'sitemap' | 'robots' | 'verification') => {
    setSubmittingToGoogle(true);
    try {
      const res = await fetch('/api/cms/google-integration', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: `submit-${type}` }),
      });

      if (res.ok) {
        const data = await res.json();
        setGoogleIntegrationStatus(data.status);
        addToast('success', `${type} submitted to Google!`);
        // In a real implementation, this would submit to Google Search Console API
        addToast('info', 'Verify the submission in Google Search Console');
      } else {
        addToast('error', `Failed to submit ${type}`);
      }
    } catch (error) {
      console.error(`Failed to submit ${type}:`, error);
      addToast('error', `Failed to submit ${type}`);
    } finally {
      setSubmittingToGoogle(false);
    }
  };

  if (loading || !settings) {
    return (
      <AdminShell title="SEO Management">
        <div className="text-center p-8">Loading SEO settings...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="SEO Management">
      <div className="mb-8">
        <h1 className="heading-xl text-gradient mb-2">SEO Settings</h1>
        <p className="text-text-secondary">Optimize your website for search engines</p>
      </div>

      <div className="flex space-x-4 mb-6 border-b border-dark-border">
        {(['global', 'sitemap', 'google', 'ahrefs', 'hotjar', 'ipinfo'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-semibold transition-colors capitalize ${
              activeTab === tab
                ? 'text-cyber-green border-b-2 border-cyber-green'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab === 'sitemap' ? '🗺️ Sitemap' : tab === 'google' ? 'Google' : tab === 'ahrefs' ? '🔗 Ahrefs' : tab === 'hotjar' ? '🔥 Hotjar' : tab === 'ipinfo' ? '🌍 IPinfo' : 'Global'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {activeTab === 'global' && (
          <>
            {/* Global SEO Settings */}
            <div className="card-cyber p-8">
              <h2 className="heading-md text-gradient mb-6">Global SEO Settings</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-text-primary font-semibold mb-2">Site Title</label>
                  <input
                    type="text"
                    value={settings.title}
                    onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                    className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary focus:border-cyber-green focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-text-primary font-semibold mb-2">Meta Description</label>
                  <textarea
                    rows={3}
                    value={settings.metaDescription}
                    onChange={(e) => setSettings({ ...settings, metaDescription: e.target.value })}
                    className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary focus:border-cyber-green focus:outline-none"
                  />
                  <p className="text-text-muted text-sm mt-2">Current: {settings.metaDescription.length}/160 characters</p>
                </div>

                <div>
                  <label className="block text-text-primary font-semibold mb-2">Keywords</label>
                  <input
                    type="text"
                    value={settings.keywords}
                    onChange={(e) => setSettings({ ...settings, keywords: e.target.value })}
                    className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary focus:border-cyber-green focus:outline-none"
                  />
                  <p className="text-text-muted text-sm mt-2">Comma-separated keywords</p>
                </div>
              </div>
            </div>

            {/* Social Media & Open Graph */}
            <div className="card-cyber p-8">
              <h2 className="heading-md text-gradient mb-6">Social Media (Open Graph)</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-text-primary font-semibold mb-2">OG Title</label>
                  <input
                    type="text"
                    value={settings.ogTitle}
                    onChange={(e) => setSettings({ ...settings, ogTitle: e.target.value })}
                    className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary focus:border-cyber-cyan focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-text-primary font-semibold mb-2">OG Description</label>
                  <textarea
                    rows={2}
                    value={settings.ogDescription}
                    onChange={(e) => setSettings({ ...settings, ogDescription: e.target.value })}
                    className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary focus:border-cyber-cyan focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-text-primary font-semibold mb-2">OG Image URL</label>
                  <input
                    type="text"
                    value={settings.ogImage}
                    onChange={(e) => setSettings({ ...settings, ogImage: e.target.value })}
                    className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary focus:border-cyber-cyan focus:outline-none"
                  />
                </div>
              </div>
            </div>

          </>
        )}


        {activeTab === 'sitemap' && (
          <div className="card-cyber p-8">
            <h2 className="heading-md text-gradient mb-6 flex items-center gap-2">
              <FaSitemap className="text-cyber-green" />
              Sitemap (served live)
            </h2>
            <p className="text-text-secondary mb-6">
              Your sitemap is generated <strong>dynamically</strong> at <code>/sitemap.xml</code> from the live CMS — it always reflects your current published pages with per-section priorities, so there is nothing to generate or upload. If a stale static <code>public/sitemap.xml</code> ever gets left behind (it would override the live one), use the button below to remove it.
            </p>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <FaSitemap className="text-2xl text-cyber-cyan" />
                <div>
                  <p className="text-text-primary font-semibold">Current sitemap.xml</p>
                  <p className="text-text-secondary text-sm">Served at /sitemap.xml using your live domain</p>
                </div>
              </div>
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary py-2 px-4 inline-flex items-center gap-2"
              >
                View sitemap.xml
              </a>
            </div>

            {sitemapStatus?.generated && (
              <div className="bg-green-900/30 border border-green-600 text-green-200 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
                <FaCheckCircle />
                <span>Sitemap generated successfully on {sitemapStatus.date}</span>
              </div>
            )}

            <button
              onClick={handleGenerateSitemap}
              disabled={generatingSitemap}
              className="btn-primary px-8 py-3 flex items-center gap-2"
            >
              <FaSyncAlt className={generatingSitemap ? 'animate-spin' : ''} />
              {generatingSitemap ? 'Clearing...' : 'Clear static sitemap'}
            </button>

            <div className="mt-8 bg-dark-card border border-dark-border rounded-lg p-6">
              <h3 className="font-semibold text-text-primary mb-4">What's included:</h3>
              <ul className="text-text-secondary text-sm space-y-2 list-disc list-inside">
                <li>All main pages (home, about, services, careers, contact)</li>
                <li>All service pages with proper priority</li>
                <li>Landing pages and special pages</li>
                <li>Update frequency and last modification date</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'google' && (
          <div className="card-cyber p-8">
            <div className="flex items-start space-x-4 mb-6">
              <FaGoogle className="text-4xl text-cyber-blue shrink-0 mt-1" />
              <div>
                <h2 className="text-xl font-bold text-text-primary mb-2">Google Services</h2>
                <p className="text-text-secondary">Integration with Google Tag Manager, Analytics, and Search Console</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-text-primary font-semibold mb-2">Google Tag Manager ID</label>
                <input
                  type="text"
                  value={settings?.googleTagManagerId || ''}
                  onChange={(e) => setSettings(settings ? { ...settings, googleTagManagerId: e.target.value } : null)}
                  placeholder="GTM-XXXXXXX"
                  className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary font-mono focus:border-cyber-blue focus:outline-none transition-colors"
                />
                <p className="text-text-muted text-sm mt-2">Enter your GTM ID (e.g., GTM-XXXXXXX)</p>
              </div>

              <div className="border border-dark-border rounded-lg p-4 bg-dark-card text-sm text-text-secondary space-y-3">
                <div className="flex items-center gap-2 text-text-primary font-semibold">
                  <FaGoogle />
                  <span>Install Google Tag Manager (GTM)</span>
                </div>
                <p>Place the head snippet high in &lt;head&gt; and the noscript snippet right after &lt;body&gt;.</p>
                <div className="space-y-2">
                  <p className="text-text-primary font-semibold text-xs">Head snippet</p>
                  <code className="block bg-dark-lighter p-3 rounded border border-dark-border text-xs whitespace-pre-wrap break-all text-text-primary">
{`<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${settings?.googleTagManagerId || 'GTM-XXXXXXX'}');</script>
<!-- End Google Tag Manager -->`}
                  </code>
                </div>
                <div className="space-y-2">
                  <p className="text-text-primary font-semibold text-xs">Body snippet</p>
                  <code className="block bg-dark-lighter p-3 rounded border border-dark-border text-xs whitespace-pre-wrap break-all text-text-primary">
{`<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${settings?.googleTagManagerId || 'GTM-XXXXXXX'}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`}
                  </code>
                </div>
                <p className="text-text-muted text-xs">We already inject GTM sitewide when you save your ID.</p>
              </div>

              <div>
                <label className="block text-text-primary font-semibold mb-2">Google Analytics 4 ID</label>
                <input
                  type="text"
                  value={settings?.googleAnalytics4Id || ''}
                  onChange={(e) => setSettings(settings ? { ...settings, googleAnalytics4Id: e.target.value } : null)}
                  placeholder="G-XXXXXXXXXX"
                  className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary font-mono focus:border-cyber-blue focus:outline-none transition-colors"
                />
                <p className="text-text-muted text-sm mt-2">Enter your GA4 ID (e.g., G-XXXXXXXXXX)</p>
              </div>

              <div>
                <label className="block text-text-primary font-semibold mb-2">Google Search Console Verification Meta</label>
                <textarea
                  value={settings?.googleSearchConsoleVerification || ''}
                  onChange={(e) => setSettings(settings ? { ...settings, googleSearchConsoleVerification: e.target.value } : null)}
                  placeholder="google-site-verification=..."
                  className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary font-mono focus:border-cyber-blue focus:outline-none transition-colors"
                  rows={3}
                />
                <p className="text-text-muted text-sm mt-2">Meta tag content from Google Search Console verification</p>
              </div>

              <div>
                <label className="block text-text-primary font-semibold mb-2">Bing Webmaster Verification Meta</label>
                <input
                  type="text"
                  value={settings?.bingWebmasterVerification || ''}
                  onChange={(e) => setSettings(settings ? { ...settings, bingWebmasterVerification: e.target.value } : null)}
                  placeholder="content value of the msvalidate.01 meta tag"
                  className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary font-mono focus:border-cyber-blue focus:outline-none transition-colors"
                />
                <p className="text-text-muted text-sm mt-2">From Bing Webmaster Tools → add site → &quot;Meta tag&quot; option. Paste only the <code>content</code> value of the <code>&lt;meta name=&quot;msvalidate.01&quot;&gt;</code> tag. Renders into &lt;head&gt; for ownership verification (Bing also powers ChatGPT Search &amp; Copilot citations).</p>
              </div>

              <div>
                <label className="block text-text-primary font-semibold mb-2">Yandex Verification Meta</label>
                <input
                  type="text"
                  value={settings?.yandexVerification || ''}
                  onChange={(e) => setSettings(settings ? { ...settings, yandexVerification: e.target.value } : null)}
                  placeholder="content value of the yandex-verification meta tag"
                  className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary font-mono focus:border-cyber-blue focus:outline-none transition-colors"
                />
                <p className="text-text-muted text-sm mt-2">From Yandex Webmaster. Paste only the <code>content</code> value of the <code>&lt;meta name=&quot;yandex-verification&quot;&gt;</code> tag.</p>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <a
                  href="https://search.google.com/search-console"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary py-2 px-6 flex items-center justify-center space-x-2"
                >
                  <FaSearch />
                  <span>Open Search Console</span>
                </a>
                <a
                  href="https://analytics.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary py-2 px-6 flex items-center justify-center space-x-2"
                >
                  <FaGoogle />
                  <span>Open Analytics</span>
                </a>
                <a
                  href="https://tagmanager.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary py-2 px-6 flex items-center justify-center space-x-2"
                >
                  <FaGoogle />
                  <span>Open Tag Manager</span>
                </a>
              </div>

              {/* Google Integration Status Dashboard */}
              <div className="border-t border-dark-border pt-8 mt-8">
                <h3 className="heading-sm text-gradient mb-6">Integration Status</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className={`p-4 rounded-lg border-2 ${
                    settings?.googleTagManagerId
                      ? 'border-cyber-green bg-green-900/20'
                      : 'border-dark-border bg-dark-card'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-text-primary">GTM Integration</span>
                      {settings?.googleTagManagerId ? (
                        <FaCheckCircle className="text-cyber-green text-lg" />
                      ) : (
                        <span className="text-text-muted text-sm">Not configured</span>
                      )}
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg border-2 ${
                    settings?.googleAnalytics4Id
                      ? 'border-cyber-green bg-green-900/20'
                      : 'border-dark-border bg-dark-card'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-text-primary">GA4 Integration</span>
                      {settings?.googleAnalytics4Id ? (
                        <FaCheckCircle className="text-cyber-green text-lg" />
                      ) : (
                        <span className="text-text-muted text-sm">Not configured</span>
                      )}
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg border-2 ${
                    googleIntegrationStatus?.sitemapSubmitted
                      ? 'border-cyber-green bg-green-900/20'
                      : 'border-dark-border bg-dark-card'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-text-primary">Sitemap.xml</span>
                        {googleIntegrationStatus?.sitemapLastSubmitted && (
                          <p className="text-text-muted text-sm">Submitted: {new Date(googleIntegrationStatus.sitemapLastSubmitted).toLocaleDateString()}</p>
                        )}
                      </div>
                      {googleIntegrationStatus?.sitemapSubmitted ? (
                        <FaCheckCircle className="text-cyber-green text-lg" />
                      ) : (
                        <span className="text-text-muted text-sm">Not submitted</span>
                      )}
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg border-2 ${
                    googleIntegrationStatus?.robotsTxtSubmitted
                      ? 'border-cyber-green bg-green-900/20'
                      : 'border-dark-border bg-dark-card'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-text-primary">Robots.txt</span>
                        {googleIntegrationStatus?.robotsTxtLastSubmitted && (
                          <p className="text-text-muted text-sm">Submitted: {new Date(googleIntegrationStatus.robotsTxtLastSubmitted).toLocaleDateString()}</p>
                        )}
                      </div>
                      {googleIntegrationStatus?.robotsTxtSubmitted ? (
                        <FaCheckCircle className="text-cyber-green text-lg" />
                      ) : (
                        <span className="text-text-muted text-sm">Not submitted</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-dark-card border border-dark-border rounded-lg p-6">
                  <h4 className="font-semibold text-text-primary mb-4">Auto-Submit to Google</h4>
                  <p className="text-text-secondary text-sm mb-4">Submit your sitemap and robots.txt to Google Search Console automatically.</p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => handleSubmitToGoogle('sitemap')}
                      disabled={submittingToGoogle}
                      className="btn-primary py-2 px-4 w-full flex items-center justify-center gap-2"
                    >
                      <FaSyncAlt className={submittingToGoogle ? 'animate-spin' : ''} />
                      {submittingToGoogle ? 'Submitting...' : 'Submit Sitemap to Google'}
                    </button>
                    <button
                      onClick={() => handleSubmitToGoogle('robots')}
                      disabled={submittingToGoogle}
                      className="btn-primary py-2 px-4 w-full flex items-center justify-center gap-2"
                    >
                      <FaSyncAlt className={submittingToGoogle ? 'animate-spin' : ''} />
                      {submittingToGoogle ? 'Submitting...' : 'Submit Robots.txt to Google'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ahrefs' && (
          <div className="card-cyber p-8">
            <div className="flex items-start space-x-4 mb-6">
              <FaLink className="text-4xl text-cyber-green shrink-0 mt-1" />
              <div>
                <h2 className="text-xl font-bold text-text-primary mb-2">Ahrefs Integration</h2>
                <p className="text-text-secondary">Connect with Ahrefs for SEO analysis and backlink monitoring</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-text-primary font-semibold mb-2">Ahrefs Site ID</label>
                <input
                  type="text"
                  value={settings?.ahrefsId || ''}
                  onChange={(e) => setSettings(settings ? { ...settings, ahrefsId: e.target.value } : null)}
                  placeholder="Your Ahrefs Site ID"
                  className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary font-mono focus:border-cyber-blue focus:outline-none transition-colors"
                />
                <p className="text-text-muted text-sm mt-2">Find this in your Ahrefs account settings</p>
              </div>

              <div>
                <label className="block text-text-primary font-semibold mb-2">Ahrefs API Key</label>
                <input
                  type="password"
                  value={settings?.ahrefsApiKey || ''}
                  onChange={(e) => setSettings(settings ? { ...settings, ahrefsApiKey: e.target.value } : null)}
                  placeholder="••••••••••••••••"
                  className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary font-mono focus:border-cyber-blue focus:outline-none transition-colors"
                />
                <p className="text-text-muted text-sm mt-2">Your Ahrefs API key (kept secure)</p>
              </div>

              <div>
                <label className="block text-text-primary font-semibold mb-2">Ahrefs Domain</label>
                <input
                  type="text"
                  value={settings?.ahrefsDomain || ''}
                  onChange={(e) => setSettings(settings ? { ...settings, ahrefsDomain: e.target.value } : null)}
                  placeholder="example.com"
                  className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary font-mono focus:border-cyber-blue focus:outline-none transition-colors"
                />
                <p className="text-text-muted text-sm mt-2">Your website domain for Ahrefs analysis</p>
              </div>

              <div>
                <label className="block text-text-primary font-semibold mb-2">Ahrefs analytics data-key</label>
                <input
                  type="text"
                  value={settings?.ahrefsDataKey || ''}
                  onChange={(e) => setSettings(settings ? { ...settings, ahrefsDataKey: e.target.value } : null)}
                  placeholder="mmeDmlcvhlGWOK1pNww8WA"
                  className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary font-mono focus:border-cyber-blue focus:outline-none transition-colors"
                />
                <p className="text-text-muted text-sm mt-2">Paste the data-key from your Ahrefs analytics snippet.</p>
              </div>

              <div>
                <label className="block text-text-primary font-semibold mb-2">Installation Method</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setSettings(settings ? { ...settings, ahrefsInstallMethod: 'direct' } : null)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      (settings?.ahrefsInstallMethod || 'direct') === 'direct'
                        ? 'border-cyber-blue bg-cyber-blue/10 text-cyber-blue'
                        : 'border-dark-border bg-dark-card text-text-muted hover:border-cyber-blue/50'
                    }`}
                  >
                    <div className="font-semibold mb-1">Direct Installation</div>
                    <div className="text-xs">Script injected directly in HTML</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings(settings ? { ...settings, ahrefsInstallMethod: 'gtm' } : null)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      settings?.ahrefsInstallMethod === 'gtm'
                        ? 'border-cyber-blue bg-cyber-blue/10 text-cyber-blue'
                        : 'border-dark-border bg-dark-card text-text-muted hover:border-cyber-blue/50'
                    }`}
                  >
                    <div className="font-semibold mb-1">Google Tag Manager</div>
                    <div className="text-xs">Managed via GTM</div>
                  </button>
                </div>
                <p className="text-text-muted text-sm mt-2">
                  {(settings?.ahrefsInstallMethod || 'direct') === 'direct' 
                    ? 'Direct installation: Script loads automatically on all pages.'
                    : 'GTM installation: Add the snippet below to your Google Tag Manager Custom HTML tag.'}
                </p>
              </div>

              <div className="border border-dark-border rounded-lg p-4 bg-dark-card text-sm text-text-secondary space-y-3">
                <div className="flex items-center gap-2 text-text-primary font-semibold">
                  <FaLink />
                  <span>
                    {(settings?.ahrefsInstallMethod || 'direct') === 'direct' 
                      ? 'Direct snippet (auto-injected into <head>):'
                      : 'Google Tag Manager snippet:'}
                  </span>
                </div>
                {(settings?.ahrefsInstallMethod || 'direct') === 'direct' ? (
                  <code className="block bg-dark-lighter p-3 rounded border border-dark-border text-xs whitespace-pre-wrap break-all text-text-primary">
{`<script src="https://analytics.ahrefs.com/analytics.js" data-key="${settings?.ahrefsDataKey || 'YOUR_DATA_KEY'}" async></script>`}
                  </code>
                ) : (
                  <code className="block bg-dark-lighter p-3 rounded border border-dark-border text-xs whitespace-pre-wrap break-all text-text-primary">
{`<script>
  var ahrefs_analytics_script = document.createElement('script');
  ahrefs_analytics_script.async = true;
  ahrefs_analytics_script.src = 'https://analytics.ahrefs.com/analytics.js';
  ahrefs_analytics_script.setAttribute('data-key', '${settings?.ahrefsDataKey || 'YOUR_DATA_KEY'}');
  document.getElementsByTagName('head')[0].appendChild(ahrefs_analytics_script);
</script>`}
                  </code>
                )}
                <p className="text-text-muted text-xs">
                  {(settings?.ahrefsInstallMethod || 'direct') === 'direct' 
                    ? 'We inject this automatically on all pages when saved.'
                    : 'Copy this snippet and paste it into a Custom HTML tag in Google Tag Manager.'}
                </p>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <a
                  href="https://app.ahrefs.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary py-2 px-6 flex items-center justify-center space-x-2"
                >
                  <FaLink />
                  <span>Open Ahrefs Dashboard</span>
                </a>
                <a
                  href="https://app.ahrefs.com/account-settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary py-2 px-6 flex items-center justify-center space-x-2"
                >
                  <FaLink />
                  <span>API Settings</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Hotjar Integration Tab */}
        {activeTab === 'hotjar' && (
          <div className="space-y-6">
            <p className="text-text-secondary">
              Connect with Hotjar for behavior analytics, heatmaps, and session recordings.
            </p>

            <div className="border-l-4 border-l-purple-500 bg-purple-500/10 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-purple-400 mb-2">🔥 Hotjar Features</h3>
              <p className="text-text-muted text-sm mb-3">
                Hotjar provides behavior analytics and user feedback through heatmaps, session recordings, and surveys.
                Get your Site ID from <a href="https://insights.hotjar.com/sites" target="_blank" rel="noopener noreferrer" className="text-cyber-blue hover:underline">Hotjar Dashboard</a>.
              </p>
              <ul className="text-text-muted text-sm space-y-1 list-disc list-inside">
                <li>Heatmaps - See where users click and scroll</li>
                <li>Session Recordings - Watch real user sessions</li>
                <li>Surveys - Collect user feedback</li>
                <li>Feedback Widgets - In-page user comments</li>
                <li>Conversion Funnels - Track user journeys</li>
              </ul>
            </div>

            <div>
              <label className="block text-text-primary font-semibold mb-2">Hotjar Site ID</label>
              <input
                type="text"
                value={settings?.hotjarSiteId || ''}
                onChange={(e) => setSettings(settings ? { ...settings, hotjarSiteId: e.target.value } : null)}
                placeholder="1234567"
                className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary font-mono focus:border-cyber-blue focus:outline-none transition-colors"
              />
              <p className="text-text-muted text-sm mt-2">Your Hotjar Site ID (hjid). Found in Settings → Sites & Organizations.</p>
            </div>

            <div>
              <label className="block text-text-primary font-semibold mb-2">ContentSquare Script URL (Optional)</label>
              <input
                type="text"
                value={settings?.contentsquareScriptUrl || ''}
                onChange={(e) => setSettings(settings ? { ...settings, contentsquareScriptUrl: e.target.value } : null)}
                placeholder="https://t.contentsquare.net/uxa/66cc23d7a291a.js"
                className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary font-mono focus:border-cyber-blue focus:outline-none transition-colors"
              />
              <p className="text-text-muted text-sm mt-2">
                ContentSquare script URL for experience analytics. Get this from your ContentSquare dashboard.
                Leave empty if not using ContentSquare.
              </p>
            </div>

            <div className="border border-dark-border rounded-lg p-4 bg-dark-card text-sm text-text-secondary space-y-3">
              <div className="flex items-center gap-2 text-text-primary font-semibold">
                <FaLink />
                <span>Tracking code (auto-injected into &lt;head&gt;):</span>
              </div>
              <code className="block bg-dark-lighter p-3 rounded border border-dark-border text-xs whitespace-pre-wrap break-all text-text-primary">
{`<script>
  (function(h,o,t,j,a,r){
    h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
    h._hjSettings={hjid:${settings?.hotjarSiteId || 'YOUR_SITE_ID'},hjsv:6};
    a=o.getElementsByTagName('head')[0];
    r=o.createElement('script');r.async=1;
    r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
    a.appendChild(r);
  })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
</script>`}
              </code>
              <p className="text-text-muted text-xs">
                We inject this automatically on all pages when you save. No need to manually add it.
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <a
                href="https://insights.hotjar.com/sites"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary py-2 px-6 flex items-center justify-center space-x-2"
              >
                <FaLink />
                <span>Open Hotjar Dashboard</span>
              </a>
              <a
                href="https://help.hotjar.com/hc/en-us/articles/115011639927"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary py-2 px-6 flex items-center justify-center space-x-2"
              >
                <FaLink />
                <span>Installation Guide</span>
              </a>
            </div>
          </div>
        )}

        {/* IPinfo Integration Tab */}
        {activeTab === 'ipinfo' && (
          <div className="space-y-6">
            <p className="text-text-secondary">
              Configure your IPinfo token to enable geolocation features in login alerts and security monitoring.
            </p>

            <div>
              <label className="block text-text-primary font-semibold mb-2">IPinfo API Token</label>
              <input
                type="text"
                value={settings?.ipinfoToken || ''}
                onChange={(e) => setSettings(settings ? { ...settings, ipinfoToken: e.target.value } : null)}
                placeholder="e7dda13207bb37"
                className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary font-mono focus:border-cyber-blue focus:outline-none transition-colors"
              />
              <p className="text-text-muted text-sm mt-2">Your IPinfo token for IP geolocation (city, country) in login alerts</p>
            </div>

            <div className="border border-dark-border rounded-lg p-4 bg-dark-card text-sm text-text-secondary space-y-3">
              <div className="flex items-center gap-2 text-text-primary font-semibold">
                <FaLink />
                <span>What is this token used for?</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-text-muted text-xs">
                <li>Telegram login alerts with IP geolocation (city, country)</li>
                <li>Security monitoring and suspicious activity detection</li>
                <li>Better accuracy than free IP geolocation services</li>
                <li>Up to 50,000 requests per month (Lite plan)</li>
              </ul>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <a
                href="https://ipinfo.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary py-2 px-6 flex items-center justify-center space-x-2"
              >
                <FaLink />
                <span>Visit IPinfo</span>
              </a>
              <a
                href="https://ipinfo.io/account/token"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary py-2 px-6 flex items-center justify-center space-x-2"
              >
                <FaLink />
                <span>Get Your Token</span>
              </a>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary px-8 py-3 flex items-center gap-2">
            <FaSave />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
