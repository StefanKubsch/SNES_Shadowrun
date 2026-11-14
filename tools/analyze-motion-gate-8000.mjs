import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const mode = { e: 0, m: 0, x: 0 };
const windows = [['gate8000', 0x808000, 0x8080B2], ['caller', 0x8096C3, 0x8096D3],
  ['rootAppend', 0x80C34A, 0x80C366], ['transitionPrefix', 0x80A4BF, 0x80A4D4]];
const blocks = windows.map(([name, entry, end]) => {
  const instructions = [];
  for (let pc = entry; pc < end;) {
    const ins = decode(bytes, pc, mode);
    if (ins.next > end || ['REP', 'SEP', 'PLP', 'XCE', 'TCD', 'PLD', 'PLB', 'SED', 'RTI', 'BRK', 'COP'].includes(ins.mnemonic)) throw Error(`Renew ${name} source proof`);
    instructions.push(ins); pc = ins.next;
  }
  return { name, entry, initialState: mode, instructions,
    stop: 'Explicit complete local window or selected prefix; external call returns and their continuation modes are assumptions,not transitive proofs; no instructions executed' };
});
const gate = blocks[0], map = new Map(gate.instructions.map(i => [i.cpu, i]));
const external = new Set([0x80C34A, 0x80A4BF]), pending = [gate.entry], reachable = new Set();
while (pending.length) {
  const pc = pending.pop(); if (reachable.has(pc)) continue;
  const i = map.get(pc); if (!i) throw Error('Uncovered gate8000 local edge');
  reachable.add(pc);
  if (i.mnemonic === 'RTS') continue;
  if (['JSL', 'JML', 'JMP', 'RTL'].includes(i.mnemonic)) throw Error('Unexpected gate8000 transfer');
  if (i.target !== undefined && !external.has(i.target)) pending.push(i.target);
  if (i.mnemonic !== 'BRA') pending.push(i.next);
}
if (reachable.size !== map.size) throw Error('Unreachable gate8000 source bytes');
const describe = block => {
  const raw = Buffer.concat(block.instructions.map(i => i.raw));
  return { name: block.name, entry: cpuLabel(block.entry), end_exclusive: cpuLabel(block.instructions.at(-1).next),
    covered_bytes: raw.length, instruction_count: block.instructions.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const report = {
  rom_sha256: metadata.rom_sha256,
  scope: 'Complete local gate8000 body178 bytes/103 instructions; separate caller16,root append28 andtransition prefix21 bytes. The local803B helper is included; externalC34A/A4BF and their transitive return/data effects remain source-required. No native gate,CPU execution or scene/frame mapping supplied.',
  windows: blocks.map(describe), gate_bytes: 178, reachable_local_instructions: reachable.size,
  transitive_return_proven: false,
  edges: gate.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
  calls: gate.instructions.filter(i => i.mnemonic === 'JSR').map(i => ({ from: cpuLabel(i.cpu), to: cpuLabel(i.target), local: map.has(i.target) })),
  direct_word_writes: gate.instructions.filter(i => ['STA', 'STZ', 'DEC'].includes(i.mnemonic)).map(i => ({ from: cpuLabel(i.cpu), instruction: i.mnemonic, address: i.value, width_bytes: 2 })),
  entry_contract: 'Explicit E0/M0/X0,D0000,binary ADC,actual DBR-to-WRAM mapping and valid disjoint JSR/PHY stack. Continuations afterC34A/A4BF decoded only under declared word-mode assumptions; no global return-mode or scratch-preservation proof. No instruction changes local DBR,D,widths or decimal flag.',
  inactive: '8000 LDY WORD DBR:0CC2;8003 BMI803F;803F CLC;8040 RTS. Negative pointer reads no slot/9D bytes and writes no scratch;Y is pointer,A/X preserved,N1/Z0 fromLDY,Carry0,V preserved.',
  coordinates: 'NonnegativeY loads0E28+Y,0E80+Y,0ED8+Y and performs two logicalLSRs each,writing WORD D:0E/11/14. No sign/alignment/slot-capacity/occupancy gate. Host bounded slot storage would need explicit reached-byte coverage,not fabricated rules.',
  groups: 'LDY0;STZ WORD17;801F reads a WORD via long indirect9D+Y;INY once;AND00FF selects only low count. Zero count bypasses803B. After no Carry1 from803B,INC WORD17 andCMP1 loop only whilegroup=1. With preserved scratch,exactly two adjacent count-prefixed groups,WORD17 finishes2. The high byte of each header WORD is still read. No arbitrary third-group or END sentinel semantics.',
  records: {
    layout: 'At currentY:lowerFirst,lowerSecond,lowerThird,upperFirst,upperSecond,upperThird,action WORD; nominal14 bytes. Headercount0..255.803B DEC WORD1A precedesBPL;initial positive byteN givesN attempts if callee scratch remains intact;exhaustion1A=FFFF returnsCarry0.',
    comparisons: 'All six comparisons are unsigned inclusive: coordinate>=lower andupper>=coordinate. Lower failuresBCC8076/807D/8084,upper failuresBCC808B/8092;upperThirdBCS8099 takes match. No collision/gameplay meaning assigned beyond these data comparisons.',
    skips: 'Failure paths useTYA;ADC14/12/10/8/6/4;TAY;BRA803B. Every reached ADC inheritsCarry0 from the failing CMP,withoutCLC. Starting from its current field cursor,nominally moves to next14-byte record. Y wraps16 bits underbinary arithmetic;no inferred capacity/bank fallback.',
  },
  actions: {
    first_group: '8099 advancesY by2 to action;LDA17;BNE80AB. Atgroup0:LDA[9D],Y;TAX;INY twice;PHY;JSRC34A;PLY;BRA803B. All matchingrecords can appendroots beforegroup1. No immediateC1CA visit or task execution in the coveredC34A wrapper. ScriptID is not doubled at this caller. Workspaceargs come from original profile/C2C8 and existing bytes,not this record.',
    second_group: 'Atnonzero17:80AB LDA[9D],Y;80AD JSRA4BF;80B0 SEC;80B1 RTS. Only conditional on the actual callee returning with valid word/stack state,this returnsCarry1 to802E andthen96C6. A4BF cannot be acknowledged as a no-op.',
    root_boundary: 'C34A..C366 pinsJSRC2C8,tail/next-list writes andRTS. Existing task-frame/heap/root append contracts are available separately. General gate-caller alias/argument/allocation-exhaustion integration is not established by this selected wrapper.',
    transition_prefix: 'A4BF stores incomingA into7E:2DE2;ASLthree times;ADC7E:2DE2 with the lastASL carry (oldA bit13),noCLC;TAX;LDA8D:929D,X;STA WORD86;JSRA44D. Index is wrapped9*A+bit13 in binary mode,not invariably9*A. Prefix ends atA44D,whose complete return is proved separately in motion-transition-a4bf.json;no A4BF final return proven.',
  },
  returns: {
    sites: ['80:802E', '80:803A', '80:8040', '80:80B1'],
    proven_no_call: 'Negative0CC2 returnsCLC/RTS8040. With explicit9D source and bothcountbyteszero,no externalcalls:header WORDs read atY0 andY1;finalY2,17=2,A2,Carry0,N0/Z0,Vpreserved,Xentrypreserved. Valid source/stack disjoint fromscratch assumed.',
    conditional: '803A clearsCarry after normal two-group completion;8040 is also803B exhaustion return.802E forwardsCarry1 from803B aftertheA4BF path.80B1 followsexplicitSEC afterA4BF,whose transitive mode/stack/data contract remains open. No complete all-path gate return claim.',
  },
  caller: '96C3 JSR8000;96C6 BCS96AB;96C8 JSRCC4B;96CB BCS96AB;96CD JSRDE94;96D0 JSRAFC4. Carry1 avoidsCC4B/DE94/AFC4 on this path and returns to the NMI-counter wait. A taskappend alone has no fixedCarry/time implication.',
  boundaries: ['A4BF complete localbody,A44D andtime helpers pinned in motion-transition-a4bf.json;BCB2/BE5B/FA3E andAD92 local source pinned in motion-reset-bcb2.json; nextA9B2/9F49 render source. C34A gate-specificargumentworkspace,aliases andallocation exhaustion need source reconciliation withexisting frame/heap owners.',
    'Actual0CC2/9D initialization,record/header bytes,DBR/entry modes,gateCC4B and automaticmain-loop/frame orchestration remain open. No native gate binding or invented callee success.'],
};
await writeFile('analysis/motion-gate-8000.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/motion-gate-8000.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete local8000..80B2 body178 bytes/103 instructions;includes803B.\n; Explicit E0M0X0,D0,binary. External call continuations assumed,not proved.\n; Separate caller16/root wrapper28/transition prefix21 bytes;no native gate orCPU execution.\n\n` + blocks.map(formatBlock).join('\n'));
console.log('Gate8000 local source178 bytes/103 instructions/22 edges/three JSRs;local803B included. Caller16/root28/transition prefix21 pinned;externalC34A/A4BF return/effect contracts remain explicit boundaries.');
