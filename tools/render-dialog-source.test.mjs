import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {cpuToOffset} from './rom.mjs';
import {proveRender9F6DSource, proveRender8F20Source, proveRender9022Source,
  proveRender905ESource, proveRender8F3ASource, proveRenderFF79Source,
  proveRenderEF47Source, proveRenderFA92Source, describeRenderDialogBlock} from './render-dialog-source.mjs';
import {proveRenderMenuSource, proveRenderSelectionSource, proveRenderText9178Source,
  describeRenderMenuWindow} from './render-menu-source.mjs';
import {proveRender9178TaskSources} from './render-9178-task-source.mjs';

const names = ['bf3b', '9f6d', '8f20', '9022', '905e', '8f3a', 'ff79', 'ef47', 'fa92', 'a6a5', 'selection', '9178'];
// C34A and C1CA reports are denied too: 9178 now recomputes both from the ROM.
const sources = [...names, 'c34a', 'c1ca'].map(name => `analysis/render-${name}.json`);
let invocation = 0;

async function analyzerFixture(t, name, wrongRom = false, denied = sources) {
  const readFile = fs.promises.readFile, writes = [], overrides = new Map();
  const paths = [`analysis/render-${name}.json`, `analysis/render-${name}.asm.txt`];
  const originals = new Map(await Promise.all(paths.map(async path => [path, await readFile(path)])));
  const rom = await readFile('Shadowrun (E).smc');
  if (wrongRom) rom[cpuToOffset(0x809F6D, rom.length)] ^= 1;
  t.mock.method(fs.promises, 'readFile', async (path, ...args) => {
    assert.ok(!denied.includes(path), 'Cyclic source report read: ' + path);
    if (path === 'Shadowrun (E).smc') return rom;
    if (overrides.has(path)) return overrides.get(path);
    return readFile(path, ...args);
  });
  t.mock.method(fs.promises, 'writeFile', async (path, data) => {
    assert.ok(paths.includes(path), 'Unexpected output: ' + path);
    writes.push({path, bytes: Buffer.from(data)});
  });
  t.mock.method(console, 'log', () => {});
  syncBuiltinESMExports();
  t.after(() => {t.mock.restoreAll(); syncBuiltinESMExports();});
  return {writes, paths, originals, overrides,
    run: () => import(new URL(`./analyze-render-${name}.mjs?dialog-test=${invocation++}`, import.meta.url))};
}

for (const name of names) {
  test(`${name}: emits identical JSON and assembly without reading any of the fourteen former cycle reports`, async t => {
    const fixture = await analyzerFixture(t, name);
    await fixture.run();
    assert.deepEqual(fixture.writes.map(write => write.path), fixture.paths);
    for (const write of fixture.writes) assert.deepEqual(write.bytes, fixture.originals.get(write.path));
  });

  test(`${name}: a changed ROM fails before any report write`, async t => {
    const fixture = await analyzerFixture(t, name, true);
    await assert.rejects(fixture.run, /Wrong European ROM revision/);
    assert.deepEqual(fixture.writes, []);
  });
}

// The audio analyzer may still read its own report's consumers, but never the A6A5 report.
const audioDenied = ['analysis/render-a6a5.json'];
test('audio: emits identical JSON and assembly without reading the A6A5 report', async t => {
  const fixture = await analyzerFixture(t, 'audio', false, audioDenied);
  await fixture.run();
  assert.deepEqual(fixture.writes.map(write => write.path), fixture.paths);
  for (const write of fixture.writes) assert.deepEqual(write.bytes, fixture.originals.get(write.path));
});

test('audio: a changed ROM fails before any report write', async t => {
  const fixture = await analyzerFixture(t, 'audio', true, audioDenied);
  await assert.rejects(fixture.run, /Wrong European ROM revision/);
  assert.deepEqual(fixture.writes, []);
});

