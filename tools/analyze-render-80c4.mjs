import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 };
const specs = [
  ['paletteRequest80C4', 0x8180C4, 0x8180F7],
  ['callbackCallC166', 0x80C166, 0x80C16A],
  ['requestReset8000', 0x818000, 0x81801A],
  ['requestAdvance8076', 0x818076, 0x8180C4],
  ['selectedSetupBank801A', 0x81801A, 0x818026],
  ['selectedSetupWriters8035', 0x818035, 0x818073],
];
const blocks = specs.map(([name, entry, end]) => {
  const initialState = { ...word, m: Number(name === 'selectedSetupWriters8035') };
  const state = { ...initialState }, instructions = [];
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, state);
    if (i.next > end || ['PLP', 'PLD', 'TCD', 'TCS', 'XCE', 'SED', 'BRK', 'COP'].includes(i.mnemonic)) throw Error(`Renew ${name} mode proof`);
    instructions.push(i); pc = i.next;
    if (['SEP', 'REP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = Number(i.mnemonic === 'SEP');
      if (i.value & 16) state.x = Number(i.mnemonic === 'SEP');
    }
  }
  return { name, entry, initialState, instructions,
    stop: name.startsWith('selected') ? 'Selected setup excerpt only; complete801A caller/data/return lifecycle open'
      : 'Complete local body or selected call; static source, no CPU/device execution' };
});
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next),
    covered_bytes: raw.length, instruction_count: b.instructions.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const map = b => new Map(b.instructions.map(i => [i.cpu, i]));
const body = blocks[0];
const original = JSON.parse(await readFile('analysis/render-a9e1.json', 'utf8'));
const callback = original.windows.find(w => w.name === 'callbackC152');
if (original.rom_sha256 !== metadata.rom_sha256
  || callback?.machine_bytes.slice((0xC166 - 0xC152) * 2, (0xC16A - 0xC152) * 2) !== describe(blocks[1]).machine_bytes) throw Error('Callback source drift');
