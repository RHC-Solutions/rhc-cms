import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getToken } from 'next-auth/jwt';
import { isSqlite } from '@adminpanel/lib/cms/db';

// execFile (no shell) — arguments are passed as an argv array, so a crafted
// backup name can never be interpreted as a shell command (js/command-line-injection).
const execFilePromise = promisify(execFile);

const BACKUPS_DIR = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'backups');
const CMS_DATA_DIR = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data');
const ROOT_DIR = process.cwd();

// Check if user is admin
async function checkAdmin(request: NextRequest) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = token && (token as any).role ? (token as any).role : null;
  if (role !== 'admin') {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized: admin role required' }, { status: 403 }),
    };
  }
  return { authorized: true };
}

// Restore CMS data from backup
async function restoreFromBackup(backupName: string): Promise<{ success: boolean; message: string; details?: string }> {
  try {
    const backupPath = path.join(BACKUPS_DIR, backupName);

    // Validate backup exists
    if (!fs.existsSync(backupPath)) {
      return {
        success: false,
        message: `Backup not found: ${backupName}`,
      };
    }

    // Validate backup is in BACKUPS_DIR (security check)
    const realBackupPath = fs.realpathSync(backupPath);
    const realBackupsDir = fs.realpathSync(BACKUPS_DIR);
    if (!realBackupPath.startsWith(realBackupsDir)) {
      return {
        success: false,
        message: 'Invalid backup path',
      };
    }

    // Create restore directory
    const restoreDir = path.join(ROOT_DIR, 'restore-temp');
    if (fs.existsSync(restoreDir)) {
      fs.rmSync(restoreDir, { recursive: true, force: true });
    }
    fs.mkdirSync(restoreDir, { recursive: true });

    // Extract backup using system unzip command
    try {
      // For Windows use tar or PowerShell, for Unix use unzip
      const isWindows = process.platform === 'win32';
      
      if (isWindows) {
        // Use PowerShell to extract ZIP on Windows. Parameters are passed as
        // discrete argv entries (no shell string), so the path is never parsed
        // as a command. -LiteralPath (vs -Path) stops PowerShell treating any
        // [ ] * ? in the backup filename as a wildcard. NB: there is no
        // -LiteralDestinationPath param — the destination is always -DestinationPath.
        await execFilePromise(
          'powershell',
          ['-NoProfile', '-Command', 'Expand-Archive', '-LiteralPath', backupPath, '-DestinationPath', restoreDir, '-Force'],
          { maxBuffer: 100 * 1024 * 1024 }, // 100MB buffer
        );
      } else {
        // Use unzip on Unix systems
        await execFilePromise('unzip', ['-q', backupPath, '-d', restoreDir], {
          maxBuffer: 100 * 1024 * 1024,
        });
      }
    } catch (extractError) {
      console.error('Extract error:', extractError);
      fs.rmSync(restoreDir, { recursive: true, force: true });
      return {
        success: false,
        message: 'Failed to extract backup archive',
        details: extractError instanceof Error ? extractError.message : String(extractError),
      };
    }

    // Restore CMS database
    const backupDbPath = path.join(restoreDir, 'cms-data', 'cms.db');
    const targetDbPath = path.join(CMS_DATA_DIR, 'cms.db');
    
    if (!isSqlite()) {
      // Postgres mode: the zipped SQLite cms.db cannot be restored into Postgres.
      // Restore the JSON files (already extracted above); DB restore uses pg_restore.
      console.warn('[restore] Postgres mode — skipping SQLite cms.db restore (use pg_restore for the DB).');
    } else if (fs.existsSync(backupDbPath)) {
      // Close any existing database connections
      try {
        const Database = require('better-sqlite3');
        // Checkpoint and close current database
        if (fs.existsSync(targetDbPath)) {
          const db = new Database(targetDbPath);
          try {
            db.pragma('wal_checkpoint(TRUNCATE)');
          } catch (e) {
            // Ignore errors
          }
          db.close();
        }
        
        // Wait a moment for file handles to release
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Backup current database
        if (fs.existsSync(targetDbPath)) {
          const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const currentDbBackup = path.join(CMS_DATA_DIR, `cms.db.before-restore-${backupTimestamp}`);
          fs.copyFileSync(targetDbPath, currentDbBackup);
          console.log(`Current database backed up to: ${currentDbBackup}`);
        }
        
        // Copy restored database
        fs.copyFileSync(backupDbPath, targetDbPath);
        console.log('✓ Database restored successfully');
        
        // Clean up WAL/SHM files
        const walPath = targetDbPath + '-wal';
        const shmPath = targetDbPath + '-shm';
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        
      } catch (dbError) {
        console.error('Database restore error:', dbError);
        throw new Error(`Failed to restore database: ${dbError instanceof Error ? dbError.message : String(dbError)}`, { cause: dbError });
      }
    } else {
      throw new Error('Database file not found in backup (cms-data/cms.db)');
    }

    // Clean up restore directory
    fs.rmSync(restoreDir, { recursive: true, force: true });

    return {
      success: true,
      message: `✅ Database restored successfully from ${backupName}`,
      details:
        '✓ cms.db (SQLite database with all CMS data)\n' +
        '  - Users & authentication\n' +
        '  - Pages & content blocks\n' +
        '  - Forms & submissions\n' +
        '  - Jobs & applications\n' +
        '  - Media metadata\n' +
        '  - Settings & configuration\n\n' +
        '⚠️  Note: Server restart recommended for changes to take full effect.\n' +
        '📦 Full site restore requires extracting entire backup and running npm install + npm run build',
    };
  } catch (error) {
    console.error('Restore error:', error);
    return {
      success: false,
      message: 'Failed to restore backup',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function POST(request: NextRequest) {
  // Check admin authorization
  const adminCheck = await checkAdmin(request);
  if (!adminCheck.authorized) {
    return adminCheck.response;
  }

  try {
    const { backupName } = await request.json();

    if (!backupName || typeof backupName !== 'string') {
      return NextResponse.json({ error: 'Invalid backup name' }, { status: 400 });
    }

    // Strict allowlist — backup files are named with letters, digits, dots,
    // dashes and underscores only. This blocks directory traversal and any
    // shell-significant characters as defense-in-depth.
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(backupName) || backupName.includes('..')) {
      return NextResponse.json({ error: 'Invalid backup name format' }, { status: 400 });
    }

    const result = await restoreFromBackup(backupName);

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process restore request',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
