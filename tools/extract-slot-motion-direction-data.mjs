import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { createSlotMotionDirectionData } from '../proof/state/slot-motion-direction-data.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const asset = { format: 'shadowrun-e-slot-motion-direction-data-v1', romSha256: metadata.rom_sha256,
  sourceCpu: '80:C7CC', sourceRomOffset: '0047CC',
  scope: 'Four original eight-WORD tables. Native reads require explicit inherited DBR00/80; other ROM banks select different bytes. No scene/frame/bank initialization supplied.',
  bytes: Array.from(bytes.subarray(0x47CC, 0x480C)) };
createSlotMotionDirectionData(asset);
await writeFile('assets/slot-motion-direction-data.json', JSON.stringify(asset) + '\n');
console.log('64 original C9E0 direction-table bytes exported.');