test('Shared C46E menu window matches the retained A6A5 and audio descriptors', async () => {
  const rom = await fs.promises.readFile('Shadowrun (E).smc');
  const window = describeRenderMenuWindow(rom, 'selectedAudioC46E');
  const menuReport = JSON.parse(await fs.promises.readFile('analysis/render-a6a5.json', 'utf8'));
  const audioReport = JSON.parse(await fs.promises.readFile('analysis/render-audio.json', 'utf8'));
  assert.deepEqual(window, menuReport.windows.find(w => w.name === 'selectedAudioC46E'));
  assert.deepEqual({...window, name: 'audioC46E'}, audioReport.windows.find(w => w.name === 'audioC46E'));
  assert.throws(() => describeRenderMenuWindow(rom, 'audioC46E'), /Unknown menu source window/);
  const changed = Buffer.from(rom); changed[cpuToOffset(0x80C46E, changed.length)] ^= 1;
  assert.throws(() => describeRenderMenuWindow(changed, 'selectedAudioC46E'), /Wrong European ROM revision/);
});

test('Direct source contracts preserve complete proofs and fresh results without importing reports', async () => {
  const rom = await fs.promises.readFile('Shadowrun (E).smc');
  const contracts = [['9f6d', proveRender9F6DSource], ['8f20', proveRender8F20Source],
    ['9022', proveRender9022Source], ['905e', proveRender905ESource], ['8f3a', proveRender8F3ASource],
    ['ff79', proveRenderFF79Source], ['ef47', proveRenderEF47Source], ['fa92', proveRenderFA92Source]];
  for (const [name, prove] of contracts) {
    const report = JSON.parse(await fs.promises.readFile(`analysis/render-${name}.json`, 'utf8'));
    const source = prove(rom);
    assert.deepEqual(source.windows, report.windows);
    assert.deepEqual(source.proof, report.full_graph.proof);
    assert.equal(source.full_graph.code_bytes, report.full_graph.code_bytes);
    assert.equal(source.full_graph.instructions, report.full_graph.instructions);
    if (name === '9f6d') assert.deepEqual(source.table, report.table);
    if (source.helperProof) assert.deepEqual(source.helperProof, report.helper_graph.proof);
    if (source.incrementProof) assert.deepEqual(source.incrementProof, report.increment_graph.proof);
    if (source.proofs) assert.deepEqual(source.proofs.slice(1), report.full_graph.helper_proofs);
    if (source.reused) assert.deepEqual(source.reused.map(describeRenderDialogBlock), report.dependencies.flatMap(d => d.windows));
    if (source.ownerBlocks) assert.deepEqual(source.ownerBlocks.map(describeRenderDialogBlock), report.selected_owners.windows);
    if (source.owners) assert.deepEqual(source.owners.map(describeRenderDialogBlock), report.selected_owners.windows);
    const callers = source.callers ?? [source.caller];
    const retainedCallers = name === 'ef47' ? report.windows.slice(source.roots.length)
      : ['ff79', 'fa92'].includes(name) ? report.windows.slice(1)
        : report.callers?.windows ?? report.callers ?? [report.caller.window];
    assert.deepEqual(callers.map(describeRenderDialogBlock), retainedCallers);
    if (name === '8f3a') assert.equal(source.raw.toString('hex').toUpperCase(), report.tables[0].machine_bytes);
    source.map.clear(); source.proof.returns.length = 0; source.root.initialState.m = 1;
    const fresh = prove(rom);
    assert.deepEqual(fresh.proof, report.full_graph.proof);
    assert.equal(fresh.map.size, report.full_graph.instructions);
    assert.deepEqual(fresh.root.initialState, {e: 0, m: 0, x: 0});
  }
  for (const at of [0x808F20, 0x809F6D, 0x809E65, 0x80A033, 0x80943F, 0x80936C,
    0x809022, 0x808FF5, 0x80905E, 0x81A954, 0x808F3A, 0x808EFE, 0x81B0A1, 0x808F87,
    0x80FF79, 0x80FA3E, 0x81AD92, 0x81EF47, 0x81F25A, 0x81F1FA, 0x81F007, 0x80FA92]) {
    const changed = Buffer.from(rom); changed[cpuToOffset(at, changed.length)] ^= 1;
    for (const [, prove] of contracts) {
      assert.throws(() => prove(changed), /Wrong European ROM revision/);
    }
  }
});

