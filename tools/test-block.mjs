// Per-block check: `npm run test:block [-- options] [changed files]`.
//
// A block runs the tests close to its changed files, not every test that loads
// them transitively. The release check covers the transitive closure once per
// batch (docs/WORKFLOW.md, "Block checks"). The selection is:
// - changed test files themselves;
// - test files that reach a changed file within `--depth` static imports
//   (default 2: the test, one helper or caller module, the changed module);
// - test files that name a changed module by its folder and base name, such as
//   `game/karma-menu` (lift comparisons name the module they cover);
// - test files given with `--with`.
// The slow tier (end-to-end sessions, Mesen boots, replays, mutation sweeps) is
// left out unless `--slow` is given; verify:release always runs it.
// Mesen runs replay from the recording cache (SNES_MESEN_CACHE=1) unless the
// variable is set otherwise.
//
// Options: --since <rev> (changed files against a revision, default HEAD plus
// untracked files), --with <test file>, --depth <n>, --slow, --list (print the
// selection without running it).
// Output: the selection with reasons, then counts and duration. A passing run
// removes its log folder; a failing one names it. Stale leftovers of earlier
// runs go first (clean-temp.mjs).
import { spawn, execFileSync } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { cleanTemp, describeClean } from './clean-temp.mjs';
import { pruneTempDirs, removeDirQuietly } from './temp-dir.mjs';
import { testBatches } from './verify-release.mjs';
import { checkProjectStatus } from './check-project-status.mjs';

// Whole test files of the slow tier, with the reason.
export const SLOW_FILES = new Map([
  ['tools/mesen-oracle.test.mjs', 'Mesen opcode comparison of the first rooms'],
  ['tools/live-matrix.test.mjs', 'the seven matrix sessions against the original'],
  ['tools/live-alley-bus.test.mjs', 'alley session with open-bus reads'],
  ['tools/live-cold-start.test.mjs', 'live cold start from reset to the title'],
  ['tools/recording.test.mjs', 'recorded session replays'],
  ['tools/save-anywhere.test.mjs', 'recorded save replay'],
]);
// Single slow tests in otherwise fast files: name → declaring file.
export const SLOW_TESTS = new Map([
  [
    'cheat switches before and during a real cold session replay with identical WRAM',
    'tools/cheats.test.mjs',
  ],
]);

// Failing test names printed per batch; older block log folders kept besides the new one.
const SHOWN_FAILURES = 20,
  KEPT_LOG_DIRS = 19,
  MS_PER_SECOND = 1000;
const MODULE = /\.(mjs|js)$/;
const TEST = /\.test\.mjs$/;
const GOLDEN = /^tools\/golden-[\w-]+\.test\.mjs$/;
const IMPORT =
  /(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)|import\s+['"](\.{1,2}\/[^'"]+)['"]/g;

async function listModules(root, dir, out) {
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    const path = dir + '/' + entry.name;
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') await listModules(root, path, out);
    } else if (MODULE.test(entry.name)) out.push(path);
  }
  return out;
}

// Module texts and the static importers of each module (relative specifiers only).
export async function moduleGraph(root) {
  const paths = [];
  for (const dir of ['src', 'proof', 'tools'])
    if (existsSync(join(root, dir))) await listModules(root, dir, paths);
  const texts = new Map();
  for (const path of paths) texts.set(path, await readFile(join(root, path), 'utf8'));
  return { texts, importers: importersOf(texts) };
}

export function importersOf(texts) {
  const importers = new Map();
  for (const [path, text] of texts)
    for (const match of text.matchAll(IMPORT)) {
      const target = posix.normalize(posix.join(posix.dirname(path), match.slice(1).find(Boolean)));
      if (!importers.has(target)) importers.set(target, new Set());
      importers.get(target).add(path);
    }
  return importers;
}

// `src/game/karma-menu.mjs` → /game\/karma-menu(?![\w-])/: folder and base name.
function mentionPattern(path) {
  const name = posix.join(
    posix.basename(posix.dirname(path)),
    posix.basename(path, posix.extname(path)),
  );
  return new RegExp(name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?![\\w-])');
}

// Returns Map(test path → reason) for the changed paths.
export function selectTests({ texts, importers, changed, depth = 2, extra = [] }) {
  const selected = new Map();
  const add = (path, reason) => {
    if (TEST.test(path) && texts.has(path) && !selected.has(path)) selected.set(path, reason);
  };
  for (const path of changed) add(path, 'changed');
  for (const path of changed) {
    const seen = new Set([path]);
    let frontier = [path];
    for (let level = 1; level <= depth && frontier.length; level++) {
      const next = [];
      for (const module of frontier)
        for (const importer of importers.get(module) ?? []) {
          if (seen.has(importer)) continue;
          seen.add(importer);
          if (TEST.test(importer)) add(importer, `imports ${path} at depth ${level}`);
          else next.push(importer);
        }
      frontier = next;
    }
  }
  for (const path of changed) {
    if (!MODULE.test(path) || TEST.test(path)) continue;
    const pattern = mentionPattern(path);
    for (const [test, text] of texts)
      if (TEST.test(test) && pattern.test(text)) add(test, `names ${path}`);
  }
  for (const path of extra) add(path, 'given with --with');
  // The golden traces (docs/STATE-MODEL-REBUILD.md) check every change of the game.
  if (changed.some((path) => path.startsWith('src/')))
    for (const test of texts.keys()) if (GOLDEN.test(test)) add(test, 'golden trace of src/');
  return selected;
}

