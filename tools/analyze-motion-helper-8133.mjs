import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, hex, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const mode = { e: 0, m: 0, x: 0 };
const windows = [[0x808133, 0x8081B4], [0x8185FE, 0x818686], [0x818686, 0x8186E5], [0x8186E5, 0x818701]];
const blocks = windows.map(([entry, end]) => {
  const instructions = [];
  for (let pc = entry; pc < end;) {
    const ins = decode(bytes, pc, mode);
    if (ins.next > end || ['REP', 'SEP', 'PLP', 'XCE', 'TCD', 'PLD', 'SED', 'JML', 'JSR'].includes(ins.mnemonic)) throw Error('Helper mode/control contract needs renewed analysis');
    if (ins.mnemonic === 'PLB' && entry !== 0x808133) throw Error('Unexpected callee DBR write');
    instructions.push(ins);
    pc = ins.next;
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
const memoryInstructions = [...instructions.values()].filter(i => ['LDA', 'LDX', 'LDY', 'ADC', 'SBC', 'CMP', 'CPY', 'ORA', 'STA', 'STX', 'STY', 'STZ'].includes(i.mnemonic) && ['dp', 'abs', 'absx', 'absy', 'longx'].includes(i.mode));
const accesses = memoryInstructions.map(i => ({ from: cpuLabel(i.cpu), instruction: i.mnemonic, operand: i.operand,
  width_bytes: 2, operation: ['STA', 'STX', 'STY', 'STZ'].includes(i.mnemonic) ? 'write' : 'read',
  bank_contract: i.mode === 'dp' ? 'D=0; bank00 low WRAM' : i.mode === 'longx' ? 'Explicit long bank' : 'DBR=7E inside helper; high tables are WRAM, not bank81 ROM' }));
const callerInstructions = [];
for (let pc = 0x80AB6A; pc < 0x80AB8F;) { const i = decode(bytes, pc, mode); callerInstructions.push(i); pc = i.next; }
const caller = { entry: 0x80AB6A, initialState: mode, instructions: callerInstructions, stop: 'Selected complete caller continuation; exits AB8F outside this window' };
const report = {
  rom_sha256: metadata.rom_sha256,
  scope: 'Complete static 8133 and its entire direct/transitive callee graph: 86E5,85FE,8686. All source bytes and control targets covered. Native standalone helper and motion-body8133 caller continuation are supplied with explicit WRAM sources and complete write-plan preflight. No CPU execution or collision result invented; original list initialization and other helper/frame contracts remain separate work.',
  routines: blocks.map(describe), caller: describe(caller), edges, accesses,
  entry_contract: 'E0M0X0, binary arithmetic, D=0, X=game-slot offset. AB46 has already written wrapped first-coordinate sum before AB6A calls8133; global6B holds its old value. 8133 saves Y/DBR, establishes DBR7E, restores them and X from scratch3E. All transitive callees preserve E/M/X-width/D/DBR and have balanced local stacks; register X/Y values may change inside them.',
  preparation: {
    source_fields: ['0E28', '0E80', '0ED8', '1458', '7E:4240', '7E:4298', '7E:42F0', '7E:4348', '7E:43A0'],
    words: '3E=slot;3B=0;1D=0ED8>>>2;20=wrapped(1D+43A0);14=wrapped((0E28>>>2)+4298);11=wrapped((0E28>>>2)+4240);17=wrapped((0E80>>>2)+42F0);1A=wrapped((0E80>>>2)+4348). Every sum has freshCLC.',
    indices: '23=((11&03C0)<<3) byte-swapped, hence (11&03C0)>>>5;29=(17&03C0)>>>1;2C=(1A&03C0)>>>1;38=23 OR29;32=23 OR2C. Call86E5 withY=32, then withY=38 only if38!=32. Both indices are even and at most01FE.',
    existing_sources: 'The five long-indexed extent fields already have known A9 zero initialization and A985 record-byte writes. They are not new unknown columns; list data is the missing source.'
  },
  dispatcher: '86E5 readsWORD7E:DEAC+Y; bit15 skips85FE, otherwise X is its node offset and Y is saved across the call. Then readsWORD7E:E0AC+Y; bit15 skips8686. Carry returns set iff3B==0. Empty heads therefore produce3B=0, but no empty original heads are assumed.',
  lists: {
    addressing: 'Both traverseWORD7E:EF3C+X for record offsets andWORD7E:F79C+X for next-node offsets. Bit15 of next offset terminates. Neither routine bounds the list nor detects cycles; a future host provider must fail closed on unknown bytes and nonterminating/out-of-window traversal.',
    records: 'RecordY has six WORD fields in7E:E2AC/E2AE/E2B0/E2B2/E2B4/E2B6+Y. Initial overlap rejects if14<field0,field3<11,1A<field1,field4<17,20<field2,field5<1D (all unsigned). Candidate=field5-1D; only candidate>=3B continues. Equality is accepted, so later equal candidates can change3B.',
    first_list: '85FE writes scratch68=recordY on eligible candidates. ReadWORD7F:E214+(recordY>>>2). Zero accepts candidate into3B. Nonzero requires(slot1458&3)==3; otherwise skip. For this branch require field0<=(0E28>>>2)<field3, field1<=(0E80>>>2)<field4 and1D>=field2; accepted candidate becomes0040 instead of the earlier difference. Failed interior checks skip.',
    second_list: '8686 readsWORD7F:E214+(recordY>>>2). Equality to3E skips self. Otherwise compareWORD7E:0CC2. If equal and(slot1458&3)==3, skip; every other case accepts the saved candidate into3B. This routine does not write68.',
    source_boundary: 'DEAC/E0AC/EF3C/F79C/E2AC..E2B6, long metadata7F:E214 and optional global0CC2 require actual WRAM source bytes; no bank81 ROM lookup supplies them. Complete initialization/lifecycle not yet derived.'
  },
  return_contract: '8133 reloadsX=3E andA=3B after restoring DBR/Y. A==0 returnsSEC; A!=0 returnsCLC. 86E5 has the same carry polarity, but8133 decides from3B again. Neither returns a Boolean inA.',
  caller_contract: 'AB6D: set carry keeps new first coordinate. Clear carry andA<5 adds4*A to0ED8 modulo65536 and zeroes0DD0. Clear carry andA>=5 restores0E28 from6B and sets1458 bit0008. ADC has carry0 from the second ASL onA0..4; no extra carry increment. All paths joinAB8F for remaining motion.',
  side_effects: { scratch_words: ['11', '14', '17', '1A', '1D', '20', '23', '29', '2C', '32', '38', '3B', '3E', '68'],
    writes: 'Only these WORD scratch locations in the entire helper graph;68 is conditional. No slot/list/record writes, no writes to6B, workspace0000..000F or D9 scratchA2/A5/A8/AB/AE/B1/B4/B7/BA. This does not exclude other engine alias writers.' },
  implementation: { helper: 'proof/state/slot-motion-helper-8133.mjs', data_provider: 'proof/state/slot-motion-data.mjs', binding: 'slots.stepMotionHelper8133(offset) commits only the successful helper scratch plan and returns original value/carry. Current coordinate fields are helper-entry data; no preceding caller addition or following motion-body continuation.',
    source_policy: 'All provider bytes start unknown; explicit seed hydration, odd-byte aliasing and full word-read knowledge. Only reads wholly inside7E:DEAC-FFFF,7F:E214-FFFF and7E:0CC2-0CC3 are covered. Out-of-window/unknown reads and cyclic chains retain all live data.',
    body_binding: 'slots.stepMotion supplies the post-addition first coordinate to8133. AB6D keeps it onCarry1, adds4*A to0ED8 and zeroes0DD0 onCarry0/A<5, otherwise restores0E28 and sets0008. Later boundaries discard all slot/6B/helper scratch plans together.',
    probe: 'Original252/217 reaches D9 wait using explicit9D probe. Body8133 needs7E:DF8E; synthetic negative heads complete8133/8238/82BC and allow330/1496/1725,0DD0=1453,0F30=913,6B=272 with original motion words/flags0061. Additional explicit0D78=0/0DD0=1 fixture permits330/1824/272,0F30=1077,6B=272 with flags0061. Tasks/workspace/heap/D9 scratch unchanged. Standalone8133 probe remains available separately. No scene/collision/frame claim.' },
  boundaries: ['No original list heads, nodes, records or metadata supplied by this static report; original initialization remains open', 'Native8133 and motion-body continuation require explicit sources; synthetic heads are not scene data', '8238 source contract and native helper/caller integration are supplied; 82BC source and native integration are supplied.80B2 source and native helper/caller integration are supplied;81B4 source is fully pinned in motion-helper-81b4.json; native81B4 helper/caller integration is supplied;C9E0 source is fully pinned in motion-helper-c9e0.json; native C9E0 integration with atomic cross-state planning is supplied; Prelude81:8799 source contract is pinned in motion-prelude-8799.json; native atomic prelude binding is supplied; AC2F complete static source is pinned in motion-postpass-ac2f.json; native bounded manual AC2F binding is supplied; native atomic manual AFC4 supplied; complete DE94 static source/return contract pinned in motion-prefix-de94.json; native bounded manual DE94 and atomic DE94/AFC4 composition supplied; selected original writer contracts pinned in motion-prefix-writers.json; native88 atomic six-WORD reset supplied; gate8000 local source pinned in motion-gate-8000.json; external callees source-required; A4BF local body,A44D andtime helpers pinned in motion-transition-a4bf.json; BCB2/BE5B/FA3E andAD92 local source pinned in motion-reset-bcb2.json; nextA9B2/9F49 render source; full starter/render and pointer lifecycle remain open. Automatic main-loop orchestration and main-loop/frame gates remain separate work']
};
await writeFile('analysis/motion-helper-8133.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/motion-helper-8133.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete transitive helper graph under E0M0X0/D0/binary arithmetic. DBR7E makes high tables WRAM.\n; PLB establishes/restores DBR only in8133. No machine code executed; no source list state assumed.\n\n` + [...blocks, caller].map(formatBlock).join('\n'));
console.log(`8133 helper graph: ${blocks.reduce((n, b) => n + describe(b).covered_bytes, 0)} bytes, ${edges.length} control edges, ${calls.length} covered calls.`);
