import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createOriginalRenderData } from '../proof/render/original-data.mjs';
import { seedOriginalAA9CData } from '../proof/render/original-aa9c-data.mjs';
import { seedOriginalAF1FData } from '../proof/render/original-af1f-data.mjs';
import { prepareRenderAA9C } from '../proof/render/aa9c.mjs';
const unpack = JSON.parse(await readFile('assets/render-unpack-data.json', 'utf8'));
const loader = JSON.parse(await readFile('assets/render-aa9c-data.json', 'utf8'));
const af1f = JSON.parse(await readFile('assets/render-af1f-data.json', 'utf8'));
const writeWindows = [[0x7E0214, 0x7E0215], [0x7E01F4, 0x7E01F5], [0x7E01FE, 0x7E01FF], [0x7E23A0, 0x7E2ADF]];
const probes = [];
for (const active of [false, true]) {
  const data = createOriginalRenderData(unpack, { writeWindows }); seedOriginalAA9CData(data, loader);
  data.seed(0x214, [255, 255]); data.seed(0x1D61, [Number(active), 0]);
  if (active) {
    seedOriginalAF1FData(data, af1f); data.seed(0x7E2DE6, [0, 0]);
    data.seed(0x7E3C00, [60, 0]); data.seed(0x7E33DE, [0, 0]);
  }
  const declaredInputs = { request: 0, bank: 0x80, status: 0, emulation: 0, directPage: 0,
    stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests', divisionMode: active ? 'stable-native' : null };
  const plan = prepareRenderAA9C({ data, ...declaredInputs });
  if (!plan.handled || !data.commit(plan).handled) throw Error(JSON.stringify(plan));
  const output = Uint8Array.from({ length: 1856 }, (_, i) => {
    const r = data.readByte(0x7E23A0 + i); if (!r.available) throw Error('Unknown converted byte'); return r.value;
  });
  probes.push({ declaredInputs: { ...declaredInputs, writeWindows, cache: 0xFFFF, firstGate: Number(active),
    secondGate: active ? 0 : null, row: active ? 60 : null, s: active ? 0 : null },
    outcome: plan.outcome, a: plan.a, x: plan.x, y: plan.y, bank: plan.bank, status: plan.status,
    carry: plan.carry, overflow: plan.overflow, index: plan.index, work: plan.work,
    firstUnpack: plan.firstUnpack, ioWrites: plan.ioWrites, palette: plan.palette, second: plan.second,
    outputSha256: createHash('sha256').update(output).digest('hex') });
}
await writeFile('analysis/render-aa9c-native.json', JSON.stringify({ romSha256: loader.romSha256,
  scope: 'Manual atomic native AA9C with original index0/0050/0740/palette sources and explicit cache/gate/row/stack/write fixtures. Ordered register-write metadata only, no actual DMA/CGRAM execution or scene/frame binding.',
  probes }, null, 2) + '\n');
console.log('AA9C original index0 native plan: first80, palette6, second1856; zero/active AF1F fixtures, request metadata only.');
