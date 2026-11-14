import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const state = { e: 0, m: 0, x: 0 };
const specs = [['input9E0B', 0x809E0B, 0x809E1A], ['callbackCallC179', 0x80C179, 0x80C17C],
  ['selectedEdge9E1A', 0x809E1A, 0x809E2C], ['selectedGetters9E59', 0x809E59, 0x809E65]];
const blocks = specs.map(([name, entry, end]) => {
  const instructions = [];
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, state);
    if (i.next > end || ['REP', 'SEP', 'PLP', 'PLB', 'XCE'].includes(i.mnemonic)) throw Error('Renew mode proof');
    instructions.push(i); pc = i.next;
  }
  return { name, entry, initialState: state, instructions,
    stop: name.startsWith('selected') ? 'Selected WORD consumer excerpts; full caller/mode/lifetime remains open' : 'Complete local body or selected callback; static source only' };
});
const windows = blocks.map(b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next),
    covered_bytes: raw.length, instruction_count: b.instructions.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
});
const callback = JSON.parse(await readFile('analysis/render-a9e1.json', 'utf8'));
if (callback.rom_sha256 !== metadata.rom_sha256 || callback.windows.find(w => w.name === 'callbackC152')
  ?.machine_bytes.slice((0xC179 - 0xC152) * 2, (0xC17C - 0xC152) * 2) !== windows[1].machine_bytes) throw Error('Callback drift');
