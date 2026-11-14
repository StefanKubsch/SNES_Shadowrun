import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 };
const specs = [['objectC06B', 0x80C06B, 0x80C0F7], ['callbackCallC17C', 0x80C17C, 0x80C17F],
  ['resetBC1A', 0x80BC1A, 0x80BC36], ['coordinatesBC36', 0x80BC36, 0x80BC67],
  ['selectBC67', 0x80BC67, 0x80BC80], ['selectBC80', 0x80BC80, 0x80BC99],
  ['selectBC99', 0x80BC99, 0x80BCB2], ['selectedClearBCB2', 0x80BCB2, 0x80BCB5],
  ['gettersC0F7', 0x80C0F7, 0x80C109]];
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
    stop: name.startsWith('selected') ? 'Selected owner excerpt only; complete caller/lifetime remains open'
      : 'Complete local body or selected callback; static source, no CPU/device execution' };
});
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next),
    covered_bytes: raw.length, instruction_count: b.instructions.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const previous = JSON.parse(await readFile('analysis/render-a9e1.json', 'utf8'));
if (previous.rom_sha256 !== metadata.rom_sha256 || previous.windows.find(w => w.name === 'callbackC152')
  ?.machine_bytes.slice((0xC17C - 0xC152) * 2, (0xC17F - 0xC152) * 2) !== describe(blocks[1]).machine_bytes) throw Error('Callback drift');