for (const [name, path, change, pattern] of [
  ['ff79', 'analysis/render-be6d.json', r => {r.dependencies.flatMap(d => d.windows).find(w => w.name === 'renderAD92').machine_bytes = '';}, /FF79 dependency drift/],
  ['ef47', 'analysis/render-audio.json', r => {r.windows.find(w => w.name === 'samplesF130').sha256 = 'changed';}, /EF47 audio dependency drift/],
  ['fa92', 'analysis/render-be6d.json', r => {r.windows.find(w => w.name === 'allocateF963').machine_bytes = '';}, /Selected source fragment drift/],
  ['a6a5', 'analysis/render-be6d.json', r => {r.windows.find(w => w.name === 'textFE69').machine_bytes = '';}, /Dependency ownership drift/],
  ['selection', 'analysis/render-ad92.json', r => {r.windows.find(w => w.name === 'renderAD92').machine_bytes = '';}, /Dependency ownership drift/],
  ['audio', 'analysis/render-9e1a.json', r => {r.windows.find(w => w.name === 'apuF007').sha256 = 'changed';}, /Reused audio source drift/],
]) {
  test(`${name}: retained external report checks reject drift before writes`, async t => {
    const fixture = await analyzerFixture(t, name, false, name === 'audio' ? audioDenied : sources);
    const report = JSON.parse(await fs.promises.readFile(path, 'utf8'));
    change(report); fixture.overrides.set(path, JSON.stringify(report));
    await assert.rejects(fixture.run, pattern);
    assert.deepEqual(fixture.writes, []);
  });
}

test('Conditional menu, selection and partial text contracts retain proofs and explicit frontiers', async () => {
  const rom = await fs.promises.readFile('Shadowrun (E).smc');
  const menuReport = JSON.parse(await fs.promises.readFile('analysis/render-a6a5.json', 'utf8'));
  const selectionReport = JSON.parse(await fs.promises.readFile('analysis/render-selection.json', 'utf8'));
  const textReport = JSON.parse(await fs.promises.readFile('analysis/render-9178.json', 'utf8'));
  const menu = proveRenderMenuSource(rom), selection = proveRenderSelectionSource(rom), text = proveRenderText9178Source(rom);
  assert.deepEqual(menu.windows, menuReport.windows);
  assert.deepEqual(menu.proofs, menuReport.helper_graph.proofs);
  assert.deepEqual(menu.menuProofs, menuReport.conditional_menu_graph.proofs);
  assert.deepEqual(menu.originalMenuProofs, menuReport.conditional_menu_graph.original_sound_proofs);
  assert.deepEqual(menu.dependencies, menuReport.dependencies);
  assert.deepEqual(menu.menuDependencies, menuReport.menu_dependencies);
  assert.equal(menu.menu.full_graph_closed, false);
  assert.equal(menu.menu.minimum_protected_stack_bytes, null);
  assert.equal(menu.conditional_menu_graph.full_reset_graph_closed, false);
  assert.deepEqual(selection.windows, selectionReport.windows);
  assert.deepEqual(selection.dependencies, selectionReport.dependencies);
  assert.deepEqual(selection.proofs, selectionReport.conditional_graph.proofs);
  assert.deepEqual(selection.originalProofs, selectionReport.conditional_graph.original_sound_proofs);
  assert.equal(selection.conditional_graph.full_reset_graph_closed, false);
  assert.equal(selection.conditional_graph.actual_termination_proven, false);
  assert.deepEqual(describeRenderDialogBlock(selection.caller), selectionReport.caller);
  assert.deepEqual(text.windows, textReport.windows);
  assert.deepEqual(text.dependencies, textReport.dependencies);
  assert.deepEqual(text.proof, textReport.render_graph.proof);
  assert.deepEqual(text.helperProof, textReport.helper_graph.proof);
  assert.deepEqual(text.excerpts.map(describeRenderDialogBlock), textReport.excerpts);
  assert.equal(text.full_graph.closed, false);
  assert.equal(text.full_graph.native_binding, false);
  assert.equal(text.full_graph.minimum_protected_stack_bytes, null);
  assert.deepEqual(text.full_graph.unresolved_nested_callees, ['80:C1CA']);
  for (const [prove, source, expected] of [
    [proveRenderMenuSource, menu, menuReport.conditional_menu_graph.proofs[0]],
    [proveRenderSelectionSource, selection, selectionReport.conditional_graph.proofs[0]],
    [proveRenderText9178Source, text, textReport.render_graph.proof],
  ]) {
    const proof = source.menuProofs?.[0] ?? source.proofs?.[0] ?? source.proof;
    proof.returns.length = 0;
    const fresh = prove(rom);
    assert.deepEqual(fresh.menuProofs?.[0] ?? fresh.proofs?.[0] ?? fresh.proof, expected);
    const changed = Buffer.from(rom); changed[cpuToOffset(0x8091C8, changed.length)] ^= 1;
    assert.throws(() => prove(changed), /Wrong European ROM revision/);
  }
});

