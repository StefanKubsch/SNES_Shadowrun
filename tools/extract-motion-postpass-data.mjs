import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom } from './rom.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const frames = bytes.subarray(0xD8000, 0xE8000), table = bytes.subarray(0x2EB4, 0x2FC4);
const digest = value => createHash('sha256').update(value).digest('hex');
await writeFile('assets/motion-postpass-data.json', JSON.stringify({ format: 'shadowrun-e-motion-postpass-data-v1',
  romSha256: metadata.rom_sha256, sourceCpuWindows: ['9B:8000-FFFF', '9C:8000-FFFF'], sourceRomOffset: '0D8000',
  dataSha256: digest(frames), bytes: [...frames], tableCpu: '80:AEB4', tableRomOffset: '002EB4',
  tableSha256: digest(table), tableBytes: [...table] }) + '\n');
console.log('Extracted65536 original9B/9C bytes and272 original tablebytes; no pointer,cursor or scene initialised.');
