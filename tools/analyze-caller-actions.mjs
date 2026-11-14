import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, hex } from './rom.mjs';
import { inspectScriptTables } from './scripts.mjs';
import { disassembleBlock, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw new Error('Wrong European ROM revision');
const inventory = inspectScriptTables(bytes);
const roots = [
  [0x80D14A, 0, 0],
  [0x80CA15, 0, 0], [0x80CA3A, 0, 0], [0x80A959, 0, 0], [0x80A963, 0, 0], [0x80A96D, 0, 0], [0x808521, 0, 0], [0x80855D, 0, 0],
  [0x81EF47, 0, 0], [0x80C560, 0, 0], [0x80C588, 1, 1], [0x80C58C, 0, 0],
];
// C58C restores the entry's saved PHP profile through PLP, not an inferred
// callee profile. 855D is independently reached by AC's taken branches;
// no return modes/effects of the separate 81:EF47 call are inferred here.
const blocks = roots.map(([entry, m, x]) => disassembleBlock(bytes, entry, { e: 0, m, x }, 128));
const ranges = [
  { nativeId: 0x83, start: 0x80D14A, end: 0x80D15C },
  { nativeId: 0xCF, start: 0x80CA15, end: 0x80CA20 },
  { nativeId: 0x02, start: 0x80CA3A, end: 0x80CA49 },
  { nativeId: 0x4F, start: 0x80A959, end: 0x80A963 },
  { nativeId: 0x50, start: 0x80A963, end: 0x80A96D },
  { nativeId: 0x51, start: 0x80A96D, end: 0x80A977 },
  { nativeId: 0xAC, start: 0x808521, end: 0x80855E },
  { nativeId: 0x63, start: 0x80C560, end: 0x80C58D },
];
const instructions = new Map();
for (const block of blocks) for (const ins of block.instructions) {
  const previous = instructions.get(ins.cpu);
  if (previous && !previous.raw.equals(ins.raw)) throw new Error('Conflicting instruction boundary');
  instructions.set(ins.cpu, ins);
}
const coverage = ranges.map(({ nativeId, start, end }) => {
  const covered = new Set();
  for (const ins of instructions.values()) if (ins.cpu >= start && ins.cpu < end) {
    for (let address = ins.cpu; address < ins.next; address++) {
      if (address >= end || covered.has(address)) throw new Error('Overlapping or escaping instruction');
      covered.add(address);
    }
    if (ins.target !== undefined && ins.target >= start && ins.target < end && !instructions.has(ins.target)) throw new Error('Missing taken branch target');
  }
  if (covered.size !== end - start) throw new Error('Incomplete native body coverage');
  const native = inventory.native_functions[nativeId];
  if (native.cpu_address !== `${hex(start >>> 16, 2)}:${hex(start & 0xFFFF, 4)}`) throw new Error('Native pointer mismatch');
  return { ...native, start: hex(start), end_exclusive: hex(end), covered_bytes: covered.size };
});
const report = {
  rom_sha256: metadata.rom_sha256,
  scope: 'Complete static bytes of 83/CF/02/4F/50/51/AC/63 bodies. Direct slot word writes, known slot field reads, CF, workspace-covered 02 and bounded no-helper AC are native JavaScript data actions; other WRAM, AC external callee and 63 register reads remain boundaries.',
  coverage,
  source_blocks: blocks.map(block => ({ entry: hex(block.entry), stop: block.stop, references: block.references, machine_bytes: Buffer.concat(block.instructions.map(ins => ins.raw)).toString('hex').toUpperCase() })),
  native_CF: { effect: '1458+slot = old1458 OR argument1; no scratch writes, no membership guard, no further reads/calls.', source: '80:CA15-CA1F' },
  native_83: { source: '80:D14A-D15B', effect: 'Copy argument1/2/3 words directly to0E28/0E80/0ED8+slot. No scaling, 0F30 update, old-field reads, membership guard, scratch writes or further calls. All four argument workspace words remain unchanged.' },
  native_02: { source: '80:CA3A-CA48', effect: 'X=word13A8+slot; read WORD at7E:0001+X, AND00FF, store return WORD to0000. No slot writes.', boundary: 'Only reads fully inside the supplied live 16-byte task workspace are currently covered; both read bytes must be known. A9 pointer=0 aliases argument word0 high and workspace word1 low. No wrapping long address or separate fictitious zero record.' },
  native_4F: { source: '80:A959-A962', effect: 'Read word0E28+slot, logical LSR twice, write result to0000. No slot writes, no membership guard or further calls. Return is0..3FFF; A9 field=(firstArgument*4)&FFFF, so A9-created slot returns firstArgument&3FFF.' },
  native_50: { source: '80:A963-A96C', effect: 'Read word0E80+slot, logical LSR twice, write result to0000. Return is0..3FFF; A9-created slot returns secondArgument&3FFF. No slot writes or further calls.' },
  native_51: { source: '80:A96D-A976', effect: 'Read word0ED8+slot, logical LSR twice, write result to0000. Return is0..3FFF; A9-created slot returns thirdArgument&3FFF. No slot writes or further calls.' },
  native_AC: {
    writes: 'X=(word1FB0+2)&FFFF; word1FB0=X; word[1FB2+X]=argument0 before branch. Operand is not proven to require a game slot.',
    first_entry: 'If X=0, word1FCC=word7E3C11>>>3; word1FCA=FFFF. If 1FD6 bit0 is set and 1CDE!=6, write1FCA=1CDE then call81:EF47.',
    callee_boundary: '81:EF47 writes1CDE=A=6 and calls81:F25A. Complete EF47/F25A/F1FA with actualcallees now supplied inanalysis/render-ef47.json:428 bytes/213 instructions,22/19/15 protected stackbytes. Native audio compositions and AC caller integration remain pending; no audio execution or acknowledgment inferred. Direct AC return is80:855D RTS.',
    alias_boundary: '1FB2+X can overlap the cursor or other fields and may leave a proposed bounded data window; no queue length, slot type or capacity invented.',
  },
  native_63: {
    source: 'PHP, SEP30, two byte-table reads at80:C58D with byte indices, XOR7E1C76/77, byte output0000/0001; hardware reads2137/213C/213D; update byte1CE8, PLP then RTS.',
    update: 'Final byte = outputHigh XOR hardware213D; if equal to old1CE8 increment modulo256, then store1CE8.',
    boundaries: 'Reads at2137/213C/213D have no supplied data source in the current port. Their register semantics are not reconstructed by this static body listing. No random output or CPU/PPU emulator substituted.',
  },
};
await writeFile('analysis/caller-actions.asm.txt', (`; European ROM SHA-256 ${metadata.rom_sha256}\n; Static body listings. External AC call effects remain unproved; 63 PLP restores saved entry mode.\n\n` + blocks.map(formatBlock).join('\n')).trimEnd() + '\n');
await writeFile('analysis/caller-actions.json', JSON.stringify(report, null, 2) + '\n');
console.log('Static native bodies: 83 18 bytes, CF 11 bytes, 02 15 bytes, 4F/50/51 10 bytes each, AC 61 bytes, 63 45 bytes; uncovered data/call/register effects remain explicit.');
