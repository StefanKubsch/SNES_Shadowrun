// Records golden traces (docs/STATE-MODEL-REBUILD.md):
//   node tools/golden/record.mjs [--accept] [scenario ...]   (default: all)
// Without --accept a new recording must keep the inputs and the picture, video, audio
// and SRAM hashes of the existing trace; only the game state hashes may change (a
// changed SCRATCH list). --accept takes a deliberate change of behaviour, whose reason
// belongs in the commit.
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { cartridge } from '../cartridge-harness.mjs';
import { SCENARIOS, scenario } from './scenarios.mjs';
import { CATEGORIES, readTrace, recordScenario, traceFile, writeTrace } from './trace.mjs';

const KIB = 1024,
  MS = 1000,
  HASH_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const KEPT = CATEGORIES.map((name, index) => [name, index]).filter(([name]) => name !== 'state');

// The first kept difference between the old trace and the new recording, or null.
function keptDifference(old, trace) {
  for (const key of ['nmis', 'pads', 'pokes', 'counter'])
    if (JSON.stringify(old[key]) !== JSON.stringify(trace[key])) return `inputs (${key})`;
  const raw = Buffer.from(trace.frames, 'base64'),
    frames = new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / HASH_BYTES),
    width = CATEGORIES.length;
  for (let n = 0; n < frames.length / width; n++)
    for (const [name, c] of KEPT)
      if (frames[n * width + c] !== old.frames[n * width + c]) return `${name} at frame ${n}`;
  return null;
}

mkdirSync(new URL('./traces/', import.meta.url), { recursive: true });
const args = process.argv.slice(2),
  accept = args.includes('--accept'),
  names = args.filter((a) => a !== '--accept');
let failed = false;
for (const s of names.length ? names.map(scenario) : SCENARIOS) {
  const started = performance.now();
  const trace = recordScenario(s, cartridge);
  if (existsSync(traceFile(s.name)) && !accept) {
    const old = readTrace(s.name),
      differs = keptDifference(
        { ...old, counter: Buffer.from(old.counter).toString('base64') },
        trace,
      );
    if (differs) {
      console.log(
        `${s.name}: not written, ${differs} differs (use --accept for a deliberate change)`,
      );
      failed = true;
      continue;
    }
  }
  writeTrace(trace);
  const size = Math.round(statSync(traceFile(s.name)).size / KIB);
  console.log(
    `${s.name}: ${trace.nmis} NMIs, ${trace.pads.length} pad changes, ${trace.pokes.length} pokes, ` +
      `${Buffer.from(trace.counter, 'base64').length} counter bytes, ${size} KiB, ` +
      `${((performance.now() - started) / MS).toFixed(1)} s`,
  );
}
process.exitCode = failed ? 1 : 0;
