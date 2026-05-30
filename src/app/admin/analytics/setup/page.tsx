'use client';
import { useState, useCallback } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { FaKey, FaGlobe, FaCheck, FaTimes, FaEye, FaEyeSlash, FaSync, FaTrash } from 'react-icons/fa';
import toast from 'react-hot-toast';

interface GA4Config {
  propertyId: string;
  serviceAccountEmail: string;
  privateKey: string;
  keyId: string;
  projectId: string;
}

interface TestResult {
  field: string;
  status: 'success' | 'error' | 'warning';
  message: string;
}

export default function AnalyticsSetupPage() {
  const [config, setConfig] = useState<GA4Config>({
    propertyId: '',
    serviceAccountEmail: '',
    privateKey: '',
    keyId: '',
    projectId: '',
  });

  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [statusBadges, setStatusBadges] = useState<Record<string, boolean>>({});

  // Load existing configuration
  const loadConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/analytics/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        
        // Set status badges
        setStatusBadges({
          propertyId: !!data.propertyId,
          serviceAccountEmail: !!data.serviceAccountEmail,
          privateKey: !!data.privateKey,
          keyId: !!data.keyId,
          projectId: !!data.projectId,
        });
      }
    } catch (error) {
      console.error('Failed to load GA4 config:', error);
    }
  }, []);

  // Load config on mount
  const handleMount = useCallback(() => {
    loadConfig();
  }, [loadConfig]);

  useState(() => {
    handleMount();
  });

  const handleChange = (field: keyof GA4Config, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value.trim() }));
  };

  const handleTestConfiguration = async () => {
    if (!config.propertyId || !config.serviceAccountEmail || !config.privateKey) {
      toast.error('Please fill in all required fields first');
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/admin/analytics/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json();
      setTestResults(data.results || []);

      if (data.status === 'success') {
        toast.success('✓ All credentials verified!');
      } else if (data.status === 'warning') {
        toast('⚠ Some credentials need attention', { icon: '⚠️' });
      } else {
        toast.error('✗ Configuration test failed');
      }
    } catch (error) {
      toast.error('Failed to test configuration');
      console.error(error);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfiguration = async () => {
    if (!config.propertyId) {
      toast.error('Property ID is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/analytics/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (response.ok) {
        setStatusBadges({
          propertyId: !!config.propertyId,
          serviceAccountEmail: !!config.serviceAccountEmail,
          privateKey: !!config.privateKey,
          keyId: !!config.keyId,
          projectId: !!config.projectId,
        });
        toast.success('✓ Analytics configuration saved!');
      } else {
        toast.error(data.message || 'Failed to save configuration');
      }
    } catch (error) {
      toast.error('Failed to save configuration');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        
        // Extract fields from Google service account JSON
        const newConfig = {
          propertyId: config.propertyId, // Keep existing property ID
          serviceAccountEmail: json.client_email || '',
          privateKey: json.private_key || '',
          keyId: json.private_key_id || '',
          projectId: json.project_id || '',
        };
        
        setConfig(newConfig);
        setStatusBadges({
          propertyId: !!newConfig.propertyId,
          serviceAccountEmail: !!newConfig.serviceAccountEmail,
          privateKey: !!newConfig.privateKey,
          keyId: !!newConfig.keyId,
          projectId: !!newConfig.projectId,
        });
        
        toast.success('✓ JSON file loaded successfully!');
      } catch (error) {
        toast.error('Failed to parse JSON file');
        console.error(error);
      }
    };
    reader.readAsText(file);
    
    // Reset input so same file can be uploaded again
    event.target.value = '';
  };

  const handleClearAll = () => {
    if (confirm('Clear all analytics credentials?')) {
      setConfig({
        propertyId: '',
        serviceAccountEmail: '',
        privateKey: '',
        keyId: '',
        projectId: '',
      });
      setStatusBadges({
        propertyId: false,
        serviceAccountEmail: false,
        privateKey: false,
        keyId: false,
        projectId: false,
      });
      toast.success('✓ Credentials cleared');
    }
  };

  return (
    <AdminShell title="Analytics Setup">
      <div className="mb-8">
        <h1 className="heading-xl text-gradient mb-2">Google Analytics 4 Configuration</h1>
        <p className="text-text-secondary">Configure your GA4 credentials to display real analytics data</p>
      </div>

      {/* Quick Start Guide */}
      <div className="card-cyber p-6 mb-8 border-l-4 border-cyber-cyan">
        <h3 className="text-lg font-bold text-cyber-cyan mb-3">Quick Start Guide</h3>
        <ol className="space-y-3 text-text-secondary text-sm">
          <li><strong>1.</strong> Go to <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer" className="text-cyber-cyan hover:underline font-bold">Google Analytics</a> → Click <strong>Admin</strong> (bottom left) → Under <strong>Property</strong>, find your <strong>Property ID</strong> (8-10 digits)</li>
          <li><strong>2.</strong> Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-cyber-cyan hover:underline font-bold">Google Cloud Console</a></li>
          <li><strong>3.</strong> Create a new project (or select existing)</li>
          <li><strong>4.</strong> <a href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-cyber-cyan hover:underline">Enable Google Analytics Data API</a></li>
          <li><strong>5.</strong> Go to <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="text-cyber-cyan hover:underline">Service Accounts</a> → Create Service Account</li>
          <li><strong>6.</strong> Add role: <strong>Viewer</strong> to the service account</li>
          <li><strong>7.</strong> Create <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="text-cyber-cyan hover:underline">JSON key</a> and paste it below</li>
          <li><strong>8.</strong> In <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer" className="text-cyber-cyan hover:underline">Google Analytics</a> → Admin → <strong>Property Access Management</strong> → Grant service account <strong>Editor</strong> access</li>
        </ol>
      </div>

      {/* Upload JSON File */}
      <div className="card-dark p-6 mb-8 border-l-4 border-cyber-green">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-cyber-green mb-2">📤 Quick Setup: Upload Service Account JSON</h3>
            <p className="text-text-secondary text-sm">Upload your Google service account JSON file to automatically populate all fields</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <label className="btn-primary cursor-pointer flex items-center space-x-2">
            <FaKey />
            <span>Choose JSON File</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleUploadJson}
              className="hidden"
            />
          </label>
          <p className="text-text-secondary text-sm">
            This will auto-fill: Service Account Email, Private Key, Project ID, and Key ID
          </p>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="space-y-6 mb-8">
        
        {/* Property ID */}
        <div className="card-dark p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FaGlobe className="text-cyber-green" />
              <label className="text-lg font-bold text-text-primary">Property ID</label>
              <span className="text-xs px-2 py-1 rounded bg-cyber-green/20 text-cyber-green">PUBLIC</span>
            </div>
            <div className={`text-sm px-3 py-1 rounded font-bold ${statusBadges.propertyId ? 'bg-cyber-green/20 text-cyber-green' : 'bg-red-500/20 text-red-400'}`}>
              {statusBadges.propertyId ? '✅ SET' : '❌ EMPTY'}
            </div>
          </div>
          <input
            type="text"
            value={config.propertyId}
            onChange={(e) => handleChange('propertyId', e.target.value)}
            placeholder="e.g., 123456789"
            className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-cyber-green"
          />
          <p className="text-xs text-text-secondary mt-2">The GA4 property ID from your Google Analytics account</p>
        </div>

        {/* Service Account Email */}
        <div className="card-dark p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FaKey className="text-cyber-cyan" />
              <label className="text-lg font-bold text-text-primary">Service Account Email</label>
              <span className="text-xs px-2 py-1 rounded bg-cyber-cyan/20 text-cyber-cyan">PUBLIC</span>
            </div>
            <div className={`text-sm px-3 py-1 rounded font-bold ${statusBadges.serviceAccountEmail ? 'bg-cyber-green/20 text-cyber-green' : 'bg-red-500/20 text-red-400'}`}>
              {statusBadges.serviceAccountEmail ? '✅ SET' : '❌ EMPTY'}
            </div>
          </div>
          <input
            type="email"
            value={config.serviceAccountEmail}
            onChange={(e) => handleChange('serviceAccountEmail', e.target.value)}
            placeholder="e.g., service-account@project.iam.gserviceaccount.com"
            className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-cyber-cyan"
          />
          <p className="text-xs text-text-secondary mt-2">From your Google Cloud Service Account JSON key</p>
        </div>

        {/* Project ID */}
        <div className="card-dark p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FaGlobe className="text-cyber-blue" />
              <label className="text-lg font-bold text-text-primary">Project ID</label>
              <span className="text-xs px-2 py-1 rounded bg-cyber-blue/20 text-cyber-blue">PUBLIC</span>
            </div>
            <div className={`text-sm px-3 py-1 rounded font-bold ${statusBadges.projectId ? 'bg-cyber-green/20 text-cyber-green' : 'bg-red-500/20 text-red-400'}`}>
              {statusBadges.projectId ? '✅ SET' : '❌ EMPTY'}
            </div>
          </div>
          <input
            type="text"
            value={config.projectId}
            onChange={(e) => handleChange('projectId', e.target.value)}
            placeholder="e.g., my-google-cloud-project"
            className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-cyber-blue"
          />
          <p className="text-xs text-text-secondary mt-2">Your Google Cloud Project ID</p>
        </div>

        {/* Key ID */}
        <div className="card-dark p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FaKey className="text-cyber-purple" />
              <label className="text-lg font-bold text-text-primary">Key ID</label>
              <span className="text-xs px-2 py-1 rounded bg-cyber-purple/20 text-cyber-purple">PUBLIC</span>
            </div>
            <div className={`text-sm px-3 py-1 rounded font-bold ${statusBadges.keyId ? 'bg-cyber-green/20 text-cyber-green' : 'bg-red-500/20 text-red-400'}`}>
              {statusBadges.keyId ? '✅ SET' : '❌ EMPTY'}
            </div>
          </div>
          <input
            type="text"
            value={config.keyId}
            onChange={(e) => handleChange('keyId', e.target.value)}
            placeholder="e.g., 1a2b3c4d5e6f7g8h9i0j"
            className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-cyber-purple"
          />
          <p className="text-xs text-text-secondary mt-2">The private key ID from your JSON key</p>
        </div>

        {/* Private Key */}
        <div className="card-dark p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FaKey className="text-red-500" />
              <label className="text-lg font-bold text-text-primary">Private Key</label>
              <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">SECRET</span>
            </div>
            <div className={`text-sm px-3 py-1 rounded font-bold ${statusBadges.privateKey ? 'bg-cyber-green/20 text-cyber-green' : 'bg-red-500/20 text-red-400'}`}>
              {statusBadges.privateKey ? '✅ SET' : '❌ EMPTY'}
            </div>
          </div>
          <div className="relative">
            <textarea
              value={config.privateKey}
              onChange={(e) => handleChange('privateKey', e.target.value)}
              placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;MIIE...&#10;-----END RSA PRIVATE KEY-----"
              className="w-full px-4 py-2 bg-dark-lighter border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-red-500 font-mono text-xs h-32 resize-none"
            />
            <button
              onClick={() => setShowPrivateKey(!showPrivateKey)}
              className="absolute right-3 top-3 text-text-secondary hover:text-text-primary transition"
            >
              {showPrivateKey ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
          <p className="text-xs text-text-secondary mt-2">The "private_key" value from your Google Cloud JSON key (keep this secure!)</p>
        </div>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="card-dark p-6 mb-8">
          <h3 className="text-lg font-bold text-text-primary mb-4">Test Results</h3>
          <div className="space-y-2">
            {testResults.map((result, idx) => (
              <div key={idx} className="flex items-start space-x-3 p-3 bg-dark-lighter rounded-lg">
                <div className="mt-1">
                  {result.status === 'success' ? (
                    <FaCheck className="text-cyber-green" />
                  ) : result.status === 'warning' ? (
                    <div className="text-yellow-500">⚠</div>
                  ) : (
                    <FaTimes className="text-red-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-text-primary capitalize">{result.field}</div>
                  <div className={`text-sm ${result.status === 'success' ? 'text-cyber-green' : result.status === 'warning' ? 'text-yellow-500' : 'text-red-400'}`}>
                    {result.message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={handleTestConfiguration}
          disabled={loading || testing}
          className="btn-secondary flex items-center space-x-2 disabled:opacity-50"
        >
          <FaSync className={testing ? 'animate-spin' : ''} />
          <span>{testing ? 'Testing...' : 'Test Configuration'}</span>
        </button>
        <button
          onClick={handleSaveConfiguration}
          disabled={loading || testing}
          className="btn-primary flex items-center space-x-2 disabled:opacity-50"
        >
          <FaCheck />
          <span>{loading ? 'Saving...' : 'Save All Configuration'}</span>
        </button>
        <button
          onClick={handleClearAll}
          disabled={loading || testing}
          className="btn-danger flex items-center space-x-2 disabled:opacity-50"
        >
          <FaTrash />
          <span>Clear All</span>
        </button>
      </div>

      {/* Troubleshooting */}
      <div className="card-dark p-6 mt-8">
        <h3 className="text-lg font-bold text-text-primary mb-4">Troubleshooting</h3>
        <div className="space-y-4 text-sm text-text-secondary">
          <div>
            <strong className="text-text-primary">Service Account Not Found</strong>
            <p className="mt-1">Make sure the service account email is added in Google Analytics with Editor role: Admin → Account Access Management</p>
          </div>
          <div>
            <strong className="text-text-primary">API Not Enabled</strong>
            <p className="mt-1">Enable Google Analytics Data API in Google Cloud Console → APIs & Services → Enable APIs</p>
          </div>
          <div>
            <strong className="text-text-primary">Invalid Private Key</strong>
            <p className="mt-1">Copy the entire "private_key" value from your JSON file (including BEGIN/END markers)</p>
          </div>
          <div>
            <strong className="text-text-primary">Property ID Error</strong>
            <p className="mt-1">Use the numeric Property ID (8-10 digits), not the Measurement ID. Find it in GA4 Admin → Properties</p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
