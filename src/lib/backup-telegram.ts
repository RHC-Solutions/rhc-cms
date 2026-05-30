import { getSecret } from '@adminpanel/lib/env';

export async function getBackupTelegramConfig() {
    let savedBotToken = '';
    let savedChatId = '';

    try {
        const { cmsDb } = await import('@adminpanel/lib/cms/database');
        const settings = await cmsDb.getSettings();
        const telegram = (settings as any)?.telegram;

        savedBotToken = telegram?.botToken?.trim?.() || '';
        savedChatId = telegram?.chatId?.trim?.() || '';
    } catch (error) {
        console.warn('[BACKUP] Could not load Telegram settings from database:', error);
    }

    return {
        telegramBotToken:
            getSecret('TELEGRAM_BACKUP_BOT_TOKEN') ||
            savedBotToken ||
            getSecret('TELEGRAM_BOT_TOKEN'),
        telegramChatId:
            getSecret('TELEGRAM_BACKUP_CHAT_ID') ||
            savedChatId ||
            getSecret('TELEGRAM_CHAT_ID'),
    };
}