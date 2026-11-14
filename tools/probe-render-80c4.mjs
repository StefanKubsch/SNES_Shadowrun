import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRender80C4 } from '../proof/render/palette-80c4.mjs';

const source = JSON.parse(await readFile('analysis/render-80c4.json', 'utf8'));
const declaredInputs = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const writeWindows = [[0x7E1CDA, 0x7E1CDB]];
const fixtures = [
  { pointer: 0 },
  { pointer: 0x1234, index: 0, size: 32, palette: 0x80 },
  { pointer: 0xABCD, index: 2, size: 0x50, palette: 0xA5, secondSize: 0x740 },
  { pointer: 0xFFFF, index: 1, size: 0, palette: 0xFF },
  { pointer: 0x1234, index: 0x14, size: 0xFFFF },
  { pointer: 0x1234, index: 0x633A, size: 16, palette: 0x5A },
];
const probes = [];
for (const fixture of fixtures) {
  const data = createRenderData({ writeWindows }), base = declaredInputs.bank * 65536;
  const word = (offset, value) => data.seed(base + offset, [value & 255, value >>> 8]);
  word(0x1CDA, fixture.pointer);
  if (fixture.index !== undefined) word(0x1CDC, fixture.index);
  if (fixture.size !== undefined) word(0x1CCA, fixture.size);
  if (fixture.secondSize !== undefined) word(0x1CCC, fixture.secondSize);
  if (fixture.palette !== undefined) data.seed(base + 0x1CC6 + fixture.index, [fixture.palette]);
  const p = prepareRender80C4({ data, ...declaredInputs });
  if (!p.handled || !data.commit(p).handled) throw Error(JSON.stringify(p));
  probes.push({ fixture, ...p });
}
await writeFile('analysis/render-80c4-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'paletteRequest80C4'),
  scope: 'Manual atomic80C4 with explicitly synthetic pointer/index/size/palette/ROMbyte/stack/write fixtures. Ordered request metadata only; no device execution, DMA, palette latch, NMI, original WRAM hydration or frame binding.',
  declaredInputs: { ...declaredInputs, writeWindows }, probes }, null, 2) + '\n');
console.log('80C4: six synthetic gate/index/size/alias/ROMbyte probes; atomic ordered requests only.');
