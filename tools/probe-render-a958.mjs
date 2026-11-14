import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderA958 } from '../proof/render/transfer-list-a958.mjs';

const source = JSON.parse(await readFile('analysis/render-a958.json', 'utf8'));
const declaredInputs = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const writeWindows = [[0x7E0082, 0x7E0083]];
const fixtures = [
  { gate: 0 },
  { gate: 1, cursor: 0xFFFE },
  { gate: 0x8000, cursor: 0x8001 },
  { gate: 1, cursor: 0, records: [[0, 0xFFC0, 0x8000, 0x8E]] },
  { gate: 1, cursor: 1, records: [[1, 0x1234, 0xABCD, 0xCF]] },
  { gate: 1, cursor: 4, records: [[4, 0xFFC0, 0xABCD, 0xCF], [2, 0x0040, 0x4000, 0x90], [0, 0, 0x1200, 0x8E]] },
];
const probes = [];
for (const fixture of fixtures) {
  const data = createRenderData({ writeWindows }), base = declaredInputs.bank * 65536;
  const word = (address, value) => data.seed(address, [value & 255, value >>> 8]);
  word(base + 0x1562, fixture.gate);
  if (fixture.cursor !== undefined) word(0x82, fixture.cursor);
  for (const [x, pointer, target, bank] of fixture.records ?? []) {
    word(base + 0x16D4 + x, pointer); word(base + 0x1754 + x, target); data.seed(base + 0x1654 + x, [bank]);
  }
  const p = prepareRenderA958({ data, ...declaredInputs });
  if (!p.handled || !data.commit(p).handled) throw Error(JSON.stringify(p));
  probes.push({ fixture, ...p });
}
await writeFile('analysis/render-a958-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'requestA958'),
  scope: 'Manual atomicA958 with explicitly synthetic gate/cursor/table/stack/write fixtures. Ordered request metadata only; no device execution, DMA, VRAM latch, NMI, original list hydration or frame binding.',
  declaredInputs: { ...declaredInputs, writeWindows }, probes }, null, 2) + '\n');
console.log('A958: six synthetic zero/negative/odd/ordered-table/highA probes; atomic ordered requests only.');
