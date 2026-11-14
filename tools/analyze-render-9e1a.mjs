import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';
import { proveInput9E1A } from './render-9e1a-proof.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 };
const specs = [['consumer9E1A', 0x809E1A, 0x809E59], ['apuF007', 0x81F007, 0x81F024],
  ['capture9E0B', 0x809E0B, 0x809E1A], ['heldGetter9E59', 0x809E59, 0x809E5F],
  ['edgeGetter9E5F', 0x809E5F, 0x809E65], ['wordWrapperF298', 0x80F298, 0x80F2A0],
  ['selectedCallerC067', 0x80C067, 0x80C06B], ['selectedMain96B7', 0x8096B7, 0x8096BA],
  ['selectedOtherClearD1F0', 0x81D1F0, 0x81D1F3],
  ['selectedRestartE382', 0x80E382, 0x80E39F, { e: 1, m: 1, x: 1 }]];
const blocks = specs.map(([name, entry, end, initialState = word]) => {
  let state = { ...initialState }; const instructions = [], statuses = [];
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, state);
    if (i.next > end || ['PLD', 'TCD', 'TCS', 'RTI', 'BRK', 'COP'].includes(i.mnemonic)) throw Error('Renew input mode proof');
    instructions.push(i); pc = i.next;
    if (i.mnemonic === 'PHP') statuses.push({ ...state });
    if (i.mnemonic === 'PLP') { state = statuses.pop(); if (!state) throw Error('Unpaired input PLP'); }
    if (['SEP', 'REP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = Number(i.mnemonic === 'SEP');
      if (i.value & 16) state.x = Number(i.mnemonic === 'SEP');
    }
    if (i.mnemonic === 'XCE') {
      if (i.cpu === 0x809E54) state = { e: 1, m: 1, x: 1 };
      else if (i.cpu !== 0x80E39E) throw Error('Renew XCE source lemma');
    }
  }
  if (statuses.length) throw Error('Unbalanced input status');
  return { name, entry, initialState, instructions, stop: name.startsWith('selected')
    ? 'Selected caller/clear/start excerpt only; no complete caller or restart lifecycle proof'
    : 'Complete local body, conditional return or reset handoff; static source only' };
});
const windows = blocks.map(b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next),
    covered_bytes: raw.length, instruction_count: b.instructions.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
});
const previous = JSON.parse(await readFile('analysis/render-9e0b.json', 'utf8'));
if (previous.rom_sha256 !== metadata.rom_sha256
  || windows[0].machine_bytes.slice(0, 36) !== previous.windows.find(w => w.name === 'selectedEdge9E1A')?.machine_bytes
  || windows[2].machine_bytes !== previous.windows[0].machine_bytes
  || windows[3].machine_bytes + windows[4].machine_bytes !== previous.windows.find(w => w.name === 'selectedGetters9E59')?.machine_bytes) throw Error('Input source drift');
const writers = JSON.parse(await readFile('analysis/motion-prefix-writers.json', 'utf8'));
if (writers.rom_sha256 !== metadata.rom_sha256 || windows[1].machine_bytes !== writers.windows.find(w => w.name === 'apuHandshake')?.machine_bytes) throw Error('APU source drift');
const scan = pattern => {
  const hits = [];
  for (let p = 0; p <= bytes.length - pattern.length; p++) if (pattern.every((v, j) => bytes[p + j] === v))
    hits.push(cpuLabel(0x808000 + Math.floor(p / 0x8000) * 0x10000 + p % 0x8000));
  return hits;
};
const graphBlocks = blocks.slice(0, 2), graphMap = new Map(graphBlocks.flatMap(b => b.instructions.map(i => [i.cpu, i])));
const edges = graphBlocks.flatMap(b => b.instructions.filter(i => i.target !== undefined)
  .map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })));
