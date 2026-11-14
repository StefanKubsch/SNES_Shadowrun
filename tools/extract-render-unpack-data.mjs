import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuToOffset, cpuLabel } from './rom.mjs';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderUnpack9F49 } from '../proof/render/unpack-9f49.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')
  throw Error('Wrong European ROM revision');
const digest = (raw) => createHash('sha256').update(raw).digest('hex');
const window = (name, address, length) => {
  const offset = cpuToOffset(address, bytes.length),
    raw = bytes.subarray(offset, offset + length);
  return {
    name,
    address,
    sourceCpu: cpuLabel(address),
    sourceRomOffset: offset,
    sha256: digest(raw),
    bytes: [...raw],
  };
};
// Exact contiguous original read ranges, confirmed by the host plans below.
// Neither output bytes nor unknown WRAM are used to seed these sources.
const sources = [window('header0050', 0x80ff98, 21), window('header0740', 0x81ff40, 63)];
const table = window('bitLengths', 0x80a033, 256);
const asset = {
  format: 'shadowrun-e-render-unpack-data-v1',
  romSha256: metadata.rom_sha256,
  table,
  sources,
};
const reports = sources.map((source, i) => {
  const data = createRenderData({ writeWindows: [[0x7e23a0, 0x7e2adf]] });
  data.seed(table.address, table.bytes);
  data.seed(source.address, source.bytes);
  const plan = prepareRenderUnpack9F49({
    data,
    sourceOffset: source.address & 0xffff,
    sourceBankWord: i === 0 ? 0x3a80 : 0x81,
    destination: 0x23a0,
    bank: 0x80,
    status: 0,
    emulation: 0,
    directPage: 0,
    stackWindow: [0x1f00, 0x1fff],
  });
  if (!plan.handled) throw Error(JSON.stringify(plan));
  const committed = data.commit(plan);
  if (!committed.handled) throw Error('Unpack commit failed');
  const output = Uint8Array.from({ length: plan.outputBytes }, (_, j) => {
    const read = data.readByte(0x7e23a0 + j);
    if (!read.available) throw Error('Unknown output');
    return read.value;
  });
  const sourceReads = plan.readAddresses.filter(
    (a) => a >= source.address && a < source.address + source.bytes.length,
  );
  if (sourceReads.length !== source.bytes.length) throw Error('Renew exact source range');
  return {
    name: source.name,
    header: plan.header,
    sourceBytes: source.bytes.length,
    outputBytes: plan.outputBytes,
    outputSha256: digest(output),
    emittedCount: plan.emittedCount,
    bits: plan.bits,
    literals: plan.literals,
    references: plan.references,
    x: plan.x,
    y: plan.y,
    scratchBytes: data.snapshot().bytes.filter(([a]) => a >= 0x7e00db && a <= 0x7e00f2),
    readAddresses: plan.readAddresses,
  };
});
await writeFile('assets/render-unpack-data.json', JSON.stringify(asset) + '\n');
await writeFile(
  'analysis/render-unpack-original.json',
  JSON.stringify(
    {
      romSha256: metadata.rom_sha256,
      scope:
        'Manual native 9F49 plans with explicit stack protection/write window; original ROM sources, no initial WRAM, no CPU/scene/DMA/NMI execution.',
      plans: reports,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Extracted21/63 original compressed bytes and256 bit-length bytes; native outputs80/1856, no scene/transfer binding.',
);
