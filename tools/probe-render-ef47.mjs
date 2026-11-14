import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderEF47 } from '../proof/render/mode-ef47.mjs';
import { ef47Entry, ef47Fixture } from './render-ef47-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-ef47.json', 'utf8'));
const fixtures = [
  { a: 0xAB00, zeroFixture: true },
  { entries: [0] },
  {},
  { entries: [6, 7, 6, 7, 0], modeLoader: { blocks: [{ kind: 'repeat', count: 2, value: 0xBEEF }] } },
  { modeLoader: { address: 0x12FF, blocks: [{ kind: 'raw', values: [0xAA, 0xBB] }] } },
  { bank: 0x7F },
  { ioRead2140: [0, 1, 2, 3, 4] },
  { ioRead2140: [0, 1, 2, 3, 4, 5] },
  { entries: [6, 7, 6], maxWork: 1000 },
];
const probes = fixtures.map(fixture => {
  const data = ef47Fixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRenderEF47({ ...ef47Entry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-ef47-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'selectEF47'), stackProof: source.full_graph.proof,
  scope: 'Manual atomic WORD EF47 under22 protected stackbytes using explicitly synthetic mode/header/directory/payload bytes and actual global BYTE2140 observations. Full first WORD1CDE store, real F25A/F1FA/F130/F007 and fixed 000D/2020 then 0002/7F7F commands, fresh shared bytes, cumulative work/output budgets and one outer commit. No audio/device/CPU/clock/interrupt/scene execution. Original callers and initialization remain open.',
  declaredInputs: ef47Entry, probes }, null, 2) + '\n');
console.log('EF47: nine synthetic zero/list/load/duplicate/physical/late-boundary probes.');
