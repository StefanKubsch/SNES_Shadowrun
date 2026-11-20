// Block test selection (tools/test-block.mjs), the slow tier lists and the
// temporary data sweep (tools/clean-temp.mjs, removeRunFiles in tools/mesen.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SLOW_FILES, SLOW_TESTS, importersOf, selectTests } from './test-block.mjs';
import { cleanTemp, STALE_MS } from './clean-temp.mjs';
import { removeRunFiles } from './mesen.mjs';
import { testTempDir } from './temp-dir.mjs';

const graph = (texts) => {
  const map = new Map(Object.entries(texts));
  return { texts: map, importers: importersOf(map) };
};

test('the selection follows static imports up to the depth, names and changed tests', () => {
  const files = graph({
    'src/game/menu.mjs': '',
    'src/game/loop.mjs': "import { menu } from './menu.mjs';",
    'src/game/owner.mjs': "import { loop } from './loop.mjs';",
    'tools/menu-caller.test.mjs': "import { menu } from '../src/game/menu.mjs';",
    'tools/loop-caller.test.mjs': "import {\n  loop,\n} from '../src/game/loop.mjs';",
    'tools/owner.test.mjs': "import { owner } from '../src/game/owner.mjs';",
    'tools/menu-lift.test.mjs': '// Compares src/game/menu.mjs with its reference.',
    'tools/menu-extra.test.mjs': '// game/menu-extra is another module.',
    'tools/other.test.mjs': '',
  });
  const selected = selectTests({ ...files, changed: ['src/game/menu.mjs'] });
  assert.deepEqual([...selected.keys()].sort(), [
    'tools/loop-caller.test.mjs',
    'tools/menu-caller.test.mjs',
    'tools/menu-lift.test.mjs',
  ]);
  assert.equal(selected.get('tools/loop-caller.test.mjs'), 'imports src/game/menu.mjs at depth 2');
  const deeper = selectTests({ ...files, changed: ['src/game/menu.mjs'], depth: 3 });
  assert.ok(deeper.has('tools/owner.test.mjs'));
  const own = selectTests({
    ...files,
    changed: ['tools/other.test.mjs'],
    extra: ['tools/owner.test.mjs'],
  });
  assert.deepEqual([...own.keys()].sort(), ['tools/other.test.mjs', 'tools/owner.test.mjs']);
});

test('a test file is not a path to further tests', () => {
  const files = graph({
    'src/a.mjs': '',
    'tools/helper.test.mjs': "import { a } from '../src/a.mjs'; export const h = 1;",
    'tools/user.test.mjs': "import { h } from './helper.test.mjs';",
  });
  assert.deepEqual(
    [...selectTests({ ...files, changed: ['src/a.mjs'] }).keys()],
    ['tools/helper.test.mjs'],
  );
});

test('every slow tier entry names an existing test file and test', () => {
  for (const path of SLOW_FILES.keys()) assert.ok(existsSync(path), path);
  for (const [name, path] of SLOW_TESTS)
    assert.ok(readFileSync(path, 'utf8').includes(name), `${name} in ${path}`);
});

test('the sweep removes stale leftovers only and keeps live and counted entries', async (t) => {
  const root = await testTempDir(t, 'snes-clean-test-'),
    temp = join(root, 'temp'),
    mesen = join(root, 'mesen'),
    now = Date.now(),
    old = (now - STALE_MS - 1) / 1000;
  const entries = {
    'temp/snes-rom-abc123/run.smc': true,
    'temp/snes-release-abc123/summary.json': true,
    'temp/Importer_0_4 (12)/.keep': true,
    'temp/snes-block-abc123/batch.log': false,
    'temp/rb9-01.log': true,
    'temp/rb9-01.tests': true,
    'temp/snes-window-focused.log': true,
    'temp/other-tool.log': false,
    'temp/msedge_url_fetcher_999999999_1/x': true,
    [`temp/msedge_url_fetcher_${process.pid}_1/x`]: false,
    'temp/scoped_dir999999999_1/CRX_INSTALL/x': true,
    [`temp/scoped_dir${process.pid}_1/x`]: false,
    'mesen/Debugger/run-1-2-abc.cdl': true,
    'mesen/Debugger/Shadowrun.cdl': false,
  };
  for (const path of Object.keys(entries)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), 'x');
  }
  const top = (path) =>
    path
      .split('/')
      .slice(0, path.startsWith('mesen/') ? 3 : 2)
      .join('/');
  for (const path of new Set(Object.keys(entries).map(top)))
    await utimes(join(root, path), old, old);
  await mkdir(join(temp, 'snes-mesen-fresh1'));
  const result = await cleanTemp({ temp, mesenDir: mesen, now });
  for (const [path, removed] of Object.entries(entries))
    assert.equal(existsSync(join(root, top(path))), !removed, path);
  assert.ok(existsSync(join(temp, 'snes-mesen-fresh1')), 'a fresh folder stays');
  assert.equal(result.removed, Object.values(entries).filter(Boolean).length);
});

test('a Mesen run removes only the files named after its ROM copy', async (t) => {
  const dir = await testTempDir(t, 'snes-mesen-run-test-');
  const names = {
    'Debugger/run-1-2-abc.cdl': true,
    'SaveStates/run-1-2-abc_1.mss': true,
    'Saves/run-1-2-abc.srm': true,
    'Debugger/run-1-2-abcd.cdl': false,
    'Saves/Shadowrun.srm': false,
  };
  for (const path of Object.keys(names)) {
    await mkdir(join(dir, path, '..'), { recursive: true });
    await writeFile(join(dir, path), 'x');
  }
  removeRunFiles(dir, 'run-1-2-abc');
  for (const [path, removed] of Object.entries(names))
    assert.equal(existsSync(join(dir, path)), !removed, path);
});
