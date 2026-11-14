import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const mode = { e: 0, m: 0, x: 0 };
const windows = [[0x8080B2, 0x808133], [0x8185FE, 0x818686], [0x818686, 0x8186E5], [0x8186E5, 0x818701]];
const readBlock = (entry, end) => {
  const instructions = [];
  for (let pc = entry; pc < end;) {
    const ins = decode(bytes, pc, mode);
    if (ins.next > end || ['REP', 'SEP', 'PLP', 'XCE', 'TCD', 'PLD', 'SED', 'JML', 'RTI'].includes(ins.mnemonic)) throw Error('Helper mode/control contract needs renewed analysis');
    instructions.push(ins); pc = ins.next;
  }
  return { entry, initialState: mode, instructions, stop: 'Complete explicit static window; no machine instructions executed' };
};
const blocks = windows.map(([entry, end]) => readBlock(entry, end));
const instructions = new Map(blocks.flatMap(b => b.instructions.map(i => [i.cpu, i])));
const edges = [];
for (const block of blocks) for (const ins of block.instructions) {
  if (ins.mnemonic === 'JSR' || (ins.mnemonic === 'PLB' && block.entry !== 0x8080B2)) throw Error('Unexpected helper call or callee DBR write');
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
// Skip the alternate8133 caller bytes AB6A-AB80; retain the shared restore
// tail reached from80B2. The original full body is already separately pinned.
const callerBlocks = [[0x80AB38, 0x80AB6A], [0x80AB81, 0x80AB8F]].map(([entry, end]) => readBlock(entry, end));
const report = {
  rom_sha256: metadata.rom_sha256,
  scope: 'Complete static80B2 graph including source-identical86E5/85FE/8686 and two caller windows AB38-AB69,AB81-AB8E. Every helper source/control target covered; caller exits to known alternate8133 or remaining motion. No machine instructions executed. Native80B2 and its caller integration are supplied with explicit WRAM sources and complete body-plan preflight; see docs/reference/movement.md#80b2.',
  routines: blocks.map(describe), caller_windows: callerBlocks.map(describe), edges, accesses,
  entry_contract: 'E0M0X0, D=0, binary arithmetic, X=game-slot offset. AB46 has already written the wrapped first-coordinate addition;6B holds its old value. Nonzero motion and flags0040 with Carry0 from the addition select80B2 atAB53; no signed direction test. Saves Y/DBR, establishes DBR7E, restores them and X from3E. Shared callees preserve widths/D/DBR with balanced local stacks.',
  preparation: {
    source_fields: ['0ED8', '7E:43A0', '0E28', '7E:4240', '7E:4298', '0E80', '7E:42F0', '7E:4348', '1458'],
    words: '3E=slot;3B=0;1D=0ED8>>>2;20=wrapped(1D+43A0);11=wrapped((0E28>>>2)+4240);14=wrapped((0E28>>>2)+4298);17=wrapped((0E80>>>2)+42F0);1A=wrapped((0E80>>>2)+4348). Every sum uses freshCLC.',
    indices: '26=(14&03C0)>>>5;29=(17&03C0)>>>1;2F=26 OR29;2C=(1A&03C0)>>>1;35=26 OR2C. Both indices even0..01FE. Visit35 before2F, skipping2F iff equal35.',
    difference_from_8133: 'Use upper first-axis bound14 for both indices, rather than8133 lower first bound11. Writes26/2F/35 instead of23/32/38.2C is still written. First-axis extent read order4240 before4298 reverses8133. Not a sign test or coordinate-name swap.',
    difference_from_82bc: 'No nonzero early exit between distinct indices. The second complete86E5 call is mandatory even if the first produced nonzero3B; it can replace that result.3B is initialized only once before both calls;35 is prepared before searching.'
  },
  shared_search_contract: {
    source: 'Pinned shared86E5/85FE/8686 bytes match8133/8238/82BC. Each index searches first list7E:DEAC then second7E:E0AC. Nodes7E:EF3C/F79C contain record and next offsets. Six record WORDs7E:E2AC..E2B6, metadataWORD7F:E214+(record>>>2), optionalWORD7E:0CC2. Negative heads/next offsets terminate. No original bounds/cycle guard.',
    records: 'Unsigned rejection order14<field0,field3<11,1A<field1,field4<17,20<field2,field5<1D. Candidate=field5-1D; continue iff candidate>=3B, including equality. Unknown later record bytes are not required after earlier rejection.',
    first_list: 'Eligible candidates write68=record. Zero metadata accepts candidate. Nonzero metadata requires(flags&3)==3, field0<=(0E28>>>2)<field3,field1<=(0E80>>>2)<field4,1D>=field2 and then writes0040 instead of candidate. May replace a larger prior result. Failed checks skip.',
    second_list: 'Metadata equal3E skips self before reading0CC2. Otherwise equal0CC2 with(flags&3)==3 skips; other cases accept candidate. Does not write68.',
    data_policy: 'Require explicit known WRAM bytes; no bank81 ROM substitution or invented empty heads. Unknown/out-of-window/cyclic traversals must fail before host live writes, including at the second index after a first hit.'
  },
  return_contract: 'Restores DBR/Y, reloadsX=3E andA=3B. A0 returnsSEC; every nonzero word returnsCLC. Epilogue recomputesCarry after any equalityCPY; result is a word, not a Boolean.',
  caller_contract: 'AB56 Carry1 keeps updated0E28. Carry0/A1..4 runs twoASLs, ADC current0ED8 with Carry0 from secondASL, writes wrapped height and zeroes0DD0. Carry0/A>=5 branches toAB81, restores0E28 from6B and sets1458 bit0008. JoinsAB8F for second/third phases; no0D20 change. Later motion writes final6B and0F30 separately.',
  side_effects: {
    scratch_words: ['11', '14', '17', '1A', '1D', '20', '26', '29', '2C', '2F', '35', '3B', '3E', '68'],
    writes: 'Only these scratchWORDs inside helper graph;68 conditional. No23/32/38 writes. No slot/list/record/6B/workspace/D9 scratch writes. Caller separately writes0E28/0ED8/0DD0/1458 and initial6B. Native plans must merge only actual writes with any subsequent8238/82BC helpers.'
  },
  implementation: { helper: 'proof/state/slot-motion-helper-80b2.mjs', shared_search: 'proof/state/slot-motion-search.mjs', binding: 'slots.stepMotionHelper80B2(offset) commits only exact helper scratch writes and returns original value/carry. slots.stepMotion selects80B2 on first-additionCarry0, supplies updated0E28, applies all AB56 caller reactions and commits slot/6B/helper writes only after complete body preflight.',
    probe: 'Explicit synthetic first-motion4 with synthetic negative heads permits the full80B2/8238/82BC body:488/1496/1725,0DD0=1453,0F30=992,6B=272 at flags0061. Original tasks/waits/heap/workspace unchanged; no scene/frame claim.' },
  boundaries: ['Native80B2 helper and caller integration require explicit WRAM sources; no collision result invented', 'Original WRAM list initialization remains open; no scene/collision result established', '81B4 source is fully pinned in motion-helper-81b4.json; native81B4 helper/caller integration is supplied;C9E0 source is fully pinned in motion-helper-c9e0.json; native C9E0 integration with atomic cross-state planning is supplied; Prelude81:8799 source contract is pinned in motion-prelude-8799.json; native atomic prelude binding is supplied; AC2F complete static source is pinned in motion-postpass-ac2f.json; native bounded manual AC2F binding is supplied; native atomic manual AFC4 supplied; complete DE94 static source/return contract pinned in motion-prefix-de94.json; native bounded manual DE94 and atomic DE94/AFC4 composition supplied; selected original writer contracts pinned in motion-prefix-writers.json; native88 atomic six-WORD reset supplied; gate8000 local source pinned in motion-gate-8000.json; external callees source-required; A4BF local body,A44D andtime helpers pinned in motion-transition-a4bf.json; BCB2/BE5B/FA3E andAD92 local source pinned in motion-reset-bcb2.json; nextA9B2/9F49 render source; full starter/render and pointer lifecycle remain open;Automatic main-loop orchestration and complete main-loop/frame contracts remain separate work']
};
await writeFile('analysis/motion-helper-80b2.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/motion-helper-80b2.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete80B2 graph under E0M0X0/D0/binary arithmetic. DBR7E makes high tables WRAM.\n; Two unique indices35/2F, no early nonzero exit. No machine instructions executed.\n\n` + [...blocks, ...callerBlocks].map(formatBlock).join('\n'));
console.log(`80B2 helper graph: ${blocks.reduce((n, b) => n + describe(b).covered_bytes, 0)} bytes, ${edges.length} control edges, ${calls.length} covered calls; caller ${callerBlocks.reduce((n, b) => n + describe(b).covered_bytes, 0)} bytes.`);
