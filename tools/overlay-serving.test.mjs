import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { browserServer, isServedPath } from './serve-browser.mjs';
import { buildWeb } from './build-web.mjs';
import { testTempDir } from './temp-dir.mjs';

const STYLESHEET = '/src/browser/overlays.css';

test('the shared overlay stylesheet is served as CSS and included unchanged in static builds', async (t) => {
  assert.equal(isServedPath(STYLESHEET), true);
  for (const path of [
    '/src/browser/other.css',
    '/tools/overlays.css',
    '/src/browser/../overlays.css',
  ])
    assert.equal(isServedPath(path), false, path);
  const css = await readFile('.' + STYLESHEET, 'utf8'),
    page = await readFile('index.html', 'utf8'),
    server = browserServer();
  assert.ok(page.includes(`href=".${STYLESHEET}"`));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${STYLESHEET}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'text/css; charset=utf-8');
    assert.equal(await response.text(), css);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  const root = await testTempDir(t, 'snes-overlay-build-'),
    out = join(root, 'dist');
  await mkdir(join(root, 'src/browser'), { recursive: true });
  await writeFile(join(root, 'index.html'), page);
  await writeFile(join(root, 'src/browser/overlays.css'), css);
  await writeFile(join(root, 'src/browser/other.css'), 'not shipped');
  const copied = await buildWeb(root, out);
  assert.deepEqual(copied.sort(), ['/index.html', STYLESHEET]);
  assert.equal(await readFile(join(out, STYLESHEET), 'utf8'), css);
});
