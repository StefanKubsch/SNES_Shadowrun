import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';
import { proveInputWrapper } from './input-wrapper-proof.mjs';
import { inspectScriptTables } from './scripts.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 };
function block(name, entry, end, initialState = word) {
  let state = { ...initialState }; const instructions = [], saved = [];
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, state); if (i.next > end) throw Error('Input flow window overrun');
    instructions.push(i); pc = i.next;
    if (i.mnemonic === 'PHP') saved.push({ ...state });
    if (i.mnemonic === 'PLP') { state = saved.pop(); if (!state) throw Error('Unpaired flow PLP'); }
    if (['REP', 'SEP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = Number(i.mnemonic === 'SEP');
      if (i.value & 16) state.x = Number(i.mnemonic === 'SEP');
    }
    if (i.cpu === 0x809E54) state.e = 1;
    else if (['XCE', 'PLD', 'TCD', 'TCS', 'RTI', 'BRK', 'COP'].includes(i.mnemonic)) throw Error('Renew input flow source');
  }
  return { name, entry, initialState, instructions, stop: name === 'mainLoop96AB'
    ? 'Complete local mainloop only; all callee returns/modes/effects explicitly conditional, no fullmain graph'
    : name.startsWith('selected') ? 'Selected original excerpt, no fullowner/caller/mode/termination proof'
      : 'Complete local or reused byteverified body; static source only' };
}
const specs = [['mainLoop96AB', 0x8096AB, 0x8096F3], ['waitB0A1', 0x81B0A1, 0x81B0AC],
  ['captureWrapperF290', 0x80F290, 0x80F298], ['consumeWrapperF298', 0x80F298, 0x80F2A0],
  ['selectedNmiCounterC131', 0x80C131, 0x80C13B], ['selectedPreloop96A1', 0x8096A1, 0x8096AB],
  ['selectedPostWait8877', 0x818877, 0x81888C], ['selectedHeldBE6D', 0x80BE6D, 0x80BE7E],
  ['selectedEdgeBF3B', 0x80BF3B, 0x80BF53]];
const blocks = specs.map(s => block(...s));
const describe = b => { const raw = Buffer.concat(b.instructions.map(i => i.raw)); return {
  name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next),
  covered_bytes: raw.length, instruction_count: b.instructions.length,
  sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() }; };
const input = JSON.parse(await readFile('analysis/render-9e1a.json', 'utf8'));
const reused = input.windows.slice(0, 3).map(w => {
  const b = block(w.name, parseInt(w.entry.replace(':', ''), 16), parseInt(w.end_exclusive.replace(':', ''), 16));
  if (input.rom_sha256 !== metadata.rom_sha256 || JSON.stringify(describe(b)) !== JSON.stringify(w)) throw Error('Input dependency drift');
  return b;
});
const proofs = [];
for (const entry of [0x80F290, 0x80F298]) for (const m of [0, 1]) for (const x of [0, 1]) {
  const initialState = { e: 0, m, x };
  const wrapper = block('wrapper', entry, entry + 8, initialState);
  const graph = entry === 0x80F290 ? [wrapper, reused[2]] : [wrapper, reused[0], reused[1]];
  proofs.push(proveInputWrapper(new Map(graph.flatMap(b => b.instructions.map(i => [i.cpu, i]))), entry, initialState));
}
const mainMap = new Map(blocks[0].instructions.map(i => [i.cpu, i])), pending = [0x8096AB], seen = new Set();
while (pending.length) {
  const pc = pending.pop(); if (seen.has(pc)) continue;
  const i = mainMap.get(pc); if (!i) throw Error('Uncovered mainlocal edge'); seen.add(pc);
  if (i.mnemonic === 'RTS') continue;
  if (i.mode === 'rel8') pending.push(i.target);
  pending.push(i.next); // External calls are explicit conditional return assumptions, never executed.
}
if (seen.size !== mainMap.size) throw Error('Unvisited mainlocal source');
const calls = blocks[0].instructions.filter(i => ['JSL', 'JSR'].includes(i.mnemonic)).map(i => ({
  from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target),
  return_contract: i.target === 0x81B0A1 ? 'Complete localWORD RTL source; externalcounter change required, not guaranteed'
    : i.target === 0x809E1A ? 'NormalWORD RTS or nonreturnreset terminal; no unconditional continuation'
      : 'Explicit maincallee return/mode/byteowner boundary; wholecaller doesnot inherit isolatedhelper entry assumptions' }));
