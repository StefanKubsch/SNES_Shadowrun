// Which script native targets the golden traces reach (docs/STATE-MODEL-REBUILD.md,
// "Golden traces"): replays every scenario with a hook on GameLoop.onNative and writes
// tools/golden/native-reach.json (per scenario the 24-bit targets and their call counts).
// A native's source proof may only be retired (tools/retired-native-proofs.mjs) when a
// trace reaches it; tools/retired-native-proofs.test.mjs checks that against this file.
//   node tools/golden/native-reach.mjs   (about nine minutes; rerun after a new scenario)
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LiveGame, PICTURE_VIDEO } from '../../src/video/live-game.mjs';
import { cartridge } from '../cartridge-harness.mjs';
import { SCENARIOS } from './scenarios.mjs';
import { attach, readTrace } from './trace.mjs';

export const NATIVE_REACH_FILE = new URL('./native-reach.json', import.meta.url);
const HEX = 16,
  MS = 1000;

export function nativeReach(scenario) {
  const trace = readTrace(scenario.name),
    game = new LiveGame(cartridge, { ...scenario.options(), video: PICTURE_VIDEO });
  attach(game, trace);
  const seen = new Map(),
    previous = game.loop.onNative;
  game.loop.onNative = (target) => {
    seen.set(target, (seen.get(target) ?? 0) + 1);
    previous?.(target);
  };
  while (game.nmis < trace.nmis) game.step();
  return Object.fromEntries(
    [...seen].sort(([a], [b]) => a - b).map(([target, calls]) => [target.toString(HEX), calls]),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const scenarios = {};
  for (const s of SCENARIOS) {
    const started = performance.now();
    scenarios[s.name] = nativeReach(s);
    console.log(
      `${s.name}: ${Object.keys(scenarios[s.name]).length} natives, ` +
        `${((performance.now() - started) / MS).toFixed(0)} s`,
    );
  }
  writeFileSync(NATIVE_REACH_FILE, JSON.stringify({ scenarios }, null, 1) + '\n');
  const all = new Set(Object.values(scenarios).flatMap(Object.keys));
  console.log(`${all.size} distinct native targets reached`);
}
