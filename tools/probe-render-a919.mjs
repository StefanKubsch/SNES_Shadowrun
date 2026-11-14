import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderA919 } from '../proof/render/palette-list-a919.mjs';

const source = JSON.parse(await readFile('analysis/render-a919.json', 'utf8'));
const declaredInputs = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const fixtures = [
  { gate: 0 },
  { gate: 0x8000, count: 0 },
  { gate: 1, count: 2, records: [[0, 0x1000]] },
  { gate: 1, count: 3, records: [[1, 0xFFF]] },
  { gate: 1, count: 6, records: [[4, 0xFFF], [2, 0x1000], [0, 1]] },
  { gate: 1, count: 0x8004, records: [[0x8002, 0x800]] },
  { gate: 1, count: 0x8022, records: [[0x8020, 0x1000]] },
  { gate: 1, count: 0xFFFF, records: [[0xFFFD, 0xFF00]] },
  { gate: 1, count: 1, records: [[0xFFFF, 0x1000]] },
];
const probes = [];
for (const fixture of fixtures) {
  const data = createRenderData(), base = declaredInputs.bank * 65536;
  const word = (address, value) => data.seed(address, [value & 255, value >>> 8]);
  // Seed records first; gate/count writes represent final inputbytes where
  // the declared next-bank WRAM mirror overlaps the list/count source.
  for (const [y, value] of fixture.records ?? []) word(base + 0x17D6 + y, value);
  word(base + 0x1562, fixture.gate);
  if (fixture.count !== undefined) word(base + 0x17D4, fixture.count);
  const p = prepareRenderA919({ data, ...declaredInputs });
  if (!p.handled || !data.commit(p).handled) throw Error(JSON.stringify(p));
  probes.push({ fixture, ...p });
}
await writeFile('analysis/render-a919-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'paletteListA919'),
  scope: 'Manual atomicA919 with explicitly synthetic gate/count/records/stack fixtures. Ordered request metadata only; no device execution, DMA, palette latch, NMI, original list hydration or frame binding.',
  declaredInputs: { ...declaredInputs, writeWindows: [] }, probes }, null, 2) + '\n');
console.log('A919: nine synthetic gate/oddcount/signedloop/pointer/index/carry probes; atomic ordered requests only.');
