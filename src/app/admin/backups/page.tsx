'use client';

import { useEffect, useState } from 'react';
import { FaDownload, FaTrash, FaSync, FaUpload, FaCheck, FaTimes, FaDatabase, FaClock, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { useToast } from '@adminpanel/components/admin/Toast';
import AdminShell from '@adminpanel/components/admin/AdminShell';

const RETENTION_DAYS = 14;

interface Backup {
  name: string;
  date: string;
  size: number;
  sizeMB: string;
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [backupSettings, setBackupSettings] = useState({
    botToken: '',
    chatId: '',
  });
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<{ success: boolean; message: string; botName?: string } | null>(null);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [schedulerSettings, setSchedulerSettings] = useState({
    enabled: false,
    frequency: 'daily', // daily, weekly, custom
    time: '02:00', // 2 AM by default
    dayOfWeek: 'sunday', // for weekly
  });
  const [savingScheduler, setSavingScheduler] = useState(false);
  const { addToast } = useToast();

  const fetchBackups = async () => {
    try {
      const response = await fetch('/api/cms/backups');
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
      } else {
        addToast('error', 'Failed to load backups');
      }
    } catch (error) {
      console.error('Error fetching backups:', error);
      addToast('error', 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  const fetchTelegramSettings = async () => {
    try {
      const response = await fetch('/api/cms/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.telegram?.botToken && data.telegram?.chatId) {
          setBackupSettings({
            botToken: data.telegram.botToken,
            chatId: data.telegram.chatId,
          });
          setTelegramConfigured(true);
        } else {
          setTelegramConfigured(false);
        }
      }
    } catch (error) {
      console.error('Error fetching Telegram settings:', error);
      setTelegramConfigured(false);
    }
  };

  const fetchSchedulerSettings = async () => {
    try {
      const response = await fetch('/api/cms/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.scheduler) {
          setSchedulerSettings(data.scheduler);
        }
      }
    } catch (error) {
      console.error('Error fetching scheduler settings:', error);
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchTelegramSettings();
    fetchSchedulerSettings();
  }, []);

  const handleCreateBackup = async () => {
    const confirmed = confirm('Create a COMPLETE full site backup? This will archive:\n\n✓ CMS Data (SQLite database, all content)\n✓ Source Code (src/ - complete application)\n✓ Public Assets (public/ - uploads, images)\n✓ Scripts & Functions (utility and serverless)\n✓ Documentation (docs_archived/)\n✓ Configuration Files (ALL - package.json, middleware.ts, etc; settings and secrets are in the database)\n✓ Build Configs (tailwind, typescript, postcss)\n✓ Deployment Configs (wrangler, ecosystem, headers, redirects)\n✓ VS Code Settings (.vscode/)\n\nThis is a COMPLETE portable backup ready for disaster recovery.\nAfter extraction, run: npm install && npm run build\n\nBackups under 50MB will be sent to Telegram.\nLarger backups are stored locally only.');
    if (!confirmed) return;

    setCreating(true);
    try {
      const response = await fetch('/api/cms/backups', { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        const telegramStatus = data.backup.telegram?.sent 
          ? `Sent to Telegram (${data.backup.telegram.message})`
          : `Telegram: ${data.backup.telegram?.message || 'Not sent'}`;
        
        addToast('success', `Backup created: ${data.backup.name}\n${telegramStatus}`);
        fetchBackups();
      } else {
        addToast('error', data.error || 'Failed to create backup');
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      addToast('error', 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBackup = async (backupName: string) => {
    const confirmed = confirm(`Delete backup ${backupName}?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/cms/backups?name=${encodeURIComponent(backupName)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        addToast('success', 'Backup deleted');
        fetchBackups();
      } else {
        const data = await response.json();
        addToast('error', data.error || 'Failed to delete backup');
      }
    } catch (error) {
      console.error('Error deleting backup:', error);
      addToast('error', 'Failed to delete backup');
    }
  };

  const handleDownloadBackup = (backupName: string) => {
    // Download via API endpoint
    const link = document.createElement('a');
    link.href = `/api/cms/backups?download=${encodeURIComponent(backupName)}`;
    link.download = backupName;
    link.click();
  };

  const handleRestoreBackup = async (backupName: string) => {
    const confirmed = confirm(
      `⚠️ RESTORE BACKUP - ${backupName}\n\n` +
      `This will restore:\n` +
      `✓ CMS Data (users, forms, pages, jobs, settings)\n` +
      `✓ Theme and Typography settings\n` +
      `✓ All media metadata\n\n` +
      `Source code and assets are NOT restored automatically.\n` +
      `See BACKUP_MANIFEST.json for full redeployment instructions.\n\n` +
      `This action cannot be undone. Are you sure?`
    );
    if (!confirmed) return;

    setRestoring(true);
    try {
      const response = await fetch('/api/cms/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupName }),
      });

      const data = await response.json();

      if (response.ok) {
        addToast('success', `Backup restored: ${backupName}\n\n${data.message}`);
        setShowRestoreModal(false);
        // Refresh page after restore to load new data
        setTimeout(() => window.location.reload(), 2000);
      } else {
        addToast('error', data.error || 'Failed to restore backup');
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      addToast('error', 'Failed to restore backup');
    } finally {
      setRestoring(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!backupSettings.botToken || !backupSettings.chatId) {
      addToast('error', 'Please enter both bot token and chat ID');
      return;
    }

    setTestingTelegram(true);
    try {
      const response = await fetch('/api/cms/telegram-test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: backupSettings.botToken.trim(),
          chatId: backupSettings.chatId.trim(),
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setTelegramStatus({ 
          success: true, 
          message: data.message,
          botName: data.botName,
        });
        addToast('success', `Telegram test successful!\nBot: ${data.botName}`);
      } else {
        setTelegramStatus({ 
          success: false, 
          message: data.message,
        });
        addToast('error', `Telegram test failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Error testing Telegram:', error);
      setTelegramStatus({
        success: false,
        message: 'Failed to test Telegram connection',
      });
      addToast('error', 'Failed to test Telegram connection');
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleSaveTelegram = async () => {
    if (!backupSettings.botToken || !backupSettings.chatId) {
      addToast('error', 'Please enter both bot token and chat ID');
      return;
    }

    try {
      const response = await fetch('/api/cms/telegram', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: backupSettings.botToken.trim(),
          chatId: backupSettings.chatId.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTelegramConfigured(true);
        addToast('success', 'Telegram settings saved successfully!');
      } else {
        addToast('error', data.error || 'Failed to save Telegram settings');
      }
    } catch (error) {
      console.error('Error saving Telegram settings:', error);
      addToast('error', 'Failed to save Telegram settings');
    }
  };

  const handleSaveScheduler = async () => {
    if (!schedulerSettings.enabled && !schedulerSettings.frequency) {
      addToast('error', 'Please configure scheduler settings');
      return;
    }

    setSavingScheduler(true);
    try {
      const response = await fetch('/api/cms/scheduler', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedulerSettings),
      });

      const data = await response.json();

      if (response.ok) {
        addToast('success', 'Scheduler settings saved successfully!');
      } else {
        addToast('error', data.error || 'Failed to save scheduler settings');
      }
    } catch (error) {
      console.error('Error saving scheduler settings:', error);
      addToast('error', 'Failed to save scheduler settings');
    } finally {
      setSavingScheduler(false);
    }
  };

  return (
    <AdminShell title="System Backups">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="heading-xl">System Backups</h1>
          <p className="text-text-secondary text-sm mt-1">Manage CMS data backups and recovery archives</p>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={creating}
          className="btn-primary"
        >
          <FaSync className={creating ? 'animate-spin' : ''} aria-hidden="true" />
          {creating ? 'Creating...' : 'Create Backup'}
        </button>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm">
        <h3 className="text-sm font-semibold text-cyan-300 mb-2">Full Site Backups</h3>
        <ul className="text-text-secondary space-y-1">
          <li className="flex items-start gap-2"><FaCheck className="mt-0.5 shrink-0 text-xs text-cyan-300" aria-hidden="true" />Complete disaster recovery backups (CMS Data + Source Code + Assets)</li>
          <li className="flex items-start gap-2"><FaCheck className="mt-0.5 shrink-0 text-xs text-cyan-300" aria-hidden="true" />Automatically sent to Telegram for secure cloud storage</li>
          <li className="flex items-start gap-2"><FaCheck className="mt-0.5 shrink-0 text-xs text-cyan-300" aria-hidden="true" />Local backups retained for {RETENTION_DAYS} days</li>
          <li className="flex items-start gap-2"><FaCheck className="mt-0.5 shrink-0 text-xs text-cyan-300" aria-hidden="true" />Ready for immediate redeployment in case of data loss</li>
          <li className="flex items-start gap-2"><FaCheck className="mt-0.5 shrink-0 text-xs text-cyan-300" aria-hidden="true" />Click the button above to create a manual backup</li>
        </ul>
      </div>

      {/* Backups List */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-secondary">Loading backups...</div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">No backups found. Create one to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-dark-lighter border-b border-dark-border">
                <tr>
                  <th className="px-6 py-3 text-left text-text-muted text-xs uppercase tracking-wide font-semibold">Backup Name</th>
                  <th className="px-6 py-3 text-left text-text-muted text-xs uppercase tracking-wide font-semibold">Date</th>
                  <th className="px-6 py-3 text-left text-text-muted text-xs uppercase tracking-wide font-semibold">Size</th>
                  <th className="px-6 py-3 text-right text-text-muted text-xs uppercase tracking-wide font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {backups.map((backup) => (
                  <tr key={backup.name} className="hover:bg-dark-lighter transition-colors">
                    <td className="px-6 py-4 text-text-primary font-mono text-sm">{backup.name}</td>
                    <td className="px-6 py-4 text-text-secondary">
                      {new Date(backup.date).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{backup.sizeMB} MB</td>
                    <td className="px-6 py-4 text-right space-x-2 flex justify-end">
                      <button
                        onClick={() => handleRestoreBackup(backup.name)}
                        disabled={restoring}
                        className="p-2 text-green-400 hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed rounded transition"
                        title="Restore backup"
                        aria-label={`Restore backup ${backup.name}`}
                      >
                        <FaUpload size={16} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleDownloadBackup(backup.name)}
                        className="p-2 text-blue-400 hover:bg-blue-500/10 rounded transition"
                        title="Download backup"
                        aria-label={`Download backup ${backup.name}`}
                      >
                        <FaDownload size={16} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleDeleteBackup(backup.name)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded transition"
                        title="Delete backup"
                        aria-label={`Delete backup ${backup.name}`}
                      >
                        <FaTrash size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Telegram Settings */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FaDatabase className="text-2xl text-green-400" aria-hidden="true" />
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Backup & Disaster Recovery</h3>
              {telegramConfigured && (
                <p className="text-green-300 text-sm mt-1 flex items-center gap-1.5"><FaCheckCircle className="text-green-400" aria-hidden="true" />Telegram is configured and ready</p>
              )}
              {!telegramConfigured && (
                <p className="text-yellow-300 text-sm mt-1 flex items-center gap-1.5"><FaExclamationTriangle className="text-yellow-400" aria-hidden="true" />Telegram not configured yet</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm">
            <p className="text-text-secondary">
              <strong>Configure Telegram</strong> to automatically send backups to your Telegram chat for secure cloud storage.
              Each backup can be up to 50MB and includes your complete site (CMS data, source code, and assets).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Telegram Bot Token</label>
            <input
              type="password"
              placeholder="123456:ABCDEfghIjklmnopqrSTUVwxyz"
              value={backupSettings.botToken}
              onChange={(e) => setBackupSettings({ ...backupSettings, botToken: e.target.value })}
              className="w-full bg-dark-input border border-dark-border rounded-lg py-2 px-3 text-text-primary 
                       focus:border-green-400 focus:outline-none"
            />
            <p className="text-text-secondary text-xs mt-1">Get from @BotFather on Telegram</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Telegram Chat ID</label>
            <input
              type="text"
              placeholder="123456789"
              value={backupSettings.chatId}
              onChange={(e) => setBackupSettings({ ...backupSettings, chatId: e.target.value })}
              className="w-full bg-dark-input border border-dark-border rounded-lg py-2 px-3 text-text-primary 
                       focus:border-green-400 focus:outline-none"
            />
            <p className="text-text-secondary text-xs mt-1">Get from getUpdates API or use your user ID</p>
          </div>

          {/* Test Result Status */}
          {telegramStatus && (
            <div className={`rounded-lg border p-4 text-sm flex items-start gap-3 ${
              telegramStatus.success
                ? 'border-green-500/30 bg-green-500/10'
                : 'border-red-500/30 bg-red-500/10'
            }`}>
              {telegramStatus.success ? (
                <FaCheck className="text-green-400 mt-0.5 shrink-0" aria-hidden="true" />
              ) : (
                <FaTimes className="text-red-400 mt-0.5 shrink-0" aria-hidden="true" />
              )}
              <div className="flex-1">
                <p className={telegramStatus.success ? 'text-sm font-semibold text-green-300' : 'text-sm font-semibold text-red-300'}>
                  {telegramStatus.success ? 'Test Successful' : 'Test Failed'}
                </p>
                <p className="text-text-secondary">
                  {telegramStatus.message}
                </p>
                {telegramStatus.botName && (
                  <p className="text-text-secondary mt-1">
                    <strong>Bot Name:</strong> {telegramStatus.botName}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Test Button */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleTestTelegram}
              disabled={testingTelegram || !backupSettings.botToken || !backupSettings.chatId}
              className="btn-secondary"
            >
              {testingTelegram ? 'Testing...' : 'Test'}
            </button>
            <button
              onClick={handleSaveTelegram}
              disabled={!backupSettings.botToken || !backupSettings.chatId}
              className="btn-primary"
            >
              Save Settings
            </button>
          </div>

          <p className="text-text-secondary text-sm">
            Click "Test" to verify credentials, then "Save Settings" to store them for automatic backups.
          </p>
        </div>
      </div>

      {/* Scheduler Settings */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FaClock className="text-2xl text-blue-400" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-text-primary">Automated Backup Scheduler</h3>
          </div>
        </div>

        <div className="space-y-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary">Enable Automated Backups</label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={schedulerSettings.enabled}
                onChange={(e) =>
                  setSchedulerSettings({
                    ...schedulerSettings,
                    enabled: e.target.checked,
                  })
                }
                className="w-5 h-5 text-blue-400 rounded"
              />
              <span className="ml-3 text-text-secondary inline-flex items-center gap-1.5">
                {schedulerSettings.enabled ? (
                  <><FaCheckCircle className="text-green-400" aria-hidden="true" />Enabled</>
                ) : (
                  <><FaExclamationTriangle className="text-yellow-400" aria-hidden="true" />Disabled</>
                )}
              </span>
            </label>
          </div>

          {schedulerSettings.enabled && (
            <>
              {/* Frequency Selection */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Backup Frequency
                </label>
                <div className="flex gap-3">
                  {['daily', 'weekly', 'monthly'].map((freq) => (
                    <button
                      key={freq}
                      onClick={() =>
                        setSchedulerSettings({
                          ...schedulerSettings,
                          frequency: freq,
                        })
                      }
                      aria-pressed={schedulerSettings.frequency === freq}
                      className={
                        schedulerSettings.frequency === freq
                          ? 'btn-secondary border-cyber-green bg-cyber-green/10 text-cyber-green'
                          : 'btn-secondary'
                      }
                    >
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Selection */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Backup Time (24-hour format)
                </label>
                <input
                  type="time"
                  value={schedulerSettings.time}
                  onChange={(e) =>
                    setSchedulerSettings({
                      ...schedulerSettings,
                      time: e.target.value,
                    })
                  }
                  className="w-full bg-dark-input text-text-primary px-3 py-2 rounded-lg border border-dark-border focus:border-cyber-green focus:outline-none"
                />
              </div>

              {/* Day of Week (for weekly backups) */}
              {schedulerSettings.frequency === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Day of Week
                  </label>
                  <select
                    value={schedulerSettings.dayOfWeek}
                    onChange={(e) =>
                      setSchedulerSettings({
                        ...schedulerSettings,
                        dayOfWeek: e.target.value,
                      })
                    }
                    className="w-full bg-dark-input text-text-primary px-3 py-2 rounded-lg border border-dark-border focus:border-cyber-green focus:outline-none"
                  >
                    {[
                      'sunday',
                      'monday',
                      'tuesday',
                      'wednesday',
                      'thursday',
                      'friday',
                      'saturday',
                    ].map((day) => (
                      <option key={day} value={day}>
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Summary */}
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm">
                <p className="text-text-secondary">
                  <strong className="font-semibold text-cyan-300">Schedule Summary:</strong> Backups will run{' '}
                  {schedulerSettings.frequency === 'daily'
                    ? `daily at ${schedulerSettings.time}`
                    : schedulerSettings.frequency === 'weekly'
                    ? `every ${schedulerSettings.dayOfWeek} at ${schedulerSettings.time}`
                    : `on the 1st of each month at ${schedulerSettings.time}`}
                </p>
              </div>
            </>
          )}

          {/* Save Button */}
          <button
            onClick={handleSaveScheduler}
            disabled={savingScheduler}
            className="btn-primary"
          >
            {savingScheduler ? 'Saving...' : 'Save Scheduler Settings'}
          </button>

          <p className="text-text-secondary text-sm">
            Enable automated backups and select your preferred schedule. Backups will run
            automatically at the specified time and be sent to Telegram if configured.
          </p>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">

        <h3 className="text-text-primary font-semibold mb-3">Disaster Recovery Backups</h3>
        <ul className="text-text-secondary text-sm space-y-2 list-disc pl-5">
          <li>
            <span><strong>Complete Portable Backup:</strong> Includes CMS data, full source code (src/), assets (public/), and all configuration files. Restore with: npm install && npm run build</span>
          </li>
          <li>
            <span><strong>Telegram Integration:</strong> Backups under 50MB are automatically uploaded to Telegram for secure cloud storage. Larger backups are stored locally only</span>
          </li>
          <li>
            <span><strong>Local Retention:</strong> Backups are kept for {RETENTION_DAYS} days on the server, then automatically deleted</span>
          </li>
          <li>
            <span><strong>Easy Download:</strong> Use the download button to get any backup for local archival</span>
          </li>
          <li>
            <span><strong>Quick Restore:</strong> Includes BACKUP_MANIFEST.json with step-by-step restore instructions for redeployment</span>
          </li>
          <li>
            <span><strong>Setup:</strong> Set the backup bot token and chat ID above, or in Integrations → Telegram bots (Backups). They are stored in the site database.</span>
          </li>
        </ul>
      </div>
    </div>
    </AdminShell>
  );
}
