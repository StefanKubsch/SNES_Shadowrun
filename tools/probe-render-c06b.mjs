import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderC06B } from '../proof/render/object-c06b.mjs';

const source = JSON.parse(await readFile('analysis/render-c06b.json', 'utf8'));
const declaredInputs = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const fixtures = [
  { gate: 0, objectWord: 0, byteD5: 0x80, bank: 0x80 },
  { gate: 0, objectWord: 0x8000, byteD5: 0x12, byteD7: 0x34, bank: 0 },
  { gate: 1, objectWord: 0, byteD5: 0xFE, bank: 0x80 },
  { gate: 0xFFFD, objectWord: 0xFFFD, byteD5: 0x80, byteD7: 0x80, bank: 0x80 },
  { gate: 0xFFFE, objectWord: 0xFFFE, byteD5: 0x80, byteD7: 0x80, bank: 0xBF },
  { gate: 0xFFFF, objectWord: 0xFFFF, byteD5: 0x80, byteD7: 0x80, bank: 0x7E },
  { gate: 0xFFFE, objectWord: 0, byteD5: 0xFF, bank: 0x7F },
];
const probes = fixtures.map(fixture => {
  const base = fixture.bank * 65536, physical = fixture.bank === 0x7E || fixture.bank === 0x7F;
  const writeWindows = [...(fixture.gate ? [[physical ? base + 0x1E8 : 0x7E01E8, physical ? base + 0x1E9 : 0x7E01E9]] : []),
    ...(physical ? [[base + 0x2000, base + 0x43FF]] : [])];
  const data = createRenderData({ writeWindows });
  data.seed(base + 0x1E8, [fixture.gate & 255, fixture.gate >>> 8]);
  data.seed(base + 0x1D5, [fixture.byteD5]);
  data.seed(base + 0x1D8, [fixture.objectWord & 255, fixture.objectWord >>> 8]);
  if (fixture.objectWord) data.seed(base + 0x1D7, [fixture.byteD7]);
  const plan = prepareRenderC06B({ data, ...declaredInputs, bank: fixture.bank, ioMode: physical ? null : 'record-requests' });
  if (!plan.handled || !data.commit(plan).handled) throw Error(JSON.stringify(plan));
  return { fixture, writeWindows, ...plan };
});
await writeFile('analysis/render-c06b-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows[0], scope: 'Seven explicitly synthetic gate/OAM/DBR/stack/write fixtures. Original140/55 code is separate. Manual ordered requests or physical WRAM registeroffset stores only; no device execution, DMA advance/completion, OAM latch or frame binding.',
  declaredInputs, probes }, null, 2) + '\n');
console.log('C06B: seven synthetic zero/three-source/OAM/physical-bank probes; atomic ordered requests only.');
