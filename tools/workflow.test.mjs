import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readProgress, progressReference } from './progress.mjs';
import {
  compareArtifacts,
  runLogged,
  testBatches,
  verifyArtifactPasses,
  transientWindowsArtifactOpen,
} from './verify-release.mjs';
const sha = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
test('central local source contract requires exact ROM/entry/complete source and retains false native binding', async (t) => {
  const root = await fixture(t);
  await progressFixture(root);
  const path = join(root, 'docs/PORTIERUNGSSTAND.json'),
    p = JSON.parse(await readFile(path));
  p.work_groups[0].source_contract = 'analysis/local.json';
  await writeFile(path, JSON.stringify(p));
  const report = {
    rom_sha256: sha,
    source_graph: { native_binding: false, local_source_complete: true },
    proofs: [{ entry: '80:BEEF', native_binding: false, local_source_complete: true }],
  };
  const put = (v) => writeFile(join(root, 'analysis/local.json'), JSON.stringify(v));
  await put(report);
  await readProgress(root);
  for (const bad of [
    { ...report, rom_sha256: '0'.repeat(64) },
    { ...report, proofs: [] },
    { ...report, source_graph: { ...report.source_graph, native_binding: true } },
    { ...report, proofs: [{ ...report.proofs[0], entry: '80:AAAA' }] },
    { ...report, proofs: [{ ...report.proofs[0], local_source_complete: false }] },
    { ...report, proofs: [{ ...report.proofs[0], native_binding: true }] },
  ]) {
    await put(bad);
    await assert.rejects(() => readProgress(root));
  }
});
async function fixture(t) {
  const prefix = join(tmpdir(), 'snes-workflow-test-'),
    root = await mkdtemp(prefix);
  t.after(async () => {
    if (!root.startsWith(prefix)) throw Error('Unsafe test cleanup path');
    await rm(root, { recursive: true, force: true });
  });
  for (const dir of ['docs', 'tools', 'src', 'analysis', 'assets', 'logs'])
    await mkdir(join(root, dir));
  await writeFile(join(root, 'docs/PORTIERUNGSSTAND.md'), 'stable');
  await writeFile(join(root, 'analysis/dialog-936c-inventory.json'), '{}');
  return root;
}
async function progressFixture(root) {
  const data = {
    schema_version: 1,
    rom_sha256: sha,
    next_block: { group: 'open', entries: ['80:BEEF'], kind: 'source' },
    supplied: [
      {
        entry: '80:ABCD',
        source: 'analysis/source.json',
        graph: 'full_graph',
        native: 'src/native.mjs',
        stack_bytes: 3,
      },
    ],
    work_groups: [{ id: 'open', entries: ['80:BEEF'], status: 'source-required' }],
    open_boundaries: [],
  };
  await writeFile(join(root, 'src/native.mjs'), 'export const supplied=true;');
  const evidence = {
    rom_sha256: sha,
    full_graph: {
      native_binding: true,
      proof: { entry: '80:ABCD', external_return_assumptions: 0, minimum_protected_stack_bytes: 3 },
    },
  };
  await writeFile(join(root, 'analysis/source.json'), JSON.stringify(evidence));
  await writeFile(join(root, progressReference), JSON.stringify(data));
  return { data, evidence };
}
test('Central progress validates actual ROM/proof/native evidence and rejects stale status claims', async (t) => {
  const root = await fixture(t),
    { data, evidence } = await progressFixture(root);
  assert.deepEqual(await readProgress(root), data);
  for (const mutate of [
    (e) => (e.rom_sha256 = '0'.repeat(64)),
    (e) => (e.full_graph.native_binding = false),
    (e) => (e.full_graph.proof.entry = '80:1234'),
    (e) => (e.full_graph.proof.external_return_assumptions = 1),
    (e) => (e.full_graph.proof.minimum_protected_stack_bytes = 2),
  ]) {
    const changed = structuredClone(evidence);
    mutate(changed);
    await writeFile(join(root, 'analysis/source.json'), JSON.stringify(changed));
    await assert.rejects(() => readProgress(root), /evidence drift/);
  }
});
test('Central progress rejects duplicate entries, next outside open group and evidence paths outside workspace', async (t) => {
  const root = await fixture(t),
    { data } = await progressFixture(root);
  for (const mutate of [
    (d) => (d.work_groups[0].entries = ['80:ABCD']),
    (d) => (d.next_block.entries = ['80:CAFE']),
    (d) => (d.supplied[0].native = 'src/../../outside.mjs'),
    (d) => d.work_groups.push(structuredClone(d.work_groups[0])),
  ]) {
    const changed = structuredClone(data);
    mutate(changed);
    await writeFile(join(root, progressReference), JSON.stringify(changed));
    await assert.rejects(() => readProgress(root));
  }
});
test('Release artifact comparison rejects changed, added and removed files', () => {
  compareArtifacts({ 'analysis/render-a.json': 'a' }, { 'analysis/render-a.json': 'a' });
  for (const after of [
    {},
    { 'analysis/render-a.json': 'b' },
    { 'analysis/render-a.json': 'a', 'analysis/render-b.json': 'b' },
  ])
    assert.throws(
      () => compareArtifacts({ 'analysis/render-a.json': 'a' }, after),
      /Non-reproducible artifacts/,
    );
});
test('Browser test files run last in their own smaller batch', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'snes-batches-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'tools'));
  await writeFile(join(root, 'tools/a.test.mjs'), "import x from './mesen.mjs';");
  await writeFile(
    join(root, 'tools/b.test.mjs'),
    "import { withStartPage } from './browser-frame.mjs';",
  );
  const paths = ['tools/b.test.mjs', 'tools/a.test.mjs'];
  assert.deepEqual(await testBatches(root, paths, {}), [
    {
      name: 'tests',
      paths: ['tools/a.test.mjs'],
      concurrency: Math.max(1, Math.min(8, (await import('node:os')).availableParallelism() - 1)),
    },
    { name: 'browser-tests', paths: ['tools/b.test.mjs'], concurrency: 2 },
  ]);
  const chosen = await testBatches(root, paths, {
    SNES_TEST_CONCURRENCY: '3',
    SNES_BROWSER_CONCURRENCY: '1',
  });
  assert.deepEqual(
    chosen.map((b) => b.concurrency),
    [3, 1],
  );
  assert.deepEqual(
    (await testBatches(root, ['tools/b.test.mjs'], {})).map((b) => b.name),
    ['browser-tests'],
  );
});
test('Release command retains logs and propagates actual nonzero child exits', async (t) => {
  const root = await fixture(t),
    logPath = join(root, 'logs/fail.log');
  await assert.rejects(
    () =>
      runLogged(process.execPath, ['-e', 'console.error("deliberate failure"); process.exit(7)'], {
        root,
        logPath,
      }),
    /Command failed \(7\)/,
  );
  assert.match(await readFile(logPath, 'utf8'), /deliberate failure/);
});
test('Two real generator passes accept stable output and reject changing second-pass output', async (t) => {
  const root = await fixture(t),
    path = join(root, 'tools/generator.mjs'),
    options = {
      root,
      logDir: join(root, 'logs'),
      generators: [['probe:render-test', 'node tools/generator.mjs']],
      announce: () => {},
    };
  await writeFile(
    path,
    'import {writeFileSync} from "node:fs"; writeFileSync("analysis/render-test.json","stable");',
  );
  assert.equal(Object.keys(await verifyArtifactPasses(options)).length, 3);
  await writeFile(
    path,
    'import {readFileSync,writeFileSync,existsSync} from "node:fs"; const n=existsSync("count")?Number(readFileSync("count","utf8"))+1:1; writeFileSync("count",String(n)); writeFileSync("analysis/render-test.json",String(n));',
  );
  await assert.rejects(
    () => verifyArtifactPasses(options),
    /Non-reproducible artifacts: analysis\/render-test.json/,
  );
});
test('Failed generator stops the release pipeline before following commands', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'tools/fail.mjs'), 'process.exit(9);');
  await writeFile(
    join(root, 'tools/follow.mjs'),
    'import {writeFileSync} from "node:fs";writeFileSync("marker","bad");',
  );
  await assert.rejects(
    () =>
      verifyArtifactPasses({
        root,
        logDir: join(root, 'logs'),
        announce: () => {},
        generators: [
          ['probe:render-fail', 'node tools/fail.mjs'],
          ['probe:render-follow', 'node tools/follow.mjs'],
        ],
      }),
    /Command failed \(9\)/,
  );
  await assert.rejects(() => readFile(join(root, 'marker')), /ENOENT/);
});
const windowsOpenError = (root, path = 'analysis/render-task-test.json', patch = {}) =>
  Error('Command failed (1)', {
    cause: {
      code: 1,
      stderr: `Error: UNKNOWN: unknown error, open '${join(root, path)}'\n  errno: -4094,\n  code: 'UNKNOWN',\n  syscall: 'open',\n`,
      ...patch,
    },
  });
