import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const mode = { e: 0, m: 0, x: 0 };
const windows = [[0x818799, 0x818861], [0x8180F7, 0x8183FB], [0x81846E, 0x8184CF]];
const readBlock = (entry, end) => {
  const instructions = [];
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, mode);
    if (i.next > end || ['REP', 'SEP', 'PLP', 'XCE', 'TCD', 'PLD', 'SED', 'RTI'].includes(i.mnemonic)) throw Error('Prelude mode contract needs renewed analysis');
    if (i.mnemonic === 'PLB' && ![0x81879D, 0x81879E, 0x81885F].includes(pc)) throw Error('Unexpected DBR change');
    instructions.push(i); pc = i.next;
  }
  return { entry, initialState: mode, instructions, stop: 'Complete explicit source window; CFG/stack/return contracts checked separately; no machine instructions executed' };
};
const blocks = windows.map(([entry, end]) => readBlock(entry, end));
const all = new Map(blocks.flatMap(b => b.instructions.map(i => [i.cpu, i])));
const edges = [];
for (const i of all.values()) {
  if (i.target !== undefined) {
    if (!all.has(i.target)) throw Error('Uncovered prelude edge');
    edges.push({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) });
  }
  if (!['RTL', 'JMP', 'BRA'].includes(i.mnemonic) && !all.has(i.next)) throw Error('Uncovered prelude fallthrough');
}
if (edges.filter(e => e.kind === 'JSL').map(e => e.to).join(',') !== '81:80F7,81:846E') throw Error('Prelude call graph changed');
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next), covered_bytes: raw.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const caller = readBlock(0x80AFC4, 0x80AFFC);
const accesses = [...all.values()].filter(i => ['LDA', 'LDX', 'LDY', 'ADC', 'ORA', 'CPY', 'STA', 'STX'].includes(i.mnemonic)
  && ['dp', 'abs', 'absx', 'absy', 'longx'].includes(i.mode)).map(i => ({
    from: cpuLabel(i.cpu), instruction: i.mnemonic, operand: i.operand, width_bytes: 2,
    operation: ['STA', 'STX'].includes(i.mnemonic) ? 'write' : 'read',
    bank_contract: i.mode === 'dp' ? 'D=0: bank00 low WRAM; shared WORD scratch'
      : i.mode === 'longx' ? 'Explicit long WRAM bank7F; WORD metadata, no alignment inference'
        : 'DBR7E set by wrapper: WRAM, not same-address Bank81 ROM' }));
