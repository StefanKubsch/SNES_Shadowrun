import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const mode = { e: 0, m: 0, x: 0 };
const linear = (entry, end) => {
  const instructions = [];
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, mode);
    if (i.next > end || ['REP', 'SEP', 'PLP', 'XCE', 'TCD', 'PLD', 'PLB', 'SED', 'RTI', 'BRK', 'COP'].includes(i.mnemonic)) throw Error('Postpass mode contract needs renewed analysis');
    instructions.push(i); pc = i.next;
  }
  return { entry, initialState: mode, instructions, stop: 'Complete explicit static window; CFG, local stack and returns checked separately; no instructions executed' };
};
const body = linear(0x80AC2F, 0x80ADF4);
const caller = linear(0x80AFC4, 0x80AFFC);
const all = new Map(body.instructions.map(i => [i.cpu, i]));
for (const i of all.values()) {
  if (i.target !== undefined && !all.has(i.target)) throw Error('Uncovered postpass edge');
  if (!['RTS', 'JMP', 'BRA'].includes(i.mnemonic) && !all.has(i.next)) throw Error('Uncovered postpass fallthrough');
  if (['JSR', 'JSL', 'JML'].includes(i.mnemonic) || ['ind', 'indx'].includes(i.mode)) throw Error('Unexpected postpass call or indirect control transfer');
}
const digest = raw => createHash('sha256').update(raw).digest('hex');
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next), covered_bytes: raw.length,
    sha256: digest(raw), machine_bytes: raw.toString('hex').toUpperCase() };
};
const table = bytes.subarray(cpuToOffset(0x80AEB4, bytes.length), cpuToOffset(0x80AFC4, bytes.length));
const accesses = body.instructions.filter(i => ['dp', 'abs', 'absx', 'absy', 'longx', 'dil', 'dily'].includes(i.mode) && i.mnemonic !== 'JMP').map(i => ({
  from: cpuLabel(i.cpu), instruction: i.mnemonic, operand: i.operand, width_bytes: 2,
  operation: ['INC', 'DEC', 'TSB'].includes(i.mnemonic) ? 'read_modify_write' : ['STA', 'STY', 'STZ'].includes(i.mnemonic) ? 'write' : 'read',
  bank_contract: i.mode === 'dp' ? 'D=0, bank00 low WRAM, exact shared byte aliases'
    : ['dil', 'dily'].includes(i.mode) ? '24-bit pointer from shared bank00 DP bytes; dily adds full Y; not DBR-relative'
      : i.mode === 'longx' ? 'Explicit7E base plus X'
        : [0xAEB4, 0xAEC4].includes(i.value) ? 'Incoming DBR; extracted Bank80 table applies only with DBR00/80 and in-window effective bytes'
          : 'Incoming DBR must expose actual low WRAM; indexed accesses still require actual effective byte coverage',
}));
const edges = body.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) }));
const report = {
  rom_sha256: metadata.rom_sha256,
  scope: 'Complete static80:AC2F postpass:453 bytes,196 instructions,26 control-flow edges,four RTS exits,zero calls. No direct/transitive helper or indirect control transfer. Separate56-byte AFC4 caller and272-byte adjacent table pinned. Indirect data reads are sources, not executable helpers. Native bounded manual postpass is supplied separately; no CPU execution.',
  routines: [describe(body)], caller_windows: [describe(caller)], edges,
  caller_edges: caller.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
  calls: [], accesses,
  data_windows: [{ entry: '80:AEB4', end_exclusive: '80:AFC4', covered_bytes: table.length, sha256: digest(table), machine_bytes: table.toString('hex').toUpperCase(),
    word_values: Array.from({ length: table.length / 2 }, (_, i) => table.readUInt16LE(i * 2)),
    uses: 'AD8C reads DBR:AEB4+resource X; ADAC reads DBR:AEC4+same X. These are overlapping offsets in one table, second base+0010.136 even WORDs=32*k,k0..135. No instruction bounds X; only actual bytes inside the pinned window are covered. Odd offsets are byte reads, not rounded WORD indices.' }],
  entry_contract: 'E0M0X0,D=0,binary arithmetic,X supplied game-slot byte offset,Y caller list cursor. PHY always saves incoming Y. No instruction changes widths,D or DBR. DBR exposes low WRAM; table reads retain incoming DBR and need DBR00/80 for this extracted table. Caller writes WORD40=008C, providing BYTE40=8C for long pointer3E/3F/40. Actual main-loop DBR remains open.',
  request_1140: {
    zero: '1140=0 enters normal fractional step atAC40.',
    sentinel: '1140=FFFF first STZ1140 then enters normal step; it is not a raw frame pointer or success return.',
    pending: 'Other nonzero1140: STZ1140 atACC0, preserve A=raw request, jumpACD0. Bypass fractional step,1090,3FD8,10E8,1198,11F0 reads/writes and3E write. Header/budget/allocation/output can still requeue the same raw request.',
  },
  fractional_step: {
    order: 'Read7E4088 then CLC/ADC7E4030; WORD20=wrapped sum; WORD7E4030=sum AND007F. ADC Carry survives STA/AND/STA. Advance if Carry1 OR masked!=WORD20; else PLY/RTS. Thus mathematical sum>=128 selects advance, including16-bit overflow.',
    next: 'Only advance reads1090. Zero1090 returns after fraction writes. Nonzero1090->WORD3E, then DEC7E3FD8 modulo65536 and write it. Zero initial countdown becomesFFFF and takes the ordinary11F0 path.',
    ordinary: 'Nonzero decremented countdown: read whole11F0 as Y; write11F0=wrap(Y+2), then WORD read[$3E],Y. Pointer bankBYTE40 is inherited, not rewritten by body. Exact2-byte ROM source and full24-bit addition needed; low-byte11F0 alone is insufficient.',
  },
  countdown_expired: {
    nonzero: 'Read10E8. Values1..007F reload3FD8 unchanged and preserve10E8. Values>=0080 mask007F then STZ10E8 before writing3FD8; includes0080->zero and values with upper bytes. Reload1090->WORD11; WORD13=008C; Y=1198; WORD read[$11],Y then AND00FF gives a byte-sized animation-stream offset. AtACC8 setY to that offset, write11F0=wrap(offset+2), read WORD[$3E],Y.',
    zero: '10E8=0: WORD7E4088=0;1038 OR8000. Read1350; negative returns without task read. Otherwise X=task offset, follow0372 while0BA2 negative, stop at first nonnegative status, OR0008 into its existing0C62. X stays terminal task offset on return; incomingY restored. No own task call/sweep/wait check. Source has no cycle or later-negative-link guard.',
  },
  frame_pointer: {
    order: 'Raw frame WORD r->WORD11; WORD3B=(r AND8000) XOR8000. ASL of restored r bit15 setsCarry; LDA009B/ADC0 gives bank009B+(r>>>15), written as WORD13 andWORD37. TSB11 sets8000; resulting low pointer->WORD35; WORD[$11] AND00FF ->WORD14=count n.',
    aliases: 'WORD13 initially writes bankBYTE13 andBYTE14=0. WORD14 subsequently overwrites high byte ofWORD13 plusBYTE15; pointer11 still uses onlyBYTE13. WORD37 bank is separate pointer35 bankBYTE37; its zero highBYTE38 overwrites low byte of existing searchWORD38, preservingBYTE39. WORD3E overlaps search3E and usesWORD40 lowBYTE40=8C. WORD35 overlaps existing search35; WORD20 also aliases prior motion/prelude scratch. WORD11 occupies11/12, outside argumentworkspace00..0F.',
  },
  admission: {
    output_budget: 'CLC then4*n+WORD82. Carry1 goes directlyAD05 withCarry1, bypassing CMP0050. Carry0 compares wrapped total0050; >=0050 retriesAD13, otherwise SEC thenAD05. Overflow is admitted to resource-count handling, not rejected or saturated.',
    pool_budget: 'SBC12A0 withCarry1 produces unsigned n-current and Borrow. Zero jumpsAD6D; Borrow shrinks; positive delta compared unsigned0D1C. Allocate only delta<freeCount; equality retries. Both budget retries write1140=WORD11 XORWORD3B (original raw r at this point), restoreY,RTS; earlier fractional/countdown/11F0 writes remain original effects.',
  },
  resource_pool: {
    owner: 'Same0D1C/freeCount,0D1E/freeHead,1564+node links,12A0/count and12F8/head used by81:A779 initialization,A9 and B9/AA4C. Do not duplicate the owner or repair initial64 versus63 reachable nodes. New output budgetWORD82 and tables1654/16D4/1754 need explicit sources/owners.',
    grow: 'WORD17=delta; SEC/freeCount-delta ->0D1C. Each iteration Y=freeHead; read1564+Y->freeHead; read slothead->1564+Y; Y->slothead; DEC17/BNE. After all iterations12A0=n. Read/write order defines alias behavior and prepend order.',
    shrink: 'Negate wrapped negative delta viaEORFFFF/INC ->WORD17; CLC/addfreeCount ->0D1C. Each iteration Y=slothead; read1564+Y->slothead; readfreeHead; Y->freeHead; oldfreeHead->1564+Y; DEC17/BNE. After all iterations12A0=n. Resulthead is actual lastnext, not synthetic zero.',
    equal: 'No pool or12A0 writes when n==current. No list membership/sign/alignment/capacity check is present; native coverage must bound actual accesses and ordered aliases explicitly.',
  },
  output: {
    order: 'PHX saves game slot; INC WORD11 (WORDwrap without bankcarry); Y=WORD82; X=12F8+game slot. Loop starts unconditionally. Twice per resource: INY/INY; read WORD[$11] ANDFFC0 ->16D4+Y; read sameWORD again AND003F,CLC/ADC008E ->1654+Y; read DBR:AEB4+X then DBR:AEC4+X ->1754+Y. Between the two WORDs and after second, INC11 twice. Then read1564+X->X even on last resource; DEC14/BNE. STY82; PLX restores game slot.',
    zero_count: 'No pre-loop zero test. n=0 admitted atAD6D still enters loop, DEC14 wrapsFFFF and nominally loops65536 times; no safe empty-record success follows from source. Any late coverage boundary must stop a native plan before all live writes. In hostile alias cases earlier writes can also affect later reads/loop state.',
    cursor: 'For a covered nonaliasing n>0 path, Y advances4*n modulo65536; writes at old82+2/+4,...; WORD11 advances1+4*n modulo65536 in its chosen bank, no bankbyte increment. Actual bank/address-crossing reads remain explicit source windows.',
  },
  tail: {
    order: 'AfterPLX, WORD7E3F80=WORD11 XORWORD3B; Y=3; WORD[$11],Y AND7 ->0F88. Zero skips0FE0 and35 decrement. Nonzero writes0F88 again as8000|low3bits; DEC WORD35; read WORD[$35]; if bit0080 set ORFF00, elseAND00FF; ASL twice ->0FE0. This is signed lowBYTE times4 modulo65536, with a fullWORD read at the byte before header. Then PLY/RTS.',
    limit: 'Output queue/pointer/tail writes alone do not perform DMA or establish rendering, animation timing or a real scene. The low3bits and signed offset gameplay interpretation remains a source boundary.',
  },
  returns: {
    sites: ['80:AC59', '80:ACBF', '80:AD1B', '80:ADF3'],
    register_stack: 'Every exit restores incomingY byPLY; finalN/Z follow that Y. X=game slot except actual task-chain stop atACBF, whereX=terminal task offset. Output PHX/PLX preserves game slot through resource traversal. No saved P, DBR or D is changed.',
    carry: 'AC59: no-advance equality setsCarry1; zero1090 afteradvance retains ADC overflowCarry (1) or masked-vs-sum CMP (0). ACBF: retains sameadvance Carry. AD1B: budget or positive-delta CMP retry Carry1. ADF3: finalsecond output ADC givesCarry0; zero0F88 preserves0, nonzero branch finalsecondASL Carry equals signedoffset BYTE bit7. No universal boolean success.',
    caller: 'AFC4 ignores returnedA/X/Carry;AC2F ownPHY/PLY restoresY. AFF7/AFF8 decrementY twice, BPL uses that sign; nextiteration reloadsX from14B2+Y. Thus terminaltask X is tolerated by this caller, not automatically by other callers.',
  },
  side_effects: {
    scratch_words: ['20', '3E', '11', '13', '3B', '37', '35', '14', '17', '82'],
    slot_words: ['1140', '7E:4030', '7E:3FD8', '10E8', '7E:4088', '1038', '11F0', '12F8', '12A0', '7E:3F80', '0F88', '0FE0'],
    external_writes: ['0C62+terminalTask OR0008', '0D1C', '0D1E', '1564+resourceNode', '16D4+outputY', '1654+outputY', '1754+outputY'],
    preserves: 'No direct workspace00..0F,6B,68,D9A2..BA,active14B0/14B2,game coordinates0E28/0E80/0ED8 or1458 writes. Effective-index/pointer aliases must not be mislabeled preserved if actual reached addresses overlap them.',
  },
  caller_contract: 'AFC4 calls8799, reloads14B0 and exits if negative. First pass reloadsX from14B2+Y,skips1458bit0400 and wrapsAB26 withPHY/PLY. ThenWORD40=008C, reload14B0, immediately starts second pass without a second sign/empty guard. Each entry reloadsX and skips1458bit0400; JSRAC2F then twoDEY/BPL. No additional Carry/return-value reaction. Native complete AFC4 planning establishes stable active-list coverage because supported writes cannot alias14B0/14B2; no guard is invented afterAFE6.',
  boundaries: [
    'Native bounded manual AC2F operation supplied: reuse slot count/head/freeCount/freeHead/links and heap-backed taskevent owner; exact shared scratch bytes and explicit two-byte8C/9B/9C data plus output cursor/queue/table owner; atomic preflight at late sources before any live writes',
    'Original1090/4088/10E8/1198/11F0 writers and frame record/header/trailer meaning; pointer/read coverage,resource links beyond supplied window,zero-count/aliases and main-loop DBR remain explicit',
    'Native manual AFC4 orchestration is supplied; complete static DE94 source/return contract is pinned in motion-prefix-de94.json, native bounded manual DE94 and atomic DE94/AFC4 composition are supplied; selected writer contracts pinned in motion-prefix-writers.json; other writers and full lifecycle remain open; no implicit scheduler/browserframe mapping; original first-list/DEAA initialization and main-loop8000/CC4B gates remain open',
    'AdjacentADF4/AE12 callers are separate routines,not helpers reached byAC2F; no graphics/DMA/audio/display claim from these data writes',
  ],
  manufacturer_sources: ['https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf#page=21'],
};
await writeFile('analysis/motion-postpass-ac2f.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/motion-postpass-ac2f.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete AC2F:453 bytes,196 instructions,26 edges,four RTS,zero calls.\n; Indirect operands read data; no executable helper chain. Separate caller56 and data272 bytes.\n; E0M0X0,D0,binary;incoming DBR not replaced; no CPU execution.\n\n` + [body, caller].map(formatBlock).join('\n') + `\n; DATA ONLY 80:AEB4..AFC4, overlapping bases AEB4/AEC4; SHA256 ${digest(table)}\n` + Array.from({ length: table.length / 16 }, (_, row) => {
  const raw = table.subarray(row * 16, row * 16 + 16);
  return `${cpuLabel(0x80AEB4 + row * 16)}  ${raw.toString('hex').toUpperCase().match(/../g).join(' ')}`;
}).join('\n') + '\n');
console.log('AC2F complete static source:453 bytes,26 edges,four RTS,zero calls;56 callerbytes and272 tablebytes pinned. Native manual postpass supplied; native atomic manual AFC4 supplied; complete DE94 static source/return contract pinned in motion-prefix-de94.json; native bounded manual DE94 and atomic DE94/AFC4 composition supplied; selected original writer contracts pinned in motion-prefix-writers.json; native88 atomic six-WORD reset supplied; gate8000 local source pinned in motion-gate-8000.json; external callees source-required; A4BF local body,A44D andtime helpers pinned in motion-transition-a4bf.json; BCB2/BE5B/FA3E andAD92 local source pinned in motion-reset-bcb2.json; nextA9B2/9F49 render source; full starter/render and pointer lifecycle remain open.');
