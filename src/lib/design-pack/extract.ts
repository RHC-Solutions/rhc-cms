import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FORBIDDEN_PACK_FILES, FORBIDDEN_PACK_PATTERNS } from './types';

// Validate a single zip entry name is safe to extract under `root`.
// Mirrors the restore route's hardening: no absolute paths, no `..` traversal,
// resolved target must stay inside root, and no forbidden files.
export function assertSafeEntry(entryName: string, root: string): void {
  const name = entryName.replace(/\\/g, '/');
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split('/').includes('..')) {
    throw new Error(`Unsafe pack entry path: ${entryName}`);
  }
  const base = path.posix.basename(name);
  if (FORBIDDEN_PACK_FILES.includes(base) || FORBIDDEN_PACK_PATTERNS.some((re) => re.test(name))) {
    throw new Error(`Pack contains a forbidden file: ${entryName}`);
  }
  const target = path.resolve(root, name);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`Pack entry escapes target directory: ${entryName}`);
  }
}

// Extract a design-pack zip (Buffer or path to a .zip) into a fresh temp dir and
// return that dir. Validates EVERY entry before writing anything, so a malicious
// pack is rejected up front (nothing is extracted partially).
export function extractPack(zip: Buffer | string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'design-pack-'));
  let archive: AdmZip;
  try {
    archive = new AdmZip(zip);
  } catch {
    fs.rmSync(root, { recursive: true, force: true });
    throw new Error('Invalid or corrupt design pack (not a valid .zip).');
  }

  try {
    for (const entry of archive.getEntries()) {
      assertSafeEntry(entry.entryName, root);
    }
    archive.extractAllTo(root, /* overwrite */ true);
  } catch (e) {
    fs.rmSync(root, { recursive: true, force: true });
    throw e;
  }
  return root;
}
