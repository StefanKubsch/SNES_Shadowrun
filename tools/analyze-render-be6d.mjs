import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 };
const specs = [
  ['heldBE6D', 0x80BE6D, 0x80BF3B], ['selectBCBE', 0x80BCBE, 0x80BE5B],
  ['widthFADD', 0x80FADD, 0x80FB2A], ['widthByteFB2A', 0x80FB2A, 0x80FB39, 1],
  ['allocateF963', 0x80F963, 0x80FA3E], ['requestFA67', 0x80FA67, 0x80FA89],
  ['textFE69', 0x80FE69, 0x80FEC1], ['composeFB39', 0x80FB39, 0x80FD80],
  ['waitACBD', 0x81ACBD, 0x81ACC3], ['waitACC3', 0x81ACC3, 0x81ACC9], ['waitACC9', 0x81ACC9, 0x81ACCF],
  ['cursorADBA', 0x81ADBA, 0x81AE14], ['remainingAE14', 0x81AE14, 0x81AE4C],
  ['noopAE4C', 0x81AE4C, 0x81AE4D], ['newlineAE4D', 0x81AE4D, 0x81AEB0],
  ['maskAEC8', 0x81AEC8, 0x81AEF4], ['requestAEF4', 0x81AEF4, 0x81AEFC],
  ['requestAEFC', 0x81AEFC, 0x81AF04], ['bitAF04', 0x81AF04, 0x81AF1F],
  ['mainCall96BA', 0x8096BA, 0x8096BD],
];
function block(name, entry, end, m = 0) {
  const initialState = { ...word, m }, state = { ...initialState }, instructions = [];
  for (let pc = entry; pc < end;) {
    // FC5F is a BYTE-A taken path fromFC51; linear predecessorFC5C is
    // an unconditional WORD-A jump. The full typed graph verifies this join.
    if (pc === 0x80FC5F) state.m = 1;
    const i = decode(bytes, pc, state);
    if (i.next > end || ['XCE', 'TCD', 'PLD', 'SED', 'RTI', 'BRK', 'COP'].includes(i.mnemonic)) throw Error(`Renew ${name} source at${cpuLabel(pc)}`);
    instructions.push(i); pc = i.next;
    if (['REP', 'SEP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = Number(i.mnemonic === 'SEP');
      if (i.value & 16) state.x = Number(i.mnemonic === 'SEP');
    }
  }
  return { name, entry, initialState, instructions, stop: 'Complete local source; full typed call graph checked separately. No CPU/device execution or data termination proof.' };
}
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next),
    covered_bytes: raw.length, instruction_count: b.instructions.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const address = label => parseInt(label.replace(':', ''), 16);
const blocks = specs.map(s => block(...s));
const dependency = JSON.parse(await readFile('analysis/render-ad92.json', 'utf8'));
if (dependency.rom_sha256 !== metadata.rom_sha256) throw Error('AD92 dependency drift');
const reusedWindows = [...dependency.windows.slice(0, 4), ...dependency.dependencies.flatMap(d => d.windows)]
  .filter(w => w.name !== 'resetBCB2');
const reused = reusedWindows.map(w => {
  const b = block(w.name, address(w.entry), address(w.end_exclusive));
  if (JSON.stringify(describe(b)) !== JSON.stringify(w)) throw Error('Reused body drift: ' + w.name);
  return b;
});
const graphBlocks = [...blocks.slice(0, -1), ...reused];
const map = new Map(graphBlocks.flatMap(b => b.instructions.map(i => [i.cpu, i])));
if (map.size !== graphBlocks.reduce((n, b) => n + b.instructions.length, 0)) throw Error('Duplicate graph source');
const proofs = [0x80BE6D, 0x80BCBE, 0x80FADD, 0x80F963, 0x80FA67, 0x80FE69, 0x80FB39, 0x81AF04]
  .map(entry => proveWordStack(map, entry, entry === 0x81AF04 ? 'RTL' : 'RTS', { measureStack: true, widthJoins: new Set([0x80FAF2, 0x80FC36]) }));
