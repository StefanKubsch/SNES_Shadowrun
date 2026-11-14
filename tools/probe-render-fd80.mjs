import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderFD80 } from '../proof/render/number-fd80.mjs';
import { numberEntry, numberFixture } from './render-fd80-fixtures.mjs';

const source = JSON.parse(await readFile('analysis/render-a6a5.json', 'utf8'));
const fixtures = [
  { number: 5, ioRead4214Word: [0], ioRead4216Byte: [5], bank: 0x80 },
  { number: 65535, ioRead4214Word: [6553, 655, 65, 6, 0], ioRead4216Byte: [5, 3, 5, 5, 6], bank: 0 },
  { number: 0xABCD, ioRead4214Word: [1, 1, 1, 1, 1, 0], ioRead4216Byte: [1, 1, 1, 1, 1, 208], bank: 0xBF },
  { number: 123, ioRead4214Word: [12], ioRead4216Byte: [3], bank: 0x80 },
  { number: 5, ioRead4214Word: [0], ioRead4216Byte: [5], bank: 0x80, waitRead01FA: [] },
];
const probes = fixtures.map(fixture => {
  const data = numberFixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRenderFD80({ ...numberEntry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-fd80-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'numberFD80'),
  stackProof: source.helper_graph.proofs.find(p => p.entry === '80:FD80'),
  scope: 'Manual atomic FD80/FB39 with synthetic bytes, separate WORD4214/BYTE4216 observations, fresh forward copy and global text/wait observations. No inferred device division, digit cap, CPU/time/interrupt/scene/frame execution.',
  declaredInputs: numberEntry, probes }, null, 2) + '\n');
console.log('FD80: five synthetic manual number, WORD quotient, index underflow and late-boundary probes.');
