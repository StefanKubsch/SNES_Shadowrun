import { readFile, writeFile } from 'node:fs/promises';
import { prepareRender91E2 } from '../proof/render/selection-91e2.mjs';
import { choice91E2Entry, choice91E2Fixture } from './render-91e2-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-selection.json', 'utf8'));
const fixtures = [
  { held: 0x2000 }, { held: 0x40 }, { held: 0x2040 }, { held: 0x40, sound: 0x8007, load: true },
  { held: 0x3030 }, { held: 0 }, { held: 0x40, ioRead2140: [] },
  { held: 0x2000, maxOutputBytes: 343 }, { held: 0x2000, maxWork: 7003 },
  { held: 0x2000, stackWindow: [0x1FEB, 0x1FFF] },
];
const probes = fixtures.map(fixture => {
  const data = choice91E2Fixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRender91E2({ ...choice91E2Entry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-91e2-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  progress_reference: 'docs/PORTIERUNGSSTAND.json', source: source.windows[0], originalTable: source.tables[0],
  stackProof: source.choice91e2_graph.proof, originalSoundStackProof: source.choice91e2_graph.original_sound_proof,
  scope: 'Manual atomic91E2 with actualA6C7 under22 protected stackbytes. Original eight-byte ROM menu list separately pinned; explicitly synthetic dictionary/font/buffer/input and independent chronological arithmetic/transfer/counter/APU observations. Fresh DP17 and post-menu DP00, actual returned DBR, exactFFFF tail, shared provider/global budgets/one outer commit. No CPU/device/time/interrupt/scene execution or automatic frame binding; E382 reset and actual termination remain open.',
  declaredInputs: choice91E2Entry, probes }, null, 2) + '\n');
console.log(probes.map(p => p.outcome ?? p.reason).join(', '));
