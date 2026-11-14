import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRender8FBA } from '../proof/render/transfer-palette-8fba.mjs';

const source = JSON.parse(await readFile('analysis/render-8fba.json', 'utf8'));
const declaredInputs = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const fixtures = [
  { gate: 0x8000, bank: 0x80 }, { gate: 0xFFFF, bank: 0 },
  { gate: 0, pointer: 0xFFFF, paletteIndex: 0xFF, sourceBank: 0x8D, bank: 0x80 },
  { gate: 0x800, pointer: 0x7FFD, paletteIndex: 0xA1, sourceBank: 0x7E, bank: 0x80 },
  { gate: 0x1234, pointer: 0x1234, paletteIndex: 0, sourceBank: 0, bank: 0 },
  { gate: 0, pointer: 0xFFFD, paletteIndex: 0x91, sourceBank: 0x8D, bank: 0xBF },
  { gate: 0x800, pointer: 0xFFFF, paletteIndex: 0xA1, sourceBank: 0x8D, bank: 0x7E },
  { gate: 0, pointer: 0x7FFF, paletteIndex: 0x91, sourceBank: 0x7F, bank: 0x7F },
];
const probes = [];
for (const fixture of fixtures) {
  const base = fixture.bank * 65536, physical = fixture.bank === 0x7E || fixture.bank === 0x7F;
  const writeWindows = fixture.gate & 0x8000 ? [] : [[physical ? base + 0x140 : 0x7E0140, physical ? base + 0x141 : 0x7E0141],
    ...(physical ? [[base + 0x2000, base + 0x43FF]] : [])];
  const data = createRenderData({ writeWindows });
  data.seed(base + 0x140, [fixture.gate & 255, fixture.gate >>> 8]);
  if (!(fixture.gate & 0x8000)) {
    data.seed(0xF6, [fixture.pointer & 255, fixture.pointer >>> 8, fixture.sourceBank]);
    data.seed(base + 0x142, [fixture.paletteIndex]);
  }
  const p = prepareRender8FBA({ data, ...declaredInputs, bank: fixture.bank, ioMode: physical ? null : 'record-requests' });
  if (!p.handled || !data.commit(p).handled) throw Error(JSON.stringify(p));
  probes.push({ fixture, writeWindows, ...p });
}
await writeFile('analysis/render-8fba-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'request8FBA'),
  scope: 'Manual atomic8FBA with explicitly synthetic gate/DP/DBR/stack/write fixtures. Ordered request metadata or physical WRAM registeroffset writes only; no device execution, DMA, setup wait, original transferbuffer hydration or frame binding.',
  declaredInputs, probes }, null, 2) + '\n');
console.log('8FBA: eight synthetic negative/zero/active/pointerwrap/overflow/physical-bank probes; atomic requests/late marker only.');
