import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderFAAC } from '../proof/render/cursor-faac.mjs';
import { cursorEntry, cursorFixture } from './render-faac-fixtures.mjs';

const source = JSON.parse(await readFile('analysis/render-a6a5.json', 'utf8'));
const fixtures = [
  { index: 2, row: 10, width: 6, position: 0x2000, delta: 3, result: 40, bank: 0x80 },
  { index: 0xFFFF, row: 0xAB00, width: 0xCC01, position: 0xFFFF, delta: 1, result: 0, bank: 0x7F },
  { index: 1, row: 0xFFFF, width: 0, position: 0x7FFF, delta: 0, result: 1, bank: 0 },
  { index: 0, row: 1, width: 3, position: 0xFFFF, delta: 1, result: null, bank: 0x7E },
];
const probes = fixtures.map(fixture => {
  const data = cursorFixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRenderFAAC({ data, ...cursorEntry, bank: fixture.bank,
    ioRead4216: fixture.result === null ? [] : [fixture.result] });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-faac-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'cursorFAAC'),
  stackProof: source.helper_graph.proofs.find(p => p.entry === '80:FAAC'),
  scope: 'Manual atomic FAAC with explicitly synthetic byte parameters, full WORD indices, carry and external WORD4216 observations. No calculated hardware result, CPU/device/time/scene/frame execution.',
  declaredInputs: cursorEntry, probes }, null, 2) + '\n');
console.log('FAAC: four synthetic manual cursor, bank/carry/width-wrap and exhausted-observation probes.');
