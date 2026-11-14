import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryPairs, dependencyOrder, reorderScripts, backwardPairs, orderedGenerators} from './order-generators.mjs';

const scripts = {
  'start': 'node start.mjs',
  'analyze:render-c': 'node c.mjs',
  'plan:dialog': 'node plan.mjs',
  'analyze:render-a': 'node a.mjs',
  'test': 'node --test',
  'probe:render-b': 'node b.mjs',
  'docs:progress': 'node docs.mjs',
};

test('Stable topological order keeps unrelated generators in their current order', () => {
  assert.deepEqual(dependencyOrder(['c', 'a', 'b', 'd'], [['b', 'c']]), ['a', 'b', 'c', 'd']);
  assert.deepEqual(dependencyOrder(['c', 'a', 'b'], []), ['c', 'a', 'b']);
  assert.deepEqual(dependencyOrder(['a', 'b'], [['x', 'a'], ['a', 'b'], ['a', 'b']]), ['a', 'b']);
  assert.throws(() => dependencyOrder(['a', 'b'], [['a', 'b'], ['b', 'a']]), /Dependency cycle/);
  assert.throws(() => dependencyOrder(['a', 'a'], []), /Duplicate generator/);
});

test('Reordering fills only generator slots and leaves final and other commands in place', () => {
  assert.deepEqual(orderedGenerators(scripts), ['analyze:render-c', 'analyze:render-a', 'probe:render-b']);
  const order = dependencyOrder(orderedGenerators(scripts), [['probe:render-b', 'analyze:render-c']]);
  const result = reorderScripts(scripts, order);
  assert.deepEqual(Object.keys(result), ['start', 'analyze:render-a', 'plan:dialog', 'probe:render-b', 'test', 'analyze:render-c', 'docs:progress']);
  for (const [name, command] of Object.entries(result)) assert.equal(command, scripts[name]);
  assert.throws(() => reorderScripts(scripts, ['analyze:render-a']), /does not match/);
});

test('Declared outputs order their owner before every consumer; self reads are ignored', () => {
  const inventory = {edges: [{producer: 'a', consumer: 'b', files: ['x']}],
    intended_ownership: {outputs: [{path: 'y', command: 'c', consumers: ['c', 'a']}]}};
  const pairs = inventoryPairs(inventory);
  assert.deepEqual(pairs, [['a', 'b'], ['c', 'a']]);
  assert.deepEqual(dependencyOrder(['a', 'b', 'c'], pairs), ['c', 'a', 'b']);
  assert.deepEqual(backwardPairs(['a', 'b', 'c'], pairs), [['c', 'a']]);
  assert.deepEqual(backwardPairs(['c', 'a', 'b'], pairs), []);
});
