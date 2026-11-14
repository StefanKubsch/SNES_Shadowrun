// Temporary directories of tools and tests in the system temp folder. Every run
// removes what it no longer needs, so repeated test runs do not fill %TEMP%.
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Edge and Mesen can hold files briefly after they exit; rm retries with a
// linear backoff (about five seconds in total).
const REMOVE_OPTIONS = { recursive: true, force: true, maxRetries: 10, retryDelay: 100 };

export const removeDir = (path) => rm(path, REMOVE_OPTIONS);

// Removal after a run is housekeeping: a locked leftover must not fail the run.
export async function removeDirQuietly(path) {
  try {
    await removeDir(path);
  } catch {
    // A later run's pruning or the user's cleanup removes it.
  }
}

// A fresh directory that is removed when the test t ends.
export async function testTempDir(t, prefix) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  t.after(() => removeDir(dir));
  return dir;
}

// One directory per process and prefix, created on first use and removed at
// process exit.
const processDirs = new Map();
export function processTempDir(prefix) {
  let dir = processDirs.get(prefix);
  if (dir === undefined) {
    dir = mkdtempSync(join(tmpdir(), prefix));
    processDirs.set(prefix, dir);
    process.once('exit', () => rmSync(dir, { recursive: true, force: true }));
  }
  return dir;
}

// Keep the newest `keep` directories whose name starts with prefix; remove the
// older ones. Returns the number removed.
export async function pruneTempDirs(prefix, keep, root = tmpdir()) {
  const entries = await readdir(root, { withFileTypes: true });
  const dirs = [];
  for (const entry of entries)
    if (entry.isDirectory() && entry.name.startsWith(prefix)) {
      const path = join(root, entry.name);
      try {
        dirs.push({ path, time: (await stat(path)).mtimeMs });
      } catch {
        // Removed concurrently.
      }
    }
  dirs.sort((a, b) => b.time - a.time);
  const old = dirs.slice(keep);
  for (const { path } of old) await removeDirQuietly(path);
  return old.length;
}
