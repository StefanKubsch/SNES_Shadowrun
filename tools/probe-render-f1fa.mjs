import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderF1FA } from '../proof/render/mode-f1fa.mjs';
import { modeEntry, modeFixture } from './render-f1fa-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-ef47.json', 'utf8'));
const fixtures = [
  { entries: [0] },
  { entries: [5, 99, 0] },
  {},
  { entries: [6, 7, 6, 7, 0] },
  { directory: 0x7E5000, header: 0xFFFF, entries: [5, 255, 255, 99, 0] },
  { blocks: [{ kind: 'repeat', count: 2, value: 0xBEEF }] },
  { entries: [6, 7, 6, 7, 0], ioRead2140: [0, 1, 2, 3, 4] },
  { entries: [6, 7, 6], maxWork: 1000 },
];
const probes = fixtures.map(fixture => {
  const data = modeFixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRenderF1FA({ ...modeEntry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-f1fa-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'modeEntriesF1FA'),
  stackProof: source.full_graph.helper_proofs.find(p => p.entry === '81:F1FA'),
  scope: 'Manual atomic BYTE F1FA using explicitly synthetic mode/header/directory/payload bytes and actual BYTE2140 observations. Fresh shared pointers/cache/list, WORD Y wrap, every repeated real F130 call, PHY/PLY and PHP/PLP semantics, global APU polls, cumulative work/output budgets and one outer commit. No audio/device/CPU/clock/interrupt/scene execution. Native F25A supplied separately; native EF47 supplied under22 protected stackbytes; original callers remain open.',
  declaredInputs: modeEntry, probes }, null, 2) + '\n');
console.log('F1FA: eight synthetic zero/mismatch/load/duplicate/wrap/repeat/late-boundary probes.');
