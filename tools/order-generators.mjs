// Reorders the release generators in package.json so that every recorded or
// declared producer runs before its consumers. The order is a stable
// topological sort: among ready generators the earlier current position wins,
// so unrelated generators keep their relative order. Other npm scripts keep
// their positions. Input is the inventory written by generator-dependencies.mjs.
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {releaseGenerators} from './generator-dependencies.mjs';

// Producer/consumer pairs from observed edges plus declared Script52 outputs.
export function inventoryPairs(inventory) {
  const pairs = inventory.edges.map(({producer, consumer}) => [producer, consumer]);
  for (const output of inventory.intended_ownership?.outputs ?? [])
    for (const consumer of output.consumers) pairs.push([output.command, consumer]);
  return pairs.filter(([producer, consumer]) => producer !== consumer);
}

export function dependencyOrder(names, pairs) {
  const index = new Map(names.map((name, i) => [name, i]));
  if (index.size !== names.length) throw Error('Duplicate generator name');
  const children = new Map(names.map(name => [name, new Set()])), incoming = new Map(names.map(name => [name, 0]));
  for (const [producer, consumer] of pairs) {
    if (!index.has(producer) || !index.has(consumer)) continue;
    if (children.get(producer).has(consumer)) continue;
    children.get(producer).add(consumer); incoming.set(consumer, incoming.get(consumer) + 1);
  }
  const ready = names.filter(name => incoming.get(name) === 0), order = [];
  while (ready.length) {
    ready.sort((a, b) => index.get(a) - index.get(b));
    const name = ready.shift(); order.push(name);
    for (const child of children.get(name)) {
      incoming.set(child, incoming.get(child) - 1);
      if (incoming.get(child) === 0) ready.push(child);
    }
  }
  if (order.length !== names.length) throw Error('Dependency cycle prevents an order');
  return order;
}

// verify-release.mjs always runs these two after all other generators.
const finalCommands = ['plan:dialog', 'docs:progress'];
export const orderedGenerators = scripts => releaseGenerators(scripts).map(([name]) => name).filter(name => !finalCommands.includes(name));

// Places the ordered release generators into the slots they already occupy.
export function reorderScripts(scripts, order) {
  const generators = new Set(orderedGenerators(scripts));
  if (order.length !== generators.size || order.some(name => !generators.has(name))) throw Error('Order does not match release generators');
  const queue = [...order], result = {};
  for (const [name, command] of Object.entries(scripts)) {
    if (generators.has(name)) { const next = queue.shift(); result[next] = scripts[next]; }
    else result[name] = command;
  }
  return result;
}

export function backwardPairs(names, pairs) {
  const index = new Map(names.map((name, i) => [name, i]));
  return pairs.filter(([producer, consumer]) => index.has(producer) && index.has(consumer) && index.get(producer) > index.get(consumer));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inventoryPath = process.argv.find(arg => arg.startsWith('--inventory='))?.slice(12) ?? '.cache/generator-dependencies.json';
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  const releaseNames = scripts => releaseGenerators(scripts).map(([name]) => name);
  const pairs = inventoryPairs(inventory), current = orderedGenerators(pkg.scripts);
  const order = dependencyOrder(current, pairs), scripts = reorderScripts(pkg.scripts, order);
  const before = backwardPairs(releaseNames(pkg.scripts), pairs).length, after = backwardPairs(releaseNames(scripts), pairs).length;
  const moved = order.filter((name, i) => name !== current[i]).length;
  console.log(`Release generators ${order.length}; moved ${moved}; backward pairs ${before} -> ${after}.`);
  if (process.argv.includes('--write')) await writeFile('package.json', JSON.stringify({...pkg, scripts}, null, 2) + '\n');
}