function changedFiles(root, since) {
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  return [
    ...new Set([
      ...git('diff', '--name-only', since),
      ...git('ls-files', '--others', '--exclude-standard'),
    ]),
  ];
}

function parseArgs(argv) {
  const options = { since: 'HEAD', extra: [], depth: 2, slow: false, list: false, files: [] };
  for (let n = 0; n < argv.length; n++) {
    const arg = argv[n];
    if (arg === '--since') options.since = argv[++n];
    else if (arg === '--with') options.extra.push(argv[++n].replaceAll('\\', '/'));
    else if (arg === '--depth') options.depth = Number(argv[++n]);
    else if (arg === '--slow') options.slow = true;
    else if (arg === '--list') options.list = true;
    else if (arg.startsWith('--')) throw Error('Unknown option: ' + arg);
    else options.files.push(arg.replaceAll('\\', '/'));
  }
  if (!Number.isInteger(options.depth) || options.depth < 1)
    throw Error('--depth needs a positive integer');
  return options;
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Runs one batch with TAP into its log; returns the TAP summary and failing test names.
async function runBatch(root, batch, args, logPath, env) {
  const log = createWriteStream(logPath);
  const child = spawn(
    process.execPath,
    [
      '--test',
      '--test-reporter=tap',
      `--test-concurrency=${batch.concurrency}`,
      ...args,
      ...batch.paths,
    ],
    { cwd: root, env, windowsHide: true },
  );
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  const code = await new Promise((done) => child.on('close', done));
  await new Promise((done) => log.end(done));
  const counts = {},
    failures = [];
  const lines = createInterface({ input: createReadStream(logPath), crlfDelay: Infinity });
  for await (const line of lines) {
    const metric = line.match(/^# (tests|pass|fail|skipped) (\d+)\s*$/);
    if (metric) counts[metric[1]] = Number(metric[2]);
    const failed = line.match(/^not ok \d+ - (.*)$/);
    if (failed && failures.length < SHOWN_FAILURES) failures.push(failed[1]);
  }
  return { code, counts, failures };
}

export async function testBlock(root, argv) {
  const options = parseArgs(argv);
  const statusFindings = checkProjectStatus(root);
  if (statusFindings.length) {
    console.error(statusFindings.map(({ text }) => text).join('\n'));
    return 1;
  }
  const changed = options.files.length ? options.files : changedFiles(root, options.since);
  const { texts, importers } = await moduleGraph(root);
  const selected = selectTests({
    texts,
    importers,
    changed,
    depth: options.depth,
    extra: options.extra,
  });
  const skippedFiles = [];
  if (!options.slow)
    for (const path of [...selected.keys()])
      if (SLOW_FILES.has(path) && !options.extra.includes(path)) {
        selected.delete(path);
        skippedFiles.push(path);
      }
  console.log(`Changed: ${changed.length} files. Selected: ${selected.size} test files.`);
  for (const [path, reason] of selected) console.log(`  ${path} (${reason})`);
  if (skippedFiles.length)
    console.log(`Slow tier left out (--slow runs it): ${skippedFiles.join(', ')}`);
  if (options.list || !selected.size) return 0;

  console.log(describeClean(await cleanTemp()));
  await pruneTempDirs('snes-block-', KEPT_LOG_DIRS);
  const logDir = await mkdtemp(join(tmpdir(), 'snes-block-'));
  const skip = options.slow ? [] : [...SLOW_TESTS.keys()].map(escapeRegex);
  const args = skip.length ? [`--test-skip-pattern=^(?:${skip.join('|')})$`] : [];
  const env = { ...process.env, SNES_MESEN_CACHE: process.env.SNES_MESEN_CACHE ?? '1' };
  delete env.NODE_TEST_CONTEXT;
  const started = Date.now(),
    total = { tests: 0, pass: 0, fail: 0, skipped: 0 };
  let failed = false;
  for (const batch of await testBatches(root, [...selected.keys()])) {
    const result = await runBatch(root, batch, args, join(logDir, batch.name + '.log'), env);
    for (const key of Object.keys(total)) total[key] += result.counts[key] ?? 0;
    if (result.code !== 0 || !('tests' in result.counts)) failed = true;
    for (const name of result.failures) console.log(`  not ok: ${name}`);
  }
  const seconds = Math.round((Date.now() - started) / MS_PER_SECOND),
    passed = !failed && !total.fail;
  // A passing run's TAP log is not needed later; a failing run keeps it for the excerpts.
  if (passed) await removeDirQuietly(logDir);
  console.log(
    `Tests: ${total.pass}/${total.tests} passed, ${total.fail} failed, ${total.skipped} skipped; ${seconds} s; ` +
      (passed ? 'log removed.' : `log: ${logDir}`),
  );
  return passed ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  process.exitCode = await testBlock(root, process.argv.slice(2));
}
