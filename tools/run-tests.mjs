// npm test: every test file in the same two batches as the release check
// (testBatches in verify-release.mjs), browser tests last and fewer at once.
// Run: node tools/run-tests.mjs
import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testBatches } from './verify-release.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = (await readdir(resolve(root, 'tools')))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => 'tools/' + name);
let failed = false;
for (const batch of await testBatches(root, paths)) {
  console.log(`${batch.name}: ${batch.paths.length} files, ${batch.concurrency} at once`);
  const result = spawnSync(
    process.execPath,
    ['--test', `--test-concurrency=${batch.concurrency}`, ...batch.paths],
    // Mesen runs replay from the recording cache, as in verify:release; a
    // recording depends only on Mesen, the ROM and the script, not on src/.
    // SNES_MESEN_CACHE=0 starts Mesen for every run.
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, SNES_MESEN_CACHE: process.env.SNES_MESEN_CACHE ?? '1' },
    },
  );
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
