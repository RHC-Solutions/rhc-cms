import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { getToken } from 'next-auth/jwt';
import { getBackupTelegramConfig } from '@/lib/backup-telegram';

const BACKUPS_DIR = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'backups');
const CMS_DATA_DIR = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data');
const SRC_DIR = path.join(process.cwd(), 'src');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const ROOT_DIR = process.cwd();
const RETENTION_DAYS = 14;

// Directories to include in full site backup
const BACKUP_SOURCES = [
  { dir: path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data'), archivePath: 'cms-data' },
  { dir: path.join(process.cwd(), 'src'), archivePath: 'src' },
  { dir: path.join(process.cwd(), 'public'), archivePath: 'public' },
  { dir: path.join(process.cwd(), 'scripts'), archivePath: 'scripts' },
  { dir: path.join(process.cwd(), 'functions'), archivePath: 'functions' },
  { dir: path.join(process.cwd(), 'docs_archived'), archivePath: 'docs_archived' },
  { dir: path.join(process.cwd(), '.vscode'), archivePath: '.vscode' },
];

// Root level config files to include
const CONFIG_FILES = [
  '.env.local',        // CRITICAL: Contains NEXTAUTH_SECRET for authentication
  '.env.example',
  '.env.local.example',
  '.env.local.cloudflare.example',
  'package.json',
  'package-lock.json',
  'package.scripts.json',
  'next.config.mjs',
  'next-env.d.ts',
  'tsconfig.json',
  'tailwind.config.ts',
  'postcss.config.mjs',
  'middleware.ts',
  'vercel.json',
  'wrangler.toml',
  '_redirects',
  '_headers',
  'ecosystem.config.js',
  'Dockerfile',
  'docker-compose.yml',
  '.gitignore',
  'README.md',
  'BACKUP_SYSTEM.md',
  'CHANGELOG.md',
  'DEPLOYMENT_SUMMARY.txt',
  'PRODUCTION_DEPLOYMENT.md',
  'PRODUCTION_READY.md',
  'QUICK_REFERENCE.md',
  'RESTORE_QUICK_CARD.md',
  'verify-restore.js',
  'quick-restore.sh',
  'quick-restore.bat',
  'rhcsolutions.com.code-workspace',
];

// Check if user is admin
async function checkAdmin(request: NextRequest) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = token && (token as any).role ? (token as any).role : null;
  if (role !== 'admin') {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized: admin role required' }, { status: 403 }),
      email: null as string | null,
    };
  }

  const email = token && (token as any).email ? (token as any).email : 'admin';
  return { authorized: true, email };
}

// Ensure backups directory exists
function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

