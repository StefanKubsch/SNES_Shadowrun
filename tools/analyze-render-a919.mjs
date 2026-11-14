import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 };
const specs = [
  ['paletteListA919', 0x81A919, 0x81A954],
  ['callbackCallC16A', 0x80C16A, 0x80C16E],
  ['listAppendAB0A', 0x80AB0A, 0x80AB26],
  ['listResetA840', 0x81A840, 0x81A919],
  ['selectedCountClear9415', 0x809415, 0x809418],
  ['selectedCountClearE4C2', 0x80E4C2, 0x80E4C5],
  ['selectedGateClearA772', 0x81A772, 0x81A775],
  ['selectedAppendCallB23D', 0x80B23D, 0x80B240],
  ['selectedAppendCallB8F1', 0x80B8F1, 0x80B8F4],
];
const blocks = specs.map(([name, entry, end]) => {
  const state = { ...word }, instructions = [];
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, state);
    if (i.next > end || ['PLP', 'PLB', 'PLD', 'TCD', 'TCS', 'XCE', 'SED', 'BRK', 'COP'].includes(i.mnemonic)) throw Error(`Renew ${name} mode proof`);
    instructions.push(i); pc = i.next;
    if (['SEP', 'REP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = Number(i.mnemonic === 'SEP');
      if (i.value & 16) state.x = Number(i.mnemonic === 'SEP');
    }
  }
  return { name, entry, initialState: word, instructions,
    stop: name.startsWith('selected') ? 'Selected instruction only; caller/mode/DBR lifecycle open'
      : 'Complete local body or selected callback call; static source, no CPU/device execution' };
});
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next),
    covered_bytes: raw.length, instruction_count: b.instructions.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const map = b => new Map(b.instructions.map(i => [i.cpu, i]));
const previous = JSON.parse(await readFile('analysis/render-a9e1.json', 'utf8'));
const callback = previous.windows.find(w => w.name === 'callbackC152');
if (previous.rom_sha256 !== metadata.rom_sha256
  || callback?.machine_bytes.slice((0xC16A - 0xC152) * 2, (0xC16E - 0xC152) * 2) !== describe(blocks[1]).machine_bytes) throw Error('Callback drift');
const slotSource = JSON.parse(await readFile('analysis/slot-state.json', 'utf8'));
if (slotSource.rom_sha256 !== metadata.rom_sha256
  || slotSource.source_blocks.find(b => b.entry === '81A840')?.machine_bytes !== describe(blocks[3]).machine_bytes) throw Error('Existing reset source drift');
const scan = pattern => {
  const candidates = [];
  for (let p = 0; p <= bytes.length - pattern.length; p++) if (pattern.every((v, j) => bytes[p + j] === v))
    candidates.push(cpuLabel(0x800000 + Math.floor(p / 0x8000) * 0x10000 + 0x8000 + p % 0x8000));
  return candidates;
};
// Counter/address arithmetic only, no instruction, memory or device execution.
const counts = [0, 1, 2, 3, 0x7FFF, 0x8000, 0x8001, 0x8002, 0x8003, 0x8004, 0xFFFF].map(count => {
  const visits = count === 0 ? 0 : count >= 2 && count <= 0x8003 ? Math.floor(count / 2) : 1;
  return { count, initialY: count === 0 ? null : (count - 2) & 65535, nominalIterations: visits,
    finalY: visits ? (count - 2 - visits * 2) & 65535 : 0 };
});
const pointers = [0, 1, 0x800, 0xFFF, 0x1000, 0xFFFF].map(value => ({ value,
  pointer: ((value * 16 % 65536) + 0xF1BA + Math.floor(value / 4096) % 2) % 65536 }));
