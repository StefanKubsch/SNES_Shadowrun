import { readFile, writeFile, readdir, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join, dirname, win32 } from 'node:path';
import { availableParallelism, tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createReleaseCache } from './release-cache.mjs';
import { projectStatusTextFindings } from './project-status-text.mjs';
import { pruneTempDirs } from './temp-dir.mjs';
const exec = promisify(execFile);
// Test files running at once, each possibly with its own Edge or Mesen.
// User decision 2026-11-01: at most 8 (node's default is all threads but
// one); SNES_TEST_CONCURRENCY overrides it.
export function testConcurrency(env = process.env, threads = availableParallelism()) {
  const chosen = Number(env.SNES_TEST_CONCURRENCY);
  if (Number.isInteger(chosen) && chosen >= 1) return chosen;
  return Math.max(1, Math.min(8, threads - 1));
}
// Browser tests run Edge pages with live workers and the CRT. Alongside each
// other and the Mesen tests, their pages starved and timed out (2026-11-03),
// so browser test files form a second batch after all others, with at most
// two at once. SNES_BROWSER_CONCURRENCY overrides it.
export function browserConcurrency(env = process.env) {
  const chosen = Number(env.SNES_BROWSER_CONCURRENCY);
  return Number.isInteger(chosen) && chosen >= 1 ? chosen : 2;
}
// A browser test is any test file with an import line for the Edge helper.
export async function testBatches(root, paths, env = process.env) {
  const browser = [],
    other = [];
  for (const path of paths)
    (/^import[^;]*from '\.\/browser-frame\.mjs'/m.test(await readFile(join(root, path), 'utf8'))
      ? browser
      : other
    ).push(path);
  return [
    { name: 'tests', paths: other, concurrency: testConcurrency(env) },
    { name: 'browser-tests', paths: browser, concurrency: browserConcurrency(env) },
  ].filter((batch) => batch.paths.length);
}
export async function runLogged(command, args, { root, logPath, env }) {
  try {
    const result = await exec(command, args, {
      cwd: root,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
      ...(env ? { env } : {}),
    });
    await writeFile(logPath, result.stdout + result.stderr);
    return result.stdout;
  } catch (error) {
    await writeFile(
      logPath,
      (error.stdout ?? '') + (error.stderr ?? '') + '\n' + error.message + '\n',
    );
    throw Error(`Command failed (${error.code ?? 'spawn'}); log: ${logPath}`, { cause: error });
  }
}
export function compareArtifacts(first, second) {
  const paths = new Set([...Object.keys(first), ...Object.keys(second)]);
  const changed = [...paths].filter((path) => first[path] !== second[path]);
  if (changed.length) throw Error('Non-reproducible artifacts: ' + changed.join(', '));
}
export async function artifactHashes(root) {
  const paths = [];
  // A vm- folder (such as assets/vm-samples) contributes each of its files.
  for (const dir of ['analysis', 'assets'])
    for (const entry of (await readdir(join(root, dir), { withFileTypes: true })).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      if (!entry.name.startsWith('render-') && !entry.name.startsWith('vm-')) continue;
      if (!entry.isDirectory()) {
        paths.push(`${dir}/${entry.name}`);
        continue;
      }
      for (const name of (await readdir(join(root, dir, entry.name))).sort())
        paths.push(`${dir}/${entry.name}/${name}`);
    }
  paths.push('analysis/dialog-936c-inventory.json', 'docs/PORTIERUNGSSTAND.md');
  const hashes = {};
  for (const path of paths)
    hashes[path] = createHash('sha256')
      .update(await readFile(join(root, path)))
      .digest('hex');
  return hashes;
}
export function transientWindowsArtifactOpen(error, root, platform = process.platform) {
  if (platform !== 'win32' || error?.cause?.code !== 1) return false;
  const stderr = error.cause.stderr ?? '',
    match = stderr.match(/^Error: UNKNOWN: unknown error, open '([^'\r\n]+)'$/m);
  if (
    !match ||
    !/^\s*errno: -4094,?$/m.test(stderr) ||
    !/^\s*code: 'UNKNOWN',?$/m.test(stderr) ||
    !/^\s*syscall: 'open',?$/m.test(stderr)
  )
    return false;
  const path = win32.relative(win32.resolve(root), win32.resolve(match[1]));
  return /^(analysis|assets)\\render-[a-z0-9-]+\.(json|asm\.txt)$/i.test(path);
}
// With the cache, pass 1 skips generators with unchanged inputs and outputs;
// pass 2 repeats exactly those run in pass 1 and compares all artifacts.
// Test files run incrementally with the Mesen recording cache (tools/mesen.mjs);
// --full records every Mesen session afresh and replaces its entry.
export async function verifyArtifactPasses({
  root,
  generators,
  command = runLogged,
  logDir,
  announce = console.log,
  platform = process.platform,
  retryWait = (ms) => new Promise((done) => setTimeout(done, ms)),
  cache = null,
  stats = {},
}) {
  let first;
  const executed = new Set();
  stats.cached = 0;
  stats.uncacheable = {};
  for (let pass = 1; pass <= 2; pass++) {
    for (let n = 0; n < generators.length; n++) {
      const [name, script] = generators[n];
      if (!/^node tools\/[a-z0-9-]+\.mjs$/.test(script))
        throw Error('Unsupported generator command: ' + name);
      if (cache) {
        if (pass === 1 && (await cache.valid('generators', name))) {
          stats.cached++;
          continue;
        }
        if (pass === 2 && !executed.has(name)) continue;
        executed.add(name);
        await cache.clearRecords(name);
      }
      for (let attempt = 0; ; attempt++) {
        const suffix = attempt ? `-retry-${attempt}` : '';
        try {
          await command(process.execPath, [script.slice(5)], {
            root,
            logPath: join(logDir, `generate-${pass}-${n}${suffix}.log`),
            ...(cache ? { env: cache.env(name) } : {}),
          });
          cache?.changed();
          break;
        } catch (error) {
          cache?.changed();
          if (attempt === 2 || !transientWindowsArtifactOpen(error, root, platform)) throw error;
          announce(
            `Windows artifact open failed; repeating ${name} (${attempt + 1}/2). Prior log retained.`,
          );
          await retryWait(attempt === 0 ? 250 : 1000);
        }
      }
    }
    const hashes = await artifactHashes(root);
    if (pass === 1) first = hashes;
    else compareArtifacts(first, hashes);
    const ran = cache ? executed.size : generators.length;
    announce(
      `Artifacts ${pass}/2: ${ran} generators run${cache ? `, ${stats.cached} unchanged` : ''}, ${Object.keys(hashes).length} artifacts.`,
    );
  }
  stats.executed = cache ? executed.size : generators.length;
  if (cache)
    for (const name of executed) {
      const reason = await cache.store('generators', name, { allowWrites: true });
      if (reason) stats.uncacheable[name] = reason;
    }
  return first;
}
async function modules(root, directory) {
  const found = [];
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) found.push(...(await modules(root, path)));
    else if (entry.name.endsWith('.mjs')) found.push(path);
  }
  return found.sort();
}
export async function verifyModuleSyntax({ root, files, logDir, command = runLogged }) {
  const manifest = join(logDir, 'syntax-files.json');
  await writeFile(manifest, JSON.stringify({ root: resolve(root), files }, null, 2) + '\n');
  const stdout = await command(
    process.execPath,
    [
      '--experimental-vm-modules',
      fileURLToPath(new URL('./check-module-syntax.mjs', import.meta.url)),
      manifest,
    ],
    { root, logPath: join(logDir, 'syntax.log') },
  );
  let result;
  try {
    result = JSON.parse(stdout);
  } catch {
    throw Error('Invalid syntax batch result');
  }
  if (
    result.modules !== files.length ||
    result.executed !== 0 ||
    !Number.isSafeInteger(result.milliseconds) ||
    result.milliseconds < 0
  )
    throw Error('Incomplete syntax batch result');
  return result;
}
// Older log directories in the temp folder are removed when a release check starts: it
// keeps the newest 19 release logs (20 with this run) and 50 browser test logs.
const KEPT_LOG_DIRS = [
  ['snes-release-', 19],
  ['snes-browser-frame-', 50],
];
export async function verifyRelease(root, { full = false } = {}) {
  for (const [prefix, keep] of KEPT_LOG_DIRS) await pruneTempDirs(prefix, keep);
  const logDir = await mkdtemp(join(tmpdir(), 'snes-release-'));
  const summary = {
    passed: false,
    log_dir: logDir,
    mode: full ? 'full' : 'incremental',
    steps: [],
    counts: {},
  };
  let step = 'configuration';
  const run = async (name, command, args) => {
    step = name;
    const started = Date.now();
    const stdout = await runLogged(command, args, { root, logPath: join(logDir, name + '.log') });
    summary.steps.push({ name, milliseconds: Date.now() - started });
    return stdout;
  };
  try {
    // Catch overlong notes before any formatter, generator or test is started,
    // including shell edits that do not trigger the agent's post-edit hook.
    step = 'project-status';
    const statusFindings = projectStatusTextFindings(
      await readFile(join(root, 'docs/PROJECT-STATUS.json'), 'utf8'),
    );
    if (statusFindings.length) throw Error(statusFindings.map(({ text }) => text).join('\n'));
    const cache = await createReleaseCache({ root, trackDir: join(logDir, 'track'), full });
    // Game and proof code stay Prettier-formatted; checked first because it is cheap.
    await run('format', process.execPath, [
      join(root, 'node_modules/prettier/bin/prettier.cjs'),
      '--check',
      'src',
      'proof',
    ]);
    console.log('Format: src and proof match Prettier.');
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    const generators = Object.entries(pkg.scripts).filter(([name]) =>
      /^(analyze|extract|probe):(render|vm)-/.test(name),
    );
    if (!generators.length) throw Error('No render generators configured');
    for (const name of ['plan:dialog', 'docs:progress']) {
      if (!pkg.scripts[name]) throw Error('Missing generator ' + name);
      generators.push([name, pkg.scripts[name]]);
    }
    step = 'artifacts';
    const artifactStats = {},
      artifactsStarted = Date.now(),
      hashes = await verifyArtifactPasses({
        root,
        generators,
        logDir,
        cache,
        stats: artifactStats,
      });
    summary.counts.generators_run = artifactStats.executed;
    summary.counts.generators_unchanged = artifactStats.cached;
    summary.uncacheable_generators = artifactStats.uncacheable;
    summary.steps.push({ name: step, milliseconds: Date.now() - artifactsStarted });
    summary.counts.render_scripts = generators.length - 2;
    summary.counts.render_artifacts = Object.keys(hashes).filter((path) =>
      /^(analysis|assets)\/(render|vm)-/.test(path),
    ).length;
    summary.counts.planning_artifacts =
      Object.keys(hashes).length - summary.counts.render_artifacts;
    const acPaths = ['analysis/ac-state.json', 'analysis/ac-state.asm.txt'];
    const before = await Promise.all(acPaths.map((path) => readFile(join(root, path))));
    await run('ac-source', process.execPath, ['tools/analyze-ac-state.mjs']);
    for (let n = 0; n < acPaths.length; n++)
      if (!(await readFile(join(root, acPaths[n]))).equals(before[n]))
        throw Error('AC source artifact drift: ' + acPaths[n]);
    console.log('AC: both source artifacts unchanged.');
    step = 'syntax';
    const files = [
      ...(await modules(root, 'src')),
      ...(await modules(root, 'proof')),
      ...(await modules(root, 'tools')),
    ];
    const syntaxStarted = Date.now(),
      syntax = await verifyModuleSyntax({ root, files, logDir });
    summary.steps.push({ name: step, milliseconds: Date.now() - syntaxStarted });
    summary.counts.syntax_modules = syntax.modules;
    console.log(`Syntax: ${files.length} modules in one parser process.`);
    const tests = files.filter((path) => path.endsWith('.test.mjs')),
      runTests = [];
    for (const path of tests) if (!(await cache.valid('tests', path))) runTests.push(path);
    summary.counts.test_files = tests.length;
    summary.counts.test_files_run = runTests.length;
    summary.counts.test_files_unchanged = tests.length - runTests.length;
    console.log(
      `Running ${runTests.length} of ${tests.length} test files (${tests.length - runTests.length} with unchanged inputs)...`,
    );
    Object.assign(summary.counts, { tests: 0, pass: 0, fail: 0, skipped: 0 });
    summary.uncacheable_tests = {};
    if (runTests.length) {
      step = 'tests';
      const started = Date.now();
      for (const batch of await testBatches(root, runTests)) {
        const output = await runLogged(
          process.execPath,
          [
            '--test',
            '--test-reporter=tap',
            `--test-concurrency=${batch.concurrency}`,
            ...batch.paths,
          ],
          {
            root,
            logPath: join(logDir, `${batch.name}.log`),
            env: { ...cache.env(), SNES_MESEN_CACHE: full ? 'record' : '1' },
          },
        );
        for (const metric of ['tests', 'pass', 'fail', 'skipped']) {
          const match = output.match(new RegExp(`^# ${metric} (\\d+)\\s*$`, 'm'));
          if (!match) throw Error('Missing TAP summary: ' + metric);
          summary.counts[metric] += Number(match[1]);
        }
      }
      summary.steps.push({ name: 'tests', milliseconds: Date.now() - started });
      if (
        summary.counts.tests < 1 ||
        summary.counts.fail !== 0 ||
        summary.counts.pass !== summary.counts.tests ||
        summary.counts.skipped !== 0
      )
        throw Error('Not all tests passed');
      for (const path of runTests) {
        const reason = await cache.store('tests', path, { allowWrites: false });
        if (reason) summary.uncacheable_tests[path] = reason;
      }
    }
    console.log(
      `Tests: ${summary.counts.pass}/${summary.counts.tests} passed in ${runTests.length} files; ${tests.length - runTests.length} files unchanged.`,
    );
    await run('diff', 'git', ['diff', '--check']);
    await run('staged-diff', 'git', ['diff', '--cached', '--check']);
    await run('lfs-fsck', 'git', ['lfs', 'fsck']);
    await run('lfs-status', 'git', ['lfs', 'status']);
    summary.passed = true;
    await writeFile(join(logDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(`Release checks passed; summary: ${join(logDir, 'summary.json')}`);
    return summary;
  } catch (error) {
    summary.failed_step = step;
    summary.error = error.message;
    await writeFile(join(logDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    throw Error(
      `Release checks failed at ${step}: ${error.message}\nSummary: ${join(logDir, 'summary.json')}`,
      { cause: error },
    );
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await verifyRelease(resolve(dirname(fileURLToPath(import.meta.url)), '..'), {
      full: process.argv.includes('--full'),
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
