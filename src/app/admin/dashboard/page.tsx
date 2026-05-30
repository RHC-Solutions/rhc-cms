'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import AdminShell from '@/components/admin/AdminShell';
import { 
  FaUsers, FaFileAlt, FaImages, FaChartLine, FaEye, FaMousePointer,
  FaClock, FaGlobeAmericas, FaDesktop, FaMobile, FaArrowUp, FaArrowDown
} from 'react-icons/fa';

export default function AdminDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const loading = status === 'loading';
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [cmsData, setCmsData] = useState<any>({ pages: 0, media: 0 });

  useEffect(() => {
    // Redirect if not authenticated (middleware should handle this, but just in case)
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    }
  }, [status, router]);

  useEffect(() => {
    // Fetch Google Analytics data
    const fetchAnalytics = async () => {
      try {
        const response = await fetch('/api/cms/google-services');
        if (response.ok) {
          const data = await response.json();
          setAnalyticsData(data);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setAnalyticsLoading(false);
      }
    };

    // Fetch CMS data (pages and media count)
    const fetchCMSData = async () => {
      try {
        const [pagesRes, mediaRes] = await Promise.all([
          fetch('/api/cms/pages'),
          fetch('/api/cms/media')
        ]);
        
        if (pagesRes.ok) {
          const pages = await pagesRes.json();
          setCmsData((prev: any) => ({ ...prev, pages: Array.isArray(pages) ? pages.length : 0 }));
        }
        
        if (mediaRes.ok) {
          const media = await mediaRes.json();
          setCmsData((prev: any) => ({ ...prev, media: Array.isArray(media) ? media.length : 0 }));
        }
      } catch (error) {
        console.error('Failed to fetch CMS data:', error);
      }
    };

    if (status === 'authenticated') {
      fetchAnalytics();
      fetchCMSData();
    }
  }, [status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-cyber-green text-2xl font-mono animate-pulse">&gt; Loading...</div>
      </div>
    );
  }

  // Extract analytics metrics
  const analytics = analyticsData?.analytics;
  const stats = {
    totalUsers: analytics?.totalUsers || 0,
    totalPageViews: analytics?.screenPageViews || 0,
    totalPages: cmsData.pages,
    totalMedia: cmsData.media,
    avgSessionDuration: analytics?.avgSessionDuration || '0:00',
    bounceRate: analytics?.bounceRate || 0,
    newUsers: analytics?.newUsers || 0,
    returningUsers: (analytics?.totalUsers || 0) - (analytics?.newUsers || 0),
  };

  const recentPages: Array<{ title: string; views: number; change: number; trending: 'up' | 'down' }> = 
    analytics?.topPages?.slice(0, 5).map((page: any) => ({
      title: page.pagePath || page.pageTitle || 'Unknown',
      views: page.screenPageViews || 0,
      change: 0,
      trending: 'up' as const
    })) || [];

  const trafficSources: Array<{ source: string; users: number; percentage: number }> = 
    analytics?.trafficSources?.slice(0, 5).map((source: any) => ({
      source: source.sourceMedium || 'Direct',
      users: source.activeUsers || 0,
      percentage: source.percentage || 0
    })) || [];

  const deviceBreakdown = [
    { 
      device: 'Desktop', 
      percentage: analytics?.deviceCategory?.find((d: any) => d.deviceCategory === 'desktop')?.percentage || 0,
      icon: FaDesktop, 
      color: 'cyber-green' 
    },
    { 
      device: 'Mobile', 
      percentage: analytics?.deviceCategory?.find((d: any) => d.deviceCategory === 'mobile')?.percentage || 0,
      icon: FaMobile, 
      color: 'cyber-cyan' 
    },
    { 
      device: 'Tablet', 
      percentage: analytics?.deviceCategory?.find((d: any) => d.deviceCategory === 'tablet')?.percentage || 0,
      icon: FaDesktop, 
      color: 'cyber-blue' 
    },
  ];

  return (
    <AdminShell title="Dashboard">
      {/* Header */}
      <div className="mb-8">
        <h1 className="heading-xl text-gradient mb-2">Dashboard</h1>
        <p className="text-text-secondary">Welcome back! Here's your website overview.</p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-cyber p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <FaUsers className="text-3xl text-cyber-green" />
            <span className="text-xs text-text-muted font-mono">30 Days</span>
          </div>
          <h3 className="text-3xl font-bold text-text-primary mb-1">{stats.totalUsers.toLocaleString()}</h3>
          <p className="text-text-secondary text-sm">Total Users</p>
          <div className="mt-3 flex items-center text-text-muted text-sm">
            <FaClock className="mr-1" />
            <span>{analyticsLoading ? 'Loading...' : stats.totalUsers > 0 ? 'Last 30 days' : 'No data'}</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-cyber p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <FaEye className="text-3xl text-cyber-cyan" />
            <span className="text-xs text-text-muted font-mono">30 Days</span>
          </div>
          <h3 className="text-3xl font-bold text-text-primary mb-1">{stats.totalPageViews.toLocaleString()}</h3>
          <p className="text-text-secondary text-sm">Page Views</p>
          <div className="mt-3 flex items-center text-text-muted text-sm">
            <FaClock className="mr-1" />
            <span>{analyticsLoading ? 'Loading...' : stats.totalPageViews > 0 ? 'Last 30 days' : 'No data'}</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card-cyber p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <FaFileAlt className="text-3xl text-cyber-blue" />
            <span className="text-xs text-text-muted font-mono">Total</span>
          </div>
          <h3 className="text-3xl font-bold text-text-primary mb-1">{stats.totalPages}</h3>
          <p className="text-text-secondary text-sm">Published Pages</p>
          <div className="mt-3 flex items-center text-text-muted text-sm">
            <FaClock className="mr-1" />
            <span>{cmsData.pages > 0 ? `${cmsData.pages} active pages` : 'No pages yet'}</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card-cyber p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <FaImages className="text-3xl text-cyber-purple" />
            <span className="text-xs text-text-muted font-mono">Total</span>
          </div>
          <h3 className="text-3xl font-bold text-text-primary mb-1">{stats.totalMedia}</h3>
          <p className="text-text-secondary text-sm">Media Files</p>
          <div className="mt-3 flex items-center text-text-muted text-sm">
            <FaClock className="mr-1" />
            <span>{cmsData.media > 0 ? `${cmsData.media} files stored` : 'No media yet'}</span>
          </div>
        </motion.div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Top Pages */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="card-cyber p-6"
        >
          <h2 className="heading-md text-gradient mb-6">Top Pages (30 Days)</h2>
          <div className="space-y-4">
            {recentPages.length > 0 ? (
              recentPages.map((page, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-dark-lighter rounded-lg hover:bg-dark-border transition-colors">
                  <div className="flex-1">
                    <h4 className="text-text-primary font-semibold">{page.title}</h4>
                    <p className="text-text-secondary text-sm">{page.views.toLocaleString()} views</p>
                  </div>
                  <div className={`flex items-center ${page.trending === 'up' ? 'text-cyber-green' : 'text-cyber-red'}`}>
                    {page.trending === 'up' ? <FaArrowUp className="mr-1" /> : <FaArrowDown className="mr-1" />}
                    <span className="font-mono text-sm">{Math.abs(page.change)}%</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-text-muted">
                <FaChartLine className="text-5xl mx-auto mb-4 opacity-30" />
                <p>No analytics data available</p>
                <p className="text-sm mt-2">Connect Google Analytics to view page statistics</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Traffic Sources */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="card-cyber p-6"
        >
          <h2 className="heading-md text-gradient mb-6">Traffic Sources</h2>
          <div className="space-y-4">
            {trafficSources.length > 0 ? (
              trafficSources.map((source, idx) => (
                <div key={idx} className="p-4 bg-dark-lighter rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <FaGlobeAmericas className="text-cyber-green mr-2" />
                      <span className="text-text-primary font-semibold">{source.source}</span>
                    </div>
                    <span className="text-text-secondary font-mono text-sm">{source.percentage}%</span>
                  </div>
                  <div className="w-full bg-dark-card rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-cyber-green to-cyber-cyan h-2 rounded-full transition-all duration-500"
                      style={{ width: `${source.percentage}%` }}
                    />
                  </div>
                  <p className="text-text-muted text-xs mt-1">{source.users.toLocaleString()} users</p>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-text-muted">
                <FaGlobeAmericas className="text-5xl mx-auto mb-4 opacity-30" />
                <p>No traffic data available</p>
                <p className="text-sm mt-2">Connect Google Analytics to view traffic sources</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Device Breakdown & Session Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Device Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="card-cyber p-6"
        >
          <h2 className="heading-md text-gradient mb-6">Device Breakdown</h2>
          <div className="space-y-6">
            {deviceBreakdown.map((device, idx) => {
              const Icon = device.icon;
              return (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Icon className={`text-${device.color} text-xl mr-3`} />
                      <span className="text-text-primary font-semibold">{device.device}</span>
                    </div>
                    <span className="text-text-secondary font-mono">{device.percentage}%</span>
                  </div>
                  <div className="w-full bg-dark-card rounded-full h-3">
                    <div
                      className={`bg-gradient-to-r from-${device.color} to-cyber-cyan h-3 rounded-full`}
                      style={{ width: `${device.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Session Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="card-cyber p-6"
        >
          <h2 className="heading-md text-gradient mb-6">Session Statistics</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-dark-lighter rounded-lg text-center">
              <FaClock className="text-cyber-green text-3xl mx-auto mb-3" />
              <h3 className="text-2xl font-bold text-text-primary mb-1">{stats.avgSessionDuration}</h3>
              <p className="text-text-secondary text-sm">Avg Duration</p>
            </div>
            <div className="p-4 bg-dark-lighter rounded-lg text-center">
              <FaMousePointer className="text-cyber-cyan text-3xl mx-auto mb-3" />
              <h3 className="text-2xl font-bold text-text-primary mb-1">{stats.bounceRate}%</h3>
              <p className="text-text-secondary text-sm">Bounce Rate</p>
            </div>
            <div className="p-4 bg-dark-lighter rounded-lg text-center">
              <FaUsers className="text-cyber-blue text-3xl mx-auto mb-3" />
              <h3 className="text-2xl font-bold text-text-primary mb-1">{stats.newUsers.toLocaleString()}</h3>
              <p className="text-text-secondary text-sm">New Users</p>
            </div>
            <div className="p-4 bg-dark-lighter rounded-lg text-center">
              <FaChartLine className="text-cyber-purple text-3xl mx-auto mb-3" />
              <h3 className="text-2xl font-bold text-text-primary mb-1">{stats.returningUsers.toLocaleString()}</h3>
              <p className="text-text-secondary text-sm">Returning Users</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <a href="/admin/pages" className="card-dark p-6 text-center hover:border-cyber-green group transition-all">
          <FaFileAlt className="text-4xl text-cyber-green mx-auto mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="text-text-primary font-semibold">Manage Pages</h3>
        </a>
        <a href="/admin/media" className="card-dark p-6 text-center hover:border-cyber-cyan group transition-all">
          <FaImages className="text-4xl text-cyber-cyan mx-auto mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="text-text-primary font-semibold">Media Library</h3>
        </a>
        <a href="/admin/analytics" className="card-dark p-6 text-center hover:border-cyber-blue group transition-all">
          <FaChartLine className="text-4xl text-cyber-blue mx-auto mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="text-text-primary font-semibold">Full Analytics</h3>
        </a>
        <a href="/admin/users" className="card-dark p-6 text-center hover:border-cyber-purple group transition-all">
          <FaUsers className="text-4xl text-cyber-purple mx-auto mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="text-text-primary font-semibold">User Management</h3>
        </a>
      </motion.div>
    </AdminShell>
  );
}
