import cron from 'node-cron';
import * as fs from 'fs';
import * as path from 'path';
import { ZipArchive } from 'archiver';
import { getBackupTelegramConfig } from './backup-telegram';
import { isSqlite } from '@adminpanel/lib/cms/db';

const BACKUPS_DIR = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'backups');
const ROOT_DIR = process.cwd();
const RETENTION_DAYS = 14;

// Directories to include in full site backup (same as API backup)
const BACKUP_SOURCES = [
  { dir: path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data'), archivePath: 'cms-data' },
  { dir: path.join(process.cwd(), 'src'), archivePath: 'src' },
  { dir: path.join(process.cwd(), 'public'), archivePath: 'public' },
  { dir: path.join(process.cwd(), 'scripts'), archivePath: 'scripts' },
  { dir: path.join(process.cwd(), 'functions'), archivePath: 'functions' },
  { dir: path.join(process.cwd(), 'docs_archived'), archivePath: 'docs_archived' },
  { dir: path.join(process.cwd(), '.vscode'), archivePath: '.vscode' },
];

// Root level config files to include (same as API backup)
const CONFIG_FILES = [
  '.env.local',
  '.env.example',
  'package.json',
  'package-lock.json',
  'package.scripts.json',
  'next.config.mjs',
  'next-env.d.ts',
  'tsconfig.json',
  'tailwind.config.ts',
  'postcss.config.mjs',
  'middleware.ts',
  'wrangler.toml',
  '_redirects',
  '_headers',
  'ecosystem.config.js',
  '.gitignore',
  'README.md',
  'CHANGELOG.md',
  'example.com.code-workspace',
];

// Ensure backups directory exists
export function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

// Read siteName from settings.json and turn it into a filename-safe slug
export function getSiteSlug(): string {
  try {
    const raw = fs.readFileSync(path.join((process.env.SHARED_ROOT || ROOT_DIR), 'cms-data', 'settings.json'), 'utf-8');
    const name = JSON.parse(raw)?.siteName;
    if (typeof name === 'string' && name.trim()) {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'site';
    }
  } catch {
    // fall through
  }
  return 'site';
}

// Create FULL backup zip - identical to manual backup from /admin/backups
export async function createBackupZip(targetPath: string): Promise<boolean> {
  // CRITICAL: Checkpoint SQLite WAL before backup. Skip under Postgres (no cms.db
  // file; full PG backups use pg_dump — see docs/DEPLOY_NEW_SITE.md).
  if (isSqlite()) {
    try {
      const Database = require('better-sqlite3');
      const dbPath = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'cms.db');
      const db = new Database(dbPath);
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      console.log('[BACKUP] ✓ SQLite WAL checkpointed');
    } catch (error) {
      console.error('[BACKUP] Warning: Could not checkpoint WAL:', error);
    }
  }

  return new Promise((resolve) => {
    const output = fs.createWriteStream(targetPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`[BACKUP] Created FULL backup: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
      resolve(true);
    });

    archive.on('error', (error: any) => {
      console.error('[BACKUP] Archive error:', error);
      resolve(false);
    });

    output.on('error', (error: any) => {
      console.error('[BACKUP] Output error:', error);
      resolve(false);
    });

    archive.pipe(output);

    // Add all backup source directories (same as API backup)
    BACKUP_SOURCES.forEach(({ dir, archivePath }) => {
      if (fs.existsSync(dir)) {
        console.log(`[BACKUP] Adding ${archivePath}...`);
        if (archivePath === 'cms-data') {
          // Special handling: exclude backups folder and SQLite temp files
          archive.directory(dir, archivePath, (entry: any) => {
            if (entry.name.includes('backups') || entry.name.endsWith('.db-shm') || entry.name.endsWith('.db-wal')) {
              return false;
            }
            return entry;
          });
        } else {
          archive.directory(dir, archivePath);
        }
      }
    });

    // Add all config files
    console.log('[BACKUP] Adding configuration files...');
    CONFIG_FILES.forEach((file) => {
      const filePath = path.join(ROOT_DIR, file);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: file });
      }
    });

    // Add node_modules list for reference
    const nodeModulesDir = path.join(ROOT_DIR, 'node_modules');
    if (fs.existsSync(nodeModulesDir)) {
      try {
        const modules = fs.readdirSync(nodeModulesDir)
          .filter(dir => !dir.startsWith('.'))
          .sort();
        const moduleList = `# Installed Node Modules (${modules.length} total)\n\n` + modules.join('\n');
        archive.append(moduleList, { name: 'installed-modules.txt' });
      } catch (error) {
        console.warn('[BACKUP] Could not list node_modules:', error);
      }
    }

    // Add backup manifest (same format as API backup)
    const manifest = {
      backupDate: new Date().toISOString(),
      version: '4.0',
      type: 'FULL BACKUP (Automated)',
      includes: [
        'cms-data: SQLite database (cms.db) with all CMS data',
        'src: Full Next.js source code',
        'public: Static assets and uploads',
        'scripts: Utility scripts',
        'functions: Serverless functions',
        'docs_archived: Documentation',
        '.vscode: VS Code settings',
        'config: ALL configuration files',
      ],
      restoreInstructions: [
        '1. Extract the entire backup zip to your deployment directory',
        '2. Run: npm install',
        '3. Verify .env.local exists',
        '4. Run: npm run build',
        '5. Run: pm2 start ecosystem.config.js or npm start',
      ],
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'BACKUP_MANIFEST.json' });

    console.log('[BACKUP] Finalizing FULL backup archive...');
    archive.finalize();
  });
}

