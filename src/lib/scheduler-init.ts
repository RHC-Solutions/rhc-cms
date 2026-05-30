import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';

let schedulerInitialized = false;
let currentTask: ScheduledTask | null = null;

export async function initBackupScheduler() {
  if (schedulerInitialized) {
    console.log('[SCHEDULER] Already initialized, skipping...');
    return;
  }
  
  schedulerInitialized = true;
  console.log('[SCHEDULER] Initializing backup scheduler...');
  
  // Import dynamically to avoid issues with edge runtime
  const { performDailyBackup } = await import('./backup');
  const { cmsDb } = await import('./cms/database');
  
  // Function to update cron schedule based on settings
  async function updateScheduler() {
    try {
      const settings = await cmsDb.getSettings();
      const scheduler = (settings as any)?.scheduler;
      
      // Stop existing task if any
      if (currentTask) {
        currentTask.stop();
        currentTask = null;
      }
      
      if (!scheduler?.enabled) {
        console.log('[SCHEDULER] Backup scheduler is disabled');
        return;
      }
      
      // Parse time
      const [hour, minute] = (scheduler.time || '02:00').split(':').map(Number);
      
      let cronExpression: string;
      
      switch (scheduler.frequency) {
        case 'weekly':
          const dayMap: Record<string, number> = {
            sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
            thursday: 4, friday: 5, saturday: 6
          };
          const dayNum = dayMap[scheduler.dayOfWeek || 'sunday'] || 0;
          cronExpression = `${minute} ${hour} * * ${dayNum}`;
          break;
        case 'monthly':
          cronExpression = `${minute} ${hour} 1 * *`;
          break;
        case 'daily':
        default:
          cronExpression = `${minute} ${hour} * * *`;
      }
      
      console.log(`[SCHEDULER] Setting up ${scheduler.frequency} backup at ${scheduler.time} (cron: ${cronExpression})`);
      
      currentTask = cron.schedule(cronExpression, async () => {
        console.log('[SCHEDULER] Executing scheduled backup...');
        await performDailyBackup();
      });
      
      console.log('[SCHEDULER] Backup scheduler initialized successfully');
    } catch (error) {
      console.error('[SCHEDULER] Error initializing scheduler:', error);
    }
  }
  
  // Initialize scheduler on startup
  await updateScheduler();
  
  // Re-check settings every 5 minutes to pick up changes
  setInterval(async () => {
    await updateScheduler();
  }, 5 * 60 * 1000);
}

// Force re-initialization (called when settings are updated)
export async function reinitScheduler() {
  schedulerInitialized = false;
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }
  await initBackupScheduler();
}
