'use client';
import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaChartLine, FaUsers, FaDesktop, FaMobile, FaGlobeAmericas, FaSync, FaShieldAlt, FaNetworkWired, FaSearch, FaTachometerAlt, FaDollarSign } from 'react-icons/fa';
import toast from 'react-hot-toast';

interface AnalyticsData {
  users?: number;
  sessions?: number;
  pageviews?: number;
  avgSessionDuration?: string;
  bounceRate?: string;
  deviceBreakdown?: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  topPages?: Array<{
    pagePath: string;
    pageviews: number;
    users: number;
    avgSessionDuration: string;
  }>;
  topCountries?: Array<{
    country: string;
    users: number;
  }>;
  error?: string;
}

interface CloudflareData {
  analytics?: {
    requests?: number;
    bandwidth?: number;
    threats?: number;
    pageviews?: number;
    note?: string;
  };
  zone?: {
    id: string;
    name: string;
    status: string;
    plan: { name: string };
    nameservers: string[];
  };
  accountId?: string;
}

interface GoogleServicesData {
  analytics?: {
    users?: number;
    sessions?: number;
    pageviews?: number;
    avgSessionDuration?: string;
    error?: string;
  };
  searchConsole?: {
    clicks?: number;
    impressions?: number;
    ctr?: string;
    position?: string;
    topQueries?: Array<{
      query: string;
      clicks: number;
      impressions: number;
      ctr: string;
      position: string;
    }>;
    error?: string;
  };
  pageSpeed?: {
    performance?: number;
    accessibility?: number;
    bestPractices?: number;
    seo?: number;
    metrics?: {
      fcp?: string;
      lcp?: string;
      cls?: string;
      tti?: string;
    };
    error?: string;
  };
  lastUpdated?: string;
}

