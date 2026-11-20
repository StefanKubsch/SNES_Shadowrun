// Records golden traces (docs/STATE-MODEL-REBUILD.md):
//   node tools/golden/record.mjs [scenario ...]   (default: all)
// Only for a deliberate change of behaviour; the reason belongs in the commit.
import { mkdirSync, statSync } from 'node:fs';
import { cartridge } from '../cartridge-harness.mjs';
import { SCENARIOS, scenario } from './scenarios.mjs';
import { recordScenario, traceFile, writeTrace } from './trace.mjs';

const KIB = 1024,
  MS = 1000;
mkdirSync(new URL('./traces/', import.meta.url), { recursive: true });
const names = process.argv.slice(2);
for (const s of names.length ? names.map(scenario) : SCENARIOS) {
  const started = performance.now();
  const trace = recordScenario(s, cartridge);
  writeTrace(trace);
  const size = Math.round(statSync(traceFile(s.name)).size / KIB);
  console.log(
    `${s.name}: ${trace.nmis} NMIs, ${trace.pads.length} pad changes, ${trace.pokes.length} pokes, ` +
      `${Buffer.from(trace.counter, 'base64').length} counter bytes, ${size} KiB, ` +
      `${((performance.now() - started) / MS).toFixed(1)} s`,
  );
}