// Read siteName from settings.json and turn it into a filename-safe slug
function getSiteSlug(): string {
  try {
    const raw = fs.readFileSync(path.join(CMS_DATA_DIR, 'settings.json'), 'utf-8');
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

// Get list of backups
function getBackupsList(): Array<{ name: string; date: string; size: number; path: string }> {
  ensureBackupsDir();
  try {
    const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.zip'));
    return files
      .map((file) => {
        const filePath = path.join(BACKUPS_DIR, file);
        const stat = fs.statSync(filePath);
        const date = new Date(stat.mtime).toISOString();
        return {
          name: file,
          date,
          size: stat.size,
          path: filePath,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error listing backups:', error);
    return [];
  }
}

// Delete old backups (older than RETENTION_DAYS)
function cleanOldBackups() {
  const backups = getBackupsList();
  const now = Date.now();
  const maxAge = RETENTION_DAYS * 24 * 60 * 60 * 1000;

  backups.forEach((backup) => {
    const age = now - new Date(backup.date).getTime();
    if (age > maxAge) {
      try {
        fs.unlinkSync(backup.path);
        console.log(`Deleted old backup: ${backup.name}`);
      } catch (error) {
        console.error(`Error deleting backup ${backup.name}:`, error);
      }
    }
  });
}

// Send backup to Telegram with retry logic
async function sendToTelegram(filePath: string, fileName: string, fileSize: number): Promise<{ success: boolean; message: string }> {
  try {
    const { telegramBotToken, telegramChatId } = await getBackupTelegramConfig();

    if (!telegramBotToken || !telegramChatId) {
      const msg = 'Telegram credentials not configured for backups';
      console.warn(msg);
      return { success: false, message: msg };
    }

    // Check file size (Telegram limit is 50MB for documents)
    const sizeMB = fileSize / 1024 / 1024;
    if (sizeMB > 50) {
      const msg = `Backup file too large (${sizeMB.toFixed(2)}MB) for Telegram (50MB limit). Stored locally only.`;
      console.warn(msg);
      return { success: false, message: msg };
    }

    const fileBuffer = fs.readFileSync(filePath);
    const sizeMBStr = sizeMB.toFixed(2);

    // Send backup file to Telegram
    const formData = new FormData();
    formData.append('chat_id', telegramChatId);
    formData.append('document', new Blob([fileBuffer], { type: 'application/zip' }), fileName);
    formData.append(
      'caption',
      `📦 Full Site Backup\n\n` +
      `File: ${fileName}\n` +
      `Size: ${sizeMBStr} MB\n` +
      `Time: ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC\n\n` +
      `✅ Includes:\n` +
      `• SQLite Database (cms.db)\n` +
      `• CMS Data (users, forms, pages, jobs)\n` +
      `• Source Code (src/)\n` +
      `• Public Assets (public/)\n` +
      `• Config Files & Environment\n` +
      `• Module List (for reinstall)\n\n` +
      `🔄 Ready for disaster recovery\n` +
      `Run: npm install && npm run build`
    );

    const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendDocument`, {
      method: 'POST',
      body: formData,
      // Timeout after 30 seconds
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const msg = `Telegram API error: ${response.status} - ${errorText}`;
      console.error(msg);
      return { success: false, message: msg };
    }

    const result = await response.json();
    console.log('Backup sent to Telegram successfully:', result.ok);
    return {
      success: true,
      message: `Sent to Telegram (${sizeMBStr}MB)`
    };
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error('Error sending backup to Telegram:', errorMsg);
    return {
      success: false,
      message: `Telegram send failed: ${errorMsg}. Backup saved locally.`
    };
  }
}

// Create zip archive of entire site (cms-data, src, public, config files)
// This is a full disaster recovery backup
async function createBackupZip(targetPath: string): Promise<boolean> {
  // CRITICAL: Checkpoint SQLite WAL before backup
  // This ensures all data from .db-wal file is written to .db file
  try {
    const Database = require('better-sqlite3');
    const dbPath = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'cms.db');
    const db = new Database(dbPath);
    db.pragma('wal_checkpoint(TRUNCATE)'); // Force checkpoint and truncate WAL
    db.close();
    console.log('✓ SQLite WAL checkpointed before backup');
  } catch (error) {
    console.error('Warning: Could not checkpoint WAL:', error);
    // Continue anyway - backup will still work but may miss recent changes
  }

  return new Promise((resolve) => {
    const output = fs.createWriteStream(targetPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`Backup created: ${archive.pointer()} bytes`);
      resolve(true);
    });

    archive.on('error', (error: any) => {
      console.error('Archive error:', error);
      resolve(false);
    });

    output.on('error', (error) => {
      console.error('Output error:', error);
      resolve(false);
    });

    archive.pipe(output);

    // Add all backup source directories
    BACKUP_SOURCES.forEach(({ dir, archivePath }) => {
      if (fs.existsSync(dir)) {
        console.log(`Adding ${archivePath}...`);
        if (archivePath === 'cms-data') {
          // Special handling for cms-data: exclude backups folder and SQLite temp files
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

    // Add config files
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
        const moduleList = `# Installed Node Modules (${modules.length} total)\n\n` +
          modules.join('\n');
        archive.append(moduleList, { name: 'installed-modules.txt' });
      } catch (error) {
        console.warn('Could not list node_modules:', error);
      }
    }

    // Add a backup manifest
    const manifest = {
      backupDate: new Date().toISOString(),
      version: '4.0',
      includes: [
        'cms-data: SQLite database (cms.db) with all CMS data (users, forms, pages, jobs, settings)',
        'cms-data: Media files, uploads, and content',
        'src: Full Next.js source code (components, pages, APIs, utilities, styles)',
        'public: Static assets (images, fonts, uploaded files, robots.txt, sitemap)',
        'scripts: Utility scripts and database tools',
        'functions: Serverless functions (Cloudflare)',
        'docs_archived: Documentation and guides',
        '.vscode: VS Code workspace settings',
        'config: ALL configuration files (package.json, next.config.mjs, .env.local, middleware.ts, etc)',
        'config: Build configs (tailwind.config.ts, tsconfig.json, postcss.config.mjs)',
        'config: Deployment configs (wrangler.toml, ecosystem.config.js, _headers, _redirects)',
        'config: Documentation (README.md, BACKUP_SYSTEM.md, CHANGELOG.md, etc)',
        'installed-modules.txt: Complete list of all installed npm packages',
      ],
      restoreInstructions: [
        '⚠️  IMPORTANT: Extract ALL files to your target directory first!',
        '',
        '1. Extract the entire backup zip to your deployment directory',
        '2. Open terminal/command prompt',
        '3. Navigate INTO the extracted folder: cd path/to/extracted/folder',
        '4. Verify you are in the correct directory: dir (Windows) or ls (Linux/Mac)',
        '   You should see: package.json, src/, public/, cms-data/, scripts/, functions/',
        '5. Install dependencies: npm install',
        '6. Verify .env.local exists and contains NEXTAUTH_SECRET',
        '7. Build the application: npm run build',
        '8. Start the server: npm start (or pm2 start ecosystem.config.js)',
        '',
        '❌ Common mistake: Running commands from parent directory',
        '✅ Correct: cd into the extracted folder first, then run commands',
        '',
        'Quick restore (from inside extracted folder):',
        '  npm install && npm run build && npm start',
      ],
    };

    archive.append(JSON.stringify(manifest, null, 2), { name: 'BACKUP_MANIFEST.json' });

    // Add README with restore instructions
    const readme = `# RHC Solutions CMS - Backup Restoration Guide

## 📦 Backup Information
- Date: ${new Date().toISOString()}
- Version: 3.0 (SQLite Database + Full Site)

## 🔴 CRITICAL REQUIREMENTS

### 1. NEXTAUTH_SECRET Must Match Original
**⚠️ IF YOU CHANGE NEXTAUTH_SECRET, YOU CANNOT LOG IN WITH EXISTING USERS!**

This backup includes your original \`.env.local\` file with the correct \`NEXTAUTH_SECRET\`.
- DO NOT generate a new secret
- DO NOT modify the NEXTAUTH_SECRET value
- Use the exact .env.local file from this backup

If you lost the .env.local file:
- You MUST delete cms-data/users.json
- Run the setup wizard to create a new admin user
- Old user passwords will NOT work with a different secret

### 2. Directory Navigation
If you see errors like "Can't resolve 'tailwindcss'" or "module not found", 
you are running commands from the WRONG directory!

### Correct Restoration Steps:

1. **Extract the backup**
   - Extract ALL files from this ZIP to your target directory
   - Example: Extract to \`/home/user/mysite\` or \`C:\\Sites\\mysite\`

2. **Navigate INTO the extracted folder**
   \`\`\`bash
   cd /path/to/extracted/folder
   # or on Windows:
   cd C:\\path\\to\\extracted\\folder
   \`\`\`

3. **Verify you're in the correct directory**
   \`\`\`bash
   # You should see these files/folders:
   - package.json
   - next.config.mjs
   - src/
   - public/
   - cms-data/
   \`\`\`
   
   Run: \`ls\` (Linux/Mac) or \`dir\` (Windows) to check

4. **VERIFY .env.local file exists**
   \`\`\`bash
   # Check if .env.local was extracted
   ls -la .env.local
   # or on Windows:
   dir .env.local
   \`\`\`
   
   **CRITICAL:** This file contains your NEXTAUTH_SECRET.
   - ✅ If it exists: DO NOT MODIFY IT
   - ❌ If missing: You cannot use existing user accounts
     - Option A: Find the original .env.local from your old installation
     - Option B: Delete cms-data/users.json and run setup wizard

5. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

6. **Build the application**
   \`\`\`bash
   npm run build
   \`\`\`

7. **Start the server**
   \`\`\`bash
   npm start
   # or for development:
   npm run dev
   \`\`\`

8. **Verify restoration (recommended)**
   \`\`\`bash
   node verify-restore.js
   \`\`\`
   This will check that all files are present, database has data, and server is responding.

### Quick One-Liner (after cd into folder):
\`\`\`bash
npm install && npm run build && npm start
\`\`\`

### Verify Everything Works:
\`\`\`bash
node verify-restore.js
\`\`\`

## 📁 What's Included
- ✅ CMS Data (users, forms, pages, jobs, settings)
- ✅ Source Code (full Next.js application)
- ✅ Public Assets (images, fonts)
- ✅ Configuration Files (package.json, configs)

## 🔧 Troubleshooting

### ❌ "Can't login with my username/password/2FA"
**Problem:** NEXTAUTH_SECRET is different from the original
**Solution:**
1. Check if .env.local exists in the extracted backup
2. If YES: Make sure you didn't modify NEXTAUTH_SECRET
3. If NO: You have two options:
   - Find your original .env.local file and copy it here
   - OR delete cms-data/users.json and run http://localhost:3000/admin/setup
     to create a new admin account

**Why this happens:** Passwords are hashed with NEXTAUTH_SECRET. Different secret = can't verify passwords.

### "Can't resolve 'tailwindcss'" or similar errors
**Problem:** You're in the wrong directory
**Solution:** \`cd\` into the extracted folder where package.json is located

### "command not found: npm"
**Problem:** Node.js is not installed
**Solution:** Install Node.js 18+ from nodejs.org

### Port already in use
**Solution:** Change port in package.json or use: \`npm start -- -p 3001\`

### Site shows only "Welcome" with no menu/footer/content
**Problem:** Next.js cache or API routes not working
**Solutions:**
1. **Clear build cache and rebuild:**
   \`\`\`bash
   rm -rf .next
   npm run build
   npm start
   \`\`\`

2. **Start in dev mode first to verify:**
   \`\`\`bash
   npm run dev
   # Visit http://localhost:3000
   # If it works, then rebuild for production
   \`\`\`

3. **Run verification script:**
   \`\`\`bash
   node verify-restore.js
   \`\`\`
   
4. **Check API routes:**
   - Visit http://localhost:3000/api/cms/settings
   - Should return JSON with site settings
   - If it returns error, database may not be loaded

**Important:** Always run \`npm run build\` AFTER extracting database, not before!

## 🆘 Need Help?
Check BACKUP_MANIFEST.json for detailed information.
Run \`node verify-restore.js\` to diagnose issues.
`;

    archive.append(readme, { name: 'README_RESTORE.md' });

    archive.finalize();
  });
}

// GET: List all backups OR download a specific backup
export async function GET(request: NextRequest) {
  try {
    const auth = await checkAdmin(request);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(request.url);
    const backupName = searchParams.get('download');

    // If download parameter is present, stream the backup file
    if (backupName) {
      if (!backupName.endsWith('.zip')) {
        return NextResponse.json({ error: 'Invalid backup name' }, { status: 400 });
      }

      const backupPath = path.join(BACKUPS_DIR, backupName);

      // Security: prevent path traversal
      if (!backupPath.startsWith(BACKUPS_DIR)) {
        return NextResponse.json({ error: 'Invalid backup path' }, { status: 400 });
      }

      if (!fs.existsSync(backupPath)) {
        return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
      }

      // Stream the file
      const fileBuffer = fs.readFileSync(backupPath);
      const stat = fs.statSync(backupPath);

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${backupName}"`,
          'Content-Length': stat.size.toString(),
        },
      });
    }

    // Otherwise, list all backups
    const backups = getBackupsList();
    return NextResponse.json({
      success: true,
      backups: backups.map((b) => ({
        name: b.name,
        date: b.date,
        size: b.size,
        sizeMB: (b.size / 1024 / 1024).toFixed(2),
      })),
      retention_days: RETENTION_DAYS,
    });
  } catch (error) {
    console.error('Error in GET /api/cms/backups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create manual backup
export async function POST(request: NextRequest) {
  try {
    const auth = await checkAdmin(request);
    if (!auth.authorized) return auth.response;

    ensureBackupsDir();

    // Create filename with site name + timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFileName = `${getSiteSlug()}-backup-${timestamp}.zip`;
    const backupFilePath = path.join(BACKUPS_DIR, backupFileName);

    // Create backup zip
    const created = await createBackupZip(backupFilePath);

    if (!created) {
      return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 });
    }

    const stat = fs.statSync(backupFilePath);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(2);

    // Send to Telegram
    const telegramResult = await sendToTelegram(backupFilePath, backupFileName, stat.size);

    // Clean old backups
    cleanOldBackups();

    return NextResponse.json({
      success: true,
      backup: {
        name: backupFileName,
        size: stat.size,
        sizeMB,
        date: new Date().toISOString(),
        telegram: {
          sent: telegramResult.success,
          message: telegramResult.message,
        },
      },
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 });
  }
}

// DELETE: Delete a specific backup
export async function DELETE(request: NextRequest) {
  try {
    const auth = await checkAdmin(request);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(request.url);
    const backupName = searchParams.get('name');

    if (!backupName || !backupName.endsWith('.zip')) {
      return NextResponse.json({ error: 'Invalid backup name' }, { status: 400 });
    }

    const backupPath = path.join(BACKUPS_DIR, backupName);

    // Security: prevent path traversal
    if (!backupPath.startsWith(BACKUPS_DIR)) {
      return NextResponse.json({ error: 'Invalid backup path' }, { status: 400 });
    }

    if (!fs.existsSync(backupPath)) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    fs.unlinkSync(backupPath);

    return NextResponse.json({
      success: true,
      message: `Backup ${backupName} deleted`,
    });
  } catch (error) {
    console.error('Error deleting backup:', error);
    return NextResponse.json({ error: 'Failed to delete backup' }, { status: 500 });
  }
}