const report = { rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json', windows, code_bytes: windows[0].covered_bytes,
  callee_bytes: windows[1].covered_bytes, instruction_count: windows[0].instruction_count,
  graph_instruction_count: graphMap.size,
  scope: 'Complete local9E1A/filter/reset handoff and F007, capture/getters and WORD-entry wrapper; selected callers/otherclear/restart prefix. Static source/mode/stack only, no CPU/APU/clock/scene execution or full restart graph.',
  graph: { edges, calls: edges.filter(e => e.kind === 'JSL'), proof: proveInput9E1A(graphMap),
    apu_proof: proveWordStack(new Map(blocks[1].instructions.map(i => [i.cpu, i])), 0x81F007, 'RTL') },
  contract: {
    entry: 'E0/M0/X0/D0 binary, actualDBR and intact disjoint rootJSR2 stackbytes. Reset branch reaches four additional localstackbytes (childJSL3/PHP1); six total. No device/interrupt interference assumed.',
    edge: 'Fresh WORD01CA, EORfresh01CC, ANDfresh01CA, WORDstore01CE; then freshWORD01CA and WORDstore01CC. Edge=(current XORprevious) ANDcurrent. WholeWORD bytes including lowbits retained in01CC even if subsequently filtered.',
    filter: 'CMP3030 exactWORD equality chooses reset BEFORE AND000F. All other inputs return with A=current&000F; nonzero nibble clearsWORD01CA thenWORD01CE, zero nibble leaves both. No01CC clear. No repeat timer, debounce or browser mapping.',
    returns: 'Normal RTS80:9E3C, E0/M0/X0, incomingDBR/D/X/Y/V/I preserved. A=nibble0..15,N0,Z=(nibble==0); C from unsignedCMPcurrent3030 even afterAND/STZ. Original current01CA is kept in01CC.',
    reset: 'Exact3030: PEA8080/PLB/PLB forcesDBR80 without saving entryDBR; LDA0000/JSL81F007. Conditional on APUack, secondPEA8080/PLB/PLB, SEP30 truncatesX/Y, BYTE STZ804200, SEC/XCE entersE1M1X1,C0 then JML80E382. No RTS, rootframe abandoned, S forced to page01. FinalN1/Z0 from secondPLB80; V/I retained. Startup beyond selectedE382 prefix remains a source boundary.',
    apu: 'F007 PHP savesincomingstatus; SEP20 leavesWORDX; XBA/LDA DBR1CE4 loadsBYTEtoken once. FreshBYTECMP DBR2140/BNE until equality with token; incomingAhLow is command afterswap. WORDSTX2142/2143, BYTEINCtoken wrap, XBA/BYTEstore2141=command, XBA/BYTEstore2140=nextToken, BYTEstore1CE4=nextToken, PLP/RTL. Returns A=(command<<8)|nextToken, X/Y/DBR/D and fullstatus restored; no reread1CE4 or audio execution.9E1A command=00 but X is actualincomingWORD, not zero.',
    ownership: 'Normal01CA/01CC/01CE are actualDBR-relative pairs, no inferred initialzeros. Reset switchesAPU1CE4/device addresses toDBR80 regardless of inputDBR, physical7F included. System device reads need explicit chronologicalBYTEsamples; physical7E/7F in standaloneF007 are actualbytes, not I/O. No assumedacknowledgment.',
  },
  owners: { capture: 'Complete9E0B writes01CA after freshWORD4218; manualC152 captures only, it does not call9E1A.',
    getters: 'Full9E59/9E5F underWORDentry read held01CA or edge01CE and storeWORDbank00DP00. Native dispatch and fullcallermodes remain separate.',
    wrapper: 'Full80F298..F29F underWORDentry: PHP/REP30/JSR9E1A/PLP/RTL for normal branch. Reset never returns throughPLP/RTL. Arbitrary entry widths and actualwrapperscaller remain unproved.',
    selected_other_clear: '81D1F0 WORDSTZ01CA is one selected latertransferclear; followingownerbody/callermode/lifetime not proved.',
    raw_patterns: { jsr9E1A: scan([0x20, 0x1A, 0x9E]), sta01CC: scan([0x8D, 0xCC, 1]),
      sta01CE: scan([0x8D, 0xCE, 1]), stz01CA: scan([0x9C, 0xCA, 1]), stz01CE: scan([0x9C, 0xCE, 1]) },
    qualification: 'Raw bytepatterns are hints, not exhaustive direct/indirect/long/indexed writer or caller census.19 JSRpatterns do not establish19 validruntimecallers or theirDBR/modes.' },
  boundaries: ['Normal9E1A and standaloneF007 manual atomicplans are supplied separately. Full reset path must withhold all earlieredge/APU effects at the unimplemented80E382 restart boundary. No normalreturn fabricated for3030.',
    'Mainlocal72/25 chronology with17 explicitcallee-return boundaries, fullB0A1/F290/F298 nativewidth source and bothmanualatomicwrappers supplied inrender-input-flow; counterchange isnotcallbackcompletion. Full localpostwait81:8877/886A/88A2/88E1 source185/82 andmanualatomic8877 plan supplied inrender-8877; original80D3D1 BYTEtable512 separate. Native8076 atomic updateplan supplied inrender-8076-native with freshWORD gates/progress/direction/index/count/table, ASLcarry, pointerwrap and shared provider/budget/threeJSLbytes. Full localBE6D206/85 andBCBE413/190 with alltransitive localcallees supplied inrender-be6d.json: closed2835/1318 WORD/DBR graph,32 protectedstackbytes,zeroexternalreturn assumptions; nativeBE6D/BCBE manual atomic composition supplied separately; actualtermination stillopen. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with freshBYTEaliases, hiddenhighA, shared provider/budget and5/7 protectedstackbytes. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json. Full80:E382 startup/APUboot graph remains separate before native reset completion. Real deviceproviders4212/4218/213A/2140, actualAPU progress, interrupt ownership, nativeA5/97, real01F8 waits and automatic scene/frame binding remain open.'] };
await writeFile('analysis/render-9e1a.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-9e1a.asm.txt', '; European ROM SHA-256 ' + metadata.rom_sha256
  + '\n; Complete9E1A + F007. Normal WORDRTS or explicit E1M1X1 JML restart boundary. No CPU/device/clock execution.\n\n' + blocks.map(formatBlock).join('\n'));
console.log(`9E1A ${report.code_bytes}/${report.instruction_count}, F007 ${report.callee_bytes}/15: fresh WORDedges, nibblefilter, exact3030 nonreturn reset handoff; APU/startup remains explicit.`);