const scan = pattern => {
  const candidates = [];
  for (let p = 0; p <= bytes.length - pattern.length; p++) if (pattern.every((v, j) => bytes[p + j] === v))
    candidates.push(cpuLabel(0x800000 + Math.floor(p / 0x8000) * 0x10000 + 0x8000 + p % 0x8000));
  return candidates;
};
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope: 'Full local80C4, selected callback call, complete8000/8076 request writers and two selected801A setup excerpts. Structural mode/stack proofs for full bodies only; no CPU/device execution, original WRAM hydration or frame binding.',
  windows: blocks.map(describe), code_bytes: 51, instruction_count: 20, caller_bytes: 4,
  owner_body_bytes: 104, owner_excerpt_bytes: 74,
  graph: { edges: body.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    calls: [], proof: proveWordStack(map(body), body.entry), actual_transfer_completion_proven: false },
  gate: 'Fresh WORD DBR:1CDA. Zero reachesRTL80F6 directly: A0/N0/Z1, C/V/I/X/Y/DBR/D preserved; no index/size/palette reads or stores. Nonzero originalWORD is stored to4302 before any furtherread.',
  active: { order: ['WORDread1CDA', 'WORDwrite4302', 'WORDread1CDC', 'TAX', 'WORDread1CCA', 'WORDwrite4305', 'WORDwrite4300=2200',
      'BYTEread1CC6+X', 'BYTEwrite2121', 'BYTEwrite4304=8B', 'BYTEwrite420B=01', 'WORDwrite1CDA=0000', 'RTL80F6'],
    indexing: 'X is full fresh WORD1CDC; BYTE DBR:1CC6,X uses actual full-address indexed bankcarry. No alignment, two-entry clamp, pointer validity or palette capacity guard. Size always reads unindexed WORD1CCA, even for X2; do not replace with1CCA+X. Zero size still requests420B.',
    requests: 'Exactly six ordered registerstores: WORD4302=initial1CDA, WORD4305=fresh1CCA, WORD4300=2200 (BYTE4300=00 then4301=22), BYTE2121=freshindexedbyte, BYTE4304=8B, BYTE420B=01. WORDclear1CDA only after420B. No transfer source read or device completion inferred.',
    returns: 'Active A0000/N0/Z1 from final WORDLDA0000, X=freshWORD1CDC, Y/DBR/D/I/C/V preserved. No arithmetic/compare/shift updates C/V. REP20 restores WORD width; local body never modifies DBR/D/Xwidth and has no stack pushes.' },
  owners: { proofs: blocks.slice(2, 4).map(b => ({ name: b.name, proof: proveWordStack(map(b), b.entry) })),
    reset: '8000 setsX2/A0, clears1CDA and1CBC then indexedWORD1CBE/1CC2/1CD6 for X2 andX0; finalXFFFE, A0, N1/Z0 from lastDEX. It does not initialize1CDC,1CCA or1CC6. No calls, supplied DBR preserved.',
    advance: '8076 considers X0 then2. Zero1CBE+X returns immediately, not skip. CLC/ADC1CC2+X then BIT0080 gates update. Ifbit7zero stores sum in1CC2+X and advancesX. Ifset stores low7bits; signedWORD1CC6+X selects forward/backward1CD6 index with1CD2 count. STA1CD6+X then ASLWORD/ADC1CCE+X WITHOUTCLC produces1CDA; TXA/STA1CDC selectsX0 or2 and returns immediately. No pending1CDA guard: a reached writer can replace an outstanding request.',
    setup_excerpts: '801A PHP/PHB/PEA8B8B/PLB/PLB explicitly selectsDBR8B. Selected8035..8072 stores actualWORD1CC6+X,1CCA+X,1CBE+X,1CD2+X,1CCE+X and1CBC; source WORDs atDBR8B:0000/2/4/6,Y and shared bank00 D0 scratchA2. In ordinary selected X0/2 these low addresses mirrorWRAM; source pointers can carry into other mappings. Full801A search/table/header/return and its caller/native bindings remain separate boundaries.',
    lifecycle: 'Original request/size/palette/index bytes are not hydrated. These source writers do not provide actual runtime owner/order/interrupt exclusion. Manual native provider remains separate from slot/task/MotionData owners.' },
  aliases: { indexed_examples: [0, 1, 2, 4, 0x14, 0x263C, 0x462, 0xE33A, 0xFFFF].map(x => ({ x, offset_sum: 0x1CC6 + x })),
    ordering: 'All gate/parameter/index reads and physical7E/7F stores must share an ordered byte view. X263C reads4302 after its pointerstore; X263F reads4305 after size; X263A reads4300=00 after configuration. X14 reads1CDA before finalclear. X462 can read2128 inI/O banks and requires separate readcontract. X E33A enters nextbank0000; no lowWORDwrap.',
    stack: 'RootJSL requires3 intact returnbytes; local80C4 pushesnone. Datareads/writes can alias bank00 stack/WRAM mirrors; protect declaredstack before any liveeffects. Code/stack/interrupt interference and actualdevice lifecycle remain unproved.' },
  caller: { at: '80:C166', target: '81:80C4', actual_nmi_dbr: '00, despitePBR81 ofcallee',
    remaining_after: ['81:A919', '81:A958', '81:A98E', '80:8FBA', '80:9E0B', '80:C06B', '81:B0D1'],
    raw_patterns: { jsl80C4: scan([0x22, 0xC4, 0x80, 0x81]), sta1CDA: scan([0x8D, 0xDA, 0x1C]), sta1CDC: scan([0x8D, 0xDC, 0x1C]) },
    qualification: 'Raw bytepattern scan only; selectedC166,8006,80B0,80B4,80F3 are instruction-validated here. No indirect, indexed alias, allwriter/caller or reachability census.' },
  manufacturer: { url: 'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf', sections: ['3.5.3', '7.3'],
    qualification: 'Indexed full-address bankcarry verified in manufacturer text; source reasoning only.' },
  boundaries: ['Native atomic80C4 request plan supplied separately with fresh unindexedsize/indexedBYTE, fullX/bankcarry, six requests, lateWORDclear and shared aliases/stack/budget. Full localA919/listwriter source supplied inrender-a919.json. NativeA919 atomic request plan supplied separately with signedBPL/countwrap, bothshiftCarries, fresh records, fullWORDbankcarry and shared aliases. Full localA958 and selected outputwriter source supplied inrender-a958.json. Native atomicA958 request plan supplied separately with fresh tables, DBR-independentDP82, retained highA, latecursorstore and shared view/budget/stack. Full localA98E and selected bufferwriter/setup source supplied inrender-a98e.json. Native atomicA98E request plan supplied separately with four ordered requests, lateWORDgateclear, retained A8004/BYTEflags and shared provider/budget/stack. Full local8FBA/reset/setup/selectedparameter source supplied inrender-8fba.json. Native atomic8FBA request plan supplied separately with signedgate, DBR-independentDP, WORDpointerwrap C/V, seven ordered requests, lateFFFF marker and shared view/budget/twoJSRbytes. Full local9E0B/selectedconsumer source supplied inrender-9e0b.json. Native atomic9E0B plan supplied separately with explicit chronological WORDsamples, bit0 polling, capturedWORD/NZ, late01CA store and shared provider/budget/twoJSRbytes. Full localC06B/BC1A/BC36/selector/getter source and originalROM384 supplied inrender-c06b.json. Native atomicC06B plan supplied separately with two ordered420B requests, lateWORDclear, unconditionalOAMtail, BYTEflags/highA and shared provider/budget/twoJSRbytes. Full localB0D1/B0AC/B0BD/B0C7 source and selectedsetup/callbacktail supplied inrender-b0d1.json. Native atomicB0D1 plan supplied separately with WORDcountdownwrap, freshgate reload, BYTEbrightness/highA/NZ/C and shared provider/budget/threeJSLbytes. Full local9E1A63/26 and F00729/15 source supplied inrender-9e1a.json: normalWORDreturn or explicitE1M1X1 resetterminal80E382, zeroexternalreturn assumptions; normal9E1A and standaloneF007 manualatomicplans supplied, complete reset held at source-required startup boundary. Complete localmain96AB72/25 chronology with17 explicitcallee-return boundaries and fullB0A1/F290/F298 nativewidth source supplied inrender-input-flow.json; both manualatomicwrappers supplied, counterchange isnotcallbackcompletion. Full localpostwait81:8877/886A/88A2/88E1 source185/82 andmanualatomic8877 plan supplied inrender-8877; original80D3D1 BYTEtable512 separate. Native8076 atomic updateplan supplied inrender-8076-native with freshWORD gates/progress/direction/index/count/table, ASLcarry, pointerwrap and shared provider/budget/threeJSLbytes. Full localBE6D206/85 andBCBE413/190 with alltransitive localcallees supplied inrender-be6d.json: closed2835/1318 WORD/DBR graph,32 protectedstackbytes,zeroexternalreturn assumptions; nativeBE6D/BCBE manual atomic composition supplied separately; actualtermination stillopen. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with freshBYTEaliases, hiddenhighA, shared provider/budget and5/7 protectedstackbytes. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json. Full localC1521027/419 eleven-callee graph supplied inrender-c152.json with zeroexternalreturn assumptions; manual atomicC152 supplied with six protectedstackbytes, one chronological provider/budget/commit and fresh orderedtail. No original request hydration or automatic callback/frame binding.',
    'Fullcallback graph/manual atomiccomposition supplied separately inrender-c152, full801A setup/callers, live request owners and DMA/NMI/RTI completion remain source-required.'] };
await writeFile('analysis/render-80c4.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-80c4.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete80C4 51/20, caller4; fullowner bodies104, selectedsetup excerpts74.\n; Static source/stack only; no CPU/device execution or WRAM hydration.\n\n` + blocks.map(formatBlock).join('\n'));
console.log('80C4 51 bytes/20 instructions/no calls; six requests and lateclear. Selected requestwriter ownership pinned.');
