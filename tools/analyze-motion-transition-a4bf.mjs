import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const mode = { e: 0, m: 0, x: 0 };
const specs = [['transitionA4BF', 0x80A4BF, 0x80A5DB], ['bankA44D', 0x80A44D, 0x80A464],
  ['timeWait', 0x81B0A1, 0x81B0AC], ['timeSet', 0x81B0AC, 0x81B0BD],
  ['timeReset', 0x81B0BD, 0x81B0C7], ['gateCaller', 0x8080AB, 0x8080B2]];
const blocks = specs.map(([name, entry, end]) => {
  let state = { ...mode }; const instructions = [];
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, state);
    if (i.next > end || ['PLP', 'XCE', 'PLB', 'PLD', 'TCD', 'SED', 'RTI', 'BRK', 'COP'].includes(i.mnemonic)) throw Error(`Renew ${name} source proof`);
    instructions.push(i); pc = i.next;
    if (i.mnemonic === 'REP' || i.mnemonic === 'SEP') {
      if (i.value !== 0x20) throw Error('Unexpected width change');
      state = { ...state, m: i.mnemonic === 'SEP' ? 1 : 0 };
    }
  }
  return { name, entry, initialState: mode, instructions,
    stop: 'Complete local static window; continuations of unresolved callees assume declared WORD/DBR/stack contracts; no CPU or hardware execution' };
});
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next), covered_bytes: raw.length,
    instruction_count: b.instructions.length, sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const edges = b => b.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) }));