const indexes = [0, 1, 0x10, 0x20, 0x30, 0x60, 0xE829, 0xFFFD].map(y => {
  const shifted = y * 8 % 256, carry = Math.floor(y / 32) % 2;
  const sum = shifted + 129 + carry, signed = (shifted < 128 ? shifted : shifted - 256) - 127 + carry;
  return { y, shiftCarry: carry, index: sum % 256, carry: Number(sum >= 256), overflow: Number(signed < -128 || signed > 127) };
});
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope: 'Complete localA919 with selected callback, completeAB0A/A840 listwriters, selected clears/calls. Structural mode/stack and algebraic count/pointer/BYTEcarry proofs only; nativeA919 supplied separately, no CPU/device execution, live owner hydration or automatic callback/frame binding.',
  windows: blocks.map(describe), code_bytes: 59, instruction_count: 31, caller_bytes: 4,
  owner_body_bytes: 245, owner_excerpt_bytes: 15,
  graph: { edges: blocks[0].instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    calls: [], proof: proveWordStack(map(blocks[0]), 0x81A919), actual_transfer_completion_proven: false },
  gates: { order: ['WORD1562', 'WORD17D4 intoY'],
    first: 'Zero1562 reachesRTL A953 immediately: A0/N0/Z1, Y/X/C/V/I/DBR/D preserved; no count/list/register reads or writes.',
    second: 'Nonzero1562 and zero17D4 return the original1562 WORD inA, Y0/N0/Z1 fromLDY0 (even A8000), X/C/V/I/DBR/D preserved; no writes. Count is byteoffset, not multiplied by2; no clear on any path.' },
  loop: { count: 'For nonzero17D4 twoWORDDEY precede an unconditional firstvisit atA925. After each visit twoWORDDEY thenBPL, notBNE or an initial signgate. Nominalvisits: count2..8003 ->floor(count/2); othernonzero ->1. Counts8002/8003 enter withnegativeY but afterfirstvisitwrap into nonnegativeY, maximum16385 visits. Parity/length/alignment are not guarded. Actual data/device/stack ownership still required.', counts,
    record: 'Fresh WORD DBR:17D6,Y with full indexed bankcarry and highbyte at next24bitaddress, including oddY andWORDstartFFFF. Maxselected startbase+117D5 forYFFFF atcount1; countFFFF startsatbase+117D3 forYFFFD. No lowWORDwrap. List can overlapphysicalregisters and laterrecords.',
    pointer: 'FourWORDASL thenADCF1BA withoutCLC: pointer=(16*record mod65536+F1BA+recordBit12) mod65536. Carry frombit12, notentryCarry orbit15. WORD4342=pointer, WORD4345=001E. PointerADC C/V are subsequently replaced by BYTEindexADC.', pointers,
    index: 'SEP20; BYTE TYA retains highA0 fromLDAWORD001E, threeBYTEASL thenADC81 withoutCLC. Index=(8*lowY mod256+81+sourceYbit5) mod256. LastshiftCarry is bit5. ADC supplies finalC/V; BYTE LDA8D/LDA10 andWORDDEY do not modifyC/V.', indexes,
    requests: 'Five stores pervisit: WORD4342, WORD4345=001E, BYTE2121=index, BYTE4344=8D, BYTE420B=10. No channel4 mode/target initialization, transfer source reads, tailpalette writes or count/flagclear.' },
  returns: 'Active WORDA0010 with N1/Z0 fromfinalWORDDEY, C/V fromlastBYTEindexADC, Y=postvisitnegativeWORD, X/DBR/D/I preserved. UsualfinalvisitY0/1 givesC0/V0 but highcountsinglevisits can differ. No genericA0 orsuccessfultransfer result. Both widths WORD atRTL A953.',
  owners: { proofs: [{ name: 'listAppendAB0A', proof: proveWordStack(map(blocks[2]), 0x80AB0A, 'RTS') },
      { name: 'listResetA840', proof: proveWordStack(map(blocks[3]), 0x81A840) }],
    append: 'AB0A doublesinputA withWORDwrap intoX andreads17E6+X. Nonnegative marker returns withoutwrites. Negative marker: read17D4, store oldoffset at17E6+X, WORD STX6B saves doubledinput, TAX oldcount, LDA6B/STA17D6+X appendsdoubledinput, TXA leavesoldcount inA, twoINX/STX17D4 add2 withWORDwrap. No capacity/parity/bank/overflowguard, no calls. SharedDP6B and markers/list can alias; original caller/lifetime/live owner not bound.',
    reset: 'A840 clears17D4 thenLDAFFFF and70 WORDstores17E6..1870; AFFFF/N1/Z0, X/Y/C/V/DBR/D preserved, no calls. Existing slot-state source is byteidentical. Does not hydrate list17D6..17E5; markerarray starts only16 bytes afterlistbase and can overlap long lists.',
    selected: 'SelectedSTZWORD17D4 at9415/E4C2 andSTZWORD1562 atA772 are pinned instruction excerpts only; completecaller/DBR/mode lifecycle not supplied. SelectedJSRAB0A atB23D/B8F1 are pinned but not wholecaller/reachability proofs.',
    lifecycle: '1562 is also read by8949. Gate/count/list/markers/6B must eventually share existing byte owners, not independent copies. Manual render provider remains separate from slot/task/MotionData, and the existing native slot initializer does not establish actualA919 list/interrupt order.' },
  aliases: 'Markerbase17E6 is listoffset10. Physicalregisteraliases: Y2B70 reads4346..4347; afterthatwrites4345=001E, nextY2B6E reads4344..4345 now8D/1E. Y2B6C thenreads4342 pointer frompreviousvisit. OddrecordstartingatFFFF requiresboth actualbanks; countE82B gives firstY E829 andWORDstartFFFF. I/O recordreadcontracts remain explicitly absent.',
  caller: { at: '80:C16A', target: '81:A919', actual_nmi_dbr: '00, notPBR81',
    remaining_after: ['81:A958', '81:A98E', '80:8FBA', '80:9E0B', '80:C06B', '81:B0D1'],
    raw_patterns: { jslA919: scan([0x22, 0x19, 0xA9, 0x81]), stz17D4: scan([0x9C, 0xD4, 0x17]),
      stx17D4: scan([0x8E, 0xD4, 0x17]), indexedListStore: scan([0x9D, 0xD6, 0x17]), jsrAB0A: scan([0x20, 0x0A, 0xAB]) },
    qualification: 'Raw bytepattern hints with selected instructions validated here; no allwriter/caller, indirect/alias, nativeABI or actualcallback return census.' },
  manufacturer: { url: 'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf', sections: ['3.5', '3.5.4', '7.3', '7.20', '7.23'],
    qualification: 'Contiguous24bitWORD data space, indexed bankcarry, destination-widthTYA and retained accumulator highbyte; manufacturer source reasoning only.' },
  boundaries: ['Native atomicA919 request plan supplied separately with fresh gates/records, signedBPL/countwrap, bothshiftCarries, shared aliases, three protectedJSLbytes and latebudget/source rollback. Full localA958 and selected outputwriter source supplied inrender-a958.json. Native atomicA958 request plan supplied separately with fresh tables, DBR-independentDP82, retained highA, latecursorstore and shared view/budget/stack. Full localA98E and selected bufferwriter/setup source supplied inrender-a98e.json. Native atomicA98E request plan supplied separately with four ordered requests, lateWORDgateclear, retained A8004/BYTEflags and shared provider/budget/stack. Full local8FBA/reset/setup/selectedparameter source supplied inrender-8fba.json. Native atomic8FBA request plan supplied separately with signedgate, DBR-independentDP, WORDpointerwrap C/V, seven ordered requests, lateFFFF marker and shared view/budget/twoJSRbytes. Full local9E0B/selectedconsumer source supplied inrender-9e0b.json. Native atomic9E0B plan supplied separately with explicit chronological WORDsamples, bit0 polling, capturedWORD/NZ, late01CA store and shared provider/budget/twoJSRbytes. Full localC06B/BC1A/BC36/selector/getter source and originalROM384 supplied inrender-c06b.json. Native atomicC06B plan supplied separately with two ordered420B requests, lateWORDclear, unconditionalOAMtail, BYTEflags/highA and shared provider/budget/twoJSRbytes. Full localB0D1/B0AC/B0BD/B0C7 source and selectedsetup/callbacktail supplied inrender-b0d1.json. Native atomicB0D1 plan supplied separately with WORDcountdownwrap, freshgate reload, BYTEbrightness/highA/NZ/C and shared provider/budget/threeJSLbytes. Full local9E1A63/26 and F00729/15 source supplied inrender-9e1a.json: normalWORDreturn or explicitE1M1X1 resetterminal80E382, zeroexternalreturn assumptions; normal9E1A and standaloneF007 manualatomicplans supplied, complete reset held at source-required startup boundary. Complete localmain96AB72/25 chronology with17 explicitcallee-return boundaries and fullB0A1/F290/F298 nativewidth source supplied inrender-input-flow.json; both manualatomicwrappers supplied, counterchange isnotcallbackcompletion. Full localpostwait81:8877/886A/88A2/88E1 source185/82 andmanualatomic8877 plan supplied inrender-8877; original80D3D1 BYTEtable512 separate. Native8076 atomic updateplan supplied inrender-8076-native with freshWORD gates/progress/direction/index/count/table, ASLcarry, pointerwrap and shared provider/budget/threeJSLbytes. Full localBE6D206/85 andBCBE413/190 with alltransitive localcallees supplied inrender-be6d.json: closed2835/1318 WORD/DBR graph,32 protectedstackbytes,zeroexternalreturn assumptions; nativeBE6D/BCBE manual atomic composition supplied separately; actualtermination stillopen. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with freshBYTEaliases, hiddenhighA, shared provider/budget and5/7 protectedstackbytes. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json. Full localC1521027/419 eleven-callee graph supplied inrender-c152.json with zeroexternalreturn assumptions; manual atomicC152 supplied with six protectedstackbytes, one chronological provider/budget/commit and fresh orderedtail. No device/DMA/NMI/RTI/frame execution.',
    'Fullcallback graph/manual atomiccomposition supplied separately inrender-c152; liveAB0A/1562/list owners, original palette/transfer data and interrupt exclusion remain source-required.'] };
await writeFile('analysis/render-a919.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-a919.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; A91959/31, callback4; fullAB0A/A840 owners245, selectedclears/calls15.\n; Static/algebraic source only; no CPU/device execution, original WRAM hydration or frame binding.\n\n` + blocks.map(formatBlock).join('\n'));
console.log('A91959 bytes/31 instructions/no calls; signedBPL, two shiftCarries and selected listwriters pinned.');
