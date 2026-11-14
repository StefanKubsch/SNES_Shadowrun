import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createOriginalRenderData } from '../proof/render/original-data.mjs';
import { seedOriginalAF1FData } from '../proof/render/original-af1f-data.mjs';
import { prepareRenderA9B2 } from '../proof/render/a9b2.mjs';
const unpackAsset = JSON.parse(await readFile('assets/render-unpack-data.json', 'utf8'));
const af1fAsset = JSON.parse(await readFile('assets/render-af1f-data.json', 'utf8'));
const probes = [];
for (const [row, s] of [[60, 0], [61, 5]]) {
  const data = createOriginalRenderData(unpackAsset, { writeWindows: [[0x7E23A0, 0x7E2ADF]] }); seedOriginalAF1FData(data, af1fAsset);
  for (const [a, v] of [[0x7E01FE, 0xFF40], [0x7E01F4, 0x81], [0x7E1D61, 1], [0x7E2DE6, 0], [0x7E3C00, row], [0x7E33DE, s]])
    data.seed(a, [v & 255, v >>> 8]);
  const plan = prepareRenderA9B2({ data, bank: 0x80, status: 0, emulation: 0, directPage: 0,
    stackWindow: [0x1F00, 0x1FFF], divisionMode: 'stable-native' });
  if (!plan.handled || !data.commit(plan).handled) throw Error(JSON.stringify(plan));
  const output = Uint8Array.from({ length: 1856 }, (_, i) => {
    const r = data.readByte(0x7E23A0 + i); if (!r.available) throw Error('Unknown output'); return r.value;
  });
  probes.push({ declaredFixtures: { row, s, firstGate: 1, secondGate: 0, sourceOffset: 0xFF40, sourceBankWord: 0x81,
    divisionMode: 'stable-native', stackWindow: [0x1F00, 0x1FFF], writeWindow: [0x7E23A0, 0x7E2ADF] },
    outcome: plan.outcome, a: plan.a, x: plan.x, y: plan.y, bank: plan.bank, status: plan.status,
    work: plan.work, af1f: plan.af1f, outputSha256: createHash('sha256').update(output).digest('hex'),
    scratchBytes: data.snapshot().bytes.filter(([a]) => a >= 0x7E00A2 && a <= 0x7E00A9) });
}
await writeFile('analysis/render-af1f-native.json', JSON.stringify({ romSha256: unpackAsset.romSha256,
  scope: 'Atomic native A9B2/activeAF1F with original ROM sources and declared WRAM/arithmetic fixtures. Division requests/results are native host plans; no device I/O, DMA/NMI or scene execution.', probes }, null, 2) + '\n');
console.log('Native activeAF1F probes:original0740 source; explicit row60/s0 and row61/s5 fixtures, no I/O execution.');
