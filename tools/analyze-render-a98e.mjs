import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 };
const specs = [
  ['objectRequestA98E', 0x81A98E, 0x81A9B2],
  ['callbackCallC172', 0x80C172, 0x80C176],
  ['initializeA779', 0x81A779, 0x81A7FB],
  ['gateIncrementA954', 0x81A954, 0x81A958],
  ['selectedGateClearA772', 0x81A772, 0x81A775],
  ['selectedBufferClear902E', 0x80902E, 0x80904F],
  ['selectedBufferWriterB158', 0x80B158, 0x80B16D],
  ['selectedBufferWriterB793', 0x80B793, 0x80B7BA],
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
    stop: name.startsWith('selected') ? 'Selected owner excerpt only; full caller/DBR/mode/return/lifetime remains open'
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
  || callback?.machine_bytes.slice((0xC172 - 0xC152) * 2, (0xC176 - 0xC152) * 2) !== describe(blocks[1]).machine_bytes) throw Error('Callback source drift');
const slot = JSON.parse(await readFile('analysis/slot-state.json', 'utf8'));
const init = slot.source_blocks.find(w => w.entry === '81A779');
const raw = describe(blocks[2]).machine_bytes;
// Existing initializer listing stops at its first BRA; selected taken
// continuationA7F1/A7F3 covers the remainder. Verify each prior source slice.
for (const entry of ['81A779', '81A7F1', '81A7F3']) {
  const old = slot.source_blocks.find(w => w.entry === entry), at = Number.parseInt(entry, 16);
  if (slot.rom_sha256 !== metadata.rom_sha256 || !old
    || raw.slice((at - 0x81A779) * 2, (at - 0x81A779) * 2 + old.machine_bytes.length) !== old.machine_bytes) throw Error('Existing initializer drift');
}
if (!init) throw Error('Missing initializer source');
const scan = pattern => {
  const candidates = [];
  for (let p = 0; p <= bytes.length - pattern.length; p++) if (pattern.every((v, j) => bytes[p + j] === v))
    candidates.push(cpuLabel(0x808000 + Math.floor(p / 0x8000) * 0x10000 + p % 0x8000));
  return candidates;
};
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope: 'Complete localA98E, selected callback, completeA779 initializer continuation andA954 increment, selected gateclear and three bufferwriter excerpts. Structural mode/stack proofs for complete local bodies only; no CPU/device execution, WRAM buffer hydration or automatic callback/frame binding.',
  windows: blocks.map(describe), code_bytes: 36, instruction_count: 14, caller_bytes: 4,
  owner_body_bytes: 134, owner_excerpt_bytes: 96,
  graph: { edges: blocks[0].instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    calls: [], proof: proveWordStack(map(blocks[0]), 0x81A98E), actual_transfer_completion_proven: false },
  gate: 'Fresh WORD DBR:1562. Zero returns A0/N0/Z1, X/Y/C/V/I/DBR/D preserved; no buffer/register reads or stores. Any nonzeroWORD takes the same fixed request path, including8000/FFFF; gate is not a count or bitmask.',
  active: { order: ['WORDread DBR:1562', 'WORDwrite DBR:4322=3D08', 'WORDwrite DBR:4325=0220',
      'WORDwrite DBR:2102=8000', 'BYTEwrite DBR:420B=04', 'WORDclear DBR:1562', 'RTL A9B1'],
    requests: 'Exactly four ordered registerstores. No write4320/4321/4324, channel setup, transfer source read or source-bank validation. Gateclear occurs only after420B; no conditional device-completion check.',
    returns: 'Active A8004/N0/Z0: WORDLDA8000 sets highA80, BYTE LDA04 replaces lowA and setsBYTE N0/Z0; REP20 andWORDSTZ1562 do not modifyA/N/Z. C/V/I/X/Y/DBR/D preserved. Do not infer N1 from finalWORD A8004 or N0/Z1/A0 from STZ. Both widths WORD onRTL.',
    no_buffer_read: '3D08 is a source-offset constant, not a CPUread. Manual request preparation must not demand original bufferbytes, synthesize a blank buffer, or execute a544-byte transfer.' },
  owners: { proofs: [2, 3].map(j => ({ name: blocks[j].name, proof: proveWordStack(map(blocks[j]), blocks[j].entry) })),
    channel_setup: 'CompleteA779130 bytes has no calls. Selectedchannel2 stores initially4321=04,4325=0220,4322=A7FB,4324=81,4320=08, BYTE2102=00/2103=80,420B=04. Only after thatrequest writes4320=00,4324=7E. Source mode/bank retained byA98E; actualdevice setup persistence/completion not proven. A779 also changes slot/pool/DP82/14B0 and shared scratch0E, so it is not ported here as an isolated channelsetter.',
    requested_range: { after_selected_setup_bank: 0x7E, start: '7E:3D08', end_inclusive: '7E:3F27', bytes: 544,
      qualification: 'Derived contiguous source interval under the retained selected mode00/bank7E only; metadata, not original bytes or proof of actual DMA. Ends immediately before existing slotdefinition words at7E:3F28.' },
    gates: 'A954 INCWORD DBR:1562 withWORDwrap; selectedA772 STZWORD1562. Existing8949/A919/A958 read the same gate earlier in the selectedcallback. BusywaitsAE0C/AE5E need actual interrupts and fullcaller lifecycle; clearing a manual provider is not a nativewait/RTI proof.',
    clear_excerpt: 'Selected902E..904E writes BYTEF0 atlong7E:3D08+X forX01FD downby4 through0001 (128 bytes); thenWORD0 atlong7E:3F08+X forX001E downby2 through0000 (32 bytes). It does not clear all544 sourcebytes. No nativeclear routine or actualcaller/mode return proof supplied.',
    writer_excerpts: 'SelectedB158..B16C andB793..B7B9 write BYTElong7E:3D08+X with explicit X increments and STXbank00 DP84. Firstselected pair takes lowA andBYTE32-1; secondselected group readsBYTE11,17-1,29 and indirect0E/Y maskedC0 OR2C/35. Original coordinates, lists, source pointers, fullspritewriter graph and buffer lifetime remain separate boundaries.',
    lifecycle: 'Actualbuffer writers can change long7E independently ofDBR. Native slotdefinitions begin at3F28, while script-state owns a potentially overlapping lower bytewindow; no new shared buffer owner/hydration is introduced. Manual render provider stays separate from slot/task/MotionData and original interrupt ordering.' },
  aliases: 'Systembank writes are requestmetadata only. DBR7E/7F uses actual physicalWRAM registers and1562, all ordered withfinalgateclear. Protected3 JSLbytes include every actual source/write alias; no localpushes. No dataread beyondgate, so unknown3D08..3F27 or4320/4321/4324 does not block a request-only plan.',
  caller: { at: '80:C172', target: '81:A98E', actual_nmi_dbr: '00, notPBR81',
    remaining_after: ['80:8FBA', '80:9E0B', '80:C06B', '81:B0D1'],
    raw_patterns: { jslA98E: scan([0x22, 0x8E, 0xA9, 0x81]), inc1562: scan([0xEE, 0x62, 0x15]),
      stz1562: scan([0x9C, 0x62, 0x15]), longBufferStore: scan([0x9F, 0x08, 0x3D, 0x7E]) },
    qualification: 'Raw bytepattern hints with selected instructions validated here; no allwriter/caller, indirect/alias or actualreachability census.' },
  boundaries: ['Full native atomicA98E request plan supplied separately with freshWORDgate, four ordered stores, lateWORDclear, A8004/BYTE N0Z0, shared provider/budget and3 protectedJSLbytes. Late boundaries withhold allprior effects. Full local8FBA/reset/setup/selectedparameter source supplied inrender-8fba.json. Native atomic8FBA request plan supplied separately with signedgate, DBR-independentDP, WORDpointerwrap C/V, seven ordered requests, lateFFFF marker and shared view/budget/twoJSRbytes. Full local9E0B/selectedconsumer source supplied inrender-9e0b.json. Native atomic9E0B plan supplied separately with explicit chronological WORDsamples, bit0 polling, capturedWORD/NZ, late01CA store and shared provider/budget/twoJSRbytes. Full localC06B/BC1A/BC36/selector/getter source and originalROM384 supplied inrender-c06b.json. Native atomicC06B plan supplied separately with two ordered420B requests, lateWORDclear, unconditionalOAMtail, BYTEflags/highA and shared provider/budget/twoJSRbytes. Full localB0D1/B0AC/B0BD/B0C7 source and selectedsetup/callbacktail supplied inrender-b0d1.json. Native atomicB0D1 plan supplied separately with WORDcountdownwrap, freshgate reload, BYTEbrightness/highA/NZ/C and shared provider/budget/threeJSLbytes. Full local9E1A63/26 and F00729/15 source supplied inrender-9e1a.json: normalWORDreturn or explicitE1M1X1 resetterminal80E382, zeroexternalreturn assumptions; normal9E1A and standaloneF007 manualatomicplans supplied, complete reset held at source-required startup boundary. Complete localmain96AB72/25 chronology with17 explicitcallee-return boundaries and fullB0A1/F290/F298 nativewidth source supplied inrender-input-flow.json; both manualatomicwrappers supplied, counterchange isnotcallbackcompletion. Full localpostwait81:8877/886A/88A2/88E1 source185/82 andmanualatomic8877 plan supplied inrender-8877; original80D3D1 BYTEtable512 separate. Native8076 atomic updateplan supplied inrender-8076-native with freshWORD gates/progress/direction/index/count/table, ASLcarry, pointerwrap and shared provider/budget/threeJSLbytes. Full localBE6D206/85 andBCBE413/190 with alltransitive localcallees supplied inrender-be6d.json: closed2835/1318 WORD/DBR graph,32 protectedstackbytes,zeroexternalreturn assumptions; nativeBE6D/BCBE manual atomic composition supplied separately; actualtermination stillopen. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with freshBYTEaliases, hiddenhighA, shared provider/budget and5/7 protectedstackbytes. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json. Full localC1521027/419 eleven-callee graph supplied inrender-c152.json with zeroexternalreturn assumptions; manual atomicC152 supplied with six protectedstackbytes, one chronological provider/budget/commit and fresh orderedtail. No actualdevice/DMA/NMI/RTI/frame execution.',
    'Fullcallback graph/manual atomiccomposition supplied separately inrender-c152; fullbufferwriter/gate/setup lifetime, original bufferbytes, nativeA5/97 and real01F8 waits remain open.'] };
await writeFile('analysis/render-a98e.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-a98e.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; CompleteA98E36/14, callback4; fullA779/A954134, selectedowner excerpts96.\n; Static source/mode/stack only; no CPU/device execution or original buffer hydration.\n\n` + blocks.map(formatBlock).join('\n'));
console.log('A98E36 bytes/14 instructions/no calls; four requests, lategateclear and A8004/BYTEflags pinned.');
