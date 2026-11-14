import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderC416 } from '../proof/render/pan-c416.mjs';
import { panEntry, panFixture } from './render-c416-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-audio.json', 'utf8'));
const fixtures = [
  { index: 65535, a: 64, ioRead4217: [17, 34] },
  { index: 2, position: 0xFFFF, other: 0x100, scroll: 0x600, a: 0xABCD, ioRead4217: [255, 0] },
  { index: 2, position: 0x7FFF, other: 0, scroll: 0x8000, a: 5, ioRead4217: [0, 128] },
  { index: 2, position: 0, other: 0, scroll: 0, a: 0xFFFF, ioRead4217: [128] },
];
const probes = fixtures.map(fixture => {
  const data = panFixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRenderC416({ ...panEntry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-c416-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'panC416'), stackProof: source.graph.proofs.find(p => p.entry === '80:C416'),
  scope: 'Manual atomic C416 with explicitly synthetic position/slot/camera inputs and actual BYTE4217 pair. Original WORD4202 then BYTE4203 requests, signed/unsigned/wrap/hiddenhighA and final flags. No calculated multiplication, audio/device/time/interrupt/scene execution.',
  declaredInputs: panEntry, probes }, null, 2) + '\n');
console.log('C416: four synthetic manual negative-slot, wrap, overflow and exhausted-result probes.');
