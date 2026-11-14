import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const mode = { e: 0, m: 0, x: 0 };
const windows = [[0x8082BC, 0x808371], [0x8185FE, 0x818686], [0x818686, 0x8186E5], [0x8186E5, 0x818701]];
const blocks = windows.map(([entry, end]) => {
  const instructions = [];
  for (let pc = entry; pc < end;) {
    const ins = decode(bytes, pc, mode);
    if (ins.next > end || ['REP', 'SEP', 'PLP', 'XCE', 'TCD', 'PLD', 'SED', 'JML', 'JSR', 'RTI'].includes(ins.mnemonic)) throw Error('Helper mode/control contract needs renewed analysis');
    if (ins.mnemonic === 'PLB' && entry !== 0x8082BC) throw Error('Unexpected callee DBR write');
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
if (calls.map(e => e.to).join(',') !== '81:86E5,81:86E5,81:86E5,81:86E5,81:85FE,81:8686') throw Error('Helper call graph changed');
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
for (let pc = 0x80AC16; pc < 0x80AC2F;) { const i = decode(bytes, pc, mode); callerInstructions.push(i); pc = i.next; }
const caller = { entry: 0x80AC16, initialState: mode, instructions: callerInstructions, stop: 'Complete82BC caller continuation through final0F30 and RTS' };
const report = {
  rom_sha256: metadata.rom_sha256,
  scope: 'Complete static82BC graph including shared86E5/85FE/8686 and its AC16-AC2E caller continuation. Every source/control target covered. No machine instructions executed; native helper and caller implementation are documented separately in docs/reference/movement.md#82bc.',
  routines: blocks.map(describe), caller: describe(caller), edges, accesses,
  entry_contract: 'E0M0X0, D=0, binary arithmetic, X=game-slot offset. AC0B has already written the changed wrapped third-coordinate sum, which is >=0100, with0040 set.6B holds the prior third value after any earlier8133/8238 height adjustments. Preserve those earlier coordinate/flags effects. Saves Y/DBR, establishes DBR7E, restores them and X from3E. Shared callees preserve width/D/DBR with balanced stacks.',
  preparation: {
    source_fields: ['0ED8', '7E:43A0', '0E80', '7E:4348', '7E:42F0', '0E28', '7E:4240', '7E:4298', '1458'],
    words: '3E=slot;3B=0;1D=0ED8>>>2;20=wrapped(1D+43A0);1A=wrapped((0E80>>>2)+4348);17=wrapped((0E80>>>2)+42F0);11=wrapped((0E28>>>2)+4240);14=wrapped((0E28>>>2)+4298). Every sum has freshCLC.',
    indices: '2C=(1A&03C0)>>>1;29=(17&03C0)>>>1;23=(11&03C0)>>>5;26=(14&03C0)>>>5;38=23 OR29;2F=26 OR29;35=26 OR2C;32=23 OR2C. Even indices0..01FE.',
    visit_order: 'Always32 first; return immediately after86E5 ifCarry0. Then38 iff38!=32, returning immediately onCarry0. Then2F iff different from32 and38, returning immediately onCarry0. Finally35 iff different from32,38 and2F. Never require later-index data after a nonzero result. Each complete index search still visits both lists in original order.',
    original_slot54_example: 'After synthetic negative heads let8133/8238 return0:0E28=330,0E80=1496. Original third272 plus decremented0DD0=1453 gives1725.82BC preparation1D=431,20=436,1A=376,17=372,2C=160,29=160,11=80,14=84,23=2,26=2,38=162,2F=162,35=162,32=162. First source7E:DF4E; only one distinct index. The native body can complete with explicitly synthetic negative heads; no original scene collision result assumed.'
  },
  shared_search_contract: {
    source: 'Same pinned86E5/85FE/8686 bytes as8133 and8238. For each selected index visit first listDEAC before secondE0AC. Read nodesEF3C/F79C and six record wordsE2AC..E2B6 in bank7E, metadata7F:E214+(record>>>2), optional0CC2. Negative heads/next nodes terminate; no original bounds/cycle guard.',
    records: 'Unsigned comparisons and candidate=field5-1D exactly match the existing search contract. Equal candidates proceed. First-list nonzero metadata may force0040 and replace a larger candidate; second-list self/special-slot filters remain conditional.68 is written only on eligible first-list candidates.',
    difference_from_8133_8238: 'Early return is between complete index searches, not between records or lists. Calling the existing shared search once with all indices would wrongly require later bytes and could replace an earlier nonzero result. All four indices are prepared before the first search; even unvisited35 is a scratch write.',
    data_policy: 'Actual WRAM bytes remain required; no ROM substitution or invented empty heads. Unknown/out-of-window reads and cycles must fail before any live body/helper write. Conditional flags/0CC2 reads and68 preserve original short-circuit order.'
  },
  return_contract: '82BC does not reloadA or recomputeCarry in its epilogue.86E5 returnsA=3B, Carry1 iff zero. First three calls branch immediately to epilogue onCarry0. Skipped final35 exits only after an equalCPY, which preservesA=0 and setsCarry1. Final actual86E5 result passes through. PLB/PLY/LDX do not changeCarry. ThusA remains3B andCarry1 iffA0 on all returns, with X/Y/DBR restored.',
  caller_contract: 'AC19 Carry1 retains the changed third coordinate and current0DD0. Carry0 restores0ED8 from6B and zeroes0DD0, regardless of the nonzero result magnitude. No4*A increase and no0008 flag write. Both paths then calculate0F30 from the wrapped sum0E28+0E80 logically divided by2 and return.',
  side_effects: {
    scratch_words: ['11', '14', '17', '1A', '1D', '20', '23', '26', '29', '2C', '2F', '32', '35', '38', '3B', '3E', '68'],
    writes: 'Only these scratch WORDs inside helper graph;68 conditional,35 always prepared even when never searched. No slot/list/record/6B/workspace/D9 scratch writes. Caller separately may restore0ED8 and zero0DD0; final0F30 always written. Combined8133/8238/82BC plans must preserve earlier effects and merge only actual scratch writes.'
  },
  boundaries: ['Original WRAM list initialization remains open', '80B2 source and native helper/caller integration are supplied;81B4 source is fully pinned in motion-helper-81b4.json; native81B4 helper/caller integration is supplied;C9E0 source is fully pinned in motion-helper-c9e0.json; native C9E0 integration with atomic cross-state planning is supplied; Prelude81:8799 source contract is pinned in motion-prelude-8799.json; native atomic prelude binding is supplied; AC2F complete static source is pinned in motion-postpass-ac2f.json; native bounded manual AC2F binding is supplied; native atomic manual AFC4 supplied; complete DE94 static source/return contract pinned in motion-prefix-de94.json; native bounded manual DE94 and atomic DE94/AFC4 composition supplied; selected original writer contracts pinned in motion-prefix-writers.json; native88 atomic six-WORD reset supplied; gate8000 local source pinned in motion-gate-8000.json; external callees source-required; A4BF local body,A44D andtime helpers pinned in motion-transition-a4bf.json; BCB2/BE5B/FA3E andAD92 local source pinned in motion-reset-bcb2.json; nextA9B2/9F49 render source; full starter/render and pointer lifecycle remain open. Automatic main-loop orchestration and main-loop/frame gates remain separate work']
};
await writeFile('analysis/motion-helper-82bc.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/motion-helper-82bc.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete82BC graph under E0M0X0/D0/binary arithmetic. DBR7E makes high tables WRAM.\n; Per-index early exit; shared list searches match8133/8238. No machine code executed.\n\n` + [...blocks, caller].map(formatBlock).join('\n'));
console.log(`82BC helper graph: ${blocks.reduce((n, b) => n + describe(b).covered_bytes, 0)} bytes, ${edges.length} control edges, ${calls.length} covered calls.`);
