// Static copy of the game page for a private static host (docs/STATIC-HOSTING.md): copies
// exactly the files the local server serves (isServedPath in tools/serve-browser.mjs) into
// dist/ and adds a _headers file with the cross-origin isolation headers. The ROMs, the
// manuals and every other repository file stay out. Git LFS pointer files are refused, so a
// checkout without LFS content fails instead of deploying a broken game.
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ISOLATION_HEADERS, isServedPath } from './serve-browser.mjs';

const LFS_POINTER = 'version https://git-lfs.github.com/spec/';
// Top-level entries that can hold served files.
const SOURCES = ['index.html', 'src', 'assets'];

async function* files(path) {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => null);
  if (!entries) {
    yield path;
    return;
  }
  for (const entry of entries) yield* files(join(path, entry.name));
}

export async function buildWeb(root = process.cwd(), out = resolve(root, 'dist')) {
  await rm(out, { recursive: true, force: true });
  const copied = [];
  for (const source of SOURCES)
    for await (const file of files(resolve(root, source))) {
      const path = '/' + relative(root, file).split(sep).join('/');
      if (!isServedPath(path)) continue;
      const head = (await readFile(file)).subarray(0, LFS_POINTER.length).toString('latin1');
      if (head === LFS_POINTER)
        throw new Error(`${path} is a Git LFS pointer; run git lfs pull before building`);
      const target = join(out, path);
      await mkdir(dirname(target), { recursive: true });
      await cp(file, target);
      copied.push(path);
    }
  const headers = Object.entries(ISOLATION_HEADERS)
    .map(([name, value]) => `  ${name}: ${value}`)
    .join('\n');
  await writeFile(join(out, '_headers'), `/*\n${headers}\n`);
  return copied;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const copied = await buildWeb();
  console.log(`dist/: ${copied.length} files and _headers.`);
}
