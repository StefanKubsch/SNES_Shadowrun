import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const mode = { e: 0, m: 0, x: 0 };
const windows = [[0x808238, 0x8082BC], [0x8185FE, 0x818686], [0x818686, 0x8186E5], [0x8186E5, 0x818701]];
const blocks = windows.map(([entry, end]) => {
  const instructions = [];
  for (let pc = entry; pc < end;) {
    const ins = decode(bytes, pc, mode);
    if (ins.next > end || ['REP', 'SEP', 'PLP', 'XCE', 'TCD', 'PLD', 'SED', 'JML', 'JSR', 'RTI'].includes(ins.mnemonic)) throw Error('Helper mode/control contract needs renewed analysis');
    if (ins.mnemonic === 'PLB' && entry !== 0x808238) throw Error('Unexpected callee DBR write');
    instructions.push(ins); pc = ins.next;
  }
  return { entry, initialState: mode, instructions, stop: 'Complete static routine window; all local branch/call targets covered, no machine code executed' };
});
const instructions = new Map(blocks.flatMap(b => b.instructions.map(i => [i.cpu, i])));
const edges = [];
for (const block of blocks) for (const ins of block.instructions) {
  if (ins.target !== undefined) {
    if (!instructions.has(ins.target)) throw Error('Uncovered helper edge');
    edges.push({ from: cpuLabel(ins.cpu), kind: ins.mnemonic, to: cpuLabel(ins.target) });
  }
  if (!['RTS', 'RTL', 'JMP', 'BRA'].includes(ins.mnemonic) && !instructions.has(ins.next)) throw Error('Uncovered fallthrough');
}
const calls = edges.filter(e => e.kind === 'JSL');
if (calls.map(e => e.to).join(',') !== '81:86E5,81:86E5,81:85FE,81:8686') throw Error('Helper call graph changed');
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next), covered_bytes: raw.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const accesses = [...instructions.values()].filter(i => ['LDA', 'LDX', 'LDY', 'ADC', 'SBC', 'CMP', 'CPY', 'ORA', 'STA', 'STX', 'STY', 'STZ'].includes(i.mnemonic) && ['dp', 'abs', 'absx', 'absy', 'longx'].includes(i.mode)).map(i => ({
  from: cpuLabel(i.cpu), instruction: i.mnemonic, operand: i.operand, width_bytes: 2,
  operation: ['STA', 'STX', 'STY', 'STZ'].includes(i.mnemonic) ? 'write' : 'read',
  bank_contract: i.mode === 'dp' ? 'D=0; bank00 low WRAM' : i.mode === 'longx' ? 'Explicit long bank' : 'DBR=7E inside helper; high tables are WRAM, not bank81 ROM'
}));
const callerInstructions = [];
for (let pc = 0x80ABC1; pc < 0x80ABE6;) { const i = decode(bytes, pc, mode); callerInstructions.push(i); pc = i.next; }
const caller = { entry: 0x80ABC1, initialState: mode, instructions: callerInstructions, stop: 'Complete8238 caller continuation; exits ABE6 outside this window' };
const report = {
  rom_sha256: metadata.rom_sha256,
  scope: 'Complete static8238 graph including shared86E5/85FE/8686 and its ABC1-ABE5 caller continuation. Every source/control target covered. Native8238 and caller reactions are implemented with explicit WRAM sources and atomic combined8133/8238 body plans. No instructions executed.',
  routines: blocks.map(describe), caller: describe(caller), edges, accesses,
  entry_contract: 'E0M0X0, D=0, binary arithmetic, X=game-slot offset. AB9D has already written wrapped second-coordinate sum;6B holds its old value. Earlier first-axis8133 caller effects on0E28/0ED8/0DD0/1458 must be retained. Saves Y/DBR, establishes DBR7E, restores them and X from3E. Shared callees preserve width/D/DBR with balanced stacks.',
  preparation: {
    source_fields: ['0ED8', '7E:43A0', '0E80', '7E:4348', '7E:42F0', '0E28', '7E:4240', '7E:4298', '1458'],
    words: '3E=slot;3B=0;1D=0ED8>>>2;20=wrapped(1D+43A0);1A=wrapped((0E80>>>2)+4348);17=wrapped((0E80>>>2)+42F0);11=wrapped((0E28>>>2)+4240);14=wrapped((0E28>>>2)+4298). Every sum has freshCLC.',
    indices: '29=(17&03C0)>>>1;23=(11&03C0)>>>5;38=23 OR29;26=(14&03C0)>>>5;2F=26 OR29. Visit2F first, then38 only if38!=2F. Both indices even and at most01FE.',
    difference_from_8133: 'Not a swap of coordinate names: use the low second-axis bound17 for both indices and vary first-axis11/14. Writes26/2F instead of2C/32; old2C/32 remain untouched. Preparation read/write order differs too.',
    original_slot54_example: 'After first-axis8133 A0 and the second addition:0E28=330,0E80=1496,0ED8=272. Known extents4240=FFFE,4298=2,42F0=FFFE,4348=2,43A0=5 produce1D=68,20=73,1A=376,17=372,29=160,11=80,23=2,38=162,14=84,26=2,2F=162. First required source7E:DF4E. Native body uses this preparation; explicit synthetic negative heads complete the sourced82BC continuation too, with atomic live writes.'
  },
  shared_search_contract: {
    source: 'Same pinned86E5/85FE/8686 bytes as8133. For each selected index visit first listDEAC before secondE0AC. Read nodesEF3C/F79C and six record wordsE2AC..E2B6 in bank7E, metadata7F:E214+(record>>>2), optional0CC2. Negative heads/next nodes terminate; no original bounds/cycle guard.',
    records: 'Reject unless14>=field0,11<=field3,1A>=field1,17<=field4,20>=field2,1D<=field5. Candidate=field5-1D; candidate>=3B proceeds, equality included.',
    first_list: 'Conditional68=record. Zero metadata accepts candidate. Nonzero requires(flags&3)==3 and field0<=(0E28>>>2)<field3,field1<=(0E80>>>2)<field4,1D>=field2; accepts forced0040, which can replace a larger prior candidate.',
    second_list: 'Metadata equal3E skips self before reading0CC2. Otherwise metadata equal0CC2 with(flags&3)==3 skips; all other cases accept candidate. Does not write68.',
    data_policy: 'Actual WRAM bytes remain required; no ROM substitution or invented empty heads. Unknown/out-of-window reads and cycles must fail before any live body/helper write. Conditional fields/reads/68 preserve original short-circuit order.'
  },
  return_contract: 'Restores DBR/Y, reloadsX=3E,A=3B. A0 returnsSEC; every nonzero word returnsCLC. No Boolean result conversion.',
  caller_contract: 'ABC4 Carry1 keeps new0E80. Carry0/A1..4 adds4*A to current0ED8 modulo65536 and zeroes0DD0; secondASL supplies Carry0 toADC. Carry0/A>=5 restores0E80 from saved6B and sets1458 bit0008. JoinsABE6 for third-axis logic and final0F30; first-axis effects remain in place.',
  side_effects: {
    scratch_words: ['11', '14', '17', '1A', '1D', '20', '23', '26', '29', '2F', '38', '3B', '3E', '68'],
    writes: 'Only these scratch WORDs inside helper graph;68 conditional. No2C/32 writes, no slot/list/record/6B/workspace/D9 scratch writes. Caller separately writes0E80/0ED8/0DD0/1458; future integration must merge exact writes with earlier8133 scratch without erasing untouched keys.'
  },
  implementation: { helper: 'proof/state/slot-motion-helper-8238.mjs', shared_search: 'proof/state/slot-motion-search.mjs', binding: 'slots.stepMotionHelper8238(offset) commits only exact helper scratch writes and returns original value/carry. slots.stepMotion supplies post-addition0E80 and earlier8133 effects, applies all ABC4 caller branches and merges only written scratch words after complete body preflight.',
    probe: 'Original252/217 waits after D9. No sources requires7E:DF8E; explicit8133-only heads next require7E:DF4E. Synthetic negative heads for both tables complete8133/8238/82BC, yielding330/1496/1725,0DD0=1453,0F30=913,6B=272. Additional0DD0=1 fixture keeps both original horizontal motions/flags0061 and permits330/1496/272,0DD0=0,0F30=913,6B=272. Earlier8133 scratch2C=224/32=226 retained;8238 sets26=2/2F=162. Tasks/workspace/heap/D9 scratch unchanged.' },
  boundaries: ['Native8238 and caller integration require explicit WRAM bytes; no original list initialization or collision data invented', 'Original WRAM list initialization remains open', '80B2 source and native helper/caller integration are supplied;81B4 source is fully pinned in motion-helper-81b4.json; native81B4 helper/caller integration is supplied;C9E0 source is fully pinned in motion-helper-c9e0.json; native C9E0 integration with atomic cross-state planning is supplied; Prelude81:8799 source contract is pinned in motion-prelude-8799.json; native atomic prelude binding is supplied; AC2F complete static source is pinned in motion-postpass-ac2f.json; native bounded manual AC2F binding is supplied; native atomic manual AFC4 supplied; complete DE94 static source/return contract pinned in motion-prefix-de94.json; native bounded manual DE94 and atomic DE94/AFC4 composition supplied; selected original writer contracts pinned in motion-prefix-writers.json; native88 atomic six-WORD reset supplied; gate8000 local source pinned in motion-gate-8000.json; external callees source-required; A4BF local body,A44D andtime helpers pinned in motion-transition-a4bf.json; BCB2/BE5B/FA3E andAD92 local source pinned in motion-reset-bcb2.json; nextA9B2/9F49 render source; full starter/render and pointer lifecycle remain open. Automatic main-loop orchestration and main-loop/frame gates remain separate work.82BC source and native integration are supplied']
};
await writeFile('analysis/motion-helper-8238.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/motion-helper-8238.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete8238 graph under E0M0X0/D0/binary arithmetic. DBR7E makes high tables WRAM.\n; Shared list searches match the pinned8133 graph. No machine code executed.\n\n` + [...blocks, caller].map(formatBlock).join('\n'));
console.log(`8238 helper graph: ${blocks.reduce((n, b) => n + describe(b).covered_bytes, 0)} bytes, ${edges.length} control edges, ${calls.length} covered calls.`);
