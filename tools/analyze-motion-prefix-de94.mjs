import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const mode = { e: 0, m: 0, x: 0 };
const readBlock = (entry, end) => {
  const instructions = [];
  for (let pc = entry; pc < end;) {
    const ins = decode(bytes, pc, mode);
    if (ins.next > end || ['REP', 'SEP', 'PLP', 'XCE', 'TCD', 'PLD', 'PLB', 'SED', 'RTI', 'BRK', 'COP'].includes(ins.mnemonic)) throw Error('DE94 source contract needs renewed analysis');
    instructions.push(ins); pc = ins.next;
  }
  return { entry, initialState: mode, instructions, stop: 'Complete explicit static window; control flow and return contracts checked separately; no instructions executed' };
};
const body = readBlock(0x80DE94, 0x80DEC7), caller = readBlock(0x8096C3, 0x8096D3);
const graph = new Map(body.instructions.map(ins => [ins.cpu, ins]));
const pending = [body.entry], reachable = new Set();
while (pending.length) {
  const pc = pending.pop(); if (reachable.has(pc)) continue;
  const ins = graph.get(pc); if (!ins) throw Error('Uncovered DE94 control flow');
  reachable.add(pc);
  if (['JSR', 'JSL', 'JML', 'JMP', 'RTL'].includes(ins.mnemonic) || ['ind', 'indx'].includes(ins.mode)) throw Error('Unexpected DE94 call or indirect control transfer');
  if (ins.mnemonic === 'RTS') continue;
  if (ins.target !== undefined) pending.push(ins.target);
  if (ins.mnemonic !== 'BRA') pending.push(ins.next);
}
if (reachable.size !== graph.size) throw Error('Unreachable bytes in DE94 body');
const describe = block => {
  const raw = Buffer.concat(block.instructions.map(ins => ins.raw));
  return { entry: cpuLabel(block.entry), end_exclusive: cpuLabel(block.instructions.at(-1).next), covered_bytes: raw.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const edges = body.instructions.filter(ins => ins.target !== undefined).map(ins => ({ from: cpuLabel(ins.cpu), kind: ins.mnemonic, to: cpuLabel(ins.target) }));
const report = {
  rom_sha256: metadata.rom_sha256,
  scope: 'Complete static80:DE94 prefix before AFC4:51 bytes,20 instructions,five edges,two RTS,zero direct/transitive calls. Separate16-byte caller window pins8000/CC4B gates thenDE94/AFC4. AdjacentDEC7 is another routine. Native bounded manual DE94 and atomic DE94/AFC4 composition are supplied separately. No CPU execution.',
  routines: [describe(body)], caller_windows: [describe(caller)], instruction_count: body.instructions.length,
  edges, calls: [], reachable_instructions: reachable.size,
  accesses: body.instructions.filter(ins => ['abs', 'absx'].includes(ins.mode)).map(ins => ({
    from: cpuLabel(ins.cpu), instruction: ins.mnemonic, operand: ins.operand, width_bytes: 2,
    operation: ins.mnemonic === 'DEC' ? 'read_modify_write' : ['STA', 'STZ'].includes(ins.mnemonic) ? 'write' : 'read',
    bank_contract: ins.mode === 'absx' ? 'Incoming DBR plus actual0D20/0D78+X effective bytes; no source alignment or slot-window guard. NonnegativeX<=7FFF keeps address within this DBR; mapping still requires actual byte coverage.'
      : 'Incoming DBR; actual low WRAM0CC2 or odd WORD1D65/1D66. D register is not used.',
  })),
  entry_contract: 'Explicit E0/M0/X0 for WORD loads,DEC,stores andbit15 sign test. IncomingX is replaced by WORD DBR:0CC2. IncomingY is unused and preserved. No D-register,decimal-mode,DBR,width or Carry/V changes. All data accesses are DBR-relative; actual low-WRAM mapping must be known. This routine does not prove prior8000/CC4B return widths or the real caller DBR.',
  gate: 'DE94 LDX0CC2;DE97 BMI DEBF. Any negative WORD0CC2 returns without reading1D65. NonnegativeX thenDE99 LDA1D65;DE9C BEQ DEBF. Zero initial counter returns without decrement or slot writes. No X alignment,capacity,task-state or1458 gate exists in this body.',
  counter: 'DE9E DEC WORD1D65 reads/modifies the WORD,writing (old-1)&FFFF while A still holds the old DE99 load. Zero resultDEA1/BEQ reachesDEC0. Since oldzero was guarded, only old1 selects expiry; old2..FFFF select alternating writes. DEC does not reload A. This is one explicit call-count decrement,not time/frame measurement.',
  expiry: { sites: ['80:DEC0', '80:DEC3'], order: 'STZ WORD DBR:0D20+X,then STZ WORD DBR:0D78+X;RTS DEC6. No read of previous movement words,flags,scratch ortask state.' },
  alternating: {
    parity: 'DEA3 AND0001 tests A=oldcounter,not the decremented memory WORD. Even oldcounter reachesDEB3; odd followsDEA8. No other counter read intervenes.',
    odd: 'LDAFFFC;STA0D20+X;LDA0004;BRA DEBC;STA0D78+X. FullWORD -4/+4,not signed lowbyte or relative coordinate changes.',
    even: 'LDA0004;STA0D20+X;LDAFFFC;STA0D78+X. FullWORD +4/-4.',
    limits: 'The header does not establish gameplay meaning or elapsed time. The source overwrites both movement words after counter decrement; it does not add offsets or directly alter game coordinates.',
  },
  returns: {
    sites: ['80:DEBF', '80:DEC6'],
    stack: 'No local push/pop or call; plain RTS consumes only the caller JSR return. E0/M0/X0,D,DBR,decimal flag,Carry andV retain entry values. Y is preserved; X is the loaded0CC2 WORD on every path.',
    accumulator_flags: [
      { path: 'negative0CC2', site: '80:DEBF', a: 'Incoming A unchanged', nz: 'N1/Z0 fromLDX' },
      { path: 'counter_zero', site: '80:DEBF', a: '0000', nz: 'N0/Z1 fromLDA1D65' },
      { path: 'counter_expiry', site: '80:DEC6', a: '0001 oldcounter', nz: 'N0/Z1 fromDEC1D65;STZ preserves flags' },
      { path: 'nonexpiry_odd', site: '80:DEBF', a: '0004', nz: 'N0/Z0 fromfinalLDA' },
      { path: 'nonexpiry_even', site: '80:DEBF', a: 'FFFC', nz: 'N1/Z0 fromfinalLDA' },
    ],
  },
  caller_contract: {
    edges: caller.instructions.filter(ins => ins.target !== undefined).map(ins => ({ from: cpuLabel(ins.cpu), kind: ins.mnemonic, to: cpuLabel(ins.target) })),
    order: '96C3 JSR8000;96C6 BCS96AB;96C8 JSRCC4B;96CB BCS96AB;96CD JSRDE94;96D0 JSRAFC4. Gate Carry must be0 on this actual fallthrough. DE94 preserves it; no returnedA/X/Y/N/Z/Carry check is present before AFC4.',
    bounds: 'Separate selected caller window only. No full source/return contract for8000,CC4B or96AB and no complete scene/main-loop iteration proven.',
  },
  aliases: {
    counter_word: '1D65 is an odd WORD covering1D65/1D66; native knowledge must preserve each real byte and adjacent unknowns.',
    hostile_offsets: 'X=1044/1045/1046 makes0D20+X writeWORD1D64/1D65/1D66;X=0FEC/0FED/0FEE makes0D78+X write the same addresses. These source-permitted positive odd/even offsets can overwritecounter bytes afterDEC,or adjacent bytes. CachedoldA parity and read/write order remain exact; no generic preserved-state claim applies outside actual covered offsets.',
    bounded_slots: 'For original44 even Gameslot offsets00..56,first writes cover0D20..0D77 andsecond0D78..0DCF;neither overlaps1D65/1D66,0CC2,active14B0/14B2 or motion scratch. An eventual bounded native game-slot contract must reject unsupported reached effective bytes before any live writes; negative0CC2 andzero counter do not reach them.',
  },
  side_effects: {
    global_words: ['DBR:1D65'], slot_words: ['DBR:0D20+X', 'DBR:0D78+X'], scratch_words: [],
    preserves_with_bounded_slots: 'No coordinate,1458,active-list,task/pool,workspace,D9/motion-scratch,WORD82,output-queue,DMA oraudio writes. Source doesnot initialize0CC2 or1D65.',
  },
  implementation: {
    helper: 'proof/state/slot-motion-prefix-de94.mjs',
    binding: 'slots.stepMotionPrefixDE94({bank}) and slots.stepMotionDE94AFC4({bank,frameAllocator}); manual WORD data calls only. Existing motion-data0CC2 and movement columns; explicitodd counter bytes1D65/1D66. Combined prefix/AFC4 preflight retains all live owners on late failures. No extraCarry gate or invented zero/timer start.',
    banks: 'Low-WRAM mirror DBR00..3F/80..BF or direct7E only; same DBR remains explicit for later C9E0/AC2F ROM reads. Unsupported reached positiveX aliases stop before counter commit; negativeX and initialzero do not reach slot writes.',
    probe: 'Original252/217 with explicit synthetic0CC2=54,counter3,DEAA20,negative first heads,1140=1,82=0,DBR80 givescounter2,motionFFFC/4,54 coords484/1824/1725 flags0069 and56 coords492/1824/256; native helper reactions restorecolliding coordinates. Counts2/2,heads4/8,freeCount60/freeHead10,cursor82=16. Tasks/waits/heap/workspace/AC unchanged.',
  },
  boundaries: [
    'Bounded manual native DE94 plan and atomic DE94/AFC4 composition supplied. selected original writer contracts pinned in motion-prefix-writers.json; native88 atomic six-WORD reset supplied; gate8000 local source pinned in motion-gate-8000.json; external callees source-required; A4BF local body,A44D andtime helpers pinned in motion-transition-a4bf.json; BCB2/BE5B/FA3E andAD92 local source pinned in motion-reset-bcb2.json; nextA9B2/9F49 render source; full starter/render and pointer lifecycle remain open. Reuse actual0CC2 byte owner and existing0D20/0D78 slot columns; reuse explicitodd counterWORD1D65 source/owner without zero/timer initialization.',
    'Counter decrement,oldA parity,expiryzero writes and laterAFC4 effects must sharepreflight;missing counter,reached slotwindow orlateAFC4 sources preserve all live owners.',
    'Selected writer contracts pinned in motion-prefix-writers.json; other writers/full lifecycle,actual entryDBR/widths,8000/CC4B gates and scene/frame/time mapping remain open. No CPU or adjacentDEC7 routine execution.',
  ],
  manufacturer_sources: ['https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf'],
};
await writeFile('analysis/motion-prefix-de94.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/motion-prefix-de94.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete DE94:51 bytes,20 instructions,five edges,two RTS,zero calls.\n; All WORD data operands inheritDBR;odd counter1D65;parity usesoldA aftermemoryDEC.\n; Caller16 bytes are separate gate/call references;previous callees remain unproved.\n; Explicit E0M0X0; no CPU execution orimplicit time; native bounded manual binding supplied separately.\n\n` + [body, caller].map(formatBlock).join('\n'));
console.log('DE94 complete source:51 bytes,20 instructions,five edges,two RTS,zero calls;separate16 callerbytes. Native bounded manual DE94 and atomic DE94/AFC4 supplied; selected original writer contracts pinned in motion-prefix-writers.json; native88 atomic six-WORD reset supplied; gate8000 local source pinned in motion-gate-8000.json; external callees source-required; A4BF local body,A44D andtime helpers pinned in motion-transition-a4bf.json; BCB2/BE5B/FA3E andAD92 local source pinned in motion-reset-bcb2.json; nextA9B2/9F49 render source; full starter/render and pointer lifecycle remain open.');
