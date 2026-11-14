import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createOriginalRenderData } from '../proof/render/original-data.mjs';
import { seedOriginalAA9CData } from '../proof/render/original-aa9c-data.mjs';
import { seedOriginalAB2CData } from '../proof/render/original-ab2c-data.mjs';
import { seedOriginalAF1FData } from '../proof/render/original-af1f-data.mjs';
import { prepareRenderAB2C } from '../proof/render/ab2c.mjs';
const load = async name => JSON.parse(await readFile('assets/' + name + '.json', 'utf8'));
const unpack = await load('render-unpack-data'), aa9c = await load('render-aa9c-data');
const ab2c = await load('render-ab2c-data'), af1f = await load('render-af1f-data');
const writeWindows = [[0x7E01BE, 0x7E01BE], [0x7E01F4, 0x7E0205],
  [0x7E0212, 0x7E021D], [0x7E0226, 0x7E0245], [0x7E23A0, 0x7E2ADF]];
const probes = [];
for (const active of [false, true]) {
  const data = createOriginalRenderData(unpack, { writeWindows });
  seedOriginalAA9CData(data, aa9c); seedOriginalAB2CData(data, ab2c);
  data.seed(0x1BE, [0xA1]); data.seed(0x1D61, [Number(active), 0]);
  if (active) {
    seedOriginalAF1FData(data, af1f); data.seed(0x7E2DE6, [0, 0]);
    data.seed(0x7E3C00, [60, 0]); data.seed(0x7E33DE, [0, 0]);
  }
  const declaredInputs = { bank: 0x80, status: 0, emulation: 0, directPage: 0,
    stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests', divisionMode: active ? 'stable-native' : null };
  const p = prepareRenderAB2C({ data, ...declaredInputs });
  if (!p.handled || !data.commit(p).handled) throw Error(JSON.stringify(p));
  const output = Uint8Array.from({ length: 1856 }, (_, i) => data.readByte(0x7E23A0 + i).value);
  probes.push({ declaredInputs: { ...declaredInputs, writeWindows, byte01BE: 0xA1,
    gate1D61: Number(active), gate2DE6: active ? 0 : null, row: active ? 60 : null, s: active ? 0 : null },
    a: p.a, x: p.x, y: p.y, bank: p.bank, status: p.status, carry: p.carry,
    overflow: p.overflow, work: p.work, loader: p.loader, requests: p.requests,
    operations: p.operations, ioWrites: p.ioWrites,
    outputSha256: createHash('sha256').update(output).digest('hex') });
}
await writeFile('analysis/render-ab2c-native.json', JSON.stringify({ romSha256: ab2c.romSha256,
  scope: 'Manual atomic AB2C with original channel0/AA9C/decompressor sources and explicit synthetic 01BE/gate/row/stack/write fixtures. Shared AA9C/A9E1 byte owner and ordered requests only; no device execution, channel state, transfer completion, NMI or automatic frame binding.', probes }, null, 2) + '\n');
console.log('AB2C: shared initializer/AA9C/A9E1 plan; original channel0 source368/48, request-only ledger.');
