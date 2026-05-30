export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') {
        return;
    }

    try {
        const { initBackupScheduler } = await import('@/lib/scheduler-init');
        await initBackupScheduler();
    } catch (error) {
        console.error('[SCHEDULER] Failed to register backup scheduler on startup:', error);
    }
}