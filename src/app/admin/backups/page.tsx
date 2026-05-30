'use client';

import { useEffect, useState } from 'react';
import { FaDownload, FaTrash, FaSync, FaUpload, FaCheck, FaTimes, FaDatabase, FaClock } from 'react-icons/fa';
import { useToast } from '@/components/admin/Toast';
import AdminShell from '@/components/admin/AdminShell';

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
    const confirmed = confirm('Create a COMPLETE full site backup? This will archive:\n\n✓ CMS Data (SQLite database, all content)\n✓ Source Code (src/ - complete application)\n✓ Public Assets (public/ - uploads, images)\n✓ Scripts & Functions (utility and serverless)\n✓ Documentation (docs_archived/)\n✓ Configuration Files (ALL - package.json, .env.local, middleware.ts, etc)\n✓ Build Configs (tailwind, typescript, postcss)\n✓ Deployment Configs (wrangler, ecosystem, headers, redirects)\n✓ VS Code Settings (.vscode/)\n\nThis is a COMPLETE portable backup ready for disaster recovery.\nAfter extraction, run: npm install && npm run build\n\nBackups under 50MB will be sent to Telegram.\nLarger backups are stored locally only.');
    if (!confirmed) return;

    setCreating(true);
    try {
      const response = await fetch('/api/cms/backups', { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        const telegramStatus = data.backup.telegram?.sent 
          ? `✅ Sent to Telegram (${data.backup.telegram.message})`
          : `⚠️ Telegram: ${data.backup.telegram?.message || 'Not sent'}`;
        
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
        addToast('success', `✅ Backup restored: ${backupName}\n\n${data.message}`);
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
        addToast('success', `✅ Telegram test successful!\nBot: ${data.botName}`);
      } else {
        setTelegramStatus({ 
          success: false, 
          message: data.message,
        });
        addToast('error', `❌ Telegram test failed: ${data.message}`);
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
        addToast('success', '✅ Telegram settings saved successfully!');
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
        addToast('success', '✅ Scheduler settings saved successfully!');
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="heading-xl text-gradient mb-2">System Backups</h1>
          <p className="text-gray-400 mt-2">Manage CMS data backups and recovery archives</p>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-black rounded-lg font-semibold transition"
        >
          <FaSync className={creating ? 'animate-spin' : ''} />
          {creating ? 'Creating...' : 'Create Backup'}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
        <h3 className="text-blue-200 font-semibold mb-2">🚀 Full Site Backups</h3>
        <ul className="text-blue-100 text-sm space-y-1">
          <li>✓ Complete disaster recovery backups (CMS Data + Source Code + Assets)</li>
          <li>✓ Automatically sent to Telegram for secure cloud storage</li>
          <li>✓ Local backups retained for {RETENTION_DAYS} days</li>
          <li>✓ Ready for immediate redeployment in case of data loss</li>
          <li>✓ Click the button above to create a manual backup</li>
        </ul>
      </div>

      {/* Backups List */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading backups...</div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No backups found. Create one to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-green-400 font-semibold">Backup Name</th>
                  <th className="px-6 py-3 text-left text-green-400 font-semibold">Date</th>
                  <th className="px-6 py-3 text-left text-green-400 font-semibold">Size</th>
                  <th className="px-6 py-3 text-right text-green-400 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {backups.map((backup) => (
                  <tr key={backup.name} className="hover:bg-gray-800 transition">
                    <td className="px-6 py-4 text-gray-300 font-mono">{backup.name}</td>
                    <td className="px-6 py-4 text-gray-400">
                      {new Date(backup.date).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-gray-400">{backup.sizeMB} MB</td>
                    <td className="px-6 py-4 text-right space-x-2 flex justify-end">
                      <button
                        onClick={() => handleRestoreBackup(backup.name)}
                        disabled={restoring}
                        className="p-2 text-green-400 hover:bg-green-900 disabled:bg-gray-700 rounded transition"
                        title="Restore backup"
                      >
                        <FaUpload size={16} />
                      </button>
                      <button
                        onClick={() => handleDownloadBackup(backup.name)}
                        className="p-2 text-blue-400 hover:bg-blue-900 rounded transition"
                        title="Download backup"
                      >
                        <FaDownload size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteBackup(backup.name)}
                        className="p-2 text-red-400 hover:bg-red-900 rounded transition"
                        title="Delete backup"
                      >
                        <FaTrash size={16} />
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
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FaDatabase className="text-2xl text-green-400" />
            <div>
              <h3 className="text-xl font-bold text-green-400">Backup & Disaster Recovery</h3>
              {telegramConfigured && (
                <p className="text-green-300 text-sm mt-1">✅ Telegram is configured and ready</p>
              )}
              {!telegramConfigured && (
                <p className="text-yellow-300 text-sm mt-1">⚠️ Telegram not configured yet</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="bg-blue-900 border border-blue-700 rounded-lg p-4 mb-4">
            <p className="text-blue-100 text-sm">
              <strong>Configure Telegram</strong> to automatically send backups to your Telegram chat for secure cloud storage.
              Each backup can be up to 50MB and includes your complete site (CMS data, source code, and assets).
            </p>
          </div>

          <div>
            <label className="block text-green-400 font-semibold mb-2">Telegram Bot Token</label>
            <input
              type="password"
              placeholder="123456:ABCDEfghIjklmnopqrSTUVwxyz"
              value={backupSettings.botToken}
              onChange={(e) => setBackupSettings({ ...backupSettings, botToken: e.target.value })}
              className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg py-2 px-4 text-gray-100 
                       focus:border-green-400 focus:outline-none"
            />
            <p className="text-gray-400 text-xs mt-1">Get from @BotFather on Telegram</p>
          </div>

          <div>
            <label className="block text-green-400 font-semibold mb-2">Telegram Chat ID</label>
            <input
              type="text"
              placeholder="123456789"
              value={backupSettings.chatId}
              onChange={(e) => setBackupSettings({ ...backupSettings, chatId: e.target.value })}
              className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg py-2 px-4 text-gray-100 
                       focus:border-green-400 focus:outline-none"
            />
            <p className="text-gray-400 text-xs mt-1">Get from getUpdates API or use your user ID</p>
          </div>

          {/* Test Result Status */}
          {telegramStatus && (
            <div className={`rounded-lg p-4 flex items-start space-x-3 ${
              telegramStatus.success 
                ? 'bg-green-900 border border-green-700' 
                : 'bg-red-900 border border-red-700'
            }`}>
              {telegramStatus.success ? (
                <FaCheck className="text-2xl text-green-400 mt-1 shrink-0" />
              ) : (
                <FaTimes className="text-2xl text-red-400 mt-1 shrink-0" />
              )}
              <div className="flex-1">
                <p className={telegramStatus.success ? 'text-green-200 font-semibold' : 'text-red-200 font-semibold'}>
                  {telegramStatus.success ? '✅ Test Successful' : '❌ Test Failed'}
                </p>
                <p className={telegramStatus.success ? 'text-green-100 text-sm' : 'text-red-100 text-sm'}>
                  {telegramStatus.message}
                </p>
                {telegramStatus.botName && (
                  <p className="text-green-100 text-sm mt-1">
                    <strong>Bot Name:</strong> {telegramStatus.botName}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Test Button */}
          <div className="flex gap-3">
            <button
              onClick={handleTestTelegram}
              disabled={testingTelegram || !backupSettings.botToken || !backupSettings.chatId}
              className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-700 text-black font-semibold py-2 px-4 rounded-lg transition"
            >
              {testingTelegram ? 'Testing...' : '🧪 Test'}
            </button>
            <button
              onClick={handleSaveTelegram}
              disabled={!backupSettings.botToken || !backupSettings.chatId}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 text-black font-semibold py-2 px-4 rounded-lg transition"
            >
              💾 Save Settings
            </button>
          </div>

          <p className="text-gray-400 text-sm">
            ℹ️ Click "Test" to verify credentials, then "Save Settings" to store them for automatic backups.
          </p>
        </div>
      </div>

      {/* Scheduler Settings */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FaClock className="text-2xl text-blue-400" />
            <h3 className="text-xl font-bold text-blue-400">Automated Backup Scheduler</h3>
          </div>
        </div>

        <div className="space-y-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-gray-300 font-semibold">Enable Automated Backups</label>
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
              <span className="ml-3 text-gray-400">
                {schedulerSettings.enabled ? '✅ Enabled' : '⚠️ Disabled'}
              </span>
            </label>
          </div>

          {schedulerSettings.enabled && (
            <>
              {/* Frequency Selection */}
              <div>
                <label className="block text-gray-300 font-semibold mb-2">
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
                      className={`px-4 py-2 rounded-lg font-semibold transition ${
                        schedulerSettings.frequency === freq
                          ? 'bg-blue-500 text-black'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Selection */}
              <div>
                <label className="block text-gray-300 font-semibold mb-2">
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
                  className="w-full bg-gray-800 text-gray-200 px-4 py-2 rounded-lg border border-gray-700 focus:border-blue-400 focus:outline-none"
                />
              </div>

              {/* Day of Week (for weekly backups) */}
              {schedulerSettings.frequency === 'weekly' && (
                <div>
                  <label className="block text-gray-300 font-semibold mb-2">
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
                    className="w-full bg-gray-800 text-gray-200 px-4 py-2 rounded-lg border border-gray-700 focus:border-blue-400 focus:outline-none"
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
              <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-3">
                <p className="text-blue-200 text-sm">
                  <strong>📅 Schedule Summary:</strong> Backups will run{' '}
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
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 text-black font-semibold py-3 px-4 rounded-lg transition"
          >
            {savingScheduler ? '💾 Saving...' : '💾 Save Scheduler Settings'}
          </button>

          <p className="text-gray-400 text-sm">
            ℹ️ Enable automated backups and select your preferred schedule. Backups will run
            automatically at the specified time and be sent to Telegram if configured.
          </p>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">

        <h3 className="text-green-400 font-semibold mb-3">🔄 Disaster Recovery Backups</h3>
        <ul className="text-gray-300 text-sm space-y-2">
          <li className="flex gap-3">
            <span className="text-green-400">📦</span>
            <span><strong>Complete Portable Backup:</strong> Includes CMS data, full source code (src/), assets (public/), and all configuration files. Restore with: npm install && npm run build</span>
          </li>
          <li className="flex gap-3">
            <span className="text-green-400">🤖</span>
            <span><strong>Telegram Integration:</strong> Backups under 50MB are automatically uploaded to Telegram for secure cloud storage. Larger backups are stored locally only</span>
          </li>
          <li className="flex gap-3">
            <span className="text-green-400">🗓️</span>
            <span><strong>Local Retention:</strong> Backups are kept for {RETENTION_DAYS} days on the server, then automatically deleted</span>
          </li>
          <li className="flex gap-3">
            <span className="text-green-400">⬇️</span>
            <span><strong>Easy Download:</strong> Use the download button to get any backup for local archival</span>
          </li>
          <li className="flex gap-3">
            <span className="text-green-400">🚀</span>
            <span><strong>Quick Restore:</strong> Includes BACKUP_MANIFEST.json with step-by-step restore instructions for redeployment</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400">ℹ️</span>
            <span><strong>Setup:</strong> Configure backup Telegram credentials in admin settings or environment variables (TELEGRAM_BACKUP_BOT_TOKEN, TELEGRAM_BACKUP_CHAT_ID, or TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)</span>
          </li>
        </ul>
      </div>
    </div>
    </AdminShell>
  );
}
