import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderF122, prepareRenderF1E8 } from '../proof/render/word-f122.mjs';
import { wordEntry, wordFixture } from './render-f122-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-audio.json','utf8'));
const fixtures = [
  { routine: 'F122', flag: 0 },
  { routine: 'F122', flag: 255, token: 255, a: 0x80FF, ioRead2140: [0,255] },
  { routine: 'F1E8', flag: 0, address: 0xFFFE, token: 127, a: 0x1234, ioRead2140: [127] },
  { routine: 'F1E8', bank: 0x7F, flag: 1, address: 0x7FFE, ioMode: null, ioRead2140: null },
  { routine: 'F1E8', address: null },
  { routine: 'F122', flag: 0, ioRead2140: [] },
];
const probes = fixtures.map(fixture => {
  const data = wordFixture(fixture), before = JSON.stringify(data.snapshot());
  const prepare = fixture.routine === 'F122' ? prepareRenderF122 : prepareRenderF1E8;
  const p = prepare({ ...wordEntry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed'); return { fixture, ...p };
});
await writeFile('analysis/render-f122-native.json',JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.filter(w=>['sendWordF122','repeatWordF1E8'].includes(w.name)),
  stackProofs: source.graph.proofs.filter(p=>['81:F122','81:F1E8'].includes(p.entry)),
  scope: 'Manual atomic F122/F1E8 WORD senders over native BYTE F03A, explicitly synthetic pair/DP96/register data and actual BYTE2140 polls. Saved low/high bytes, actual hiddenhighA/callee flags, REP20 without NZ recomputation, fresh WORDINC96 twice only inF1E8, global observations/shared provider/budget/outer commit. No audio/device/CPU/clock/interrupt/scene execution.',
  declaredInputs: wordEntry, probes },null,2)+'\n');
console.log('F122/F1E8: six synthetic manual buffer/pair/wrap/WRAM/source/poll probes.');