test('Direct C34A and C1CA sources match the retained reports and keep the C1CA frontier open', async () => {
  const rom = await fs.promises.readFile('Shadowrun (E).smc');
  const appendReport = JSON.parse(await fs.promises.readFile('analysis/render-c34a.json', 'utf8'));
  const visitReport = JSON.parse(await fs.promises.readFile('analysis/render-c1ca.json', 'utf8'));
  const textReport = JSON.parse(await fs.promises.readFile('analysis/render-9178.json', 'utf8'));
  const {append, visit} = proveRender9178TaskSources(rom);
  assert.deepEqual(append.proof, appendReport.full_graph.proof);
  assert.equal(append.map.size, appendReport.full_graph.instructions);
  assert.equal(append.closed, appendReport.full_graph.closed);
  assert.deepEqual(visit.frontier, visitReport.full_graph.frontier);
  assert.equal(visit.map.size, visitReport.local_source.instructions);
  assert.equal(visit.closed, false); assert.equal(visitReport.full_graph.closed, false);
  assert.equal(visit.minimum_protected_stack_bytes, null); assert.equal(visit.native_binding, false);
  const [c34a] = textReport.full_graph.supplied_source_nested_callees;
  const [c1ca] = textReport.full_graph.supplied_partial_nested_callees;
  assert.equal(c34a.minimum_protected_stack_bytes, append.proof.minimum_protected_stack_bytes);
  assert.equal(c1ca.minimum_protected_prefix_stack_bytes, visit.frontier.minimum_protected_prefix_stack_bytes);
  append.proof.returns.length = 0; visit.map.clear();
  const fresh = proveRender9178TaskSources(rom);
  assert.deepEqual(fresh.append.proof, appendReport.full_graph.proof);
  assert.deepEqual(fresh.visit.frontier, visitReport.full_graph.frontier);
  for (const at of [0x80C34A, 0x80C2C8, 0x80C242, 0x80C1CA, 0x80F378, 0x80F4CB]) {
    const changed = Buffer.from(rom); changed[cpuToOffset(at, changed.length)] ^= 1;
    assert.throws(() => proveRender9178TaskSources(changed), /Wrong European ROM revision/);
  }
});

test('Shared field and transfer proofs preserve wait frontiers and decoder policies', async () => {
  const rom = await fs.promises.readFile('Shadowrun (E).smc');
  const fields = proveRender9022Source(rom), further = proveRender905ESource(rom), transfer = proveRender8F3ASource(rom);
  assert.deepEqual(describeRenderDialogBlock(fields.helper), describeRenderDialogBlock(further.helper));
  assert.equal(fields.proof.minimum_protected_stack_bytes, 4);
  assert.equal(further.proof.minimum_protected_stack_bytes, 5);
  assert.equal(transfer.proof.minimum_protected_stack_bytes, 6);
  for (const source of [fields, further]) {
    assert.equal(source.map.get(0x809003).state.m, 1);
    assert.equal(source.map.get(0x809017).state.m, 1);
    assert.equal(source.map.get(0x809019).state.m, 0);
    assert.equal(source.map.get(0x80901C).state.m, 0);
    assert.equal(source.map.get(0x80901F).mnemonic, 'BPL');
    assert.equal(source.map.get(0x80901F).target, 0x80901C);
  }
  assert.equal(transfer.map.get(0x808F1E).mnemonic, 'PLP');
  assert.equal(transfer.map.get(0x808F1F).state.m, 0);
  assert.equal(transfer.map.get(0x81B0A5).mnemonic, 'CMP');
  assert.equal(transfer.map.get(0x81B0A9).mnemonic, 'BEQ');
  assert.equal(transfer.map.get(0x81B0A9).target, 0x81B0A5);
  assert.equal(transfer.map.get(0x81B0AB).mnemonic, 'RTL');
  for (const name of ['9022', '905e', '8f3a']) {
    const report = JSON.parse(await fs.promises.readFile(`analysis/render-${name}.json`, 'utf8'));
    assert.equal(report.full_graph.actual_termination_proven, false);
  }
});
