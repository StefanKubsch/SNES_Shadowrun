import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRender8949 } from '../proof/render/pretransfer-8949.mjs';
const source = JSON.parse(await readFile('analysis/render-a9e1.json', 'utf8'));
const writeWindows = [[0x7E0CD0, 0x7E0CD1], [0x7E0CD6, 0x7E0CD7]];
const declaredInputs = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const probes = [];
for (const [mask, gate0CD8, gate1562] of [[0, 0x8001, null], [0, 0, 0],
  ...Array.from({ length: 4 }, (_, mask) => [mask, 0, 1])]) {
  const data = createRenderData({ writeWindows });
  const words = [[0xCD8, gate0CD8], [0x1562, gate1562], [0xCD0, mask & 1 ? 0x8001 : 0],
    [0xCD6, mask & 2 ? 0xFFFF : 0], [0xCCC, 0x1111], [0xCCE, 0x2222],
    [0xCD2, 0x3333], [0xCD4, 0x4444], [0xCC4, 0x1234], [0xCC6, 0xFFFF]];
  for (const [a, v] of words) if (v !== null) data.seed(a, [v & 255, v >>> 8]);
  const p = prepareRender8949({ data, ...declaredInputs });
  if (!p.handled || !data.commit(p).handled) throw Error(JSON.stringify(p));
  probes.push({ mask, gate0CD8, gate1562, outcome: p.outcome, a: p.a, x: p.x, y: p.y,
    bank: p.bank, status: p.status, carry: p.carry, overflow: p.overflow, work: p.work,
    operations: p.operations, ioWrites: p.ioWrites, byteWrites: p.byteWrites });
}
await writeFile('analysis/render-8949-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'pretransfer8949'),
  scope: 'Manual atomic8949 with explicit synthetic gate/flag/parameter/scroll/stack/write fixtures. Ordered reached register writes only; no device execution, scroll latch, transfer completion, NMI or frame binding.',
  declaredInputs: { ...declaredInputs, writeWindows, destinations: [0x1111, 0x2222, 0x3333, 0x4444],
    scroll0CC4: 0x1234, scroll0CC6: 0xFFFF }, probes }, null, 2) + '\n');
console.log('8949: two earlygates and all four flag combinations; request-only metadata, paired scroll BYTEwrites.');
