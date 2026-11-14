import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderFA92 } from '../proof/render/fields-fa92.mjs';
import { fa92Entry, fa92Fixture } from './render-fa92-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-fa92.json', 'utf8'));
const fixtures = [
  {},
  { second: 1, dimension: null },
  { second: 0, dimension: 0 },
  { second: 0x8000, dimension: 0xFFFF },
  { index: 0xFFFF, second: 0, dimension: 2, bank: 0x7F },
  { index: 0xDEDF, first: 0xABCD, second: 0, dimension: 0x8000 },
  { dimension: null },
  { maxWork: 5 },
  { writeWindows: [[0x7E2102, 0x7E2103], [0x7E2122, 0x7E2122]] },
];
const probes = fixtures.map(fixture => {
  const data = fa92Fixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRenderFA92({ ...fa92Entry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-fa92-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows[0], stackProof: source.full_graph.proof,
  scope: 'Manual atomic WORD FA92 under2 protected stackbytes using explicitly synthetic DP/dimension/window inputs. Full unmasked indices and bankcarry, first WORD store before fresh second input, positive versus zero/negative gate, actual ADC C/V before two DEC and final DEC N/Z, shared view/budgets and one outer commit. No CPU/device/clock/interrupt/scene/frame execution. Original F963 initialization and whole936C/BF3B caller binding remain open.',
  declaredInputs: fa92Entry, probes }, null, 2) + '\n');
console.log('FA92: nine synthetic field/positive/zero/negative/bankcarry/late-boundary probes.');
