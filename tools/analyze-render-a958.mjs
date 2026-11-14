import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 };
const specs = [
  ['requestA958', 0x81A958, 0x81A98E],
  ['callbackCallC16E', 0x80C16E, 0x80C172],
  ['outputPostpassAC2F', 0x80AC2F, 0x80ADF4],
  ['selectedOutputWriterAE63', 0x80AE63, 0x80AEB4],
  ['selectedOutputBudgetAE4C', 0x80AE4C, 0x80AE63],
  ['selectedChannel1SetupA787', 0x81A787, 0x81A793],
  ['selectedCursorResetA7CB', 0x81A7CB, 0x81A7D3],
  ['gateIncrementA954', 0x81A954, 0x81A958],
  ['selectedGateClearA772', 0x81A772, 0x81A775],
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
    stop: name.startsWith('selected') ? 'Selected owner excerpt only; full caller/DBR/return/lifetime remains open'
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
  || callback?.machine_bytes.slice((0xC16E - 0xC152) * 2, (0xC172 - 0xC152) * 2) !== describe(blocks[1]).machine_bytes) throw Error('Callback drift');
const postpass = JSON.parse(await readFile('analysis/motion-postpass-ac2f.json', 'utf8'));
if (postpass.rom_sha256 !== metadata.rom_sha256
  || postpass.routines[0].machine_bytes !== describe(blocks[2]).machine_bytes) throw Error('Output writer source drift');
