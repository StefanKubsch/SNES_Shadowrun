import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderA98E } from '../proof/render/object-buffer-a98e.mjs';

const source = JSON.parse(await readFile('analysis/render-a98e.json', 'utf8'));
const declaredInputs = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const fixtures = [
  { gate: 0, bank: 0x80, writeWindows: [], ioMode: null },
  { gate: 1, bank: 0x80, writeWindows: [[0x7E1562, 0x7E1563]], ioMode: 'record-requests' },
  { gate: 0x8000, bank: 0x80, writeWindows: [[0x7E1562, 0x7E1563]], ioMode: 'record-requests' },
  { gate: 0xFFFF, bank: 0x00, writeWindows: [[0x7E1562, 0x7E1563]], ioMode: 'record-requests' },
  { gate: 1, bank: 0x7E, writeWindows: [[0x7E1562, 0x7E1563], [0x7E2000, 0x7E43FF]], ioMode: null },
  { gate: 1, bank: 0x7F, writeWindows: [[0x7F1562, 0x7F1563], [0x7F2000, 0x7F43FF]], ioMode: null },
];
const probes = [];
for (const fixture of fixtures) {
  const data = createRenderData({ writeWindows: fixture.writeWindows });
  data.seed(fixture.bank * 65536 + 0x1562, [fixture.gate & 255, fixture.gate >>> 8]);
  const p = prepareRenderA98E({ data, ...declaredInputs, bank: fixture.bank, ioMode: fixture.ioMode });
  if (!p.handled || !data.commit(p).handled) throw Error(JSON.stringify(p));
  probes.push({ fixture, ...p });
}
await writeFile('analysis/render-a98e-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'objectRequestA98E'),
  scope: 'Manual atomicA98E with explicitly synthetic gate/DBR/stack/write fixtures. Ordered request metadata or physical WRAM registeroffset writes only; no device execution, DMA, OAM latch, NMI, original buffer hydration or frame binding.',
  declaredInputs, probes }, null, 2) + '\n');
console.log('A98E: six synthetic zero/nonzero/negativegate and physical-bank probes; atomic requests/lateclear only.');