if (proofs[0].reachable_instructions !== map.size) throw Error('Unexpected unreachable fullgraph source');
const input = JSON.parse(await readFile('analysis/render-input-flow.json', 'utf8'));
const prefix = input.windows.find(w => w.name === 'selectedHeldBE6D');
if (input.rom_sha256 !== metadata.rom_sha256 || describe(blocks[0]).machine_bytes.slice(0, prefix.covered_bytes * 2) !== prefix.machine_bytes) throw Error('BE6D prefix drift');
const main = input.windows.find(w => w.name === 'mainLoop96AB');
if (main.machine_bytes.slice((0x96BA - 0x96AB) * 2, (0x96BD - 0x96AB) * 2) !== describe(blocks.at(-1)).machine_bytes) throw Error('Maincall drift');
const tables = [
  ['selectedAction9700', 0x809700, 26], ['selectedText9782', 0x809782, 26],
  ['exhaustedText819780', 0x819780, 2], ['selectedWidthsAC0C', 0x81AC0C, 128],
  ['selectedMasksAC8D', 0x81AC8D, 34], ['selectedGlyphs95F2D0', 0x95F2D0, 2048],
].map(([name, entry, length]) => { const raw = bytes.subarray(cpuToOffset(entry, bytes.length), cpuToOffset(entry, bytes.length) + length);
  return { name, entry: cpuLabel(entry), covered_bytes: length, sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase(),
    qualification: 'Selected original ROM data window only; no index clamp, semantic table capacity or automatic provider hydration.' }; });
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope: 'Complete local BE6D/BCBE plus all transitive local callees; original AD92/A9B2/reset bodies reused byte-for-byte. Closed structural WORD/DBR/typed-stack graph, zero external return assumptions. Actual source ownership, loops, MMIO results, waits and interrupt completion remain unproved; manual native BE6D/BCBE supplied separately; no CPU/device execution.',
  windows: blocks.map(describe), dependencies: [{ report: 'analysis/render-ad92.json', windows: reusedWindows }], tables,
  local_code_bytes: blocks.slice(0, -1).reduce((n, b) => n + describe(b).covered_bytes, 0),
  reused_code_bytes: reusedWindows.reduce((n, w) => n + w.covered_bytes, 0),
  full_graph: { code_bytes: graphBlocks.reduce((n, b) => n + describe(b).covered_bytes, 0), instructions: map.size,
    proof: proofs[0], actual_termination_proven: false, native_binding: true },
  structural_proofs: proofs,
  width_joins: [{ at: '80:FAF2', instruction: 'REP20', incoming_m: [0, 1], outgoing_m: 0,
    qualification: 'Initial WORD fallthrough and BYTE loop branches share original fixed2byte REP20.' },
  { at: '80:FC36', instruction: 'SEP20', incoming_m: [0, 1], outgoing_m: 1,
    qualification: 'WORD firstpass/wordwrap branch and BYTE glyphloop FD56 JMP share original fixed2byte SEP20. Only declared sourcechecked joins permit incoming width differences.' }],
  local_graphs: blocks.slice(0, -1).map(b => ({ name: b.name,
    edges: b.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    returns: b.instructions.filter(i => ['RTS', 'RTL'].includes(i.mnemonic)).map(i => cpuLabel(i.cpu)) })),
  entry: 'E0M0X0,D0000,binary arithmetic, actual DBR and explicit shared bytes. Root JSR2 plus maximum transitive local stack; code and every protected stackbyte remain disjoint from all reached data/scratch/device writers. Local closed source does not supply live main/interrupt ownership or original WRAM initialization.',
  held: {
    gate: 'Fresh WORD01D8 zero JMPBF36/RTS: A0,N0,Z1,X/Y/C/V/DBR/D/I preserved. Nonzero reads fresh WORD01CA then XBA/AND000F/LSR/TAX. X retains original high nibble shifted once until a later callee changes it.',
    axes: 'Input bits8/9 control01D0, bits10/11 control01D2; first bit wins when both set. Positive path retains nonnegative velocity elseLDA0; ADC002F with C1 adds0030 then unsigned upperclamp0300. Negative path retains negative velocity elseLDA0; SBC0030 with C1 subtracts0030 then unsigned lowerclampFD00. Neither direction STZWORD velocity without oldvelocity read.',
    positions: 'Unconditionally CLC/fresh01D4+fresh01D0 WORDwrap then sequential unsigned clamps [0300,EF00]; similarly01D6+01D2 clamps[0300,CE00]. Wrapped sums are clamped, not mathematical saturated sums. WORDstores include the BYTE01D5/01D7 owners used byC06B.',
    tail: 'A second fresh WORD01CA/XBA/AND000F decides tail; no cached first nibble. Nonzero reads fresh01DA; negative returns, otherwiseJSRBE5B including zero. Zero nibbleJSRBCBE thenRTS. Callback C06B/main9E1A/manual providers share no automatic original chronology.',
  },
  selection: {
    search: 'Fresh signedWORD14B0 intoY; negative toBD99. Otherwise WORD01D4/01D6 highbytes copied into sharedDP0E/11, fullindexedWORD14B2+Y->X. WORD1090+X gates record. Long7E3F28+X type000B additionally requires01D8=FFFD or nonzero fresh1D5F OR1D6D. Full typeASL/ASL/ADCDP1A withoutCLC indexes fixed long8CEFB0; FFFF entry skips. Y decrements twice with WORDwrap/sign; odd heads are not aligned.',
    geometry: 'Repeated binaryWORD subtracts/adds use explicitSEC/CLC and full source addresses in actualDBR or fixed7E. BMI tests result bit15; unsignedCMP boundaries and source-defined ROR/LSR sequences remain literal. No screen-space replacement, slot clamp or inferred scene geometry.',
    reuse: 'AtBDA2 fresh01DA/type/01DE equality jumpsBE38. Newtarget mayPHX/JSRBE5B/PLX then reads scratch14/0E/17/11 freshly for01E0/01E2 and writes freshtype01DA plus selectedslot01DE. BE5B transitive shared scratch may affect later values; no scratchsnapshot acrosscalls.',
    table: 'Flags1458+X low2==3 selects150A+X and descending X0018..0000 action scan. Exhaustion leavesXFFFE; fixed long809782+X reaches819780, not809780. Other path uses fresh01DA then ASL/ASL/ADCDP1A withoutCLC to long8CEFB0. Long and absolute indexed addresses retain full bankcarry; no clamped slot or glyph index.',
    calls: 'Selected textWORD->DP00/PHA; FADD returns actualWORDwidth, CLC/ADC0018 WORDwrap/threeLSR ->DP04. DP00=001E-DP04, DP02=0017,DP06=0003,DP08=0800; JSRF963, freshDP00->01DC, PLA->DP02, JSRFE69. Allocation capacity failure still returns to remaining caller stores andFE69; no invented success test.',
    track: 'BE38 reads freshDP14/01E0; unsigned difference>=00FF callsBE5B. Otherwise XBA/STAWORD01D4 occurs before analogousDP17/01E2 test. A second failedtest follows an already written01D4; eventual atomic native owner must include that earlier effect and all reset/render work.',
  },
  text: {
    pointer: 'FADD andFE69 writeWORDD0=9DFF, conditionalINCD0 for negative textWORD, thenWORDCF=(text OR8000), overlapping D0 lowbyte. Thus pointerbank is9D/9E; highD1 andCF/D0 aliases stay real. AF04 DECWORD0206 signedBPL else reload15, PHA/LDA[CF]/XBA/STAWORD0208, twoINCCF,PLA; ASLWORD0208 suppliesCarry and preservesA. IncrementCF wraps lowWORD withoutbankincrement.',
    decoding: 'FADD/FE69 TAX fullA, callAF04, INXtwice onlyCarry1, longWORD9D8000+X, nonnegativeword loopsback toTAX with currentA. Negativeword masks7F7F and processes high character before low;0A ends, low0 requests nextword. No invented decoding, terminator or bounded token count.',
    width: 'FADD zeroesWORDBA; BYTE-A FB2A TAX transfers fullA including hiddenhighB into WORDX, then BYTE long81AC0C+X read, REP20/ADCWORDBA/STA, SEP20/RTS. HighA from widthsum can affect second character tableindex; no glyphBYTEclamp. RootREP20/LDAWORDBA/RTS. Termination/data/stack alias remain explicit.',
    allocation: 'F963 WORD0204+2 CPX0020; unsigned>= exits atFA3D without workspace result initialization. Active fields, width/height geometry, long7E2000..2180 and actual0226 update are ordered. BYTE211B twice then211C, WORD2134 first read stored20A0+X then fresh0212; optional second2134 read for capacitywrap. FA67 ASLthree/ADC4FFF retainsCarry, sets020A/020C, INCWORD01F6 and waitsACBD. ThenACCF, ACB5 wait01F8. Requests/reads are not multiplication results or acknowledgments.',
    rendering: 'FE69 savesDBR, selects7E, emits actualBYTE21A0+Y highchar thenlowchar, zero terminator, REP20/JSRFB39/PLB/RTS. FB39 handles currentline geometry, wordwrap/styles/case/font rows/masks using sharedDP and actualbufferbytes. ADBA/AE14/AE4D temporarilyselectDBR80 for division/multiplication reads, restoreDBR; AE4C bareRTL is literal. AEC8 assembles masks. AEF4/AEFC INCWORD01FA/01FC thenwaitACC3/ACC9. Pollzero/wrap doesnotprove transfer or clock progress.',
  },
  boundaries: [
    'Source graph closed; nativeBE6D/BCBE manual atomic composition supplied separately. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with explicit pointers/dictionary/widthbytes/shared aliases, hiddenhighA and5/7 protectedstackbytes; no guessed token termination. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native81:ADBA/AE14/AE4D geometry, AEC8 mask and AEF4/AEFC/ACC3/ACC9 request/wait atomic prerequisites supplied inrender-text-helpers-native: original318/153, fresh explicit BYTE4214/WORD4216, eight maskWORDs, protectedstack6/6/7/3/6/6/3/3 and shared view/budget/outercommit. FE69/FB39 composition supplied separately with globally distributed arithmetic/wait observations. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json. AD92 is integrated in the native manual BE6D/BCBE release chain.',
    'BF3B remains open at nestedaction/dialog callees andE382; full localBF3B source andnativeFEC1 prerequisite supplied inrender-bf3b/render-fec1-native. Original MMIO2134/4214/4216 arithmetic results, request/acknowledgment lifecycle01F6/01F8/01FA/01FC, source initializers, actualmain/interrupt ownership, E382 startup, nativeA5/97 and automaticframe binding remain open.',
  ],
};
await writeFile('analysis/render-be6d.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-be6d.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Full local BE6D/BCBE and text/allocator callees. Reused render/reset bodies byteverified in JSON.\n; Closed typed callgraph, no CPU/device execution, original scene/frame binding or actualloop/wait completion.\n\n` + blocks.map(formatBlock).join('\n'));
console.log(`BE6D closed source: ${report.full_graph.code_bytes} bytes/${map.size} instructions; stack${proofs[0].minimum_protected_stack_bytes}; native manual BE6D/BCBE supplied separately; next native FD80 prerequisite.`);