const owners = new Map(blocks.slice(2, 7).flatMap(b => b.instructions.map(i => [i.cpu, i])));
const scan = pattern => {
  const hits = [];
  for (let p = 0; p <= bytes.length - pattern.length; p++) if (pattern.every((v, j) => bytes[p + j] === v))
    hits.push(cpuLabel(0x808000 + Math.floor(p / 0x8000) * 0x10000 + p % 0x8000));
  return hits;
};
const dataWindows = [0x8DFB78, 0x8DFBF8, 0x8DFC78].map(entry => {
  const raw = bytes.subarray(cpuToOffset(entry, bytes.length), cpuToOffset(entry, bytes.length) + 128);
  return { entry: cpuLabel(entry), covered_bytes: 128, sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
});
const report = { rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json', windows: blocks.map(describe), data_windows: dataWindows,
  code_bytes: 140, instruction_count: blocks[0].instructions.length, caller_bytes: 3, owner_body_bytes: 152, owner_excerpt_bytes: 3, getter_bytes: 18, data_bytes: 384,
  scope: 'Complete localC06B, selected callback, complete localBC1A/BC36/BC67/BC80/BC99 owners and two getters; selectedBCB2 clear. Three128byte original ROM windows. Structural code/mode/stack only; no DMA/OAM/device execution or automatic callback/frame binding.',
  graph: { calls: [], edges: blocks[0].instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    proof: proveWordStack(new Map(blocks[0].instructions.map(i => [i.cpu, i])), 0x80C06B, 'RTS'), actual_transfer_completion_proven: false },
  contract: {
    entry: 'E0/M0/X0/D0 binary, actualDBR, two protectedJSRbytes. No local pushes/calls or DBR/D changes; all joins and RTS are WORD.',
    gate: 'Fresh WORD DBR01E8. Zero skips only transfer and gateclear, always enters OAMtail. FFFE selectsFB78, FFFD selectsFC78, every other nonzero includingpositive selectsFBF8. No sign test or count semantics.',
    requests: 'Eleven ordered transfer stores: WORD4302=selected, BYTE4304=8D,4301=18,2115=80,4300=01, WORD2116=0000,4305=0040, BYTE420B=01, WORD2116=0100,4305=0040, BYTE420B=01. There is no4302 reload between requests; actual channel advance and DMA completion are not executed/proved. Then WORDSTZ01E8.',
    tail: 'Always WORDSTZ2102 then fresh BYTE01D5/STA2104, fresh WORDLDX01D8. X0 writesBYTE2104=F0 withoutreading01D7. Every nonzeroX reads freshBYTE01D7 then writesBYTE2104=value,00,30. No clear01D8, no01D4/01D6 lowbyte reads and no2104 reads.',
    returns: 'A00F0/N1/Z0 forX0, A0030/N0/Z0 fornonzeroX. HighA00 follows zeroWORDgate or lastWORDLDA0040, lowA and NZ from finalBYTELDA; REP20 doesnot recomputeNZ. X equals freshWORD01D8, Y/V/I/DBR/D preserved. C preserved for gate0; C1 precisely for nonzero gate>=FFFD from selected CMP, elseC0. No arithmetic affectsV.' },
  owners: { proofs: blocks.slice(2, 7).map(b => ({ name: b.name, proof: proveWordStack(owners, b.entry, 'RTS') })),
    reset: 'BC1A clears01D0/01D2/01D8/01E8, writesWORD8000 to01D4/01D6 (therefore actualBYTE01D5/01D7=80), writesFFFF01DA. SelectedBCB2 clears01D8; fullBCB2 contract already supplied separately, not a C06B callee.',
    coordinate_writer: 'BC36 loadsWORD0CC2 toY; chained SEC/SBC of0C00-0F30[Y]-0ED8[Y]-0CC6-0048, twoLSR/XBA/WORDSTA01D6; CLC/ADC0600+0E80[Y], SEC/SBC0E28[Y]/0CC4/0010, twoLSR/XBA/WORDSTA01D4. C/V and borrow are propagated as actual WORDinstructions; these fullWORDwrites own tailBYTE01D7/01D5.',
    selectors: 'BC67/BC80/BC99 eachJSRBC36 before writingWORD01E4/01E6 and equalWORD01E8/01D8=FFFF/FFFE/FFFD. BC80 uses05E4/0BE8; otherselectors0600/0C00. Source/mode/stack graphs closed, actual slot/scroll values and fullcaller lifecycle remain open.',
    getters: 'C0F7/C100 loadWORD01D5/01D7 thenAND00FF andWORDSTA bank00DP00. They stillread the neighboring01D6/01D8 byte although the mask discards it; separate from C06B BYTEreads.',
    aliases: '01D5 and01D7 are highbytes ofWORD01D4/01D6; WORD01D8 is independent. No detached OAMparameter copy. Physical7E/7F registeroffsets and parameters share realWRAM bytes; systembank registers require explicit request-only IO.',
    raw_patterns: { jsrC06B: scan([0x20, 0x6B, 0xC0]), sta01E8: scan([0x8D, 0xE8, 1]), stz01E8: scan([0x9C, 0xE8, 1]),
      sta01D4: scan([0x8D, 0xD4, 1]), sta01D6: scan([0x8D, 0xD6, 1]), sta01D8: scan([0x8D, 0xD8, 1]), stz01D8: scan([0x9C, 0xD8, 1]) },
    qualification: 'Raw bytepatterns plus selected complete localowners are not a complete direct/indirect writer/caller or runtime census. ROMwindows are original data; two64byte consecutive spans are metadata contingent on actualincrementing DMA, not observed transfer output.' },
  caller: { at: '80:C17C', target: '80:C06B', actual_nmi_dbr: '00', remaining_after: ['81:B0D1'] },
  boundaries: ['Manual atomicC06B request plan supplied separately with freshgate, two ordered420B requests, lateWORDclear, unconditionalOAMtail, BYTEflags/highA, shared view/budget and two protectedJSRbytes. Full localB0D1/B0AC/B0BD/B0C7 source and selectedsetup/callbacktail supplied inrender-b0d1.json. Native atomicB0D1 plan supplied separately with WORDcountdownwrap, freshgate reload, BYTEbrightness/highA/NZ/C and shared provider/budget/threeJSLbytes. Full local9E1A63/26 and F00729/15 source supplied inrender-9e1a.json: normalWORDreturn or explicitE1M1X1 resetterminal80E382, zeroexternalreturn assumptions; normal9E1A and standaloneF007 manualatomicplans supplied, complete reset held at source-required startup boundary. Complete localmain96AB72/25 chronology with17 explicitcallee-return boundaries and fullB0A1/F290/F298 nativewidth source supplied inrender-input-flow.json; both manualatomicwrappers supplied, counterchange isnotcallbackcompletion. Full localpostwait81:8877/886A/88A2/88E1 source185/82 andmanualatomic8877 plan supplied inrender-8877; original80D3D1 BYTEtable512 separate. Native8076 atomic updateplan supplied inrender-8076-native with freshWORD gates/progress/direction/index/count/table, ASLcarry, pointerwrap and shared provider/budget/threeJSLbytes. Full localBE6D206/85 andBCBE413/190 with alltransitive localcallees supplied inrender-be6d.json: closed2835/1318 WORD/DBR graph,32 protectedstackbytes,zeroexternalreturn assumptions; nativeBE6D/BCBE manual atomic composition supplied separately; actualtermination stillopen. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with freshBYTEaliases, hiddenhighA, shared provider/budget and5/7 protectedstackbytes. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json. Full localC1521027/419 eleven-callee graph supplied inrender-c152.json with zeroexternalreturn assumptions; manual atomicC152 supplied with six protectedstackbytes, one chronological provider/budget/commit and fresh orderedtail.',
    'Fullcallback manual atomiccomposition supplied separately inrender-c152; actualDMA/OAM/device behavior, sharedslot/scroll owner hydration, fullinterrupt lifetime, nativeA5/97, real01F8 waits and automatic scene/frame binding remain open.'] };
await writeFile('analysis/render-c06b.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-c06b.asm.txt', '; European ROM SHA-256 ' + metadata.rom_sha256
  + '\n; CompleteC06B140 bytes; callback3, fullowners152, selectedclear3, getters18, originalROMdata384 separately. Static only.\n\n' + blocks.map(formatBlock).join('\n'));
console.log(`C06B140/${report.instruction_count}: no calls, two transfer requests, unconditional OAMtail, BYTEflags/WORDreturn; owners152 and originalROM384.`);
