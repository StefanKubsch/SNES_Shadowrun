import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, hex } from './rom.mjs';
import { disassembleBlock, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw new Error('Wrong European ROM revision');
const roots = [0x80A4BF, 0x80A44D, 0x80A4D4, 0x80A3B6, 0x80A3C4, 0x80A426, 0x80A446,
  0x818701, 0x81874B, 0x81840E, 0x818755, 0x81877B, 0x80A58B];
const blocks = roots.map(entry => disassembleBlock(bytes, entry, { e: 0, m: 0, x: 0 }, 160));
const bank = blocks.find(block => block.entry === 0x80A44D);
if (bank.instructions[0].mnemonic !== 'ASL' || bank.stop !== 'RTS boundary' || bank.instructions.at(-1).state.m !== 0 || bank.instructions.at(-1).state.x !== 0 || bank.instructions.some(ins => ['PLP', 'JSR', 'JSL', 'XCE'].includes(ins.mnemonic))) throw new Error('Bank helper proof changed');
const tableOffset = 0x6929D;
const report = {
  rom_sha256: metadata.rom_sha256,
  scope: 'Source pointer data slices; not execution of the full scene loader. Complete bank helper entry found atA44D, including its ASL before the old A44E prefix.',
  table_selection: '80:A4BF saves selectionn to7E2DE2, three ASL and ADC7E2DE2 retaining carry from the final ASL. X=((n*8)&FFFF)+n+((n>>>13)&1), modulo65536; readWORD at8D929D+X into86.',
  bank_selection: 'JSRA44D atA4D1 withA=raw table word. ASL in word mode replaces carry with original bit15, SEP20/LDA99/ADC0 forms99+(raw>>>15) under explicit binaryADC (decimal flag0). Writes bank bytes88/0CDC/9F/9C/F5/FE. REP20/RTS returnsE0M0X0 and preservesX.',
  pointer_word: 'A4D4 loads8000 thenTSB86. Thus86=(raw|8000); base=((99+(raw>>>15))<<16)|(raw|8000). Both resulting source windows are ROM:99/9A upper halves.',
  selection_zero: { status: 'Explicit data probe only; does not identify the scene of the synthetic252/217 orchestration.', table_cpu: '8D:929D', table_rom_offset: hex(tableOffset), table_bytes: bytes.subarray(tableOffset, tableOffset + 9).toString('hex').toUpperCase(), raw_word: bytes.readUInt16LE(tableOffset), base_cpu: '99:8000' },
  pointer9A: 'A3B6 readsWORD86+4 masked to byte, startsY=5 and consumes six bytes per object. Creation callA835 is enclosed inPHY/PLY. A446 storesWORD9A=(86+Y)&FFFF; bank9C already shares the bank helper result. Original object/task/list effects are not executed by the extracted-data provider.',
  pointer9D: '81:8701 readsWORD9A+Y masked to byte, consumes twelve bytes per record and, if saved inputA!=0, two additional bytes. The local helper840E usesPHY/PLY and no calls, so it preservesY and returnsE0M0X0. At877B after the firstA=0 call,9D=(9A+Y)&FFFF. Full8756 graph includes other callees (84DE) whose effects/lifecycle remain a scene-loading boundary.',
  pointerF3: 'A58B readsWORD9D masked to byte, computes14*count, SEC/ADC9D adds one, storesWORD F3. A59E readsWORD F3 masked to byte and advances its low word by14*count+1, preserving bankF5. Both full read words are required. No low-word overflow is propagated into F5.',
  data_window: { windows: ['99:8000-FFFF', '9A:8000-FFFF'], rom_offset: '0C8000', byte_length: 65536, boundary: 'Lower bank halves and other banks remain unavailable. Long-indexed WORD reads cannot collapse bank boundaries into contiguous extracted bytes.' },
  boundaries: ['Selection and full scene lifecycle of synthetic252/217 are not established.', 'Provider derives F3 only from an explicitly supplied9D source; it never guesses9D or initializes a scene.', 'A835 game creation, graphics/audio/loading callees and global shared scratch are not executed by this data derivation.'],
  source_blocks: blocks.map(block => ({ entry: hex(block.entry), stop: block.stop, references: block.references, machine_bytes: Buffer.concat(block.instructions.map(ins => ins.raw)).toString('hex').toUpperCase() })),
};
await writeFile('analysis/target-pointer.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/target-pointer.asm.txt', (`; European ROM SHA-256 ${metadata.rom_sha256}\n; Bounded pointer slices. OnlyA44D bank-helper return mode is claimed here; full scene/callee graph is not executed.\n\n` + blocks.map(formatBlock).join('\n')).trimEnd() + '\n');
console.log('Bank helperA44D, table source and bounded9D-to-F3 derivation established; complete scene loading remains outside this source slice.');
