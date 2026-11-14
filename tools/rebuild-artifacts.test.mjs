import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {rebuildSequence, generatedFiles, retainedInputs} from './rebuild-artifacts.mjs';

const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
const catalogue = JSON.parse(readFileSync('docs/GENERATOR-INPUT-SOURCES.json', 'utf8'));

test('Rebuild runs outside producers before the release generators and ends with the final commands', () => {
  const sequence = rebuildSequence(scripts, catalogue), names = sequence.map(step => step.name);
  assert.equal(new Set(names).size, names.length);
  const firstRelease = names.findIndex(name => /^(analyze|extract|probe):(render|vm)-/.test(name));
  for (const group of catalogue.groups.filter(group => group.kind === 'generated-outside-graph'))
    assert.ok(names.indexOf(group.npm_command ?? group.command) < firstRelease, group.command);
  assert.ok(names.indexOf('extract:slot-action-data') < firstRelease);
  assert.deepEqual(names.slice(-2), ['plan:dialog', 'docs:progress']);
  assert.throws(() => rebuildSequence({...scripts, 'extract:slot-action-data': undefined}, catalogue), /Missing producer/);
  assert.throws(() => rebuildSequence({...scripts, 'extract:slot-action-data': 'node a.mjs && rm x'}, catalogue), /Unsupported command/);
});

test('Recorded and retained catalogue inputs are never deleted and stay versioned', () => {
  for (const group of catalogue.groups.filter(group => group.kind !== 'generated-outside-graph'))
    for (const path of group.outputs) assert.ok(retainedInputs.includes(path), path);
  const ignored = path => { try { execFileSync('git', ['check-ignore', '--no-index', '-q', path]); return true; } catch { return false; } };
  for (const path of retainedInputs) assert.equal(ignored(path), false, path);
  assert.equal(ignored('analysis/render-9178.json'), true);
  const root = mkdtempSync(join(tmpdir(), 'rebuild-')), files = ['analysis/render-x.json', 'analysis/rom-vram.json',
    'assets/vm-font.bmp', 'assets/nested/vm-x.json', 'assets/room-observations.json.gz'];
  try {
    for (const path of files) { mkdirSync(join(root, path, '..'), {recursive: true}); writeFileSync(join(root, path), ''); }
    assert.deepEqual(generatedFiles(root).sort(), ['analysis/render-x.json', 'assets/nested/vm-x.json', 'assets/vm-font.bmp']);
  } finally { rmSync(root, {recursive: true, force: true}); }
});
