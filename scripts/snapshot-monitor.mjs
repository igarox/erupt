#!/usr/bin/env node
/**
 * Watches .snapshots/ for new .magma directories and renames them with a
 * datetime prefix so they sort chronologically.
 *
 * Output name format: YYYYMMDD-HHMMSS-.magma
 * Uses the directory's birth time (creation time) when available; falls back
 * to the rename moment if birth time is unavailable on the OS/fs.
 *
 * Usage:
 *   node scripts/snapshot-monitor.mjs
 *   node scripts/snapshot-monitor.mjs --dir "C:\path\to\.snapshots"
 *
 * Run once at dev session start. Ctrl+C to stop.
 */

import fs from 'fs';
import path from 'path';

const DEFAULT_SNAPSHOTS_DIR = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  'Documents', 'Obsidian Vault', '.snapshots'
);

const snapshotsDir = process.argv[2] === '--dir' && process.argv[3]
  ? process.argv[3]
  : DEFAULT_SNAPSHOTS_DIR;

const TARGET_NAME = '.magma';
const POLL_MS = 1000;

function toTimestampPrefix(date) {
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    '-' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

async function tryRename(src) {
  try {
    const stats = await fs.promises.stat(src);
    // birthtimeMs is 0 on filesystems that don't track it; fall back to mtime.
    const birthMs = stats.birthtimeMs > 0 ? stats.birthtimeMs : stats.mtimeMs;
    const prefix = toTimestampPrefix(new Date(birthMs));
    const dest = path.join(snapshotsDir, `${prefix}-${TARGET_NAME}`);
    await fs.promises.rename(src, dest);
    console.log(`[snapshot-monitor] renamed: ${TARGET_NAME} → ${path.basename(dest)}`);
  } catch (err) {
    console.error(`[snapshot-monitor] rename failed: ${err.message}`);
  }
}

let known = new Set();

async function poll() {
  let entries;
  try {
    entries = await fs.promises.readdir(snapshotsDir);
  } catch {
    // Directory may not exist yet — just wait.
    return;
  }

  for (const entry of entries) {
    if (entry === TARGET_NAME) {
      const full = path.join(snapshotsDir, entry);
      // Wait 500 ms after first detection to let the write settle, then rename.
      if (!known.has(full)) {
        known.add(full);
        setTimeout(() => tryRename(full).then(() => known.delete(full)), 500);
      }
    }
  }
}

// Verify the target directory exists before starting.
try {
  fs.accessSync(snapshotsDir);
} catch {
  console.error(`[snapshot-monitor] snapshots dir not found: ${snapshotsDir}`);
  console.error('Pass a custom path with: node scripts/snapshot-monitor.mjs --dir <path>');
  process.exit(1);
}

console.log(`[snapshot-monitor] watching ${snapshotsDir}`);
console.log('[snapshot-monitor] will rename .magma → YYYYMMDD-HHMMSS-.magma on detection');
console.log('[snapshot-monitor] Ctrl+C to stop\n');

poll();
setInterval(poll, POLL_MS);
