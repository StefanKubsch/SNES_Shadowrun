import { writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderA9E1 } from '../proof/render/a9e1.mjs';

// Explicit synthetic parameters, not original WRAM/NMI observations.
const writeWindows = [[0x7E01F6, 0x7E01FD], [0x7E020A, 0x7E020D]];
const declaredInputs = { bank: 0x80, status: 0, emulation: 0, directPage: 0,
  stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests', ioRead213A: 0xC7 };
const flags = [0x1F6, 0x1F8, 0x1FA, 0x1FC], probes = [];
for (let mask = 0; mask < 16; mask++) {
  const data = createRenderData({ writeWindows });
  const values = [...flags.map((f, i) => [f, mask & (1 << i) ? 0x8001 : 0]),
    [0x20C, 0x1401], [0x20A, 0xF800], [0x20E, 0xABCD], [0x210, 0x1234]];
  for (const [address, value] of values) data.seed(address, [value & 255, value >>> 8]);
  const plan = prepareRenderA9E1({ data, ...declaredInputs });
  if (!plan.handled || !data.commit(plan).handled) throw Error(JSON.stringify(plan));
  probes.push({ mask, a: plan.a, status: plan.status, carry: plan.carry, overflow: plan.overflow,
    work: plan.work, operations: plan.operations, ioRequests: plan.ioRequests, byteWrites: plan.byteWrites });
}
await writeFile('analysis/render-a9e1-native.json', JSON.stringify({
  scope: 'Manual atomic A9E1 request ledger with explicit synthetic flag/parameter/stack/write/read fixtures; no device execution, transfer completion, NMI or automatic frame binding.',
  declaredInputs: { ...declaredInputs, writeWindows, activeFlag: 0x8001,
    size020C: 0x1401, destination020A: 0xF800, destination020E: 0xABCD, size0210: 0x1234 }, probes,
}, null, 2) + '\n');
console.log('A9E1: sixteen synthetic flag combinations; ordered requests and clears, explicit BYTE213A metadata only.');
