import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, access} from 'node:fs/promises';
import {buildInventory, releaseGenerators, classifyProducerGaps} from './generator-dependencies.mjs';
import {scriptOpcodeOutputPlan, scriptOpcodeOutputDeclarations} from './script-opcode-outputs.mjs';

const generators = (...names) => names.map(name => [name, `node tools/${name}.mjs`]);
const record = (key, inputs, outputs) => [key, {key,
  inputs: Object.fromEntries(inputs.map(path => [path, 'input-hash'])),
  outputs: Object.fromEntries(outputs.map(path => [path, 'output-hash']))}];

test('Dependency groups put producers before consumers, regardless of recorded command order', () => {
  const entries = generators('consumer', 'producer');
  const records = new Map([
    record('consumer', ['analysis/source.json', 'assets/data.bin', 'tools/shared.mjs'], []),
    record('producer', ['tools/shared.mjs'], ['analysis/source.json', 'assets/data.bin']),
  ]), before = structuredClone({entries, records});
  const inventory = buildInventory(entries, records);
  assert.deepEqual(inventory.dependency_groups, [['producer'], ['consumer']]);
  assert.deepEqual(inventory.edges, [{producer: 'producer', consumer: 'consumer',
    files: ['analysis/source.json', 'assets/data.bin']}]);
  assert.equal(inventory.counts.backward_command_dependencies, 1);
  assert.equal(inventory.counts.backward_file_dependencies, 2);
  assert.deepEqual(inventory.shared_tools, [{path: 'tools/shared.mjs', commands: ['consumer', 'producer']}]);
  assert.deepEqual({entries, records}, before);
});

test('A dependency cycle remains one explicit group ahead of its downstream consumers', () => {
  const inventory = buildInventory(generators('leaf', 'a', 'b'), new Map([
    record('leaf', ['analysis/a.json'], []),
    record('a', ['analysis/b.json'], ['analysis/a.json']),
    record('b', ['analysis/a.json'], ['analysis/b.json']),
  ]));
  assert.deepEqual(inventory.cycles, [['a', 'b']]);
  assert.deepEqual(inventory.dependency_groups, [['a', 'b'], ['leaf']]);
  assert.equal(inventory.counts.cyclic_generators, 2);
});

test('Multiple writers are reported and every possible producer is retained', () => {
  const inventory = buildInventory(generators('first', 'second', 'consumer'), new Map([
    record('first', [], ['analysis/shared.json']),
    record('second', [], ['analysis/shared.json']),
    record('consumer', ['analysis/shared.json'], []),
  ]));
  assert.deepEqual(inventory.output_conflicts, [{path: 'analysis/shared.json', commands: ['first', 'second']}]);
  assert.deepEqual(inventory.edges.map(edge => edge.producer), ['first', 'second']);
});

test('Missing records and artifact inputs without a known producer remain visible', () => {
  const inventory = buildInventory(generators('missing', 'reader'), new Map([
    record('reader', ['analysis/unrecorded.json', 'src/source.mjs'], []),
  ]));
  assert.deepEqual(inventory.missing_records, ['missing']);
  assert.equal(inventory.counts.recorded, 1);
  assert.deepEqual(inventory.generators_without_recorded_outputs, ['reader']);
  assert.deepEqual(inventory.artifact_inputs_without_recorded_producer,
    [{path: 'analysis/unrecorded.json', commands: ['reader']}]);
});

test('An entry for a different command and duplicate generator names are rejected', () => {
  assert.throws(() => buildInventory(generators('a'), new Map([['a', record('b', [], [])[1]]])), /Invalid generator record/);
  assert.throws(() => buildInventory(generators('a'), new Map([['a', {key: 'a', inputs: [], outputs: {}}]])), /Invalid generator record/);
  assert.throws(() => buildInventory(generators('a', 'a'), new Map()), /Duplicate generator name/);
});