export default function AnalyticsPage() {
  const [gaData, setGaData] = useState<AnalyticsData | null>(null);
  const [cfData, setCfData] = useState<CloudflareData | null>(null);
  const [googleServices, setGoogleServices] = useState<GoogleServicesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gaError, setGaError] = useState<string | null>(null);
  const [cfError, setCfError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setGaError(null);
    setCfError(null);

    // Fetch Google Services (Analytics, Search Console, PageSpeed)
    try {
      const response = await fetch('/api/cms/google-services');
      const result = await response.json();
      setGoogleServices(result);
    } catch (err) {
      console.error('Failed to fetch Google services:', err);
    }

    // Fetch legacy Google Analytics data
    try {
      const response = await fetch('/api/cms/analytics');
      const result = await response.json();
      
      if (result.error) {
        setGaError(result.error);
      } else {
        setGaData(result);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch Google Analytics';
      setGaError(errorMsg);
    }

    // Fetch Cloudflare data
    try {
      const response = await fetch('/api/cms/cloudflare', { credentials: 'include' });
      if (response.ok) {
        const result = await response.json();
        setCfData(result);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        setCfError(errorData.error || 'Failed to load Cloudflare data');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch Cloudflare data';
      setCfError(errorMsg);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
    toast.success('Analytics refreshed successfully');
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };
  
  return (
    <AdminShell title="Analytics">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="heading-xl text-gradient mb-2">Website Analytics</h1>
          <p className="text-text-secondary">Unified analytics from Google Analytics 4 and Cloudflare</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="btn-primary px-4 py-2 flex items-center gap-2"
        >
          <FaSync className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh All'}
        </button>
      </div>

      {loading && !gaData && !cfData ? (
        <div className="card-dark p-8 text-center mb-8">
          <FaSync className="text-4xl text-cyber-cyan animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading analytics data...</p>
        </div>
      ) : (
        <>
          {/* Cloudflare Analytics Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gradient flex items-center gap-2">
                <FaNetworkWired className="text-cyber-cyan" />
                Cloudflare Analytics (24h)
              </h2>
              {cfData?.zone && (
                <a
                  href={`https://dash.cloudflare.com/${cfData?.accountId || ''}/${cfData?.zone?.name || ''}/analytics/traffic`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyber-cyan hover:underline text-sm"
                >
                  Open Cloudflare Dashboard →
                </a>
              )}
            </div>

            {cfError ? (
              <div className="card-dark p-6 mb-4 border-l-4 border-yellow-500">
                <p className="text-yellow-500 font-semibold">⚠️ Cloudflare: {cfError}</p>
                <p className="text-text-secondary text-sm mt-2">Configure Cloudflare credentials in Settings</p>
              </div>
            ) : cfData?.analytics ? (
              <>
                {cfData?.zone?.plan?.name === 'Free Website' && (
                  <div className="card-cyber p-4 mb-4 border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-500/5 to-transparent">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">⚠️</span>
                      <div>
                        <h3 className="font-bold text-amber-400 text-sm">Limited on Free Plan</h3>
                        <p className="text-text-muted text-xs">
                          Detailed analytics require a paid Cloudflare plan (Pro or Business).
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="card-cyber p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-text-muted text-sm">Requests</p>
                        <p className="text-3xl font-bold text-text-primary">
                          {(cfData.analytics.requests || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-4xl text-blue-400 opacity-20">📨</div>
                    </div>
                  </div>

                  <div className="card-cyber p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-text-muted text-sm">Bandwidth</p>
                        <p className="text-3xl font-bold text-text-primary">
                          {formatBytes(cfData.analytics.bandwidth || 0)}
                        </p>
                      </div>
                      <div className="text-4xl text-cyan-400 opacity-20">🌐</div>
                    </div>
                  </div>

                  <div className="card-cyber p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-text-muted text-sm">Threats Blocked</p>
                        <p className="text-3xl font-bold text-text-primary">
                          {(cfData.analytics.threats || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-4xl text-red-400 opacity-20">🚫</div>
                    </div>
                  </div>

                  <div className="card-cyber p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-text-muted text-sm">Page Views</p>
                        <p className="text-3xl font-bold text-text-primary">
                          {(cfData.analytics.pageviews || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-4xl text-green-400 opacity-20">📈</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="card-dark p-6 border-l-4 border-dark-border">
                <p className="text-text-muted">No Cloudflare data available</p>
              </div>
            )}
          </div>

          {/* Google Services (Site Kit Style) */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gradient flex items-center gap-2">
                <FaChartLine className="text-cyber-green" />
                Google Services (Site Kit Integration)
              </h2>
            </div>

            {googleServices ? (
              <>
                {/* Search Console Section */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
                    <FaSearch className="text-blue-400" />
                    Search Console (30d)
                  </h3>
                  {googleServices.searchConsole?.error ? (
                    <div className="card-dark p-6 border-l-4 border-yellow-500">
                      <p className="text-yellow-500 font-semibold">⚠️ {googleServices.searchConsole.error}</p>
                      <p className="text-text-secondary text-sm mt-2">Grant Search Console access to service account</p>
                    </div>
                  ) : googleServices.searchConsole ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="card-cyber p-6">
                          <p className="text-text-muted text-sm">Total Clicks</p>
                          <p className="text-3xl font-bold text-blue-400">
                            {(googleServices.searchConsole.clicks || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="card-cyber p-6">
                          <p className="text-text-muted text-sm">Total Impressions</p>
                          <p className="text-3xl font-bold text-cyan-400">
                            {(googleServices.searchConsole.impressions || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="card-cyber p-6">
                          <p className="text-text-muted text-sm">Avg. CTR</p>
                          <p className="text-3xl font-bold text-green-400">
                            {googleServices.searchConsole.ctr}%
                          </p>
                        </div>
                        <div className="card-cyber p-6">
                          <p className="text-text-muted text-sm">Avg. Position</p>
                          <p className="text-3xl font-bold text-purple-400">
                            {googleServices.searchConsole.position}
                          </p>
                        </div>
                      </div>

                      {/* Top Queries */}
                      {googleServices.searchConsole.topQueries && googleServices.searchConsole.topQueries.length > 0 && (
                        <div className="card-dark p-6">
                          <h4 className="text-lg font-bold text-text-primary mb-4">Top Search Queries</h4>
                          <div className="space-y-3">
                            {googleServices.searchConsole.topQueries.slice(0, 10).map((query, idx) => (
                              <div key={idx} className="flex items-center justify-between p-4 bg-dark-lighter rounded-lg">
                                <div className="flex-1">
                                  <p className="text-text-primary font-semibold">{query.query}</p>
                                  <p className="text-text-secondary text-sm">
                                    {query.clicks} clicks • {query.impressions} impressions • Position {query.position}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-blue-400 font-bold">{query.ctr}%</p>
                                  <p className="text-text-secondary text-xs">CTR</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="card-dark p-6 border-l-4 border-dark-border">
                      <p className="text-text-muted">No Search Console data available</p>
                    </div>
                  )}
                </div>

                {/* PageSpeed Insights Section */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
                    <FaTachometerAlt className="text-green-400" />
                    PageSpeed Insights
                  </h3>
                  {googleServices.pageSpeed?.error ? (
                    <div className="card-dark p-6 border-l-4 border-yellow-500">
                      <p className="text-yellow-500 font-semibold">⚠️ {googleServices.pageSpeed.error}</p>
                      <p className="text-text-secondary text-sm mt-2">PageSpeed API unavailable</p>
                    </div>
                  ) : googleServices.pageSpeed ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="card-cyber p-6">
                          <p className="text-text-muted text-sm">Performance</p>
                          <p className={`text-3xl font-bold ${
                            (googleServices.pageSpeed.performance || 0) >= 90 ? 'text-green-400' :
                            (googleServices.pageSpeed.performance || 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {googleServices.pageSpeed.performance}
                          </p>
                          <p className="text-text-secondary text-xs mt-1">/ 100</p>
                        </div>
                        <div className="card-cyber p-6">
                          <p className="text-text-muted text-sm">Accessibility</p>
                          <p className={`text-3xl font-bold ${
                            (googleServices.pageSpeed.accessibility || 0) >= 90 ? 'text-green-400' :
                            (googleServices.pageSpeed.accessibility || 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {googleServices.pageSpeed.accessibility}
                          </p>
                          <p className="text-text-secondary text-xs mt-1">/ 100</p>
                        </div>
                        <div className="card-cyber p-6">
                          <p className="text-text-muted text-sm">Best Practices</p>
                          <p className={`text-3xl font-bold ${
                            (googleServices.pageSpeed.bestPractices || 0) >= 90 ? 'text-green-400' :
                            (googleServices.pageSpeed.bestPractices || 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {googleServices.pageSpeed.bestPractices}
                          </p>
                          <p className="text-text-secondary text-xs mt-1">/ 100</p>
                        </div>
                        <div className="card-cyber p-6">
                          <p className="text-text-muted text-sm">SEO</p>
                          <p className={`text-3xl font-bold ${
                            (googleServices.pageSpeed.seo || 0) >= 90 ? 'text-green-400' :
                            (googleServices.pageSpeed.seo || 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {googleServices.pageSpeed.seo}
                          </p>
                          <p className="text-text-secondary text-xs mt-1">/ 100</p>
                        </div>
                      </div>

                      {/* Core Web Vitals */}
                      {googleServices.pageSpeed.metrics && (
                        <div className="card-dark p-6">
                          <h4 className="text-lg font-bold text-text-primary mb-4">Core Web Vitals</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-dark-lighter rounded-lg">
                              <p className="text-text-muted text-sm">First Contentful Paint</p>
                              <p className="text-xl font-bold text-text-primary">{googleServices.pageSpeed.metrics.fcp}</p>
                            </div>
                            <div className="p-4 bg-dark-lighter rounded-lg">
                              <p className="text-text-muted text-sm">Largest Contentful Paint</p>
                              <p className="text-xl font-bold text-text-primary">{googleServices.pageSpeed.metrics.lcp}</p>
                            </div>
                            <div className="p-4 bg-dark-lighter rounded-lg">
                              <p className="text-text-muted text-sm">Cumulative Layout Shift</p>
                              <p className="text-xl font-bold text-text-primary">{googleServices.pageSpeed.metrics.cls}</p>
                            </div>
                            <div className="p-4 bg-dark-lighter rounded-lg">
                              <p className="text-text-muted text-sm">Time to Interactive</p>
                              <p className="text-xl font-bold text-text-primary">{googleServices.pageSpeed.metrics.tti}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="card-dark p-6 border-l-4 border-dark-border">
                      <p className="text-text-muted">No PageSpeed data available</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="card-dark p-6 border-l-4 border-dark-border">
                <p className="text-text-muted">Loading Google Services...</p>
              </div>
            )}
          </div>

          {/* Google Analytics Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gradient flex items-center gap-2">
                <FaChartLine className="text-cyber-green" />
                Google Analytics 4 (30d)
              </h2>
              <a
                href="https://analytics.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyber-green hover:underline text-sm"
              >
                Open Google Analytics →
              </a>
            </div>

            {gaError ? (
              <div className="card-dark p-6 border-l-4 border-yellow-500">
                <p className="text-yellow-500 font-semibold">⚠️ Google Analytics: {gaError}</p>
                <p className="text-text-secondary text-sm mt-2">
                  Configure GA4 credentials in Admin → Analytics → Setup
                </p>
              </div>
            ) : gaData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="card-cyber p-6">
                    <FaUsers className="text-3xl text-cyber-green mb-3" />
                    <h3 className="text-2xl font-bold text-text-primary">{gaData.users?.toLocaleString() || 'N/A'}</h3>
                    <p className="text-text-secondary">Total Users</p>
                  </div>
                  <div className="card-cyber p-6">
                    <FaDesktop className="text-3xl text-cyber-cyan mb-3" />
                    <h3 className="text-2xl font-bold text-text-primary">
                      {gaData.deviceBreakdown?.desktop ? 
                        `${((gaData.deviceBreakdown.desktop / (gaData.deviceBreakdown.desktop + gaData.deviceBreakdown.mobile + (gaData.deviceBreakdown.tablet || 0))) * 100).toFixed(1)}%` 
                        : 'N/A'}
                    </h3>
                    <p className="text-text-secondary">Desktop Traffic</p>
                  </div>
                  <div className="card-cyber p-6">
                    <FaMobile className="text-3xl text-cyber-blue mb-3" />
                    <h3 className="text-2xl font-bold text-text-primary">
                      {gaData.deviceBreakdown?.mobile ? 
                        `${((gaData.deviceBreakdown.mobile / (gaData.deviceBreakdown.desktop + gaData.deviceBreakdown.mobile + (gaData.deviceBreakdown.tablet || 0))) * 100).toFixed(1)}%` 
                        : 'N/A'}
                    </h3>
                    <p className="text-text-secondary">Mobile Traffic</p>
                  </div>
                  <div className="card-cyber p-6">
                    <FaGlobeAmericas className="text-3xl text-cyber-purple mb-3" />
                    <h3 className="text-2xl font-bold text-text-primary">{gaData.topCountries?.length || 'N/A'}</h3>
                    <p className="text-text-secondary">Countries</p>
                  </div>
                </div>

                {/* Top Pages */}
                {gaData.topPages && gaData.topPages.length > 0 && (
                  <div className="card-dark p-8 mb-6">
                    <h3 className="text-xl font-bold text-text-primary mb-4">Top Pages</h3>
                    <div className="space-y-3">
                      {gaData.topPages.map((page, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-dark-lighter rounded-lg">
                          <div className="flex-1">
                            <p className="text-text-primary font-semibold">{page.pagePath}</p>
                            <p className="text-text-secondary text-sm">{page.users} users • {page.pageviews} pageviews</p>
                          </div>
                          <div className="text-right">
                            <p className="text-cyber-cyan font-bold">{page.pageviews}</p>
                            <p className="text-text-secondary text-xs">views</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Countries */}
                {gaData.topCountries && gaData.topCountries.length > 0 && (
                  <div className="card-dark p-8">
                    <h3 className="text-xl font-bold text-text-primary mb-4">Top Countries</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {gaData.topCountries.slice(0, 10).map((country, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-dark-lighter rounded-lg">
                          <span className="text-text-primary">{country.country}</span>
                          <span className="text-cyber-cyan font-bold">{country.users.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="card-dark p-6 border-l-4 border-dark-border">
                <p className="text-text-muted">No Google Analytics data available</p>
              </div>
            )}
          </div>

          {/* Quick Links Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Google Analytics Links */}
            <div className="card-dark p-6">
              <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                <FaChartLine className="text-cyber-green" />
                Google Analytics Features
              </h3>
              <div className="space-y-2">
                {[
                  { name: 'Real-time Overview', url: 'https://analytics.google.com/analytics/web/#/p314493630/realtime/overview', icon: '⚡' },
                  { name: 'Reports Snapshot', url: 'https://analytics.google.com/analytics/web/#/p314493630/reports/intelligenthome', icon: '📈' },
                  { name: 'Traffic Sources', url: 'https://analytics.google.com/analytics/web/#/p314493630/reports/acquisition', icon: '🔍' },
                  { name: 'User Demographics', url: 'https://analytics.google.com/analytics/web/#/p314493630/reports/reportinghub?params=_u..nav%3Dmaui', icon: '👥' }
                ].map((feature, idx) => (
                  <a
                    key={idx}
                    href={feature.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-3 p-3 bg-dark-lighter rounded-lg hover:bg-dark-border transition-colors group"
                  >
                    <span className="text-xl">{feature.icon}</span>
                    <span className="text-text-primary group-hover:text-cyber-green transition-colors text-sm">{feature.name}</span>
                    <span className="ml-auto text-text-secondary text-xs">→</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Cloudflare Links */}
            {cfData?.zone && (
              <div className="card-dark p-6">
                <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                  <FaShieldAlt className="text-cyber-cyan" />
                  Cloudflare Features
                </h3>
                <div className="space-y-2">
                  {[
                    { name: 'Live Traffic Analytics', url: `https://dash.cloudflare.com/${cfData.accountId}/${cfData.zone.name}/analytics/traffic`, icon: '📊' },
                    { name: 'Security Events', url: `https://dash.cloudflare.com/${cfData.accountId}/${cfData.zone.name}/security/events`, icon: '🛡️' },
                    { name: 'DNS Records', url: `https://dash.cloudflare.com/${cfData.accountId}/${cfData.zone.name}/dns`, icon: '🌐' },
                    { name: 'Firewall Rules', url: `https://dash.cloudflare.com/${cfData.accountId}/${cfData.zone.name}/security/waf`, icon: '🔥' }
                  ].map((feature, idx) => (
                    <a
                      key={idx}
                      href={feature.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-3 p-3 bg-dark-lighter rounded-lg hover:bg-dark-border transition-colors group"
                    >
                      <span className="text-xl">{feature.icon}</span>
                      <span className="text-text-primary group-hover:text-cyber-cyan transition-colors text-sm">{feature.name}</span>
                      <span className="ml-auto text-text-secondary text-xs">→</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </AdminShell>
  );
}
