// Inventory recorded generator dependencies without running generators.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {cacheKey, createReleaseCache} from './release-cache.mjs';
import {scriptOpcodeOutputDeclarations} from './script-opcode-outputs.mjs';

export function releaseGenerators(scripts) {
  const generators = Object.entries(scripts).filter(([name]) => /^(analyze|extract|probe):(render|vm)-/.test(name));
  if (!generators.length) throw Error('No render generators configured');
  for (const name of ['plan:dialog', 'docs:progress']) {
    if (!scripts[name]) throw Error('Missing generator: ' + name);
    generators.push([name, scripts[name]]);
  }
  return generators;
}

function componentsOf(names, graph) {
  let next = 0;
  const index = new Map(), low = new Map(), stack = [], active = new Set(), components = [];
  function visit(name) {
    index.set(name, next); low.set(name, next++);
    stack.push(name); active.add(name);
    for (const target of graph.get(name)) {
      if (!index.has(target)) {
        visit(target); low.set(name, Math.min(low.get(name), low.get(target)));
      } else if (active.has(target)) low.set(name, Math.min(low.get(name), index.get(target)));
    }
    if (low.get(name) === index.get(name)) {
      const component = [];
      let target;
      do { target = stack.pop(); active.delete(target); component.push(target); } while (target !== name);
      components.push(component);
    }
  }
  for (const name of names) if (!index.has(name)) visit(name);
  return components;
}

