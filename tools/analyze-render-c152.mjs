import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const reports = new Map();
for (const key of ['a9e1', '999a', '80c4', 'a919', 'a958', 'a98e', '8fba', '9e0b', 'c06b', 'b0d1']) {
  const report = JSON.parse(await readFile(`analysis/render-${key}.json`, 'utf8'));
  if (report.rom_sha256 !== metadata.rom_sha256) throw Error('Source revision drift');
  reports.set(key, report);
}
const sourceWindows = [reports.get('a9e1').windows.find(w => w.name === 'callbackC152'),
  reports.get('a9e1').windows.find(w => w.name === 'pretransfer8949'), reports.get('a9e1').windows[0],
  ...['999a', '80c4', 'a919', 'a958', 'a98e', '8fba', '9e0b', 'c06b', 'b0d1'].map(key => reports.get(key).windows[0])];
const address = label => parseInt(label.replace(':', ''), 16), word = { e: 0, m: 0, x: 0 };
const blocks = sourceWindows.map(window => {
  const entry = address(window.entry), end = address(window.end_exclusive), state = { ...word }, instructions = [];
  for (let pc = entry; pc < end;) {
    if (pc === 0x81B114) state.m = 1; // Both stopping edges are BYTE joins.
    const i = decode(bytes, pc, state);
    if (i.next > end || ['PLP', 'PLB', 'PLD', 'TCD', 'TCS', 'XCE', 'SED', 'PHP', 'PHA', 'PHX', 'PHY', 'PHB', 'PHD'].includes(i.mnemonic)) throw Error('Renew callback proof');
    instructions.push(i); pc = i.next;
    if (['REP', 'SEP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = Number(i.mnemonic === 'SEP');
      if (i.value & 16) state.x = Number(i.mnemonic === 'SEP');
    }
  }
  const raw = Buffer.concat(instructions.map(i => i.raw));
  if (raw.toString('hex').toUpperCase() !== window.machine_bytes || instructions.length !== window.instruction_count
    || createHash('sha256').update(raw).digest('hex') !== window.sha256) throw Error('Individual source window drift');
  return { name: window.name, entry, initialState: word, instructions,
    stop: 'Complete local callback graph; all eleven call bodies included, no external return assumptions; structural only, no CPU/device/interrupt execution' };
});
const calls = blocks[0].instructions.filter(i => ['JSR', 'JSL'].includes(i.mnemonic));
const expected = [0x818949, 0x81A9E1, 0x80999A, 0x8180C4, 0x81A919, 0x81A958, 0x81A98E, 0x808FBA, 0x809E0B, 0x80C06B, 0x81B0D1];
if (calls.length !== 11 || calls.some((i, j) => i.target !== expected[j])
  || blocks.slice(1).some(b => b.instructions.some(i => ['JSR', 'JSL'].includes(i.mnemonic)))) throw Error('Callback callgraph drift');
const map = new Map(blocks.flatMap(b => b.instructions.map(i => [i.cpu, i])));
const proof = proveWordStack(map, 0x80C152);
if (proof.reachable_instructions !== map.size) throw Error('Unreachable callback graph bytes');
const report = { rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json', windows: sourceWindows,
  callback_bytes: 84, callback_instructions: 28, callee_bytes: sourceWindows.slice(1).reduce((n, w) => n + w.covered_bytes, 0),
  code_bytes: sourceWindows.reduce((n, w) => n + w.covered_bytes, 0), instruction_count: map.size,
  scope: 'Complete localC152 graph with all eleven individually byte-matched call bodies and orderedtail. Structural mode/typedstack/DBRreturn only; no CPU/device/interrupt execution, polltermination, channelprogress or automatic frame binding.',
  graph: { calls: calls.map(i => ({ at: cpuLabel(i.cpu), kind: i.mnemonic, target: cpuLabel(i.target), return_bytes: i.length - 1 })),
    proof, root_return_bytes: 3, maximum_nested_return_bytes: 3, required_stack_bytes: 6,
    actual_poll_termination_proven: false, actual_nmi_rti_return_proven: false },
  contract: {
    entry: 'Manual E0/M0/X0/D0 binary, actualDBR, six protected stackbytes for rootJSL3 plus deepestchildJSL3 (JSRchildren2). No calleepushes/transitivecalls. Structural proof visits every includedinstruction and has zeroexternalreturn assumptions; doesnot execute eitherstack orNMI.',
    prologue: 'BYTE2100=80 beforeallcallees; REP20/elevenorderedcalls. InitialHighA is unobserved:8949 firstWORDread replacesA beforeuse; initialC/V/I pass through firstBYTE-LDA/REP.',
    shared: 'Oneprovider, chronologicalbyteoverlay, budget and outercommit. A/X/Y/status flow intoeachnextcallee; rootchanges onlyA/NZ byBYTE-LDA. Laterreads see earlierwrites/clears; no independentcallee commits. A9E1 clear01F8 is not wholecallback completion. A919/A958 consume1562 before A98E clearsit. DP82/F6/F8 stay bank00 independent ofDBR.',
    reads: 'Systembank explicit213A BYTE onlywhenreached inA9E1; chronological4212 WORDsamples and4218 WORD alwaysrequired when9E0B reached. Physical7E/7F use actualsharedregisteroffsetbytes; no devicevalue, highbyte, acknowledgment orclock inferred.',
    tail: 'AfterB0D1, freshBYTE01BC/01BE/01C0/01C2/01C4 interleaveBYTE2100/212C/212D/212E/420C writes; no snapshot, adjacenthighbyte read, mask orreset. Tail01BC sees B0D1 update. REP20/RTL preserves finalBYTEflags.',
    returns: 'A=(B0D1returnedA&FF00)|freshBYTE01C4; N from01C4bit7,Z from01C4BYTEzero,evenwhenHighA nonzero. C/V/I fromB0D1 and precedingactualpath, X fromC06Bfresh01D8, Y from precedingA919/999A orentry; DBR/D preserved. No successfuldevice orwholeframe flag.',
    atomic: 'Any reached lateIO/source/write/stack/budget boundary withholds all earlierrequests and datawrites, including initial2100=80, earlier01F8/1562/0140/01CA/01E8/brightness changes and alltailwrites. Onlyonefinished revision/owner-bound privatecommit payload.' },
  boundaries: ['Full local9E1A63/26 and F00729/15 source supplied inrender-9e1a.json: normalWORDreturn or explicitE1M1X1 resetterminal80E382, zeroexternalreturn assumptions; normal9E1A and standaloneF007 manualatomicplans supplied, complete reset held at source-required startup boundary. Complete localmain96AB72/25 chronology with17 explicitcallee-return boundaries and fullB0A1/F290/F298 nativewidth source supplied inrender-input-flow.json; both manualatomicwrappers supplied, counterchange isnotcallbackcompletion. Full localpostwait81:8877/886A/88A2/88E1 source185/82 andmanualatomic8877 plan supplied inrender-8877; original80D3D1 BYTEtable512 separate. Native8076 atomic updateplan supplied inrender-8076-native with freshWORD gates/progress/direction/index/count/table, ASLcarry, pointerwrap and shared provider/budget/threeJSLbytes. Full localBE6D206/85 andBCBE413/190 with alltransitive localcallees supplied inrender-be6d.json: closed2835/1318 WORD/DBR graph,32 protectedstackbytes,zeroexternalreturn assumptions; nativeBE6D/BCBE manual atomic composition supplied separately; actualtermination stillopen. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with freshBYTEaliases, hiddenhighA, shared provider/budget and5/7 protectedstackbytes. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json.',
    'Manual atomicC152 composition supplied separately; actual NMI dispatch/stackchanges/RTI, real4212/4218/213A device provider, full WRAMslot/task/transfer ownership, nativeA5/97, real01F8 waits and automatic scene/frame binding remain open.'] };
await writeFile('analysis/render-c152.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-c152.asm.txt', '; European ROM SHA-256 ' + metadata.rom_sha256
  + `\n; C15284/28 plus eleven bodies${report.callee_bytes}; all${map.size} instructions structurally covered, zeroexternalreturn assumptions.\n; Six protected root/nested returnbytes; no actual poll/NMI/device execution.\n\n` + blocks.map(formatBlock).join('\n'));
console.log(`C152 full graph ${report.code_bytes}/${map.size}, eleven callees, six stackbytes, zeroexternalreturn assumptions; actualdevice/termination open.`);
