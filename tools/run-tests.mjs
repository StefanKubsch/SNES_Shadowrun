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
    { cwd: root, stdio: 'inherit' },
  );
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