export function buildInventory(generators, records, declarations = []) {
  const names = generators.map(([name]) => name), order = new Map(names.map((name, i) => [name, i]));
  if (order.size !== names.length) throw Error('Duplicate generator name');
  const owners = new Map(), shared = new Map(), unowned = new Map(), pairs = new Map();
  const missing = names.filter(name => !records.has(name));
  for (const name of names) {
    const record = records.get(name);
    if (!record) continue;
    if (record.key !== name || ![record.inputs, record.outputs].every(value => value
      && typeof value === 'object' && !Array.isArray(value))) throw Error('Invalid generator record: ' + name);
    for (const path of Object.keys(record.outputs)) {
      if (!owners.has(path)) owners.set(path, []);
      owners.get(path).push(name);
    }
  }
  for (const consumer of names) for (const path of Object.keys(records.get(consumer)?.inputs ?? {})) {
    if (path.startsWith('tools/') && path.endsWith('.mjs')) {
      if (!shared.has(path)) shared.set(path, []);
      shared.get(path).push(consumer);
    }
    if (!owners.has(path) && /^(analysis|assets)\//.test(path)) {
      if (!unowned.has(path)) unowned.set(path, []);
      unowned.get(path).push(consumer);
    }
    for (const producer of owners.get(path) ?? []) {
      if (producer === consumer) continue;
      const key = producer + '\0' + consumer;
      if (!pairs.has(key)) pairs.set(key, {producer, consumer, files: []});
      pairs.get(key).files.push(path);
    }
  }
  const edges = [...pairs.values()].sort((a, b) => order.get(a.producer) - order.get(b.producer)
    || order.get(a.consumer) - order.get(b.consumer));
  for (const edge of edges) edge.files.sort();
  const graph = new Map(names.map(name => [name, new Set()]));
  for (const edge of edges) graph.get(edge.producer).add(edge.consumer);
  const components = componentsOf(names, graph);
  for (const group of components) group.sort((a, b) => order.get(a) - order.get(b));
  const groupOf = new Map(components.flatMap((group, i) => group.map(name => [name, i])));
  const children = components.map(() => new Set()), incoming = components.map(() => 0);
  for (const {producer, consumer} of edges) {
    const from = groupOf.get(producer), to = groupOf.get(consumer);
    if (from !== to && !children[from].has(to)) { children[from].add(to); incoming[to]++; }
  }
  const pending = components.map((_, i) => i).filter(i => incoming[i] === 0), groups = [];
  while (pending.length) {
    pending.sort((a, b) => order.get(components[a][0]) - order.get(components[b][0]));
    const group = pending.shift();
    groups.push(components[group]);
    for (const child of children[group]) if (--incoming[child] === 0) pending.push(child);
  }
  const cycles = groups.filter(group => group.length > 1);
  const backwards = edges.filter(edge => order.get(edge.producer) > order.get(edge.consumer));
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const withoutOutputs = names.filter(name => records.has(name) && !Object.keys(records.get(name).outputs).length);
  const byPath = entries => [...entries].sort(([a], [b]) => compare(a, b))
    .map(([path, commands]) => ({path, commands}));
  // Keep declarations separate: a planned output is not an observed write,
  // and must not become a cache output or silently alter the observed graph.
  const declared = new Map(), commands = new Map(generators);
  for (const declaration of declarations) {
    if (!commands.has(declaration.name) || commands.get(declaration.name) !== declaration.command) {
      throw Error('Output declaration command mismatch: ' + declaration.name);
    }
    if (!Array.isArray(declaration.outputs) || !declaration.definition) throw Error('Invalid output declaration');
    for (const path of declaration.outputs) {
      if (typeof path !== 'string' || !/^(analysis|assets)\/[\w./-]+$/.test(path)
        || path.split('/').includes('..') || declared.has(path)) throw Error('Invalid or duplicate declared output: ' + path);
      declared.set(path, declaration.name);
    }
  }
  const intendedOutputs = [...declared].sort(([a], [b]) => compare(a, b)).map(([path, command]) => ({
    path, command, recorded_writers: owners.get(path) ?? [],
    consumers: names.filter(name => Object.hasOwn(records.get(name)?.inputs ?? {}, path)),
  }));
  const coveredGaps = [...unowned.keys()].filter(path => declared.has(path)).length;
  return {
    schema_version: 2,
    counts: {
      generators: names.length, recorded: names.length - missing.length, missing: missing.length,
      outputs: owners.size, command_dependencies: edges.length,
      file_dependencies: edges.reduce((sum, edge) => sum + edge.files.length, 0),
      backward_command_dependencies: backwards.length,
      backward_file_dependencies: backwards.reduce((sum, edge) => sum + edge.files.length, 0),
      cycle_groups: cycles.length, cyclic_generators: cycles.flat().length,
      multiple_writer_outputs: [...owners.values()].filter(commands => commands.length > 1).length,
      generators_without_recorded_outputs: withoutOutputs.length,
      artifact_inputs_without_recorded_producer: unowned.size,
    },
    generators: generators.map(([name, command]) => ({name, command})),
    missing_records: missing,
    generators_without_recorded_outputs: withoutOutputs,
    output_conflicts: byPath([...owners].filter(([, commands]) => commands.length > 1)),
    cycles, dependency_groups: groups, edges,
    artifact_inputs_without_recorded_producer: byPath(unowned),
    shared_tools: byPath(shared).sort((a, b) => b.commands.length - a.commands.length || compare(a.path, b.path)),
    intended_ownership: {
      counts: {
        commands: declarations.length, outputs: declared.size,
        outputs_with_owner_write: intendedOutputs.filter(output => output.recorded_writers.includes(output.command)).length,
        outputs_without_owner_write: intendedOutputs.filter(output => !output.recorded_writers.includes(output.command)).length,
        outputs_with_other_writers: intendedOutputs.filter(output => output.recorded_writers.some(name => name !== output.command)).length,
        covered_recorded_producer_gaps: coveredGaps,
        remaining_recorded_producer_gaps: unowned.size - coveredGaps,
      },
      definitions: declarations, outputs: intendedOutputs,
    },
  };
}