const scan = pattern => {
  const candidates = [];
  for (let p = 0; p <= bytes.length - pattern.length; p++) if (pattern.every((v, j) => bytes[p + j] === v))
    candidates.push(cpuLabel(0x808000 + Math.floor(p / 0x8000) * 0x10000 + p % 0x8000));
  return candidates;
};
const cursors = [0, 1, 2, 3, 0x7FFE, 0x7FFF, 0x8000, 0xFFFE, 0xFFFF].map(cursor => {
  const visits = cursor < 0x8000 ? Math.floor(cursor / 2) + 1 : 0;
  return { cursor, nominalIterations: visits, finalX: visits ? (cursor - 2 * visits) & 65535 : cursor };
});
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope: 'Complete localA958, selected callback, byteidentical completeAC2F writer, selectedAE63/AE4C/init excerpts and fullA954 gate increment. Structural proof forA958/A954 only; original data, owner lifecycle, native binding and device/frame execution remain separate boundaries.',
  windows: blocks.map(describe), code_bytes: 54, instruction_count: 23, caller_bytes: 4,
  owner_body_bytes: 457, owner_excerpt_bytes: 127,
  graph: { edges: blocks[0].instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    calls: [], proof: proveWordStack(map(blocks[0]), 0x81A958), actual_transfer_completion_proven: false },
  gates: { first: 'Fresh WORD DBR:1562; zero returns A0/N0/Z1, X/Y/C/V/I/DBR/D preserved without DP82/table/register access or writes.',
    second: 'LDX WORD bank00:D0:82, independent ofDBR. BMI returns with original nonzero1562 inA, negativeX/N1/Z0 even forA1, Y/C/V/I/DBR/D preserved. No cursorclear on either gate. Cursor0 is one active entry, not an empty list.' },
  loop: { cursor: 'Nonnegative82 is last occupied byteoffset, not count. Firstvisit atA961 usesX unchanged. Two WORDDEX and BPL after everyvisit; no decrement before firstvisit. Visits=floor(cursor/2)+1 for0000..7FFF, zero for8000..FFFF. Evenactive endsXFFFE, oddactive endsXFFFF. No parity, capacity or tablelength guard; maximum16384 entries.', cursors,
    order: ['WORDread DBR:16D4+X', 'WORDwrite DBR:4312=pointer', 'WORDwrite DBR:4315=0040',
      'WORDread DBR:1754+X', 'WORDwrite DBR:2116=target', 'BYTEwrite DBR:2115=80',
      'BYTEread DBR:1654+X', 'BYTEwrite DBR:4314=sourceBank', 'BYTEwrite DBR:420B=02', 'DEX', 'DEX', 'BPL A961', 'WORDstore bank00:82=finalX'],
    requests: 'Six ordered registerstores pervisit; no channel1 mode/target initialization or transfer-source reads. WORD4315 writes0040 (4315=40,4316=00). Bankentry read is BYTE even though original writers store WORD1654+Y; highbyte is not read.',
    addressing: 'X remains WORD during BYTE-A mode. Table effective addresses add fullX to DBR base, including crossing8000 ROM mapping. Active X<=7FFF means no FFFF bankcross for these three tables. Negative X exits before reads. Bank00 DP82/83 always separate from DBR7F:0082/83.',
    returns: 'Active A=(last targetWORD ANDFF00)|0002: LDAWORD1754+X sets highA, BYTE LDA80/bank/LDA02 retain it. Final N1/Z0 from last WORDDEX, C/V/I/Y/DBR/D preserved, XFFFE/FFFF stored to bank00 DP82/83 after allrequests. REP20 restores WORD-A. No A0002 assumption or gate1562 clear.' },
  owners: { gate_increment_proof: proveWordStack(map(blocks[7]), 0x81A954),
    increment: 'A954 INCWORD DBR:1562 thenRTL, no calls. WORDwrap FFFF->0000, N/Z from increment, A/X/Y/C/V/I/DBR/D preserved; actualcaller entry/DBR/order not inferred from rawJSL hints.',
    reset: 'SelectedA772 STZWORD1562; A7CB LDAFFFE/STA14B0/STA bank00 DP82; selectedA787..A792 initializes BYTE4310=01 and4311=18 under actual suppliedDBR. No initial1654/16D4/1754 bytes or running cursor lifetime established.',
    postpass: 'CompleteAC2F453/196 matches prior source exactly. OutputsegmentAD6D..ADC0 saves slotX, reads bank00 DP82 asY, appends two entries perresource after INY/INY. Fresh indirectWORD masksFFC0 ->16D4+Y; reread masks003F, CLC/ADC008E ->WORD1654+Y; resource tableAEB4/AEC4 ->1754+Y. STY82 advances shared cursor. Full termination/pool/task/scratch/native contract remains in motion-postpass-ac2f.json, not newly asserted here.',
    other_writer: 'SelectedAE63..AEB3 appends same three tables twice perresource from longpointer bank00 DP41/42/43, DECWORD44/BNE, follows1564 andSTY82. SelectedAE4C..AE62 checks wrap and0050 before gate increment and busywait1562. FullAE12/ADF4 includes externalB0A1 return, AC2F and gate-wait lifecycle; these are explicit owner boundaries, notA958 callees. No nativeAE12 or actualwait completion proof.',
    lifecycle: 'SharedDP82/83 is already nativeAC2F output cursor; tablebytes1654..17D3 have an existing state postpass owner, and1562 is shared by8949/A919. Manual render provider stays separate; do not hydrate/copy/merge runtime owners or infer original interrupt ordering.' },
  aliases: 'DBR7E/7F registerstores are realWRAM in the same ordered byteview. X2BBE makes fresh1754+X read4312 just written by pointerstore. X2CC2 makes BYTE1654+X read4316=00 just written by size. X2CB8 makes16D4+X read438C with mapping-dependent ownership; reachedI/O reads remain unresolved. Stack3 JSLbytes must be protected including DP82 finalstore; no local pushes.',
  caller: { at: '80:C16E', target: '81:A958', actual_nmi_dbr: '00, notPBR81',
    remaining_after: ['81:A98E', '80:8FBA', '80:9E0B', '80:C06B', '81:B0D1'],
    raw_patterns: { jslA958: scan([0x22, 0x58, 0xA9, 0x81]), jslA954: scan([0x22, 0x54, 0xA9, 0x81]),
      inc1562: scan([0xEE, 0x62, 0x15]), indexedPointerStore: scan([0x99, 0xD4, 0x16]),
      indexedBankStore: scan([0x99, 0x54, 0x16]), indexedTargetStore: scan([0x99, 0x54, 0x17]) },
    qualification: 'Raw pattern hints plus selected instruction pins only; not allwriter/caller/indirect alias or actual runtime reachability census.' },
  boundaries: ['Full native atomicA958 manual request plan supplied separately with fresh three-table reads, DP82 independent ofDBR, retained target highA, signedcursor, six ordered requests, finalDP82 store, shared view/budget and3 protectedJSLbytes; late boundaries withhold allwrites/requests. Full localA98E and selected bufferwriter/setup source supplied inrender-a98e.json. Native atomicA98E request plan supplied separately with four ordered requests, lateWORDgateclear, retained A8004/BYTEflags and shared provider/budget/stack. Full local8FBA/reset/setup/selectedparameter source supplied inrender-8fba.json. Native atomic8FBA request plan supplied separately with signedgate, DBR-independentDP, WORDpointerwrap C/V, seven ordered requests, lateFFFF marker and shared view/budget/twoJSRbytes. Full local9E0B/selectedconsumer source supplied inrender-9e0b.json. Native atomic9E0B plan supplied separately with explicit chronological WORDsamples, bit0 polling, capturedWORD/NZ, late01CA store and shared provider/budget/twoJSRbytes. Full localC06B/BC1A/BC36/selector/getter source and originalROM384 supplied inrender-c06b.json. Native atomicC06B plan supplied separately with two ordered420B requests, lateWORDclear, unconditionalOAMtail, BYTEflags/highA and shared provider/budget/twoJSRbytes. Full localB0D1/B0AC/B0BD/B0C7 source and selectedsetup/callbacktail supplied inrender-b0d1.json. Native atomicB0D1 plan supplied separately with WORDcountdownwrap, freshgate reload, BYTEbrightness/highA/NZ/C and shared provider/budget/threeJSLbytes. Full local9E1A63/26 and F00729/15 source supplied inrender-9e1a.json: normalWORDreturn or explicitE1M1X1 resetterminal80E382, zeroexternalreturn assumptions; normal9E1A and standaloneF007 manualatomicplans supplied, complete reset held at source-required startup boundary. Complete localmain96AB72/25 chronology with17 explicitcallee-return boundaries and fullB0A1/F290/F298 nativewidth source supplied inrender-input-flow.json; both manualatomicwrappers supplied, counterchange isnotcallbackcompletion. Full localpostwait81:8877/886A/88A2/88E1 source185/82 andmanualatomic8877 plan supplied inrender-8877; original80D3D1 BYTEtable512 separate. Native8076 atomic updateplan supplied inrender-8076-native with freshWORD gates/progress/direction/index/count/table, ASLcarry, pointerwrap and shared provider/budget/threeJSLbytes. Full localBE6D206/85 andBCBE413/190 with alltransitive localcallees supplied inrender-be6d.json: closed2835/1318 WORD/DBR graph,32 protectedstackbytes,zeroexternalreturn assumptions; nativeBE6D/BCBE manual atomic composition supplied separately; actualtermination stillopen. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with freshBYTEaliases, hiddenhighA, shared provider/budget and5/7 protectedstackbytes. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json. Full localC1521027/419 eleven-callee graph supplied inrender-c152.json with zeroexternalreturn assumptions; manual atomicC152 supplied with six protectedstackbytes, one chronological provider/budget/commit and fresh orderedtail.',
    'Fullcallback graph/manual atomiccomposition supplied separately inrender-c152; fullAE12/ADF4/B0A1 owner lifecycle, original tables/gates, nativeA5/97, actual01F8 waits and automatic scene/frame binding remain open.'] };
await writeFile('analysis/render-a958.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-a958.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; CompleteA95854/23, callback4; fullAC2F/A954457, selectedowner excerpts127.\n; Static source/mode/stack only; no CPU/device execution or original WRAM hydration.\n\n` + blocks.map(formatBlock).join('\n'));
console.log('A95854 bytes/23 instructions/no calls; sharedDP82, retained highA and selected tablewriters pinned.');