test('Windows artifact retry requires exact open/UNKNOWN/-4094/nonzero1 evidence and a confined original artifact path', () => {
  const root = 'C:\\Coding\\SNES_Shadowrun';
  assert.equal(transientWindowsArtifactOpen(windowsOpenError(root), root, 'win32'), true);
  assert.equal(
    transientWindowsArtifactOpen(windowsOpenError(root, 'assets/render-test.json'), root, 'win32'),
    true,
  );
  for (const path of [
    '../outside/analysis/render-test.json',
    '../SNES_Shadowrun2/analysis/render-test.json',
    'Shadowrun (E).smc',
    'docs/PORTIERUNGSSTAND.json',
    'analysis/task-heap.json',
  ])
    assert.equal(transientWindowsArtifactOpen(windowsOpenError(root, path), root, 'win32'), false);
  for (const patch of [
    { code: 7 },
    { code: 'UNKNOWN' },
    { stderr: 'Source proof drift' },
    { stderr: windowsOpenError(root).cause.stderr.replace('-4094', '-4048') },
    { stderr: windowsOpenError(root).cause.stderr.replace("syscall: 'open'", "syscall: 'read'") },
  ])
    assert.equal(
      transientWindowsArtifactOpen(windowsOpenError(root, undefined, patch), root, 'win32'),
      false,
    );
  assert.equal(transientWindowsArtifactOpen(windowsOpenError(root), root, 'linux'), false);
});
test('Transient Windows generator failure retains separate attempts, retries the same generator, and still hashes two entire passes', async (t) => {
  const root = await fixture(t),
    calls = [],
    waits = [],
    announcements = [];
  const command = async (binary, args, options) => {
    calls.push({ binary, args, logPath: options.logPath });
    if (calls.length === 1) {
      await writeFile(options.logPath, 'original UNKNOWN/-4094 failure');
      throw windowsOpenError(root);
    }
    await writeFile(options.logPath, 'success');
    await writeFile(join(root, 'analysis/render-test.json'), 'stable');
  };
  await verifyArtifactPasses({
    root,
    logDir: join(root, 'logs'),
    generators: [['probe:render-test', 'node tools/generator.mjs']],
    command,
    platform: 'win32',
    retryWait: async (ms) => waits.push(ms),
    announce: (message) => announcements.push(message),
  });
  assert.deepEqual(
    calls.map((c) => c.args),
    [['tools/generator.mjs'], ['tools/generator.mjs'], ['tools/generator.mjs']],
  );
  assert.deepEqual(waits, [250]);
  assert.ok(calls[1].logPath.endsWith('generate-1-0-retry-1.log'));
  assert.equal(await readFile(calls[0].logPath, 'utf8'), 'original UNKNOWN/-4094 failure');
  assert.equal(announcements.filter((s) => s.startsWith('Artifacts')).length, 2);
});
test('Persistent Windows open stops after two retries; semantic errors stop at once; following generators never execute', async (t) => {
  for (const transient of [true, false]) {
    const root = await fixture(t),
      calls = [],
      waits = [],
      failure = transient ? windowsOpenError(root) : Error('Source drift');
    await assert.rejects(
      () =>
        verifyArtifactPasses({
          root,
          logDir: join(root, 'logs'),
          platform: 'win32',
          announce: () => {},
          retryWait: async (ms) => waits.push(ms),
          generators: [
            ['probe:render-fail', 'node tools/fail.mjs'],
            ['probe:render-follow', 'node tools/follow.mjs'],
          ],
          command: async (_binary, args) => {
            calls.push(args);
            throw failure;
          },
        }),
      (error) => error === failure,
    );
    assert.equal(calls.length, transient ? 3 : 1);
    assert.ok(calls.every((args) => args[0] === 'tools/fail.mjs'));
    assert.deepEqual(waits, transient ? [250, 1000] : []);
  }
});
test('A successful retry never excuses changed artifacts in the second full pass', async (t) => {
  const root = await fixture(t);
  let calls = 0;
  await assert.rejects(
    () =>
      verifyArtifactPasses({
        root,
        logDir: join(root, 'logs'),
        platform: 'win32',
        announce: () => {},
        retryWait: async () => {},
        generators: [['probe:render-changing', 'node tools/generator.mjs']],
        command: async () => {
          calls++;
          if (calls === 1) throw windowsOpenError(root);
          await writeFile(join(root, 'analysis/render-test.json'), String(calls));
        },
      }),
    /Non-reproducible artifacts: analysis\/render-test.json/,
  );
  assert.equal(calls, 3);
});
