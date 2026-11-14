// Rebuilds every generated artifact under analysis/ and assets/ from the ROM.
// Order: catalogued producers outside the release graph, the ROM-only extract
// commands, then the release generators in package.json order and the two
// final commands. Recorded and retained inputs are never deleted or written.
//   node tools/rebuild-artifacts.mjs            rebuild in this checkout
//   node tools/rebuild-artifacts.mjs --clean    delete generated files first
//   --root=<dir>                                operate on another checkout
import {spawnSync} from 'node:child_process';
import {readFileSync, readdirSync, rmSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {releaseGenerators} from './generator-dependencies.mjs';

// Inputs that need Mesen recordings or are retained; see GENERATOR-INPUT-SOURCES.json.
export const retainedInputs = ['analysis/mesen-coverage.json', 'analysis/rom-code-observed.json',
  'analysis/rom-palettes.json', 'analysis/rom-reads.json', 'analysis/rom-vram.json',
  'assets/boot-logo-observations.json', 'assets/room-observations.json.gz'];
export const generatedDirectories = ['analysis', 'assets'];
// ROM-only producers whose outputs no release generator reads.
const extraCommands = ['extract:slot-action-data', 'extract:slot-target-data', 'extract:motion-postpass-data'];

export function rebuildSequence(scripts, catalogue) {
  const outside = catalogue.groups.filter(group => group.kind === 'generated-outside-graph');
  const npm = new Set([...outside.map(group => group.npm_command).filter(Boolean), ...extraCommands]);
  for (const name of npm) if (!scripts[name]) throw Error('Missing producer script ' + name);
  const named = Object.keys(scripts).filter(name => npm.has(name)).map(name => ({name, command: scripts[name]}));
  const bare = [...new Set(outside.filter(group => !group.npm_command).map(group => group.command))]
    .map(command => ({name: command, command}));
  const release = releaseGenerators(scripts).map(([name, command]) => ({name, command}));
  for (const {command} of [...named, ...bare, ...release]) if (!/^node [^&|;<>]+$/.test(command)) throw Error('Unsupported command ' + command);
  return [...named, ...bare, ...release];
}

export function generatedFiles(root) {
  const keep = new Set(retainedInputs);
  return generatedDirectories.flatMap(dir => readdirSync(join(root, dir), {recursive: true, withFileTypes: true})
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath ?? entry.path, entry.name).slice(root.length + 1).replaceAll('\\', '/'))
    .filter(path => !keep.has(path)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(process.argv.find(arg => arg.startsWith('--root='))?.slice(7) ?? '.');
  const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts;
  const catalogue = JSON.parse(readFileSync(join(root, 'docs/GENERATOR-INPUT-SOURCES.json'), 'utf8'));
  const sequence = rebuildSequence(scripts, catalogue);
  if (process.argv.includes('--clean')) {
    const files = generatedFiles(root);
    for (const path of files) rmSync(join(root, path));
    console.log(`Deleted ${files.length} generated files.`);
  }
  const started = Date.now();
  for (const [n, {name, command}] of sequence.entries()) {
    const result = spawnSync(process.execPath, command.split(' ').slice(1), {cwd: root, encoding: 'utf8', maxBuffer: 1 << 28});
    if (result.status !== 0) {
      process.stderr.write(result.stdout + result.stderr);
      throw Error(`Rebuild failed at ${n + 1}/${sequence.length} ${name}`);
    }
  }
  console.log(`Rebuilt with ${sequence.length} commands in ${((Date.now() - started) / 1000).toFixed(1)} seconds.`);
}