test('The inventory follows release generator selection and keeps planning commands last', () => {
  const selected = releaseGenerators({'start': 'node tools/server.mjs', 'analyze:render-a': 'node tools/a.mjs',
    'docs:progress': 'node tools/progress.mjs', 'analyze:vm-coverage': 'node tools/coverage.mjs',
    'plan:dialog': 'node tools/dialog.mjs', 'decode:scripts': 'node tools/scripts.mjs'});
  assert.deepEqual(selected.map(([name]) => name), ['analyze:render-a', 'analyze:vm-coverage', 'plan:dialog', 'docs:progress']);
  assert.throws(() => releaseGenerators({}), /No render generators/);
  assert.throws(() => releaseGenerators({'analyze:render-a': 'node tools/a.mjs'}), /Missing generator/);
});

test('Intended ownership explains skipped writes without changing observations or cache records', () => {
  const entries = generators('source', 'native', 'reader');
  const records = new Map([
    record('source', ['analysis/source.json'], []),
    record('native', ['analysis/source.json', 'analysis/native.json'], []),
    record('reader', ['analysis/native.json', 'analysis/unknown.json'], ['analysis/source.json']),
  ]);
  const before = structuredClone(records);
  const declarations = [
    {name: 'source', command: entries[0][1], definition: 'tools/outputs.mjs', outputs: ['analysis/source.json']},
    {name: 'native', command: entries[1][1], definition: 'tools/outputs.mjs', outputs: ['analysis/native.json']},
  ];
  const observed = buildInventory(entries, records);
  const inventory = buildInventory(entries, records, declarations);
  for (const key of ['counts', 'edges', 'cycles', 'dependency_groups', 'artifact_inputs_without_recorded_producer']) {
    assert.deepEqual(inventory[key], observed[key]);
  }
  assert.deepEqual(inventory.intended_ownership.counts, {commands: 2, outputs: 2,
    outputs_with_owner_write: 0, outputs_without_owner_write: 2, outputs_with_other_writers: 1,
    covered_recorded_producer_gaps: 1, remaining_recorded_producer_gaps: 1});
  assert.deepEqual(inventory.intended_ownership.outputs, [
    {path: 'analysis/native.json', command: 'native', recorded_writers: [], consumers: ['native', 'reader']},
    {path: 'analysis/source.json', command: 'source', recorded_writers: ['reader'], consumers: ['source', 'native']},
  ]);
  assert.deepEqual(records, before);
  assert.equal(buildInventory(entries, new Map(), declarations).intended_ownership.counts.outputs_without_owner_write, 2);
});

test('Output declarations reject changed commands, unknown owners and duplicate paths', () => {
  const entries = generators('source');
  const declaration = {name: 'source', command: entries[0][1], definition: 'tools/outputs.mjs', outputs: ['analysis/source.json']};
  for (const patch of [{command: 'node tools/other.mjs'}, {name: 'absent'}]) {
    assert.throws(() => buildInventory(entries, new Map(), [{...declaration, ...patch}]), /command mismatch/);
  }
  for (const outputs of [['analysis/source.json', 'analysis/source.json'], ['analysis/../outside.json']]) {
    assert.throws(() => buildInventory(entries, new Map(), [{...declaration, outputs}]), /Invalid or duplicate/);
  }
});

test('Script52 definitions cover every retained report, including the generic and continuation contracts', async () => {
  const specs = JSON.parse(await readFile(new URL('./script-opcode-specs.json', import.meta.url), 'utf8'));
  const {scripts} = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const declarations = scriptOpcodeOutputDeclarations(specs);
  const actual = (await readdir(new URL('../analysis/', import.meta.url)))
    .filter(path => /^render-task-script-(?:opcode(?:-[0-9a-f]{3})?|continuation)(?:-native)?\.json$/.test(path))
    .map(path => 'analysis/' + path).sort();
  const declared = declarations.flatMap(declaration => declaration.outputs);
  assert.equal(declared.length, 1878);
  assert.equal(new Set(declared).size, declared.length);
  assert.deepEqual(declared.sort(), actual);
  for (const declaration of declarations) assert.equal(declaration.command, scripts[declaration.name]);
  const plan = scriptOpcodeOutputPlan(specs);
  assert.equal(plan.blocks[0].spec, null);
  assert.deepEqual(plan.blocks.slice(1).map(block => block.spec), specs);
  assert.ok(declarations[0].outputs.every(path => !path.endsWith('-native.json')));
  assert.ok(declarations[1].outputs.every(path => path.endsWith('-native.json')));
  for (const invalid of [[{id: 1}, {id: 1}], [{id: -1}], [{id: 0.5}]]) {
    assert.throws(() => scriptOpcodeOutputPlan(invalid), /Invalid or duplicate Script52 ID/);
  }
});

