import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, hex } from './rom.mjs';
import { inspectScriptTables } from './scripts.mjs';
import { disassembleBlock, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw new Error('Wrong European ROM revision');
const inventory = inspectScriptTables(bytes);
const entries = [0x80AAAF, 0x80AAC7, 0x80AADF, 0x80AADD, 0x80AB09,
  0x80A985, 0x80A991, 0x80A9FA, 0x80AA0C, 0x80AA1E, 0x80AA30, 0x80AA4B,
  0x80D15C, 0x80D163, 0x80D16C];
// Roots, conditional targets and true call continuations only. A985 is fully
// covered below and has no mode changes; its short-call returns preserve M/X.
const blocks = entries.map(entry => disassembleBlock(bytes, entry, { e: 0, m: 0, x: 0 }, 256));
const ranges = [
  { name: 'helper_A985', start: 0x80A985, end: 0x80AA4C },
  { name: 'native_6A', start: 0x80AAAF, end: 0x80AB0A },
  { name: 'native_D2', start: 0x80D15C, end: 0x80D16D },
];
const instructions = new Map();
for (const block of blocks) for (const ins of block.instructions) {
  const previous = instructions.get(ins.cpu);
  if (previous && !previous.raw.equals(ins.raw)) throw new Error('Conflicting instruction boundary');
  instructions.set(ins.cpu, ins);
}
const coverage = ranges.map(range => {
  const covered = new Set();
  for (const ins of instructions.values()) if (ins.cpu >= range.start && ins.cpu < range.end) {
    for (let address = ins.cpu; address < ins.next; address++) {
      if (address >= range.end || covered.has(address)) throw new Error('Overlapping or escaping instruction');
      covered.add(address);
    }
    if (ins.target !== undefined && !instructions.has(ins.target)) throw new Error('Uncovered branch/call target');
  }
  if (covered.size !== range.end - range.start) throw new Error('Incomplete routine byte coverage');
  return { name: range.name, start: hex(range.start), end_exclusive: hex(range.end), byte_length: covered.size };
});
const helper = [...instructions.values()].filter(ins => ins.cpu >= 0x80A985 && ins.cpu < 0x80AA4C);
if (helper.some(ins => ['JSR', 'JSL', 'REP', 'SEP', 'PLP', 'XCE'].includes(ins.mnemonic))) throw new Error('Unexpected helper mode/control effect');
for (const [id, address, count] of [[0x6A, 0x80AAAF, 2], [0xD2, 0x80D15C, 3]]) {
  const profile = inventory.native_functions[id];
  if (profile.argument_words !== count || profile.return_bytes !== 0) throw new Error('Unexpected native ABI');
  // Read the pointer table too; inventory provenance validates its source.
  if (bytes.readUInt16LE(0x157B8 + id * 2) !== (address & 0xFFFF)) throw new Error('Unexpected native pointer');
}
const report = {
  rom_sha256: metadata.rom_sha256, scope: 'Static source boundary. All bounded 6A and D2 paths including A985 are implemented; see docs/reference/slots.md#slotaktion-6a. No invented field/table semantics.',
  coverage,
  source_blocks: blocks.map(block => ({ entry: hex(block.entry), stop: block.stop, references: block.references, machine_bytes: Buffer.concat(block.instructions.map(ins => ins.raw)).toString('hex').toUpperCase() })),
  native_6A: {
    ...inventory.native_functions[0x6A],
    equality_path: 'Compare old 1198+slot with argument 1; equality returns at AB09 without writes or further field reads.',
    mutation_order: 'If different, write argument 1 to 1198+slot before reading 10E8+slot. Later data/source boundaries cannot be confused with a source-level rollback.',
    cases: ['10E8=0 or >=0080: read 1038; FFFF returns. Otherwise scratch 0002=1038 & 7FFF, write 1038=FFFF, call A985, branch AB09.', '0001<=10E8<0080: pointer 0008=1090, 000A=008C; byte at 11F0 becomes oldByte - ROM[8C:pointer+old1198] + ROM[8C:pointer+new1198] modulo 256, then 7E:4030=0080 and 1140=FFFF. Y stays 16-bit during the byte path.'],
  },
  helper_A985: {
    equality_path: 'Compare input 0002 with 1038+slot; equality jumps to AA4B without writes.',
    lookup: 'X=(2*definition)&FFFF; long read at 8C:ED8A+X. Pointer=(tableWord + ((2*input0002)&FFFF) + original input bit15)&FFFF, because ASL supplies carry to ADC.',
    second_carry: 'After indirect pointer read, ADC #0008 retains carry from the previous tableWord ADC; pointer1090=(indirectWord+8+previousCarry)&FFFF. Do not replace with unconditional +8.',
    data_reads: 'Indirect pointer/table data and bytes at offsets 0..7 plus byte at pointer1090+1198; original word loads remain two-byte reads even when later AND 00FF uses only the low byte.',
    fields: ['1038', '1090', '11F0', '7E:4088', '10E8', '7E:3FD8', '1248', '7E:4240', '7E:4298', '7E:42F0', '7E:4348', '7E:43A0', '7E:4030', '1140'],
    bytes: 'Byte 1 XOR 0080 for 10E8. Bytes 3..6 sign-extend to words; byte 7 stays unsigned. Field/table gameplay meanings remain unassigned.',
    scratch: 'Writes words 0000,0002,0004,0006,0008,000A. Full helper preserves E/M/X; no further calls. Final carry depends on comparison of byte 6 with 0080.',
  },
  native_D2: {
    ...inventory.native_functions[0xD2],
    order: 'Save original 0004 and original 0000, call A985, restore 0000=original slot and 0002=original 0004, then call 6A, RTS. Original 0002 is not restored; 0004 is not restored either.',
  },
  boundaries: ['1198/10E8/11F0 and related source fields are not universally initialized by existing A9/initializer data.', 'A9 definition asset starts at 8C:EFB4; new assets/slot-action-data.json and fixed Bank-8C provider now cover the pointer/data window separately. 6A, A985 and D2 data-reading paths are integrated.', 'CPU long-index and indirect addressing must be reduced to explicit data reads with correct bank/word boundaries, not a generic machine bus.', 'All bounded 6A/D2 paths and A985 helper are implemented. Unknown source fields retain the pending request.'],
};
await writeFile('analysis/slot-actions.asm.txt', (`; European ROM SHA-256 ${metadata.rom_sha256}\n; Static listings with explicit E0/M0/X0 entries. A985 has complete byte coverage and preserves modes.\n\n` + blocks.map(formatBlock).join('\n')).trimEnd() + '\n');
await writeFile('analysis/slot-actions.json', JSON.stringify(report, null, 2) + '\n');
console.log('Static source coverage: complete 6A, A985 and D2; bounded 6A, D2 and A985 paths implemented separately.');