const writer = JSON.parse(await readFile('analysis/render-80c4.json', 'utf8'));
const requestOwner = writer.windows.find(w => w.entry === '81:8076');
if (!requestOwner || writer.rom_sha256 !== metadata.rom_sha256) throw Error('Missing8076 source');
const raw8076 = bytes.subarray(cpuToOffset(0x818076, bytes.length), cpuToOffset(0x8180C4, bytes.length));
if (requestOwner.machine_bytes !== raw8076.toString('hex').toUpperCase()) throw Error('8076 source drift');
const report = { rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json', windows: blocks.map(describe),
  scope: 'Complete local96AB mainloop, B0A1 and F290/F298; four nativeM/X entry combinations for both wrappers, input dependencies rechecked. Main17callee returns conditional, selected NMI/consumer/preloop excerpts. No CPU/device/clock execution or fullmain/interrupt proof.',
  main: { entry: '80:96AB', code_bytes: 72, instruction_count: blocks[0].instructions.length,
    reachable_local_instructions: seen.size, external_return_boundaries: calls.length, calls,
    branches: blocks[0].instructions.filter(i => i.mode === 'rel8').map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    returns: blocks[0].instructions.filter(i => i.mnemonic === 'RTS').map(i => cpuLabel(i.cpu)),
    chronology: 'JSL81B0A1 waits for fixed7E1C76 change; JSL818877 thenJSL818076 precede JSR809E1A. JSR80BE6D heldword consumer precedes JSR80BF3B edge consumer, thenJSRC1E3 tasksweep, JSR8000 gate. Carry1 from8000 orCC4B restarts96AB; otherwise DE94/AFC4/BAD5/8C2E/8A91/B8DE/FF14/E270 thenWORD1FDA nonzeroRTS96EC, elseWORD1FD8 zero restarts96AB/nonzeroRTS96F2. No direct9E0B capture here or unconditional9E1A-afterwait adjacency.',
    qualification: 'Local orderedinstructions undercompatible E0M0X0/D0 externalreturns only.17 explicit callee boundaries; no fullcallgraph or actualtermination/mode/DBR proof acrossmain. Interrupt may incrementcounter before callback finishes; do not combine waits/capture/consumer into automaticframe.' },
  wait: { proof: proveWordStack(new Map(blocks[1].instructions.map(i => [i.cpu, i])), 0x81B0A1, 'RTL'),
    contract: 'E0M0X0D0; longWORD7E1C76/1C77 baseline loadedonceintoA, freshlongWORDcomparison on everyloop. BEQ repeats atB0A5, notB0A1. AnyunequalWORD releases; no baseline reload, delta computation, catchup or elapsedtime. A remains originalbaseline; C/N/Z from finalunsignedWORDCMP baseline-observed, V/I/X/Y/DBR/D retained. N/Z neednot agreewithreturnedA. Unchanging actualbytes never release; no syntheticcounterupdate. Manual nativeB0A1 supplied separately with explicit actualWORD observations.',
    owners: 'Selected actualNMI bank00:C131 PHK/PLB setsDBR00 thenWORDINC1C76 atC133 beforePHP/JSL80C14F callbackdispatchC137. Sourcebytes shared80C131/00C131, bank-sensitivePHK matters. Increment is before9E0B capture insideC152, not callbackcompletion; no atomiccounter/capture pairing. Selected preloop clears1FD8/1FDA andcalls8861, fullparent/return proof separate.' },
  wrappers: { proofs, local_bytes: 16, dependencies: reused.map(describe),
    capture: 'F290 PHP/REP30/JSR9E0B/PLP/RTL. Allfour nativeM/X combinations; WORDpoll and capture even for incomingBYTEA/X. FullcapturedWORD remains inA, including highB when M1 restored; fullentryP/DBR/D restored, X/Y preserved. IncomingX1 requires actualzero highbytes. Sixprotectedbytes including rootJSL3/PHP1/childJSR2.',
    consume: 'F298 PHP/REP30/JSR9E1A/PLP/RTL onnormalbranch. Allfour nativeM/X combinations, fullentryP restored evenwhenN/Z/C disagreewithreturned nibble.01CC fullcopy/filter ordering retained. Normal sixprotectedbytes; resetbranch reaches ten(root3/PHP1/JSR2/childJSL3/PHP1) and abandonswrapperstatus/rootreturn at80E382, noPLP/RTL or successfulpartialreset.',
    ownership: 'ActualDBR01CA/01CC/01CE WORDpairs, physical7E/7F and systemaliases. Explicit4212/4218 chronology for systemcapture. No browserinput, nativeScriptfunction mapping or automaticmain pairing; F290/F298 are not entries in the220-function native table.' },
  selected_owners: { request8076: { source: 'analysis/render-80c4.json', ...requestOwner,
    qualification: 'Complete existinglocal8076 source rechecked; Manual native8076 atomic updateplan supplied separately; original caller-mode/DBR ownership remains open' },
    heldBE6D: 'Selected originalBE6D prefix unchanged; full localBE6D/BCBE andalltransitive source supplied inrender-be6d.json, closed2835/1318 graph,32 stackbytes; native manualatomiccomposition supplied; actualbyteowners/termination remainopen.',
    edgeBF3B: 'Selected1D5D/1D5F/01DA gates precede fresh01CE/AND8030. Full local304/132 BF3B andnativeFEC1 prerequisite supplied inrender-bf3b; nestedaction/dialog source andE382 remainopen; no unconditionaledge consumption.' },
  boundaries: ['Mainlocal chronology and bothmanualatomicwrappers supplied. Manual nativeB0A1 wait supplied separately with fixed baseline/global counterPolls/three protected stackbytes; actualNMI-/RTI-/counter/capture pairing remains unimplemented; no millis/framecatchup or automaticinput binding.',
    'Full localpostwait81:8877/886A/88A2/88E1 source185/82 andmanualatomic8877 plan supplied inrender-8877; original80D3D1 BYTEtable512 separate. Native8076 atomic updateplan supplied inrender-8076-native with freshWORD gates/progress/direction/index/count/table, ASLcarry, pointerwrap and shared provider/budget/threeJSLbytes. Full localBE6D206/85 andBCBE413/190 with alltransitive localcallees supplied inrender-be6d.json: closed2835/1318 WORD/DBR graph,32 protectedstackbytes,zeroexternalreturn assumptions; nativeBE6D/BCBE manual atomic composition supplied separately; actualtermination stillopen. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with freshBYTEaliases, hiddenhighA, shared provider/budget and5/7 protectedstackbytes. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json. NativeBE6D/BCBE andFEC1 supplied; fullBF3B nestedaction/dialog callees and originalmain return/interrupt lifecycle remain separate. Full80E382 startup/reset remains open.'] };
const native = inspectScriptTables(bytes).native_functions;
if (native.some(n => ['80:F290', '80:F298'].includes(n.cpu_address))) throw Error('Renew native wrapper mapping');
report.wrappers.native_table = { entries: native.length, wrapper_matches: [], getter_entries: native.filter(n => ['80:9E59', '80:9E5F'].includes(n.cpu_address)),
  qualification: 'Original native table only, no runtime reachability or all direct/indirect wrappercaller census' };
await writeFile('analysis/render-input-flow.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-input-flow.asm.txt', '; European ROM SHA-256 ' + metadata.rom_sha256
  + '\n; Main72 bytes,17 conditionalcallee boundaries; B0A1 fixedlongWORDcounter wait; F290/F298 nativeM/X source. No CPU/interrupt/frame execution.\n\n' + [...blocks, ...reused].map(formatBlock).join('\n'));
console.log(`Inputflow: main72/${report.main.instruction_count} local, ${calls.length} explicitcalls; wait11/4, wrappers16/10 with eight complete mode/stack proofs.`);
