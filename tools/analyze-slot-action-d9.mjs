import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, hex, cpuLabel } from './rom.mjs';
import { inspectScriptTables } from './scripts.mjs';
import { disassembleBlock, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw new Error('Wrong European ROM revision');
const native = inspectScriptTables(bytes).native_functions[0xD9];
if (native.cpu_address !== '80:8D4E' || native.argument_words !== 2 || native.return_bytes !== 2) throw new Error('D9 native ABI changed');
const helper = disassembleBlock(bytes, 0x808D95, { e: 0, m: 0, x: 0 }, 256);
const helperInstructions = new Map(helper.instructions.map(ins => [ins.cpu, ins]));
// Prove the local callee's mode at every conditional edge before decoding
// D9's post-call continuation. This is static source validation, no CPU run.
if (helper.stop !== 'RTS boundary') throw new Error('Helper lacks covered return');
for (const ins of helper.instructions) {
  if (['JSR', 'JSL', 'JMP', 'JML', 'BRA', 'BRL', 'PLP', 'RTI', 'RTL', 'XCE', 'PLD', 'TCD', 'PLB', 'SED'].includes(ins.mnemonic)) throw new Error('Helper mode proof needs renewed analysis');
  let { e, m, x } = ins.state;
  if (['SEP', 'REP'].includes(ins.mnemonic)) {
    const value = ins.mnemonic === 'SEP' ? 1 : 0;
    if (ins.value & 0x20) m = value;
    if (ins.value & 0x10) x = value;
  }
  if (ins.mnemonic === 'RTS') {
    if (e || m || x) throw new Error('Helper does not return native entry mode');
    continue;
  }
  for (const address of [ins.next, ...(ins.target === undefined ? [] : [ins.target])]) {
    const next = helperInstructions.get(address);
    if (!next || next.state.e !== e || next.state.m !== m || next.state.x !== x) throw new Error('Uncovered or conflicting helper mode edge');
  }
}
const blocks = [disassembleBlock(bytes, 0x808D4E, { e: 0, m: 0, x: 0 }, 128),
  helper, disassembleBlock(bytes, 0x808D75, { e: 0, m: 0, x: 0 }, 128)];
const candidates = [disassembleBlock(bytes, 0x80A44E, { e: 0, m: 0, x: 0 }, 128),
  disassembleBlock(bytes, 0x80A58B, { e: 0, m: 0, x: 0 }, 128)];
const instructions = new Map(blocks.flatMap(block => block.instructions.map(ins => [ins.cpu, ins])));
const coverage = [[0x808D4E, 0x808D7F], [0x808D95, 0x808E36]].map(([start, end]) => {
  const covered = new Set();
  for (const ins of instructions.values()) if (ins.cpu >= start && ins.cpu < end) {
    for (let address = ins.cpu; address < ins.next; address++) {
      if (address >= end || covered.has(address)) throw new Error('Overlapping source instruction');
      covered.add(address);
    }
    if (ins.target !== undefined && !instructions.has(ins.target)) throw new Error('Uncovered call or branch target');
  }
  if (covered.size !== end - start) throw new Error('Incomplete source body');
  return { start: hex(start), end_exclusive: hex(end), covered_bytes: covered.size };
});
const describe = block => ({ entry: hex(block.entry), stop: block.stop, references: block.references,
  machine_bytes: Buffer.concat(block.instructions.map(ins => ins.raw)).toString('hex').toUpperCase() });
const report = {
  rom_sha256: metadata.rom_sha256, native, coverage,
  scope: 'Complete static D9 body and local helper, with every taken helper branch and mode-preserving return proved. Bounded target provider and pure native motion calculation are implemented; native slot/workspace and shared scratch integration are implemented with explicit F3 hydration. Original scene lifecycle remains a separate task.',
  arithmetic_contract: {
    implementation: 'proof/state/slot-target-motion.mjs; no CPU/register bus or device state.',
    manufacturer_sources: ['https://gamingdoc.org/wp-content/uploads/2021/02/book1.pdf#page=82', 'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf'],
    division: 'Nintendo BookI printed2-15-1: unsigned16/8 quotient at4214/4215 after16 machine cycles, zero divisor producesFFFF.',
    completed_read_bounds: 'WDC table5-7 and notes:17 full cycles before8DF2 EOR;15 before8E0F/8E2C EOR, plus3 fetch cycles before each absolute low-byte data read. Every routine-local read is after16 cycles. No asynchronous device overlap is simulated.',
    data_source: 'Target-pointer report provesA44D ASL and callerA4BF/TSB86. slot-target-data.mjs covers99/9A upper halves and derivesF3 only from explicit9D; it does not load a scene.',
  },
  helper_mode: { entry: 'E0 M0 X0', return: 'E0 M0 X0', further_calls: 0,
    branch_edges: helper.instructions.filter(ins => ins.target !== undefined).map(ins => ({ from: cpuLabel(ins.cpu), to: cpuLabel(ins.target), mode: `E${ins.state.e} M${ins.state.m} X${ins.state.x}` })) },
  argument_index: 'Clear word0004. Let n=argument1, a=(n*8)&FFFF, first=(a-n)&FFFF and c=(a>=n). Y=(first-n-(c?0:1)+1)&FFFF. The second SBC retains the first subtraction carry; this is not universally (6*n+1)&FFFF.',
  data_reads: 'Three WORD reads at longPointerF3+Y, with 16-bit Y incremented by2 between reads. Each loaded word is shifted left twice modulo65536 and written toB4/B7/BA. PointerF3 comprises bytesF3/F4/F5; DBR does not replace its bank.',
  helper_differences: 'Y=argument0. For B4-0E28,Y; B7-0E80,Y; BA-0ED8,Y: SEC each, wrapped WORD subtraction, test result bit15. Negative result gets EORFFFF/INC and sign wordA8/AB/AE=FFFF; otherwise sign=0. Save first two magnitudes toA2/A5, third to4204.',
  helper_sum: 'CLC, ADC first magnitude then ADC second magnitude retaining carry, WORD result then four logical shifts. INC0004; D9 has cleared it so it becomes1 and skips the optional fifth shift. Full zero result becomes1. Write low byte to4206 and full word to0000; write logical half toB1.',
  register_sequence: 'Write WORD4204 with third magnitude, BYTE4206 with low byte0000, then read WORD4214. Repeat with first and second magnitudes. Each4214 read is XORed with its sign word; if bit15 is set increment modulo65536. Store results in0DD0/0D20/0D78+Y respectively. D9 then addsB1 to0DD0+Y modulo65536 usingCLC.',
  workspace: '0000 becomes the full divisor-derived word, 0002 retains argument1, 0004 becomes1; words3..7 are untouched. ScratchA2/A5/A8/AB/AE/B1/B4/B7/BA also change. No fictitious profile-only return acknowledgement.',
  candidate_pointer_writes: {
    status: 'Candidates found from raw85F3/85F5 patterns in ROM000000..01FFFF, then decoded under explicit listed modes. This does not prove their caller graph, execution before217, DBR/D or loaded data.',
    bank_prefix: '80:A44E-A463 executesSEP20 thenA=99 plus incoming carry, writes BYTEF5 (also88/0CDC/9F/9C/FE), REP20, RTS. It does not establish an unconditional fixed bank99.',
    word_prefix: '80:A58B-A5C5 underE0M0X0 readsWORD[$9D] masked to byte, derives pointerF3 using SEC/ADC9D after 14*count, readsWORD[$F3] masked to byte and advances F3 likewise. It next derivesFC from another count and callsBABB. Pointer9D bytes and read data are not supplied; bank propagation and the callers remain source tasks.',
    source_blocks: candidates.map(describe),
  },
  boundaries: ['Without explicit F3, original217 suspends atD9 request8 PC50 args0054,0000 returnBytes2. Explicit9D=99807E probe resumes D9=2912 and reaches waitPC54 mask1 count2912.',
    'Bounded target ROM words and explicit shared F3 are supported; original scene-derived pointer lifecycle remains unproved.',
    'Pure native arithmetic includes low-byte-zero divisor and word carries; native writes three slot columns, nine global scratch words and workspace prefix[value,index,1]. Unknown data preflights without effects. No CPU/register device emulation.',
    'Original scene initialization and caller graph for the pointer-write candidates remain unproved.'],
  source_blocks: blocks.map(describe),
};
await writeFile('analysis/slot-action-d9.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/slot-action-d9.asm.txt', (`; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete D9/helper source. Helper mode proven at all branches; pointer prefixes remain caller/data candidates.\n\n` + blocks.map(formatBlock).join('\n') + '\n; Candidate pointer prefixes only; listed incoming modes do not prove caller reachability.\n\n' + candidates.map(formatBlock).join('\n')).trimEnd() + '\n');
console.log('D9 body49 bytes and helper161 bytes fully covered; helper return mode proven. Native slot/workspace/scratch integration implemented with explicit F3. Original scene pointer lifecycle and motion consumers remain source boundaries.');
