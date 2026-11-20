// One golden trace as a node:test (docs/STATE-MODEL-REBUILD.md). Each scenario has its
// own test file (tools/golden-<name>.test.mjs) so that the runner can take them in
// parallel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from '../cartridge-harness.mjs';
import { scenario } from './scenarios.mjs';
import { replayScenario } from './trace.mjs';

const TIMEOUT = 900000;
export function goldenTest(name) {
  test(`the game replays the golden trace ${name} unchanged`, { timeout: TIMEOUT }, () => {
    const difference = replayScenario(scenario(name), cartridge);
    assert.equal(difference, null, `golden trace ${name}: ${JSON.stringify(difference)}`);
  });
}