// Send backup to Telegram
async function sendToTelegram(filePath: string, fileName: string): Promise<boolean> {
  try {
    const { telegramBotToken, telegramChatId } = await getBackupTelegramConfig();

    if (!telegramBotToken || !telegramChatId) {
      console.warn('[BACKUP] Telegram credentials not configured for backups');
      return false;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = fileBuffer.length;
    const sizeMB = (fileSize / 1024 / 1024).toFixed(2);

    // Send backup file to Telegram
    const formData = new FormData();
    formData.append('chat_id', telegramChatId);
    formData.append('document', new Blob([fileBuffer], { type: 'application/zip' }), fileName);
    formData.append(
      'caption',
      `📦 FULL Backup\n\nFile: ${fileName}\nSize: ${sizeMB} MB\nTime: ${new Date().toLocaleString()}\n\nContents:\n• Source code (src/)\n• Database (cms.db)\n• Public files\n• Config files\n• Environment vars`
    );

    const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[BACKUP] Telegram upload failed:', error);
      return false;
    }

    console.log('[BACKUP] Sent to Telegram successfully');
    return true;
  } catch (error) {
    console.error('[BACKUP] Error sending to Telegram:', error);
    return false;
  }
}

// Delete old backups
function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.zip'));
    const now = Date.now();
    const maxAge = RETENTION_DAYS * 24 * 60 * 60 * 1000;

    let deleted = 0;
    files.forEach((file) => {
      const filePath = path.join(BACKUPS_DIR, file);
      const stat = fs.statSync(filePath);
      const age = now - stat.mtime.getTime();

      if (age > maxAge) {
        fs.unlinkSync(filePath);
        deleted++;
        console.log(`[BACKUP] Deleted old backup: ${file}`);
      }
    });

    if (deleted > 0) {
      console.log(`[BACKUP] Cleaned up ${deleted} old backup(s)`);
    }
  } catch (error) {
    console.error('[BACKUP] Cleanup error:', error);
  }
}

// Perform daily backup
export async function performDailyBackup() {
  try {
    console.log('[BACKUP] Starting daily backup...');
    ensureBackupsDir();

    // Create filename with site name + timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFileName = `${getSiteSlug()}-backup-${timestamp}.zip`;
    const backupFilePath = path.join(BACKUPS_DIR, backupFileName);

    // Create backup zip
    const created = await createBackupZip(backupFilePath);

    if (!created) {
      console.error('[BACKUP] Failed to create backup');
      return;
    }

    const stat = fs.statSync(backupFilePath);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(2);

    // Send to Telegram
    const sentToTelegram = await sendToTelegram(backupFilePath, backupFileName);

    // Clean old backups
    cleanOldBackups();

    console.log(`[BACKUP] Daily backup completed: ${backupFileName} (${sizeMB} MB)${sentToTelegram ? ', sent to Telegram' : ''}`);
  } catch (error) {
    console.error('[BACKUP] Daily backup failed:', error);
  }
}

// Schedule daily backup at 2 AM UTC
export function initializeBackupScheduler() {
  // Run every day at 2:00 AM UTC
  const task = cron.schedule('0 2 * * *', async () => {
    console.log('[BACKUP] Executing scheduled daily backup...');
    await performDailyBackup();
  });

  console.log('[BACKUP] Scheduler initialized (runs daily at 2:00 AM UTC)');
  return task;
}
