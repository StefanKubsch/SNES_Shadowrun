// Removes leftovers of earlier test and tool runs: `npm run clean:temp`.
// test:block and verify:release call it first, so leftovers do not pile up
// (user, 2026-11-10 and 2026-11-20). Each run already removes its own temporary
// data; this sweep catches what killed or crashed runs and external programs
// left behind. It only removes entries older than STALE_MS, so parallel runs
// keep their live folders.
// - %TEMP%/snes-* folders, except the log folders that pruneTempDirs keeps by count;
// - former agent logs in %TEMP% (rb*.log, rb*.tests, snes-*.log);
// - Edge's msedge_url_fetcher_<pid>_* folders whose process has ended (browser
//   tests now start Edge without the component updater that made them);
// - Mesen's per-run files (Saves, Debugger, SaveStates) named after a run's ROM copy.
// --dry-run lists the entries instead of removing them.
import { readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findMesen, MESEN_RUN_FOLDERS } from './mesen.mjs';

const HOUR_MS = 3600000,
  STALE_HOURS = 6,
  BYTES_PER_MB = 1048576;
export const STALE_MS = STALE_HOURS * HOUR_MS;
// A few short retries: a still locked entry waits for the next sweep.
const REMOVE_OPTIONS = { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }; // magic-number-ok: retry count and delay in ms
// Log folders kept by count (pruneTempDirs in verify-release.mjs and test-block.mjs).
const COUNTED_PREFIXES = ['snes-release-', 'snes-browser-frame-', 'snes-block-'];
const TEMP_FILE = /^(?:rb\d[\w-]*\.(?:log|tests)|snes-[\w.-]+\.log)$/;
const EDGE_FETCHER = /^msedge_url_fetcher_(\d+)_\d+$/;
const MESEN_RUN = /^run-\d+-\d+-/;

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

async function size(path) {
  let info;
  try {
    info = await stat(path);
  } catch {
    return 0;
  }
  if (!info.isDirectory()) return info.size;
  let total = 0;
  for (const name of await readdir(path).catch(() => [])) total += await size(join(path, name));
  return total;
}

// Which entries of a folder go: a callback decides per name and directory flag.
async function sweep(dir, { now, staleMs, dryRun }, wanted, result) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!wanted(entry.name, entry.isDirectory())) continue;
    const path = join(dir, entry.name);
    try {
      if (now - (await stat(path)).mtimeMs < staleMs) continue;
      const bytes = await size(path);
      if (dryRun) result.names.push(path);
      else await rm(path, REMOVE_OPTIONS);
      result.removed++;
      result.bytes += bytes;
    } catch {
      result.locked++;
    }
  }
}

export async function cleanTemp({
  temp = tmpdir(),
  mesenDir = findMesen().exe ? dirname(findMesen().exe) : null,
  now = Date.now(),
  staleMs = STALE_MS,
  dryRun = false,
} = {}) {
  const result = { removed: 0, bytes: 0, locked: 0, names: [] },
    options = { now, staleMs, dryRun };
  await sweep(
    temp,
    options,
    (name, isDir) =>
      isDir
        ? (name.startsWith('snes-') && !COUNTED_PREFIXES.some((p) => name.startsWith(p))) ||
          (EDGE_FETCHER.test(name) && !processAlive(Number(name.match(EDGE_FETCHER)[1])))
        : TEMP_FILE.test(name),
    result,
  );
  if (mesenDir)
    for (const folder of MESEN_RUN_FOLDERS)
      await sweep(join(mesenDir, folder), options, (name) => MESEN_RUN.test(name), result);
  return result;
}

export const describeClean = ({ removed, bytes, locked }, verb = 'Cleaned') =>
  `${verb} ${removed} stale temporary entries (${Math.round(bytes / BYTES_PER_MB)} MB)` +
  (locked ? `; ${locked} still locked` : '') +
  '.';

// --dry-run lists what would go without removing it.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dryRun = process.argv.includes('--dry-run'),
    result = await cleanTemp({ dryRun });
  for (const name of result.names) console.log(name);
  console.log(describeClean(result, dryRun ? 'Would clean' : 'Cleaned'));
}