test('Source classifications preserve the observed graph and leave new gaps explicitly unknown', () => {
  const inventory = buildInventory(generators('reader'), new Map([
    record('reader', ['analysis/generated.json', 'analysis/recorded.json', 'analysis/retained.json', 'analysis/new.json'], []),
  ]));
  const groups = [
    {kind: 'generated-outside-graph', tool: 'tools/legacy.mjs', command: 'node tools/legacy.mjs',
      npm_command: 'analyze:legacy', outputs: ['analysis/generated.json'], evidence: ['writeFile']},
    {kind: 'recording-dependent', tool: 'tools/recording.mjs', command: 'node tools/recording.mjs',
      npm_command: null, outputs: ['analysis/recorded.json'], evidence: ['writeFile']},
    {kind: 'retained-input', tool: null, command: null, npm_command: null,
      outputs: ['analysis/retained.json'], evidence_file: 'analysis/retained.json', evidence: ['scope']},
  ];
  const before = structuredClone(inventory), catalogue = {schema_version: 1, groups};
  const scripts = {'analyze:legacy': groups[0].command};
  const classified = classifyProducerGaps(inventory, catalogue, scripts);
  assert.deepEqual(classified.counts, {inputs: 4, 'generated-outside-graph': 1,
    'recording-dependent': 1, 'retained-input': 1, unclassified: 1});
  assert.equal(classified.inputs.find(input => input.path === 'analysis/new.json').source, null);
  assert.deepEqual(inventory, before);
  inventory.intended_ownership.outputs.push({path: 'analysis/generated.json'});
  const declared = classifyProducerGaps(inventory, catalogue, scripts);
  assert.equal(declared.counts.inputs, 3);
  assert.deepEqual(declared.catalogued_inputs_outside_current_gaps, ['analysis/generated.json']);
  for (const patch of [{command: 'node tools/wrong.mjs'}, {npm_command: 'missing'}]) {
    assert.throws(() => classifyProducerGaps(inventory, {...catalogue, groups: [{...groups[0], ...patch}]}, scripts), /command mismatch/);
  }
  assert.throws(() => classifyProducerGaps(inventory, {...catalogue, groups: [groups[0], groups[0]]}, scripts), /duplicate input source/);
  assert.throws(() => classifyProducerGaps(inventory, {...catalogue, groups: [{...groups[2], tool: 'tools/false-writer.mjs'}]}, scripts), /cannot claim a producer/);
});

test('The source catalogue classifies 58 retained inputs with existing paths, command bindings and source evidence', async () => {
  const catalogue = JSON.parse(await readFile(new URL('../docs/GENERATOR-INPUT-SOURCES.json', import.meta.url), 'utf8'));
  const {scripts} = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const paths = catalogue.groups.flatMap(group => group.outputs);
  const inventory = buildInventory(releaseGenerators(scripts), new Map());
  inventory.artifact_inputs_without_recorded_producer = paths.map(path => ({path, commands: ['example-consumer']}));
  const classified = classifyProducerGaps(inventory, catalogue, scripts);
  assert.deepEqual(classified.counts, {inputs: 58, 'generated-outside-graph': 54,
    'recording-dependent': 3, 'retained-input': 1, unclassified: 0});
  assert.deepEqual(classified.catalogued_inputs_outside_current_gaps, []);
  for (const group of catalogue.groups) {
    const source = await readFile(new URL('../' + (group.evidence_file ?? group.tool), import.meta.url), 'utf8');
    for (const token of group.evidence) assert.ok(source.includes(token), 'Source evidence drift: ' + token);
    for (const path of group.outputs) await access(new URL('../' + path, import.meta.url));
    if (group.kind !== 'retained-input') assert.match(source, /writeFile(?:Sync)?\(/);
  }
  const retained = classified.inputs.filter(input => input.source.kind === 'retained-input');
  assert.deepEqual(retained.map(input => input.path), ['analysis/rom-palettes.json']);
});