const scan = pattern => {
  const hits = [];
  for (let p = 0; p <= bytes.length - pattern.length; p++) if (pattern.every((v, j) => bytes[p + j] === v))
    hits.push(cpuLabel(0x808000 + Math.floor(p / 0x8000) * 0x10000 + p % 0x8000));
  return hits;
};
const report = { rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json', windows, code_bytes: 15, instruction_count: 6,
  caller_bytes: 3, owner_excerpt_bytes: 30,
  scope: 'Complete local9E0B and selected callback, selected WORD edge/getter consumers. Static code/mode/stack only; no device execution, input mapping, clock, interrupt or wait termination inferred.',
  graph: { calls: [], edges: [{ from: '80:9E11', kind: 'BNE', to: '80:9E0B' }],
    proof: proveWordStack(new Map(blocks[0].instructions.map(i => [i.cpu, i])), 0x809E0B, 'RTS'),
    actual_wait_termination_proven: false },
  contract: {
    entry: 'E0/M0/X0/D0 binary, actualDBR, two protectedJSRbytes; no localpushes/calls or mode/DBR/D changes.',
    poll: 'Fresh WORD DBR:4212/4213 on every iteration; AND0001/BNE loops precisely for bit0=1, regardless of every other bit. WORDread includes high4213 even though AND discards it. No cached poll, delay, timeout, partial write or automatic acknowledgment in ROM.',
    capture: 'First poll withbit0=0 is followed by fresh WORD DBR:4218/4219 then WORDstore DBR:01CA/01CB. No01CC/01CE updates, no registerwrites, no CPUinput filtering or deduplication here.',
    returns: 'A equals fullcaptured4218 WORD; N frombit15,Z fromWORDzero,C/V/I/X/Y/DBR/D preserved. Finalflags come from LDA4218, not zeroAND or busy poll. WORDRTS structural only.',
    native_inputs: 'Systembanks need explicit per-call chronological ioRead4212 WORD samples and ioRead4218 WORD; record-requests ledger reads only. Exhaustion is source-required, not a synthetic clear. Stop at first clearbit0; unused samples are not consumed. Physical7E/7F require actual shared bytes, ignore device samples, and reread fresh4212 on every iteration; persistent busy is bounded by workbudget. No inferred hardware highbyte/open-bus value.',
    ownership: 'WORD01CA destination requires explicit ownership, not its previous value. Device WORD results include both bytes. A manual plan does not hydrate browser input, real joypad registers, automatic polling or native frame state.' },
  owners: {
    edge_excerpt: 'Selected9E1A..9E2B computes01CE=(fresh01CA XOR01CC) ANDfresh01CA, then copies fresh01CA to01CC. Full9E1A includes later filtering/reset path and external81:F007; not derived or implemented by9E0B.',
    getters: 'Selected9E59 loadsWORD DBR01CA and storesWORD bank00DP00;9E5F similarly loads01CE. WORD-entry assumptions only, actual callers/ABI/lifetimes remain separate.',
    raw_patterns: { jsr9E0B: scan([0x20, 0x0B, 0x9E]), sta01CA: scan([0x8D, 0xCA, 1]), lda01CA: scan([0xAD, 0xCA, 1]) },
    qualification: 'Raw bytepatterns are hints, not a complete direct/indirect writer or runtime census; second rawJSR80:F293 is not the selected NMIcall or a newly proved fullwrapper contract.' },
  caller: { at: '80:C179', target: '80:9E0B', actual_nmi_dbr: '00', remaining_after: ['80:C06B', '81:B0D1'] },
  boundaries: ['Manual native atomic9E0B plan supplied separately with fresh chronological explicit WORDreads, bit0 polling, full capturedWORD/NZ, late01CA store, shared view/budget and two protectedJSRbytes. Full localC06B/BC1A/BC36/selector/getter source and originalROM384 supplied inrender-c06b.json. Native atomicC06B plan supplied separately with two ordered420B requests, lateWORDclear, unconditionalOAMtail, BYTEflags/highA and shared provider/budget/twoJSRbytes. Full localB0D1/B0AC/B0BD/B0C7 source and selectedsetup/callbacktail supplied inrender-b0d1.json. Native atomicB0D1 plan supplied separately with WORDcountdownwrap, freshgate reload, BYTEbrightness/highA/NZ/C and shared provider/budget/threeJSLbytes. Full local9E1A63/26 and F00729/15 source supplied inrender-9e1a.json: normalWORDreturn or explicitE1M1X1 resetterminal80E382, zeroexternalreturn assumptions; normal9E1A and standaloneF007 manualatomicplans supplied, complete reset held at source-required startup boundary. Complete localmain96AB72/25 chronology with17 explicitcallee-return boundaries and fullB0A1/F290/F298 nativewidth source supplied inrender-input-flow.json; both manualatomicwrappers supplied, counterchange isnotcallbackcompletion. Full localpostwait81:8877/886A/88A2/88E1 source185/82 andmanualatomic8877 plan supplied inrender-8877; original80D3D1 BYTEtable512 separate. Native8076 atomic updateplan supplied inrender-8076-native with freshWORD gates/progress/direction/index/count/table, ASLcarry, pointerwrap and shared provider/budget/threeJSLbytes. Full localBE6D206/85 andBCBE413/190 with alltransitive localcallees supplied inrender-be6d.json: closed2835/1318 WORD/DBR graph,32 protectedstackbytes,zeroexternalreturn assumptions; nativeBE6D/BCBE manual atomic composition supplied separately; actualtermination stillopen. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with freshBYTEaliases, hiddenhighA, shared provider/budget and5/7 protectedstackbytes. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json. Full localC1521027/419 eleven-callee graph supplied inrender-c152.json with zeroexternalreturn assumptions; manual atomicC152 supplied with six protectedstackbytes, one chronological provider/budget/commit and fresh orderedtail.',
    'Fullcallback manual atomiccomposition supplied separately inrender-c152; actual4212/4218 device provider, full01CA consumers/filter/reset lifecycle, interrupt/timing/stack exclusion, nativeA5/97, real01F8 waits and automatic scene/frame binding remain open.'] };
await writeFile('analysis/render-9e0b.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-9e0b.asm.txt', '; European ROM SHA-256 ' + metadata.rom_sha256
  + '\n; Complete9E0B15/6, selectedcallback3, selectedconsumerexcerpts30. Static proof; no device or wait execution.\n\n' + blocks.map(formatBlock).join('\n'));
console.log('9E0B15/6: fresh WORDpoll bit0, WORDcapture/01CA, preserved C/V and structural RTS; real wait/device owner open.');
