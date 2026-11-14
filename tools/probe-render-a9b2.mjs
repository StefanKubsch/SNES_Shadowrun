import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createOriginalRenderData } from '../proof/render/original-data.mjs';
import { prepareRenderA9B2 } from '../proof/render/a9b2.mjs';

const asset = JSON.parse(await readFile('assets/render-unpack-data.json', 'utf8'));
const probes = [];
for (const [firstGate, secondGate] of [[0, null], [1, 0xFFFF]]) {
  const data = createOriginalRenderData(asset, { writeWindows: [[0x7E23A0, 0x7E2ADF]] });
  data.seed(0x7E01FE, [0x40, 0xFF]); data.seed(0x7E01F4, [0x81, 0]);
  data.seed(0x7E1D61, [firstGate, 0]); if (secondGate !== null) data.seed(0x7E2DE6, [255, 255]);
  const plan = prepareRenderA9B2({ data, bank: 0x80, status: 0, emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF] });
  if (!plan.handled || !data.commit(plan).handled) throw Error(JSON.stringify(plan));
  const output = Uint8Array.from({ length: 1856 }, (_, i) => {
    const r = data.readByte(0x7E23A0 + i); if (!r.available) throw Error('Unknown converted byte'); return r.value;
  });
  probes.push({ declaredInputs: { bank: 0x80, status: 0, sourceOffset: 0xFF40, sourceBankWord: 0x81,
    firstGate, secondGate, stackWindow: [0x1F00, 0x1FFF], writeWindow: [0x7E23A0, 0x7E2ADF] },
    outcome: plan.outcome, a: plan.a, x: plan.x, y: plan.y, bank: plan.bank, status: plan.status,
    carry: plan.carry, overflow: plan.overflow, work: plan.work, conversionWords: plan.conversionWords,
    unpack: plan.unpack, outputSha256: createHash('sha256').update(output).digest('hex') });
}
await writeFile('analysis/render-a9b2-native.json', JSON.stringify({ romSha256: asset.romSha256,
  scope: 'Manual native A9B2 with original0740 ROM stream and explicitly supplied pointer/gate/stack/write fixtures; early AF1F paths only, no scene/CPU/DMA/NMI execution.',
  probes }, null, 2) + '\n');
console.log('A9B2 native0740 probe:1856 converted bytes; explicit zero/negative AF1F fixtures, no transfer/frame binding.');
