import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 };
const specs = [['requestACB5', 0x81ACB5, 0x81ACBD], ['waitACAF', 0x81ACAF, 0x81ACB5],
  ['entryACCF', 0x81ACCF, 0x81AD92], ['renderAD92', 0x81AD92, 0x81ADBA],
  ['ackAA20', 0x81AA20, 0x81AA48], ['callC15F', 0x80C15F, 0x80C163], ['callAC07', 0x81AC07, 0x81AC0B]];
function block(name, entry, end) {
  const instructions = [], state = { ...word };
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, state);
    if (i.next > end || ['XCE', 'TCD', 'PLD', 'SED', 'RTI', 'BRK', 'COP'].includes(i.mnemonic)) throw Error(`Renew ${name} source proof`);
    instructions.push(i); pc = i.next;
    if (['REP', 'SEP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = i.mnemonic === 'SEP' ? 1 : 0;
      if (i.value & 16) state.x = i.mnemonic === 'SEP' ? 1 : 0;
    }
  }
  return { name, entry, initialState: word, instructions,
    stop: 'Complete selected local body, bounded acknowledgment slice or raw-call anchor; no CPU/device execution or wait completion' };
}
const blocks = specs.map(s => block(...s));
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next),
    covered_bytes: raw.length, instruction_count: b.instructions.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const address = label => Number.parseInt(label.replace(':', ''), 16);
