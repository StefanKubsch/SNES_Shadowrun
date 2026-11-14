import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom } from './rom.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw new Error('Wrong European ROM revision');
const selected = bytes.subarray(0x60000, 0x68000);
const asset = {
  format: 'shadowrun-e-slot-action-data-v1', romSha256: metadata.rom_sha256,
  sourceCpu: '8C:8000', sourceRomOffset: '060000',
  scope: 'Selected ROM half-bank for A985/6A data reads. Logical table/record sizes and gameplay meanings remain unassigned; other banks and RAM/hardware are uncovered.',
  bytes: Array.from(selected),
};
const data = createSlotActionData(asset);
const report = {
  rom_sha256: metadata.rom_sha256, selected_sha256: createHash('sha256').update(selected).digest('hex'),
  window: { ...data.describe(), finalCpuByte: '8C:FFFF', finalRomByte: '067FFF', asset: 'assets/slot-action-data.json' },
  table_source: { cpu: '8C:ED8A', references: ['80:A999 ASL A', '80:A99A TAX', '80:A99E ADC 8C:ED8A,X'], note: '16-bit wrapped doubled definition index, then full long-address addition. Window is not a proven logical definition count.' },
  examples: [0, 11, 84, 153, 184, 185, 220].map(definitionWord => {
    const table = data.readDefinitionPointer(definitionWord);
    return { definitionWord, table, firstIndirectWord: table.available ? data.readDataWord(table.value) : null };
  }),
  boundaries: ['6A, A985 and D2 are integrated with exact source reads.', 'Byte and word coverage differ at the end of bank 8C; no truncated word or bank wrap is manufactured.', 'No emulator, generic CPU bus, scene initializer, rendering or inferred record semantics.'],
};
await writeFile('assets/slot-action-data.json', JSON.stringify(asset) + '\n');
await writeFile('analysis/slot-action-data.json', JSON.stringify(report, null, 2) + '\n');
console.log('32768 original Bank-8C bytes exported; bounded slot-action data provider validated.');