const report = {
  rom_sha256: metadata.rom_sha256,
  scope: 'Complete static81:8799 prelude and two transitive helpers:1069 bytes,13 edges,two JSL calls; full56-byte AFC4 caller. No further helper or indirect call in the prelude. Native bounded prelude planning and manual binding are supplied; no CPU execution or implicit frame integration.',
  routines: blocks.map(describe), caller_windows: [describe(caller)], edges,
  caller_edges: caller.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
  accesses,
  entry_contract: 'E0M0X0,D=0,binary arithmetic. Wrapper saves incoming DBR, sets DBR7E through PEA7E7E/two PLB, restores incoming DBR before RTL. Helpers inherit DBR7E and preserve it, D and widths. Full main-loop entry contract and actual incoming DBR remain separate; prelude does not establish DBR00/80 for later C9E0 tables.',
  reset_80F7: {
    writes: 'LDAFFFF followed by256 WORD STA at7E:E0AC,E0AE,...,E2AA, then RTL. Only second-list heads are reset; no first-list DEAC reset, no node/record/metadata reset.',
    order: 'Always runs before DEAA read or14B0 sign test. Even a negative/empty active list therefore clears512 bytes, reads7E:DEAA and writes DP A0. A0 is not reset to an inferred zero.',
  },
  active_list: {
    order: 'Read7E:DEAA -> DP A0. Load14B0 into X; negative returns after reset/A0. Otherwise DP20=0A74, visit14B2+X descending by2. Read1458+Y first; only bit0100 set reads43A0+Y; only nonzero43A0 builds a record. Bit0400 is not tested by this prelude.',
    limits: 'Source has no alignment,44-slot window,duplicate-active-entry,capacity or unknown-data guard. Native host must bound/validate only actual reads and writes before committing. Do not treat supplied fixtures as original scene contents.',
    preserved: 'No writes to14B0/14B2,game-slot fields orDEAA. Loop PHX saves active-list cursor; after846E restores record X, PLY retrieves cursor for metadata and TYX restores cursor before DEX/DEX.',
  },
  records: {
    start_offset: '0A74', stride_bytes: 12,
    sources: 'Logical WORD quarter coordinates a=0E28>>2,b=0E80>>2,c=0ED8>>2; five extent WORDs4240/4298/42F0/4348/43A0; each addition starts with CLC and wraps16 bits.',
    fields: [
      { address: '7E:E2AC+record', field: 0, value: 'wrap(a+4240)' },
      { address: '7E:E2AE+record', field: 1, value: 'wrap(b+42F0)' },
      { address: '7E:E2B0+record', field: 2, value: 'c' },
      { address: '7E:E2B2+record', field: 3, value: 'wrap(a+4298)' },
      { address: '7E:E2B4+record', field: 4, value: 'wrap(b+4348)' },
      { address: '7E:E2B6+record', field: 5, value: 'wrap(c+43A0)' },
    ],
    write_order: [0, 1, 2, 5, 3, 4],
    metadata: 'After846E and DP20=wrap(record+000C), logical record>>2 indexes explicit7F:E214. Write game-slot offset reloaded from14B2+saved cursor. WORD at record0A74 uses metadata offset029D, an odd address; next record advances metadata by3 bytes. No byte truncation or even-address guard.',
    consumers: 'These are the same six-field records and metadata read by85FE/8686 in native motion search. The rebuilt heads are its second list E0AC. First-list DEAC scene initialization remains open, including current missing7E:DF8E.',
  },
  indices: {
    formulas: 'h(v)=(v AND03C0)>>5, encoded by three ASL/XBA; t(v)=(v AND03C0)>>1. DP3E=h(f0),41=h(f3),44=t(f1),47=t(f4);50=3E OR44,53=41 OR47,56=41 OR44,59=3E OR47. Four even indices0..01FE.',
    selection: '846E always inserts50. If50==53 return; otherwise insert53. If53==56 OR53==59 return; otherwise insert56 then59. Constructed horizontal/vertical bitfields give1,2 or4 distinct corner heads; no full rectangle/intermediate-cell enumeration.',
  },
  insert_846E: {
    order: 'Save record X -> DP4D. X=DP A0,Y=selected head index. WORD writes EF3C+X=record; F79C+X=old E0AC+Y; E0AC+Y=X; INX twice. Repeat only selected corner steps. Final STX A0 then LDX4D restores record X; RTL. Same-head repeated slots read the most recently written head, producing prepend order.',
    persistence: 'A0 advances by2 per inserted node and is not written back toDEAA. Only second-list heads/used nodes/used records/used metadata are overwritten; remaining data bytes stay unchanged. Head reset makes stale second-list nodes unreachable unless later source writes reconnect them.',
  },
  returns: {
    helper_80F7: 'A=FFFF; X/Y and Carry unchanged; no local stack effect; DBR/D/widths unchanged; RTL.',
    helper_846E: 'X restored record, Y last selected index, A last inserted node offset. Carry comes from last CPY:1 on any equality exit; on four-insert path unsigned53>=59. INX/LDX/STX preserve that Carry. DP A0 is advanced node offset; RTL.',
    wrapper: 'Incoming DBR restored; no status restore or defined boolean success. X=initial14B0 if negative, otherwise descending loop final negative cursor. Y/A depend on skipped or selected last entries. If any record selected, final Carry is bit1 of its record offset after the two LSR at884C/884D; for bounded0A74+12*k it is0. If none selected, Carry inherited. N/Z finally come from restored DBR via PLB, not a scene-ready result.',
    caller: 'AFC8 reloads14B0 and ignores prelude A/X/Y/Carry. First AB26 pass sees rebuilt second-list WRAM and prior incoming DBR, skips1458 bit0400. Then DP40=008C and mandatory second AC2F pass. Main-loop gates8000/CC4B remain separate; complete DE94 source/return contract is pinned in motion-prefix-de94.json, native bounded manual DE94 and atomic DE94/AFC4 composition are supplied; selected writer contracts pinned in motion-prefix-writers.json; other writers and full lifecycle remain open; native manual postpassAC2F is supplied; native manual AFC4 is supplied; no browser-frame success.',
  },
  side_effects: {
    scratch_words: ['A0', '20', '1A', '3E', '1D', '44', '50', '41', '47', '53', '56', '59', '4D'],
    shared_search_scratch: ['1A', '1D', '20', '3E'],
    byte_alias: 'WORD DP41 writes bytes41/42, overwriting high byte of WORD DP40 while its bank BYTE40 remains unchanged. AFC4 later writes WORD008C atDP40 before postpass. Track exact byte knowledge if this WORD/pointer owner is exposed; do not claim DP40 WORD preserved.',
    preserves: 'No own game-slot,6B,search68,D9 A2/A5/A8/AB/AE/B1/B4/B7/BA,task0C62 or argumentworkspace00..0F writes. Other scratch words remain explicit aliases, including20 record cursor andA0 node cursor; cannot silently keep them in a disconnected owner.',
  },
  implementation: {
    plan: 'proof/state/slot-motion-prelude-8799.mjs prepares complete data/scratch writes; slots.stepMotionPrelude8799 commits through the existing motionData byte owner only after every read/write is covered',
    sources: 'motionData explicitly includes7E:DEAA/DEAB without initialization; active entries and fields come from the existing slot owner. writePreludeWords validates its complete dedicated write batch before any byte change; planner also rejects base-bank crossings even into another allowed numeric window.',
    aliases: 'Shared search words20/1A/1D/3E retain one owner. Additional preludeScratchWords and scratchWord40Bytes preserve WORD41/highWORD40 alias, including unknown lowBYTE40 and later explicit WORD40 hydration. Existing node/record/metadata consumers read the same bytes; odd/in-window column overlaps retain ordered writes without invented table capacity.',
    probe: 'Original252/217 synthetic orchestration with explicitDEAA0020: slot54 flags0061 skipped, slot56 originalA368/height24 selects record0A74=[121,454,64,127,460,88], metadata0056, headindex00E2=node0020, A0=0022,20=0A80. Additional synthetic0100/height1 for54 gives firstrecord metadata0054, then0056 at0A80, node0022->0020, A0=0024,20=0A8C. Wait checks/workspace/heap unchanged; first-list7E:DF8E remains unknown unless explicitly seeded.',
  },
  boundaries: [
    'Native bounded81:8799 plan with shared active-list/fields,motion-data bytes and scratch plus explicit7E:DEAA source is supplied. AC2F complete static source is pinned in motion-postpass-ac2f.json; native bounded manual AC2F binding is supplied; native atomic manual AFC4 supplied; complete DE94 static source/return contract pinned in motion-prefix-de94.json; native bounded manual DE94 and atomic DE94/AFC4 composition supplied; selected original writer contracts pinned in motion-prefix-writers.json; native88 atomic six-WORD reset supplied; gate8000 local source pinned in motion-gate-8000.json; external callees source-required; A4BF local body,A44D andtime helpers pinned in motion-transition-a4bf.json; BCB2/BE5B/FA3E andAD92 local source pinned in motion-reset-bcb2.json; nextA9B2/9F49 render source; full starter/render and pointer lifecycle remain open',
    'Missing active-list/field/node-base/byte windows and capacity/alias limits must stop before every live head/record/node/metadata/scratch write, including the256-head reset',
    'This supplies dynamic second-list initialization, not first-list DEAC scene contents or originalDEAA writer; no fabricated empty first list',
    'Automatic main-loop orchestration, main-loop gates and callerDBR, original C9E0 target/timer/tasklink initialization, scene/frame/audio/display remain open',
  ],
};
await writeFile('analysis/motion-prelude-8799.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/motion-prelude-8799.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete static prelude graph:1069 bytes,13 edges,two calls;56-byte caller.\n; DBR7E WRAM inside wrapper; incoming DBR restored. No CPU execution.\n\n` + [...blocks, caller].map(formatBlock).join('\n'));
console.log('Prelude8799:1069 bytes,13 edges,two calls,256 second-list head writes and56 callerbytes recorded; native manual binding supplied, native atomic manual AFC4 supplied; complete DE94 static source/return contract pinned in motion-prefix-de94.json; native bounded manual DE94 and atomic DE94/AFC4 composition supplied; selected original writer contracts pinned in motion-prefix-writers.json; native88 atomic six-WORD reset supplied; gate8000 local source pinned in motion-gate-8000.json; external callees source-required; A4BF local body,A44D andtime helpers pinned in motion-transition-a4bf.json; BCB2/BE5B/FA3E andAD92 local source pinned in motion-reset-bcb2.json; nextA9B2/9F49 render source; full starter/render and pointer lifecycle remain open.');
