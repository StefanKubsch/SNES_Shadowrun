import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRender8877 } from '../proof/render/color-8877.mjs';

const source = JSON.parse(await readFile('analysis/render-8877.json', 'utf8'));
const table = JSON.parse(await readFile('assets/render-8877-data.json', 'utf8')).sources[0];
const declaredInputs = { status: 0xC5, x: 0x1234, y: 0xBEEF, emulation: 0, directPage: 0,
  stackWindow: [0x1EE0, 0x1EEF], ioMode: 'record-requests' };
const fixtures = [{ gate: 0, bank: 0x80 }, { gate: 8, bank: 0 }, { gate: 0xFFFF, bank: 0x80 },
  { gate: 7, bank: 0x80 }, { gate: 2, phaseWord: 0x100, bank: 0x80 },
  { gate: 6, phaseWord: 0x140, bank: 0 }, { gate: 2, phaseWord: 0x7FC0, bank: 0x80 },
  { gate: 4, phaseWord: 0x170, bank: 0x80 }, { gate: 4, phaseWord: 0x7FF0, bank: 0x80 },
  { gate: 4, phaseWord: 0x100, bank: 0x7F, tableByte: 0 }];
const probes = fixtures.map(fixture => {
  const { gate, bank, phaseWord = 0 } = fixture, base = bank * 65536, physical = bank === 0x7F ? 0x7F0000 : 0x7E0000;
  const writeWindows = [[physical + 0x1FDC, physical + 0x1FDF],
    ...(bank === 0x7F ? [[base + 0x2131, base + 0x2132]] : [])];
  const data = createRenderData({ writeWindows }); data.seed(base + 0x1FDC, [gate & 255, gate >>> 8]);
  if (!(gate & 0x8001) && gate & 6) {
    data.seed(base + 0x1FDE, [phaseWord & 255, phaseWord >>> 8]);
    const index = (phaseWord + (gate & 2 ? 64 : 16)) & 511;
    if (bank === 0x7F) data.seed(base + 0xD3D1 + index, [fixture.tableByte]);
    else data.seed(table.address, table.bytes); // Explicit originalROM data, never substituted at otherDBRs.
  }
  const plan = prepareRender8877({ data, bank, ...declaredInputs });
  if (!plan.handled || !data.commit(plan).handled) throw Error(JSON.stringify(plan));
  return { fixture, writeWindows, ...plan };
});
await writeFile('analysis/render-8877-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.slice(0, 3), table: source.table,
  scope: 'Ten explicitly synthetic gate/phase/DBR/stack/write fixtures; original185bytes/82instructions and original512BYTEtable separate. Manual atomic data/request plan only; no CPU/device/interrupt/clock or automaticframe execution.',
  declaredInputs, probes }, null, 2) + '\n');
console.log('8877: ten synthetic zero/negative/one-shot/ramp/overflow/physical-bank probes; originaltable512 separate.');
