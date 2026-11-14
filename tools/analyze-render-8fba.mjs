import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 };
const specs = [
  ['request8FBA', 0x808FBA, 0x808FF5], ['callbackCallC176', 0x80C176, 0x80C179],
  ['reset8FB3', 0x808FB3, 0x808FBA], ['setupWait8FF5', 0x808FF5, 0x809022],
  ['selectedPointerWriter942F', 0x80942F, 0x80943F], ['selectedPointerWriter9456', 0x809456, 0x809465],
  ['selectedPointerWriterE4C5', 0x80E4C5, 0x80E4D5],
  ['selectedSetupCaller9022', 0x809022, 0x80902E], ['selectedSetupCaller905E', 0x80905E, 0x80906A],
  ['selectedSetupCallerE48D', 0x80E48D, 0x80E499],
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
    stop: name.startsWith('selected') ? 'Selected writer/caller excerpt only; complete caller/data/DBR/mode/return/lifetime remains open'
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
  || callback?.machine_bytes.slice((0xC176 - 0xC152) * 2, (0xC179 - 0xC152) * 2) !== describe(blocks[1]).machine_bytes) throw Error('Callback drift');
const scan = pattern => {
  const candidates = [];
  for (let p = 0; p <= bytes.length - pattern.length; p++) if (pattern.every((v, j) => bytes[p + j] === v))
    candidates.push(cpuLabel(0x808000 + Math.floor(p / 0x8000) * 0x10000 + p % 0x8000));
  return candidates;
};
const pointers = [0, 0x7FFC, 0x7FFD, 0x7FFF, 0x8000, 0xFFFC, 0xFFFD, 0xFFFF].map(pointer => {
  const sum = pointer + 3, signed = (pointer < 32768 ? pointer : pointer - 65536) + 3;
  return { pointer, offset: sum % 65536, carry: Number(sum >= 65536), overflow: Number(signed > 32767 || signed < -32768) };
});
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope: 'Complete local8FBA, selected callback, complete8FB3 reset and8FF5 setup/wait, selected F6/F8 parameterwriters and index/setup callers. Structural mode/stack proofs for complete local bodies only; no CPU/device/wait execution, original transfer data hydration or automatic callback/frame binding.',
  windows: blocks.map(describe), code_bytes: 59, instruction_count: 24, caller_bytes: 3,
  owner_body_bytes: 52, owner_excerpt_bytes: 83,
  graph: { edges: blocks[0].instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    calls: [], proof: proveWordStack(map(blocks[0]), 0x808FBA, 'RTS'), actual_transfer_completion_proven: false },
  gate: 'Fresh WORD DBR:0140. Negative returns thatWORD inA/N1/Z0, X/Y/C/V/I/DBR/D preserved with no parameters/registerreads or stores. Nonnegative including0 is active; gate is targetaddress, not count/bitmask.',
  active: { order: ['WORDread DBR:0140', 'WORDwrite DBR:2116=target', 'BYTEwrite DBR:420B=01',
      'WORDread bank00 DP:F6', 'CLC/WORDADC0003', 'WORDwrite DBR:4342=wrappedOffset', 'WORDwrite DBR:4345=001E',
      'BYTEread DBR:0142', 'BYTEwrite DBR:2121=index', 'BYTEread bank00 DP:F8', 'BYTEwrite DBR:4344=bank',
      'BYTEwrite DBR:420B=10', 'WORDwrite DBR:0140=FFFF', 'RTS8FF4'],
    requests: 'Seven ordered registerstores, including two separate420B writes01 then10. No channel0/4 mode/target setup, no transfer source reads, no validation of0140/index/sourcebank/offset. Bank/index are BYTEreads;0143/F9 remain unneeded.',
    pointer: 'WORD bank00 D0:F6/F7, independent ofDBR, plus0003 afterCLC. Offset wraps modulo65536; no carry increment of bank00 F8. C1 forFFFD..FFFF, V1 for7FFD..7FFF, independent entryCarry. Returned C/V come fromthisADC.', pointers,
    returns: 'Active AFFFF/N1/Z0 from final WORDLDAFFFF, after both420B requests; WORDstore0140 preservesA/N/Z. X/Y/DBR/D/I preserved, C/V from F6+3. Both widths WORD atRTS. No A0 or generic successful-device result.',
    parameters: 'Read order is gate, DPWORD F6, DBRBYTE0142, DPBYTEF8; no frozen snapshot or eager extra highbyte/source reads. Literal0003 advances only offsetword; actual sourcebank is unchanged even onpointer wrap.' },
  owners: { proofs: [2, 3].map(j => ({ name: blocks[j].name, proof: proveWordStack(map(blocks[j]), blocks[j].entry, 'RTS') })),
    reset: '8FB3 WORDLDAFFFF/STA DBR:0140/RTS; AFFFF/N1/Z0, X/Y/C/V/I/DBR/D preserved, no calls. Actualcaller/initialization lifecycle remains separate.',
    setup_wait: '8FF5 six registerstores: WORD4305=1000, WORD4302=5250, BYTE4304=7F,4301=18,2115=80,4300=01; REP20; WORDSTX DBR:0140; busywait freshLDA0140/BPL untilnegative. No calls/stack pushes. Structural WORDRTS does not prove waittermination or actualinterrupt/device return. Requires external writer; no native waitbinding here. Channel4 setup/F6/F8 are not supplied bythisroutine.',
    callers: 'Selected9022 setsWORD0142=0091 andX0000 beforeJSR8FF5;905E andE48D set0142=00A1 andX0800. High0143 is written bythese callers butnotread by8FBA. Fullcaller postreturn/puffer/interrupt lifecycle stays open.',
    pointer_writers: 'Selected942F/E4C5 load BYTE long8D:0002+X into bank00F8 then WORD long8D:0000+X intoF6. Selected9456 setsY2, reads BYTE longpointer[$11],Y intoF8 then WORD[$11] intoF6. All actualX/pointer/header/caller data must be explicit. External9F6D/8F20/9022 and other caller paths are not8FBA callees and are not newly derived here.',
    lifecycle: 'Manual render provider remains separate from slot/task/MotionData. DP F6/F7/F8 and DBR0140/0142 need shared actual byteowners before automatic binding. Setup retained channel0 source7F:5250/4096 bytes and channel4 sourceoffsetF6+3/30 bytes are request metadata only; no original data, header validity or DMA completion inferred.' },
  aliases: 'DPF6/F8 always usebank00 even withDBR7F; its physical7F:F6/F8 are separate and unchanged. Physical7E/7F registeroffsetstores, gate and late0140 marker share an ordered byteview. Systembankstores are metadata only. RootJSR requires2 protectedreturnbytes, not3 JSLbytes; no localpushes. Late missing sources, ownership, stack or budgets must withhold every earlyrequest/marker.',
  caller: { at: '80:C176', target: '80:8FBA', actual_nmi_dbr: '00', remaining_after: ['80:9E0B', '80:C06B', '81:B0D1'],
    raw_patterns: { jsr8FBA: scan([0x20, 0xBA, 0x8F]), jsr8FF5: scan([0x20, 0xF5, 0x8F]),
      sta0140: scan([0x8D, 0x40, 1]), stx0140: scan([0x8E, 0x40, 1]), sta0142: scan([0x8D, 0x42, 1]),
      staDPF6: scan([0x85, 0xF6]), staDPF8: scan([0x85, 0xF8]) },
    qualification: 'Raw bytepattern hints plus selected instruction pins only; no allwriter/caller/indirect alias or actual runtime reachability census.' },
  boundaries: ['Manual native atomic8FBA request plan supplied separately with fresh gate/DPWORD/BYTEparameters, wrappedoffset C/V, seven ordered requests, lateWORD0140=FFFF, shared provider/budget and2 protectedJSRbytes. Full local9E0B/selectedconsumer source supplied inrender-9e0b.json. Native atomic9E0B plan supplied separately with explicit chronological WORDsamples, bit0 polling, capturedWORD/NZ, late01CA store and shared provider/budget/twoJSRbytes. Full localC06B/BC1A/BC36/selector/getter source and originalROM384 supplied inrender-c06b.json. Native atomicC06B plan supplied separately with two ordered420B requests, lateWORDclear, unconditionalOAMtail, BYTEflags/highA and shared provider/budget/twoJSRbytes. Full localB0D1/B0AC/B0BD/B0C7 source and selectedsetup/callbacktail supplied inrender-b0d1.json. Native atomicB0D1 plan supplied separately with WORDcountdownwrap, freshgate reload, BYTEbrightness/highA/NZ/C and shared provider/budget/threeJSLbytes. Full local9E1A63/26 and F00729/15 source supplied inrender-9e1a.json: normalWORDreturn or explicitE1M1X1 resetterminal80E382, zeroexternalreturn assumptions; normal9E1A and standaloneF007 manualatomicplans supplied, complete reset held at source-required startup boundary. Complete localmain96AB72/25 chronology with17 explicitcallee-return boundaries and fullB0A1/F290/F298 nativewidth source supplied inrender-input-flow.json; both manualatomicwrappers supplied, counterchange isnotcallbackcompletion. Full localpostwait81:8877/886A/88A2/88E1 source185/82 andmanualatomic8877 plan supplied inrender-8877; original80D3D1 BYTEtable512 separate. Native8076 atomic updateplan supplied inrender-8076-native with freshWORD gates/progress/direction/index/count/table, ASLcarry, pointerwrap and shared provider/budget/threeJSLbytes. Full localBE6D206/85 andBCBE413/190 with alltransitive localcallees supplied inrender-be6d.json: closed2835/1318 WORD/DBR graph,32 protectedstackbytes,zeroexternalreturn assumptions; nativeBE6D/BCBE manual atomic composition supplied separately; actualtermination stillopen. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with freshBYTEaliases, hiddenhighA, shared provider/budget and5/7 protectedstackbytes. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json. Full localC1521027/419 eleven-callee graph supplied inrender-c152.json with zeroexternalreturn assumptions; manual atomicC152 supplied with six protectedstackbytes, one chronological provider/budget/commit and fresh orderedtail. Native8FF5 setup/signed wait supplied separately; no original wait chronology or transferbuffer hydration.',
    'Fullcallback graph/manual atomiccomposition supplied separately inrender-c152; fullsetup/parameter/writer/interrupt lifecycle, nativeA5/97, real01F8 waits and automatic scene/frame binding remain open.'] };
await writeFile('analysis/render-8fba.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-8fba.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete8FBA59/24, callback3; full8FB3/8FF5 owners52, selectedparameter/caller excerpts83.\n; Static source/mode/stack only; no CPU/device/wait execution or original buffer hydration.\n\n` + blocks.map(formatBlock).join('\n'));
console.log('8FBA59 bytes/24 instructions/no calls; DPpointer wrap/C/V, sevenrequests and late0140 sentinel pinned.');
