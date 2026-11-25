// Which src functions the golden traces reach (docs/STATE-MODEL-REBUILD.md, "Golden
// traces"): runs every tools/golden-*.test.mjs with V8 coverage and reports, per src
// directory and module, the functions called at least once. A proof module (and its
// differential test) may only be retired where the traces reach the same src path.
//   npm run golden:coverage [-- --modules]   (--modules lists every partly reached module)
//   --json writes .cache/golden-coverage.json: per loaded module the reached and the
//   unreached function names.
// Branches inside a reached function are not counted: reaching a function is the lower
// bound the retirement check starts from, not the proof of every path.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)),
  listModules = process.argv.includes('--modules'),
  writeJson = process.argv.includes('--json'),
  // At most three replays at once (CPU limit of the user's machine).
  CONCURRENCY = 3,
  PERCENT = 100,
  // Output tail shown on a failure, and the report's column widths.
  FAILURE_TAIL = 4000,
  DIRECTORY_COLUMN = 16,
  COUNT_COLUMN = 5;
const tests = readdirSync(join(root, 'tools'))
  .filter((name) => /^golden-.*\.test\.mjs$/.test(name))
  .map((name) => join('tools', name));
const coverage = mkdtempSync(join(tmpdir(), 'golden-coverage-'));
try {
  const run = spawnSync(
    process.execPath,
    ['--test', `--test-concurrency=${CONCURRENCY}`, ...tests],
    { cwd: root, env: { ...process.env, NODE_V8_COVERAGE: coverage }, encoding: 'utf8' },
  );
  if (run.status !== 0) {
    console.error(run.stdout.slice(-FAILURE_TAIL), run.stderr.slice(-FAILURE_TAIL));
    throw new Error('golden traces failed; coverage not evaluated');
  }
  // Per module: function key (name and offset) -> reached at least once.
  const modules = new Map();
  for (const file of readdirSync(coverage))
    for (const script of JSON.parse(readFileSync(join(coverage, file), 'utf8')).result) {
      if (!script.url.startsWith('file:')) continue;
      const path = relative(root, fileURLToPath(script.url)).replaceAll('\\', '/');
      if (!path.startsWith('src/')) continue;
      let functions = modules.get(path);
      if (!functions) modules.set(path, (functions = new Map()));
      for (const fn of script.functions) {
        if (!fn.functionName) continue;
        const key = `${fn.functionName}@${fn.ranges[0].startOffset}`;
        functions.set(key, functions.get(key) || fn.ranges[0].count > 0);
      }
    }
  const all = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true }))
      if (entry.isDirectory()) walk(`${dir}/${entry.name}`);
      else if (entry.name.endsWith('.mjs')) all.push(`${dir}/${entry.name}`);
  };
  walk('src');
  const directories = new Map();
  let reached = 0,
    total = 0;
  const partly = [];
  for (const path of all) {
    const functions = [...(modules.get(path)?.values() ?? [])],
      hit = functions.filter(Boolean).length,
      dir = path.split('/').slice(0, 2).join('/'),
      d = directories.get(dir) ?? { hit: 0, total: 0, modules: 0, unloaded: 0 };
    d.hit += hit;
    d.total += functions.length;
    d.modules++;
    if (!modules.has(path)) d.unloaded++;
    directories.set(dir, d);
    reached += hit;
    total += functions.length;
    if (modules.has(path) && hit < functions.length)
      partly.push(`${hit}/${functions.length} ${path}`);
  }
  console.log(`Golden traces: ${tests.length}; src functions reached ${reached} of ${total}.`);
  for (const [dir, d] of [...directories].sort())
    console.log(
      `${dir.padEnd(DIRECTORY_COLUMN)} ${String(d.hit).padStart(COUNT_COLUMN)}/${String(d.total).padEnd(COUNT_COLUMN)} ` +
        `${d.total ? Math.round((PERCENT * d.hit) / d.total) : PERCENT}%  ` +
        `modules ${d.modules}, not loaded ${d.unloaded}`,
    );
  if (listModules) for (const line of partly.sort()) console.log(line);
  if (writeJson) {
    const report = {};
    for (const [path, functions] of [...modules].sort()) {
      const names = (hit) =>
        [...functions].filter(([, h]) => h === hit).map(([key]) => key.split('@')[0]);
      report[path] = { reached: names(true), unreached: names(false) };
    }
    mkdirSync(join(root, '.cache'), { recursive: true });
    writeFileSync(
      join(root, '.cache/golden-coverage.json'),
      `${JSON.stringify(report, null, 1)}\n`,
    );
  }
} finally {
  rmSync(coverage, { recursive: true, force: true });
}
