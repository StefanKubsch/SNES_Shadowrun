import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom } from './rom.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw new Error('Wrong European ROM revision');
const window = bytes.subarray(0xC8000, 0xD8000);
const asset = { format: 'shadowrun-e-slot-target-data-v1', romSha256: metadata.rom_sha256,
  sourceCpuWindows: ['99:8000-FFFF', '9A:8000-FFFF'], sourceRomOffset: '0C8000',
  dataSha256: createHash('sha256').update(window).digest('hex'), bytes: [...window] };
await writeFile('assets/slot-target-data.json', JSON.stringify(asset) + '\n');
console.log(`Extracted${window.length} original F3 target-window bytes; no pointer or scene initialized.`);