const dependencies = await Promise.all(['render-a9b2', 'motion-reset-bcb2'].map(async file => {
  const report = JSON.parse(await readFile(`analysis/${file}.json`, 'utf8'));
  if (report.rom_sha256 !== metadata.rom_sha256) throw Error('Dependency ROM mismatch');
  const selected = report.windows.filter(w => file === 'render-a9b2' ? w.name !== 'callerAD92'
    : ['resetBCB2', 'releaseBE5B', 'removeFA3E'].includes(w.name));
  const reused = selected.map(w => {
    const b = block(w.name, address(w.entry), address(w.end_exclusive));
    if (JSON.stringify(describe(b)) !== JSON.stringify(w)) throw Error('Dependency bytes or modes changed');
    return b;
  });
  return { report: `analysis/${file}.json`, windows: selected, blocks: reused };
}));
const all = [...blocks.slice(0, 4), ...dependencies.flatMap(d => d.blocks)];
const map = new Map(all.flatMap(b => b.instructions.map(i => [i.cpu, i])));
if (map.size !== all.reduce((n,b) => n+b.instructions.length, 0)) throw Error('Duplicate graph coverage');
const structuralProofs = [0x81ACAF, 0x81ACB5, 0x81ACCF, 0x81AD92, 0x80BCB2].map(entry => proveWordStack(map, entry, entry === 0x80BCB2 ? 'RTS' : 'RTL'));
const renderInstructions = 16 + 3 + 3 + 97 + 249;
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope: 'Complete local ACB5/ACAF/ACCF and AD92:249 code bytes/119 instructions. Separate AA20 acknowledgment slice40 and two rawJSL anchors8. Existing verified A9B2/AF1F/decompressor plus reset sources reused byte-for-byte. Closed structural render/reset graphs, no input termination or actual wait proof, no native renderer.',
  windows: blocks.map(describe), code_bytes: 249, acknowledgment_bytes: 40, caller_bytes: 8,
  dependencies: dependencies.map(({report,windows}) => ({report,windows})),
  local_graphs: blocks.slice(0, 4).map(b => ({ name: b.name, instruction_count: b.instructions.length,
    edges: b.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    return_sites: b.instructions.filter(i => i.mnemonic === 'RTL').map(i => cpuLabel(i.cpu)) })),
  structural_proofs: structuralProofs,
  closed_render_graph: { entry: '81:AD92', code_bytes: 790, instructions: renderInstructions, external_return_assumptions: 0 },
  closed_reset_graph: { entry: '80:BCB2', code_bytes: 861, instructions: renderInstructions + 31, external_return_assumptions: 0 },
  actual_memory_termination_proven: false,
  entry: 'Explicit E0/M0/X0,D0000,binary arithmetic, actual DBR mapping and known source/output/scratch bytes plus valid disjoint stack. ACCF sets DBR7E and structurally restores entryDBR/X; arbitrary data aliases or foreign writes may invalidate that guarantee. No CPU execution.',
  request: { increment: 'ACB5 INC WORD DBR:01F8 thenJSL81ACAF/RTL. WordwrapFFFF->0000 permits immediate wait exit;this doesnotprove any transfer happened. Normal0->1 requires a later realzero. No Boolean set or inferred frame delay.',
    wait: 'ACAF repeatedly LDA WORD DBR:01F8/BNEACAF,RTL onlyonactualzero. No localwrite,call,modechange or delaycounter. Onintactreturn A0,N0/Z1,X/Y/Carry/V/DBR/D/E/M/X/decimal preserved acrossthis localwait;ACB5 changes only01F8 directly. No standalone boundedwait success forconstantnonzero.',
    acknowledgment: 'Selected AA20..AA47:WORD01F8 zero skips slice toAA48. Nonzero writesWORD4372=23A0,4375=0740,2116=7800;SEP20/BYTE2115=80/BYTE420B=80/REP20;thenSTZWORD01F8. No omitted highbyte clear. Full localA9E1/caller/channel source supplied separately inrender-a9e1.json; actual lifecycle remains open;registerwrites alone do not prove hardware transfer.',
    anchors: 'Raw JSL81A9E1 pinned at80C15F and81AC07. These four-byte anchors are not complete callers or a proof of incoming modes/DBR/interrupt provenance. AA20 is a selected writer slice,not standalone RTL routine.' },
  entry_draw: {
    setup: 'PHB;PEA7E7E/twoPLB;STXWORDCF. Sequential longWORDreads7E2080+X->D2,7E2180+X->C9,7E2000+X->C3/Y. FirstwriteWORD(2001 OR freshC9) atDBR7E:23A0+Y;INYtwice;onlythenreadWORD7E2020+X. No alignment or capacity gate;allsourceWORDhighbytes required.',
    top: 'WidthWORD-2 viaDECA twice ->sharedC6,thenTAX. Unconditional do-loop WORD(2002 OR freshC9),write23A0+Y,INYtwice,DEX/BNE. C6zero nominal65536 writes,notzero. Rightcap WORD6001 OR freshC9 atcurrentY. ReloadXfromsharedCF;onlythenreadWORD7E2040+X andDECA twice ->rowcountX. Heightread must see earlieroutput aliases.',
    middle: 'Unconditional rowloop evenifrowcount0:CLC/LDAC3/ADC40/STAC3/TAY;WORD2003 OR freshC9 leftcap;INYtwice;LDAC6/STACC;LDAD2/ORAC9 once beforeinnerloop. Innerwrite23A0+Y;INCA thenINCWORDD2,INYtwice,DECWORDCC/BNE. Aincrements the alreadyORedWORD; do not recomputeD2 OR C9 percell. CCzero nominal65536 cells. Rightcap WORD6003 OR freshC9.',
    wrap: 'PHX protects rowcount;LDXsharedCF;SEC/LDAD2/SBC longWORD7E2060+X;CMP longWORD7E20A0+X;BCC keepsD2. Unsigneddifference>=limit(including equality) reloads base viaa second actual7E2060+X read andSTAD2. No signedguard;borrowed difference wrapsWORD. PLX/DEX/BNE advancesrows. ReturnedCarry isnot a successflag.',
    bottom: 'CLC/LDAC3/ADC40/STAC3/TAY;WORD A001 OR freshC9;INYtwice;LDXsharedC6;unconditional loop WORD A002 OR freshC9,write/INYtwice/DEX/BNE;finalWORD E001 OR freshC9. LDXsharedCF/PLB/RTL. C3 is finalrowbase,Y isrightcapcursor;finalrightcapdoesnotadvanceY. StackX/DBR structurallyrestored;flags/registers depend on actualsources/path.',
    ownership: 'SharedDP WORDwrites C3,C6,C9,CC,CF,D2; output is same WRAMbuffer23A0 asA9B2/AF1F,not a copiedtilearray. Real byteowners, oddoffsets, wrappingcounters, evolving A and repeatedreads must remain ordered. No invented capacities, nullinitialization or DMA acknowledgment. ActualWRAM/device/stack/source coverage andinterrupt interference remain preflight boundaries.' },
  wrapper: 'AD92 nowhasno external localcall boundary:A9B2 first, fresh0204 signedgate, fresh0200/0226 entryreads, ACCF onlyatnonzeroentry withunsignedX>=0200, INXtwice/fresh0204 inclusivecompare, ACB5 last/unconditional. ACCF structuralXrestore isproved forintactsharedCF;countbounds/aliases andactual01F8 acknowledgment stillrequired. Localgraph closeswithoutclaimingfiniteactualreset/renderreturn.',
  boundaries: ['Full A9E1/8949,actual00:C112 NMIcaller andlocalchannelinitialization source supplied inrender-a9e1.json. Full localAA9C/AB2C/maincaller source supplied inrender-aa9c.json. Native9F49/A9B2/AF1F/AA9C atomic data plans supplied, with explicit request-only IO and stable arithmetic contracts. Native A9E1 ordered request plan supplied with fresh parameters, clear ordering and explicit213A metadata read contract. Native AB2C atomic initializer supplied with original channel0 ROM assets, shared AA9C/A9E1 byte view and request-only IO. Native8949 atomic ordered request plan supplied with both early gates, fresh parameters and paired scroll byte writes. Full local999A/caller-prefix source supplied inrender-999a.json, including WORDcountwrap, five-ASL carry, BYTEtail and shared aliases. Native999A atomic ordered request plan supplied with fresh gates/records/tail, WORDcountwrap, five-ASL carry, shared aliases and request-only IO. Full local80C4/requestwriter source supplied inrender-80c4.json. Native80C4 atomic request plan supplied separately with fresh indexedBYTE/unindexedsize, fullX/bankcarry, six stores, shared aliases and lateclear. Full localA919/listwriter source supplied inrender-a919.json. NativeA919 atomic request plan supplied separately with signedBPL/countwrap, bothshiftCarries, fresh records, fullWORDbankcarry and shared aliases. Full localA958 and selected outputwriter source supplied inrender-a958.json. Native atomicA958 request plan supplied separately with fresh tables, DBR-independentDP82, retained highA, latecursorstore and shared view/budget/stack. Full localA98E and selected bufferwriter/setup source supplied inrender-a98e.json. Native atomicA98E request plan supplied separately with four ordered requests, lateWORDgateclear, retained A8004/BYTEflags and shared provider/budget/stack. Full local8FBA/reset/setup/selectedparameter source supplied inrender-8fba.json. Native atomic8FBA request plan supplied separately with signedgate, DBR-independentDP, WORDpointerwrap C/V, seven ordered requests, lateFFFF marker and shared view/budget/twoJSRbytes. Full local9E0B/selectedconsumer source supplied inrender-9e0b.json. Native atomic9E0B plan supplied separately with explicit chronological WORDsamples, bit0 polling, capturedWORD/NZ, late01CA store and shared provider/budget/twoJSRbytes. Full localC06B/BC1A/BC36/selector/getter source and originalROM384 supplied inrender-c06b.json. Native atomicC06B plan supplied separately with two ordered420B requests, lateWORDclear, unconditionalOAMtail, BYTEflags/highA and shared provider/budget/twoJSRbytes. Full localB0D1/B0AC/B0BD/B0C7 source and selectedsetup/callbacktail supplied inrender-b0d1.json. Native atomicB0D1 plan supplied separately with WORDcountdownwrap, freshgate reload, BYTEbrightness/highA/NZ/C and shared provider/budget/threeJSLbytes. Full local9E1A63/26 and F00729/15 source supplied inrender-9e1a.json: normalWORDreturn or explicitE1M1X1 resetterminal80E382, zeroexternalreturn assumptions; normal9E1A and standaloneF007 manualatomicplans supplied, complete reset held at source-required startup boundary. Complete localmain96AB72/25 chronology with17 explicitcallee-return boundaries and fullB0A1/F290/F298 nativewidth source supplied inrender-input-flow.json; both manualatomicwrappers supplied, counterchange isnotcallbackcompletion. Full localpostwait81:8877/886A/88A2/88E1 source185/82 andmanualatomic8877 plan supplied inrender-8877; original80D3D1 BYTEtable512 separate. Native8076 atomic updateplan supplied inrender-8076-native with freshWORD gates/progress/direction/index/count/table, ASLcarry, pointerwrap and shared provider/budget/threeJSLbytes. Full localBE6D206/85 andBCBE413/190 with alltransitive localcallees supplied inrender-be6d.json: closed2835/1318 WORD/DBR graph,32 protectedstackbytes,zeroexternalreturn assumptions; nativeBE6D/BCBE manual atomic composition supplied separately; actualtermination stillopen. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with freshBYTEaliases, hiddenhighA, shared provider/budget and5/7 protectedstackbytes. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json. Full localC1521027/419 eleven-callee graph supplied inrender-c152.json with zeroexternalreturn assumptions; manual atomicC152 supplied with six protectedstackbytes, one chronological provider/budget/commit and fresh orderedtail; real lifecycle/native acknowledgment remain open.',
    'NativeA5/97, render providers/byteownership, inputcoverage/alias/termination guarantees, interrupt/transfer lifecycle andautomatic transition/frame binding remain open. No CPU, DMA, graphics or scene execution.'],
};
await writeFile('analysis/render-ad92.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-ad92.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Local ACB5/ACAF/ACCF/AD92:249 bytes;ack40/rawcallanchors8 separate.\n; Reused verified source yields closed render790/reset861 byte structuralgraphs.\n; No CPU execution, inputtermination or real01F8 wait completion.\n\n` + blocks.map(formatBlock).join('\n'));
console.log('ACB5/ACAF/ACCF/AD92249 bytes,ack40/callanchors8 pinned;render790/reset861 graphs structurallyclosed. Actual wait remains explicit boundary.');
