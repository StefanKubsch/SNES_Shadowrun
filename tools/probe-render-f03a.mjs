import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderF03A } from '../proof/render/pair-f03a.mjs';
import { pairEntry, pairFixture } from './render-f03a-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-audio.json', 'utf8'));
const fixtures = [
  { flag: 0, a: 0xAB00, ioMode: null, ioRead2140: null },
  {},
  { flag: 255, token: 255, buffer: 0x80, a: 0xFFFF, ioRead2140: [0,255] },
  { bank: 0x7F, token: 127, a: 0xAB00, ioMode: null, ioRead2140: null },
  { ioRead2140: [0,255] },
  { writeWindows: [[0x7E1CE6,0x7E1CE6]] },
];
const probes = fixtures.map(fixture => {
  const data = pairFixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRenderF03A({ ...pairEntry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed'); return { fixture, ...p };
});
await writeFile('analysis/render-f03a-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'sendPairF03A'),
  stackProof: source.graph.proofs.find(p => p.entry === '81:F03A'),
  scope: 'Manual atomic BYTE F03A pair buffer/request algorithm, explicitly synthetic source/register bytes and actual BYTE2140 polls. Fresh flag/token/buffer, saved incoming byte, hiddenhighA/XBA/actual BYTEflags, global observation positions, shared provider/budget and one outer commit. No audio/device/CPU/clock/interrupt/scene execution.',
  declaredInputs: pairEntry, probes }, null, 2) + '\n');
console.log('F03A: six synthetic manual buffer/pair/wrap/WRAM/poll/window probes.');
