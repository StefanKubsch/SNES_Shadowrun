import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuToOffset, cpuLabel } from './rom.mjs';
const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const window = (address, length) => {
  const offset = cpuToOffset(address, bytes.length), raw = bytes.subarray(offset, offset + length);
  return { address, sourceCpu: cpuLabel(address), sourceRomOffset: offset,
    sha256: createHash('sha256').update(raw).digest('hex'), bytes: [...raw] };
};
await writeFile('assets/render-ab2c-data.json', JSON.stringify({ format: 'shadowrun-e-render-ab2c-data-v1',
  romSha256: metadata.rom_sha256, sources: [window(0x95F160, 368), window(0x95F140, 48)] }) + '\n');
console.log('Extracted AB2C channel0 original368/48 bytes with overlap16; no WRAM/device hydration.');