const graphs = blocks.slice(0, 5).map(b => {
  const map = new Map(b.instructions.map(i => [i.cpu, i])), pending = [b.entry], seen = new Set();
  while (pending.length) {
    const pc = pending.pop(); if (seen.has(pc)) continue;
    const i = map.get(pc); if (!i) throw Error(`Uncovered ${b.name} local edge`);
    seen.add(pc); if (['RTS', 'RTL'].includes(i.mnemonic)) continue;
    if (i.target !== undefined && !['JSR', 'JSL'].includes(i.mnemonic)) pending.push(i.target);
    if (i.mnemonic !== 'BRA') pending.push(i.next);
  }
  if (seen.size !== map.size) throw Error(`Unreachable ${b.name} source bytes`);
  return { name: b.name, reachable_local_instructions: seen.size, edges: edges(b),
    calls: edges(b).filter(e => ['JSR', 'JSL'].includes(e.kind)),
    return_sites: b.instructions.filter(i => ['RTS', 'RTL'].includes(i.mnemonic)).map(i => cpuLabel(i.cpu)) };
});
const body = blocks[0], bodyCalls = graphs[0].calls;
const proved = new Set(['80:A44D', '81:B0AC', '81:B0BD', '81:B0A1']);
const report = {
  rom_sha256: metadata.rom_sha256,
  scope: 'Complete local A4BF body284 bytes/118 instructions/30 edges/23 calls,plus complete A44D23 andtime helpers38 bytes; gate caller7 separate. A44D return proof reused and independently pinned. NMI wait conditional on observed counter change. Remaining transitive callees and full A4BF return remain unproved; no native transition,scene or frame execution.',
  windows: blocks.map(describe), source_bytes: 345, caller_bytes: 7, local_graphs: graphs,
  transitive_return_proven: false,
  unresolved_call_sites: bodyCalls.filter(c => !proved.has(c.to)),
  direct_writes: body.instructions.filter(i => ['STA', 'STZ', 'TSB'].includes(i.mnemonic)).map(i => ({ from: cpuLabel(i.cpu), instruction: i.mnemonic,
    operand: i.operand, width_bytes: i.state.m ? 1 : 2 })),
  entry: 'Explicit E0/M0/X0,D0000,binary ADC/SBC (decimal flag0),actual WRAM DBR mapping,valid disjoint WORD stack. All unresolved-callee continuations are decoded under declared word/DBR/D/stack assumptions,not proven return states. No global preservation or playable scene claim.',
  selection: 'A4BF writes WORD7E:2DE2=selection;threeASL thenADC7E:2DE2 retain lastASL Carry=selectionbit13. X=(9*selection+bit13)&FFFF; long-indexedWORD8D:929D+X read intoWORD86. This is the same2DE2 owner asnative56;long ROM addressing and both source bytes must remain real.',
  bank_helper: {
    source: 'Matches completeA44D fromanalysis/target-pointer.json,not the formerA44E prefix. ASL WORD setsCarry=rawbit15;SEP20;LDA99;ADC0 computesBYTE99+rawbit15 inbinarymode;writes88,DBR:0CDC,9F,9C,F5,FE;REP20;RTS. No calls,branches,local pushes orDBR/D/X/Y changes.',
    returns: 'E0M0X0 preserved;A=((raw<<1)&FF00)|(99+rawbit15),N1/Z0/C0/V0 afterBYTEADC underbinary contract. HighA remains the highbyte ofshifted raw. IncomingCarry replaced byASL,not used as bankselector. Decimal flag0 explicit;REP doesnotclear decimal mode.',
    widths: 'Only the six listed bytes are written,not WORDs. Neighborbytes87/89,0CDB/0CDD,9E/A0,9B/9D,F4/F6,FD/FF retain actual values.88 completes86 pointerbank;9C/9F/F5/FE are highbytes of9A/9D/F3/FC pointers.',
    caller: 'A4D4 LDA8000;TSB WORD86 makes lowpointer raw|8000 without changingbank88. Source base=(99+rawbit15):(raw|8000). No scene initialization is thereby completed.',
  },
  time_helpers: {
    set: 'B0AC STA WORD01C6=A thenBPL testsincomingN,becauseSTA doesnotupdateflags. On N1,EORFFFF/INC forms WORDnegation;onN0,A retained. CLC/ADC8 thenSTA01C8/RTL. No inferred absolute-value contract for mismatchedA/N. A4DA LDAFFFE suppliesN1:01C6=FFFE,01C8=000A;A5D3 LDA2 suppliesN0:01C6=0002,01C8=000A,onlyif those callsites are actually reached.',
    reset: 'B0BD STZ WORD01C6;LDA0080;STAWORD01BC;RTL. A0080,N0/Z0;Carry/V,DBR/D/X/Y preserved. Writes differ fromB0AC;no clock duration assigned.',
    wait: 'B0A1 loads WORD7E:1C76 intoA;B0A5 comparesfreshsameWORD;BEQ repeatscomparison untilnot equal;RTL onlyafterobservedchange. No counterwrite,difference,catchup,timerduration orsuccesswithoutanactualchange. ReturnA isinitialsample,X/Y/DBR/D/widths/decimal/V preserved;NZC reflect finalCMP. Interrupt/subsystem effects and forwardprogress are not supplied.',
  },
  sequence: {
    first: 'A44D;TSB86;PHX savesoriginalselectionindex;LDAFFFE;B0AC;BCB2;C1A6. C1A6 is the existing originaltask/heap/list initializer,not a harmless continuation of currenttasks. BCB2/BE5B/FA3E andAD92 local source pinned in motion-reset-bcb2.json; transitive render effects/return remain unresolved.',
    first_gate: 'IfWORD1FD6 bit2clear orWORD1FB0 nonnegative,callEF94. OtherwiseWORD[86]+Y1 is read thenmasked tobyte;FF or equalitywithWORD1CDE skipsEF94;other values callit. No inferredaudio semantics or simulatedacknowledgement.',
    header: 'Y2:WORD[86],Y thenDEC andSTA0CDA,withnozero guard (0->FFFF). WORD[86] masked tobyte beforeA117. ThenB0BD,B0A1,8861,FF79,A772. PLX atA52F restoresindex onlyconditional on validcallee stacks/modes.',
    table: 'WORD8D:929F+X maskedFF writesWORD11;unmaskedWORD8D:92A0/92A2/92A4+X writeWORD14/17/1A.9-byte rowextent is source shape only;host must cover actual effective ROM bytes,includingunalignedindices.',
    middle: 'A2FA,A3B6,A464,9AE6,8D05,8BD9. Thenif1FD6 bit2clear callEF47;elseif1CDE!=FFFF skipit;elseifBYTEat86+1!=FF callEF47;elseA=WORD1FCA andskipit. All branchesmergeat8756,then8511.',
    pointers: 'Three complete WORDcountreads at9D,F3,F3 maskedFF. Firsttwo countgroups use14*n+1 withpreservedF5 bank,writeF3 twice. Third uses6*n+1 (onlytwoASL aftersaved2*n),writesFC withpreservedFE bank. Local low-WORDwrapping doesnotcarryintopointerbanks;noadditionalreadorframe claim.',
    final: 'BABB;STZ WORD1D61;AD92;LDAFFFF;STA WORD1D61;LDA2;B0AC;RTS A5DA. UnknownAD92 canstall orwriteglobaldata beforelaterwrites;no unconditionallastvalueFFFF orfinalreturn guaranteed.1D61/1D62 sharethe expandedMotionData neighbor/hole owner;native88 deliberately leaves them untouched.',
  },
  local_stack: 'OneWORD PHX(A4D9)/PLX(A52F) pair andthreeWORD PHA/PLA pairs(A591/A59D,A5A4/A5B0,A5B7/A5C2). Balanced local pushes if everycallee returns with valid stack andmode;not a transitive stack proof. No stackemulator executed.',
  gate_caller: '80AB LDA[9D],Y;80AD JSRA4BF;80B0 SEC;80B1 RTS. SEC happens onlyafteractualA4BFreturn;returnmode stillunproved. No automatic NMI/scheduler/frame mapping.',
  boundaries: ['BCB2/BE5B/FA3E andAD92 local source pinned in motion-reset-bcb2.json. Next bounded source:complete81:A9B2 andfirst80:9F49 copyhelper withDBR/stack/WORDreturn anddestinationwrites. Keep destructive task/heap/list resetC1A6 explicit before anynative transition integration.',
    '23 directA4BF callsites pinned;five sites have included callfree helper source (A44D,twoB0AC,B0BD,B0A1). Remaining18 callsites require caller-specific effects/modes/aliases;existing task/slot/pointer slices are reusable evidence,not complete scenecontracts.',
    'Original selection,rowextent,scene record pointers/bytes,APU/render/hardware effects,interruptwrites,actualDBR/entrymodes andcompleteA4BFreturn remain source-required. No fabricatedcalleeresult,partialnativepointersetter,sceneexecution orCPUemulation.'],
};
await writeFile('analysis/motion-transition-a4bf.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/motion-transition-a4bf.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; A4BF local284 bytes;A44D23;timehelpers38;caller7 separate.\n; Explicit E0M0X0,D0,binary. Only included callfree helpers prove local modes.\n; Externalcallee continuation modes assumed;NMI wait needs actualchange;noCPU execution.\n\n` + blocks.map(formatBlock).join('\n'));
console.log('A4BF local284 bytes/118 instructions/30 edges/23 calls;A44D23/timehelpers38/caller7 pinned;18 callsites remain external effect/return boundaries.');
