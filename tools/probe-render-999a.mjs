import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRender999A } from '../proof/render/palette-999a.mjs';

const source = JSON.parse(await readFile('analysis/render-999a.json', 'utf8'));
const writeWindows = [[0x7E0D0E, 0x7E0D0F]];
const declaredInputs = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const fixtures = [
  { flag: 0, count: null, records: [], tail: null },
  { flag: 1, count: 0, records: [], tail: null },
  ...[0, 1, 0x400, 0x7FF, 0x800, 0xFFFF].map(record => ({ flag: 1, count: 1, records: [record], tail: [0x5A, 0x80] })),
  { flag: 1, count: 3, records: [1, 0x800, 0x400], tail: [0xA5, 0] },
  { flag: 0xFFFF, count: 0x8001, records: [0x800], tail: [0, 255] },
];
const probes = [];
for (const fixture of fixtures) {
  const data = createRenderData({ writeWindows });
  const seedWord = (a, v) => data.seed(a, [v & 255, v >>> 8]);
  seedWord(0xD0E, fixture.flag);
  if (fixture.count !== null) seedWord(0xD10, fixture.count);
  fixture.records.forEach((v, index) => seedWord(0xD00 + index * 2, v));
  if (fixture.tail) data.seed(0xD12, fixture.tail);
  const p = prepareRender999A({ data, ...declaredInputs });
  if (!p.handled || !data.commit(p).handled) throw Error(JSON.stringify(p));
  probes.push({ fixture, ...p });
}
await writeFile('analysis/render-999a-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'paletteRequest999A'),
  scope: 'Manual atomic999A using explicitly synthetic flag/count/records/tail/stack/write fixtures. Ordered request metadata only; no device execution, palette latch, DMA, NMI, original list hydration or frame binding.',
  declaredInputs: { ...declaredInputs, writeWindows }, probes }, null, 2) + '\n');
console.log('999A: ten synthetic gate/pointer/countwrap probes; fresh reads and atomic request metadata.');
