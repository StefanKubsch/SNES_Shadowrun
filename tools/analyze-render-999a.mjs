import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 };
const block = (name, entry, end) => {
  const state = { ...word }, instructions = [];
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, state); if (i.next > end) throw Error('Window overrun');
    if (['XCE', 'SED', 'TCD', 'PLD', 'PLP', 'BRK', 'COP'].includes(i.mnemonic)) throw Error('Renew mode proof');
    instructions.push(i); pc = i.next;
    if (['SEP', 'REP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = i.mnemonic === 'SEP' ? 1 : 0;
      if (i.value & 16) state.x = i.mnemonic === 'SEP' ? 1 : 0;
    }
  }
  return { name, entry, initialState: word, instructions,
    stop: name === 'paletteRequest999A' ? 'Complete local body; no calls, no CPU/device execution'
      : 'Selected callback prefix; stops before remaining external callees, actual callback/RTI return open' };
};
const blocks = [block('paletteRequest999A', 0x80999A, 0x8099EB), block('callbackPrefixC152', 0x80C152, 0x80C166)];
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next),
    covered_bytes: raw.length, instruction_count: b.instructions.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const dependency = JSON.parse(await readFile('analysis/render-a9e1.json', 'utf8'));
const originalCallback = dependency.windows.find(w => w.name === 'callbackC152');
if (dependency.rom_sha256 !== metadata.rom_sha256 || originalCallback?.entry !== '80:C152'
  || !originalCallback.machine_bytes.startsWith(describe(blocks[1]).machine_bytes)) throw Error('Callback source drift');
const map = new Map(blocks[0].instructions.map(i => [i.cpu, i]));
const proof = proveWordStack(map, 0x80999A, 'RTS');
const rawCandidates = [];
for (let p = 0; p < bytes.length - 2; p++) if (bytes[p] === 0x20 && bytes[p + 1] === 0x9A && bytes[p + 2] === 0x99)
  rawCandidates.push(cpuLabel(0x800000 + Math.floor(p / 0x8000) * 0x10000 + 0x8000 + p % 0x8000));
// Algebraic source lemmas only: no register/memory/device execution.
const counts = [0, 1, 0x7FFF, 0x8000, 0x8001, 0xFFFF].map(count => ({ count,
  initialY: count * 2 % 65536, nominalIterations: count === 0 ? 0 : count % 32768 || 32768 }));