export function classifyProducerGaps(inventory, catalogue, scripts) {
  if (catalogue.schema_version !== 1 || !Array.isArray(catalogue.groups)) throw Error('Invalid input source catalogue');
  const known = new Map(), selected = new Set(inventory.generators.map(generator => generator.name));
  const kinds = ['generated-outside-graph', 'recording-dependent', 'retained-input'];
  for (const group of catalogue.groups) {
    if (!kinds.includes(group.kind) || !Array.isArray(group.outputs) || !group.outputs.length
      || !Array.isArray(group.evidence) || !group.evidence.length) throw Error('Invalid input source group');
    if (group.kind === 'retained-input') {
      if (group.tool || group.command || group.npm_command || !group.evidence_file) throw Error('Retained input cannot claim a producer');
    } else if (!group.tool || group.command !== 'node ' + group.tool
      || (group.npm_command && (scripts[group.npm_command] !== group.command || selected.has(group.npm_command)))) {
      throw Error('Input source command mismatch: ' + group.tool);
    }
    for (const path of group.outputs) {
      if (!/^(analysis|assets)\/[\w.-]+$/.test(path) || known.has(path)) throw Error('Invalid or duplicate input source: ' + path);
      known.set(path, group);
    }
  }
  const declared = new Set(inventory.intended_ownership.outputs.map(output => output.path));
  const gaps = inventory.artifact_inputs_without_recorded_producer.filter(input => !declared.has(input.path));
  const inputs = gaps.map(({path, commands}) => ({path, consumers: commands, source: known.get(path) ?? null}));
  const gapPaths = new Set(gaps.map(input => input.path));
  return {
    catalogue: 'docs/GENERATOR-INPUT-SOURCES.json',
    counts: {inputs: inputs.length,
      ...Object.fromEntries(kinds.map(kind => [kind, inputs.filter(input => input.source?.kind === kind).length])),
      unclassified: inputs.filter(input => !input.source).length},
    inputs,
    catalogued_inputs_outside_current_gaps: [...known.keys()].filter(path => !gapPaths.has(path)).sort(),
  };
}

export async function readInventory(root) {
  const {scripts} = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const generators = releaseGenerators(scripts), keys = generators.map(([name]) => cacheKey(name));
  if (new Set(keys).size !== keys.length) throw Error('Generator cache keys collide');
  const records = new Map();
  await Promise.all(generators.map(async ([name]) => {
    let content;
    try { content = await readFile(join(root, '.cache/release/generators', cacheKey(name) + '.json'), 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    records.set(name, JSON.parse(content));
  }));
  const specs = JSON.parse(await readFile(join(root, 'tools/script-opcode-specs.json'), 'utf8'));
  const inventory = buildInventory(generators, records, scriptOpcodeOutputDeclarations(specs));
  const catalogue = JSON.parse(await readFile(join(root, 'docs/GENERATOR-INPUT-SOURCES.json'), 'utf8'));
  const inputSources = classifyProducerGaps(inventory, catalogue, scripts);
  for (const group of catalogue.groups) {
    const path = group.evidence_file ?? group.tool, source = await readFile(join(root, path), 'utf8');
    for (const token of group.evidence) if (!source.includes(token)) throw Error('Input source evidence drift: ' + path + ': ' + token);
  }
  const cache = await createReleaseCache({root});
  const stale = [];
  for (const [name] of generators) if (records.has(name) && !await cache.valid('generators', name)) stale.push(name);
  const selected = new Set(generators.map(([name]) => name));
  return {...inventory, input_sources: inputSources, source: '.cache/release/generators',
    freshness: {current: records.size - stale.length, stale_records: stale},
    other_commands: Object.keys(scripts).filter(name => !selected.has(name))};
}

export function inventorySummary(inventory) {
  return {
    counts: inventory.counts,
    freshness: {current: inventory.freshness.current, stale: inventory.freshness.stale_records.length},
    other_commands: inventory.other_commands.length,
    output_conflicts: inventory.output_conflicts,
    intended_ownership: inventory.intended_ownership.counts,
    input_sources: inventory.input_sources.counts,
    cycles: inventory.cycles.map(commands => ({size: commands.length, sample: commands.slice(0, 6)})),
    shared_tools: inventory.shared_tools.slice(0, 8).map(({path, commands}) => ({path, generators: commands.length})),
    limits: 'The graph uses recorded reads and writes, including transitive module loads. Intended Script52 ownership and source-reviewed classifications of other inputs remain separate from graph edges and cache records. Recording-dependent and retained inputs must be preserved. Classifications are not a bootstrap plan; cycles cannot be ordered internally.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--json')) throw Error('Usage: node tools/generator-dependencies.mjs [--json output-path]');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const inventory = await readInventory(root);
  if (args.length) {
    const path = resolve(args[1]);
    await mkdir(dirname(path), {recursive: true});
    await writeFile(path, JSON.stringify(inventory, null, 2) + '\n');
  }
  console.log(JSON.stringify(inventorySummary(inventory), null, 2));
}