const pointers = [0, 1, 0x400, 0x7FF, 0x800, 0xFFFF].map(value => {
  const shifted = value * 32 % 65536, shiftCarry = Math.floor(value / 2048) % 2;
  const sum = shifted + 0xF624 + shiftCarry, signed = (shifted < 32768 ? shifted : shifted - 65536) - 2524 + shiftCarry;
  return { value, shifted, shiftCarry, pointer: sum % 65536,
    adcCarry: Number(sum >= 65536), overflow: Number(signed < -32768 || signed > 32767) };
});
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope: 'Full local palette request999A, selected callback prefix and structural WORD/DBR/RTS proof. Algebraic count/pointer lemmas only; native999A atomic plan supplied separately. No memory hydration, CPU/device/NMI execution or full callback return.',
  windows: blocks.map(describe), code_bytes: 81, caller_bytes: 20, instruction_count: 40, caller_instruction_count: 7,
  local_graph: { edges: blocks[0].instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    calls: [], returns: ['80:99EA'], proof, actual_transfer_termination_proven: false },
  gates: { order: ['WORD0D0E', 'WORD0D10'], effects: 'Zero0D0E returns99EA after firstread. Otherwise zero0D10 returns99EA after secondread without clearing0D0E. Both paths A0/N0/Z1, C/V preserved, X/Y/DBR/D unchanged. Nonzero count is doubled with WORDwrap intoY; no CLC between five WORDshifts and pointerADC.' },
  loop: { entry: '80:99A6', read: 'Fresh WORD DBR:0CFE,Y at each visit, absolute indexed with real bankcarry; no fixed record count, clamp, alignment or initialized table inferred.',
    pointer: 'Five WORD ASL then ADC F624 without CLC: pointer=(32*record mod65536 + F624 + recordBit11) mod65536. Last shiftcarry is sourcebit11, not entryC or bit15. WORD4342 receivespointer; WORD4345=001E.',
    requests: 'SEP20; TYA transfers lowY to lowA while preserving highA. Three BYTE ASL then BYTE INC:2121=((lowY*8)+1) mod256; BYTE4344=8C,420B=10. REP20; two WORDDEY then BNE99A6. Exactly five registerstores per visit, no actual transferbody read.',
    count: 'Unconditional loop entry after nonzero count. Y even; decrement2 with WORDwrap. Nominaliterations=count mod32768, except nonzero8000 yieldsY0 and32768visits. No Y modification by this body outside the shown initialization/decrements. Intact stack/no interference and reached memory/device operations stillrequired.',
    counts, pointers },
  tail: { order: ['BYTE2121=00', 'BYTEread0D12', 'BYTE2122=0D12', 'BYTEread0D13', 'BYTE2122=0D13', 'REP20', 'WORDclear0D0E', 'RTS99EA'],
    registers: 'Active finalY0, X/DBR/D preserved, WORD returnA=00:finalBYTE0D13. HighA0 from last LDA001E survives all BYTEoperations. N/Z from BYTE0D13 (A0080 hasN1 despite WORDreturn), C0 from lastiterationY2 and its third BYTEASL, V from final pointerADC, I preserved. STZ/REP do not recalculate N/Z.' },
  ownership: { aliases: '0CFE+Y can reach flags/count/tailbytes: Y10->0D0E,Y12->0D10,Y14->0D12/13. With physical DBR7E/7F registerstores can replace later records, e.g.Y3646->4344 thenY3644->4342. Shared ordered byte owner required; no immutable independent record copy.',
    addressing: 'WDC sections3.5.4/7.3: absolute indexed may cross bank; do not reduce 0CFE+Y to lowWORD inentrybank. Systembank records can reach I/O/ROM/bank boundaries; their read/mapping contracts must be explicit. Even base/Y keeps both recordbytes away from a WORD-at-FFFF start.',
    device: 'Five stores request channel4 work and bank8C; no channel4 mode/target init, transfer source validity/content or devicecompletion is inferred. Native999A manual shared byte owner supplied separately; no original WRAM initializer or I/O record-read contract supplied.' },
  caller: { at: '80:C163', target: '80:999A', order: 'BYTE2100=80; REP20; JSL818949; JSL81A9E1; JSR80999A. Earlier localhelpers have structural WORD/DBR/D return contracts; sourceprefix repeats pinned callback bytes. Actual NMI sets DBR00, not callback PBR80.',
    remaining_after: ['81:80C4', '81:A919', '81:A958', '81:A98E', '80:8FBA', '80:9E0B', '80:C06B', '81:B0D1'],
    scan: { raw_jsr_candidates: rawCandidates, qualification: 'Raw ROM bytepattern scan only. Selected80:C163 is instruction-validated; no indirect/reachability/allcallsite proof.' },
    boundary: 'Source999A local return nowproved, fullcallback graph/manual atomiccomposition now supplied inrender-c152; real devices, actualRTI and stack/interference ownership remain open.' },
  manufacturer: { url: 'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf',
    sections: ['3.5.4', '7.3', '7.20', '7.23'], qualification: 'Manufacturer text for indexed bankcarry, destination-width register transfer and retained accumulator highbyte; source reasoning, no hardware timing/trace.' },
  boundaries: ['Native999A atomic ordered request plan supplied with fresh gates/records/tail, WORD countwrap, five-ASL carry and shared WRAM/I/O ownership. Full local80C4/requestwriter source supplied inrender-80c4.json. Native80C4 atomic request plan supplied separately with fresh indexedBYTE/unindexedsize, fullX/bankcarry, six stores, shared aliases and lateclear. Full localA919/listwriter source supplied inrender-a919.json. NativeA919 atomic request plan supplied separately with signedBPL/countwrap, bothshiftCarries, fresh records, fullWORDbankcarry and shared aliases. Full localA958 and selected outputwriter source supplied inrender-a958.json. Native atomicA958 request plan supplied separately with fresh tables, DBR-independentDP82, retained highA, latecursorstore and shared view/budget/stack. Full localA98E and selected bufferwriter/setup source supplied inrender-a98e.json. Native atomicA98E request plan supplied separately with four ordered requests, lateWORDgateclear, retained A8004/BYTEflags and shared provider/budget/stack. Full local8FBA/reset/setup/selectedparameter source supplied inrender-8fba.json. Native atomic8FBA request plan supplied separately with signedgate, DBR-independentDP, WORDpointerwrap C/V, seven ordered requests, lateFFFF marker and shared view/budget/twoJSRbytes. Full local9E0B/selectedconsumer source supplied inrender-9e0b.json. Native atomic9E0B plan supplied separately with explicit chronological WORDsamples, bit0 polling, capturedWORD/NZ, late01CA store and shared provider/budget/twoJSRbytes. Full localC06B/BC1A/BC36/selector/getter source and originalROM384 supplied inrender-c06b.json. Native atomicC06B plan supplied separately with two ordered420B requests, lateWORDclear, unconditionalOAMtail, BYTEflags/highA and shared provider/budget/twoJSRbytes. Full localB0D1/B0AC/B0BD/B0C7 source and selectedsetup/callbacktail supplied inrender-b0d1.json. Native atomicB0D1 plan supplied separately with WORDcountdownwrap, freshgate reload, BYTEbrightness/highA/NZ/C and shared provider/budget/threeJSLbytes. Full local9E1A63/26 and F00729/15 source supplied inrender-9e1a.json: normalWORDreturn or explicitE1M1X1 resetterminal80E382, zeroexternalreturn assumptions; normal9E1A and standaloneF007 manualatomicplans supplied, complete reset held at source-required startup boundary. Complete localmain96AB72/25 chronology with17 explicitcallee-return boundaries and fullB0A1/F290/F298 nativewidth source supplied inrender-input-flow.json; both manualatomicwrappers supplied, counterchange isnotcallbackcompletion. Full localpostwait81:8877/886A/88A2/88E1 source185/82 andmanualatomic8877 plan supplied inrender-8877; original80D3D1 BYTEtable512 separate. Native8076 atomic updateplan supplied inrender-8076-native with freshWORD gates/progress/direction/index/count/table, ASLcarry, pointerwrap and shared provider/budget/threeJSLbytes. Full localBE6D206/85 andBCBE413/190 with alltransitive localcallees supplied inrender-be6d.json: closed2835/1318 WORD/DBR graph,32 protectedstackbytes,zeroexternalreturn assumptions; nativeBE6D/BCBE manual atomic composition supplied separately; actualtermination stillopen. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with freshBYTEaliases, hiddenhighA, shared provider/budget and5/7 protectedstackbytes. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json. Full localC1521027/419 eleven-callee graph supplied inrender-c152.json with zeroexternalreturn assumptions; manual atomicC152 supplied with six protectedstackbytes, one chronological provider/budget/commit and fresh orderedtail. No inferred callback/NMI/transfer completion.',
    'All eleven callbackcallee bodies and manual atomicC152 supplied separately; channel4 initialization/transfer source validity, original WRAM list/palette owners, nested interrupts and automatic frame binding remain source-required.'] };
await writeFile('analysis/render-999a.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-999a.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Local999A81 bytes/40 instructions, selectedcallbackprefix20/7 separate.\n; No CPU/device execution; original WRAM/transfer/actualNMI return remain open.\n\n` + blocks.map(formatBlock).join('\n'));
console.log('999A81/40 and callerprefix20/7 pinned; local WORD/DBR/RTS graph closed, actual transfer/callback lifecycle open.');
