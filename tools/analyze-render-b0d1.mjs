import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 };
const specs = [['fadeB0D1', 0x81B0D1, 0x81B11A], ['callbackCallC17F', 0x80C17F, 0x80C183],
  ['setB0AC', 0x81B0AC, 0x81B0BD], ['resetB0BD', 0x81B0BD, 0x81B0C7],
  ['resetB0C7', 0x81B0C7, 0x81B0D1], ['selectedSetupB08B', 0x81B08B, 0x81B0A1],
  ['callbackTailC183', 0x80C183, 0x80C1A6]];
const blocks = specs.map(([name, entry, end]) => {
  const state = { ...word }, instructions = [];
  for (let pc = entry; pc < end;) {
    // Both BEQs reach B114 in BYTE mode; preceding linear RTL is not its owner.
    if (pc === 0x81B114) state.m = 1;
    const i = decode(bytes, pc, state);
    if (i.next > end || ['PLP', 'PLB', 'PLD', 'TCD', 'TCS', 'XCE', 'SED', 'BRK', 'COP'].includes(i.mnemonic)) throw Error(`Renew ${name} mode proof`);
    instructions.push(i); pc = i.next;
    if (['SEP', 'REP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = Number(i.mnemonic === 'SEP');
      if (i.value & 16) state.x = Number(i.mnemonic === 'SEP');
    }
  }
  return { name, entry, initialState: word, instructions,
    stop: name.startsWith('selected') ? 'Selected WORD setup excerpt only; fullcaller/device/lifetime remains open'
      : 'Complete local body or selected callback; static source, no CPU/device/frame execution' };
});
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next),
    covered_bytes: raw.length, instruction_count: b.instructions.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const previous = JSON.parse(await readFile('analysis/render-a9e1.json', 'utf8'));
const callbackBytes = previous.windows.find(w => w.name === 'callbackC152')?.machine_bytes;
if (previous.rom_sha256 !== metadata.rom_sha256 || callbackBytes?.slice(0x2D * 2, 0x31 * 2) !== describe(blocks[1]).machine_bytes
  || callbackBytes?.slice(0x31 * 2) !== describe(blocks[6]).machine_bytes) throw Error('Callback drift');
const transition = JSON.parse(await readFile('analysis/motion-transition-a4bf.json', 'utf8'));
for (const [index, name] of [[2, 'timeSet'], [3, 'timeReset']]) if (transition.rom_sha256 !== metadata.rom_sha256
  || transition.windows.find(w => w.name === name)?.machine_bytes !== describe(blocks[index]).machine_bytes) throw Error('Owner drift');
const scan = pattern => {
  const hits = [];
  for (let p = 0; p <= bytes.length - pattern.length; p++) if (pattern.every((v, j) => bytes[p + j] === v))
    hits.push(cpuLabel(0x808000 + Math.floor(p / 0x8000) * 0x10000 + p % 0x8000));
  return hits;
};
const proof = b => proveWordStack(new Map(b.instructions.map(i => [i.cpu, i])), b.entry, 'RTL');
const report = { rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json', windows: blocks.map(describe), code_bytes: 73,
  instruction_count: blocks[0].instructions.length, caller_bytes: 4, owner_body_bytes: 37, owner_excerpt_bytes: 22, callback_tail_bytes: 35,
  scope: 'Complete localB0D1 and B0AC/B0BD/B0C7 owners, selected setupB08B, selected callbackJSLC17F and fulltailC183. Structural code/mode/stack only; no device execution, clock or automatic callback/frame binding.',
  graph: { calls: [], edges: blocks[0].instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })), proof: proof(blocks[0]) },
  contract: {
    entry: 'E0/M0/X0/D0 binary, actualDBR, three protectedJSLbytes. No localpushes/calls, DBR/D or X/Y changes. Three RTLsites restoreWORD; B114 is a BYTE-entry join proved from both branches.',
    early: 'Fresh WORD01C6. Zero returns A0/N0/Z1 without01C8/01BC reads or writes. Nonzero does freshWORDDEC01C8 with modulo65536 wrap; nonzero decrementedWORD returns original gateA with N/Z from DECmemory, notA. C/V/I preserved onboth paths; initialcount0 becomesFFFF, not expiration.',
    expire: 'Only oldcount1 expires. Reload freshWORD01C6 before BPL. Negative reload forms WORDnegation EORFFFF/INC, retaining8000; nonnegative reload remains unchanged. StoreWORD01C8=reloadmagnitude before freshBYTE01BC. Negative period8000 is valid; no clamp or elapsed-time calculation.',
    negative: 'BYTEAND0F. Low nibble0 clearsWORD01C6 without rereading/changing01BC; returned lowA00/Z1/N0. Otherwise reread fullBYTE01BC, BYTEDEC A and BYTESTA01BC; returned lowA=(freshByte-1)&FF, NZ fromBYTEDEC. Bit7 and uppernibble are preserved by ordinaryBYTEDEC; no AND7F here. C/V/I preserved.',
    positive: 'BYTEAND0F/CMP0F. NibbleF clearsWORD01C6 without rereading/changing01BC; returned lowA0F/N0/Z1 fromCMP (notA). Otherwise reread fullBYTE01BC, BYTEINC A, BYTEAND7F, BYTESTA01BC; lowA=((freshByte+1)&FF)&7F, N0/Z fromfinalAND. C1 for endpointF, otherwiseC0; V/I preserved.',
    highA: 'HighA retained from reloadedWORDperiod (negated fornegative) throughout BYTEtail; gate1/brightnessFF returnsA000F/Z1, gate8000/brightness00 returnsA8000/Z1/N0, despite bit15. REP20 and STZ do not recomputeNZ. X/Y/DBR/D preserved; no registerwrites or implicit countdown/timer/frame events.' },
  owners: { proofs: blocks.slice(2, 5).map(b => ({ name: b.name, proof: proof(b) })),
    set: 'B0AC stores entryA toWORD01C6 thenBPL tests incomingN becauseSTA preservesflags. N1 negatesWORDA, N0 retainsA; CLC/ADC0008 writesWORD01C8. No automatic absolutevalue for mismatchedA/N. Exact bytes match prior transition source.',
    resets: 'B0BD/B0C7 clearWORD01C6 andwriteWORD01BC=0080/000F, preserving01C8. A0080/000F, N0/Z0, C/V/X/Y/I/DBR/D preserved. B08B setup excerpt clearsWORD01BE/01C0/01C6/01C2/01C4 andwritesWORD01BC=0080; no01C8 initialization.',
    callback_tail: 'After B0D1 returns, C183 freshBYTEreads01BC/01BE/01C0/01C2/01C4 interleaveBYTEstores2100/212C/212D/212E/420C, thenREP20/RTL. Bothlow/highWORDaliases must remain shared; callbacktail must see B0D1 updated01BC. Fullcallback manual atomiccomposition supplied separately inrender-c152; actualnativeNMI/RTI binding remains open.',
    raw_patterns: { jslB0D1: scan([0x22, 0xD1, 0xB0, 0x81]), sta01C6: scan([0x8D, 0xC6, 1]), stz01C6: scan([0x9C, 0xC6, 1]),
      sta01C8: scan([0x8D, 0xC8, 1]), stz01C8: scan([0x9C, 0xC8, 1]), sta01BC: scan([0x8D, 0xBC, 1]) },
    qualification: 'Raw bytepatterns are hints, not complete direct/indirect writer/caller/runtime census; raw87:968A STZpattern is not a new proved owner. Native renderprovider remains separate from originalslot/task/interrupt byteowners.' },
  caller: { at: '80:C17F', target: '81:B0D1', actual_nmi_dbr: '00', remaining_after: [] },
  boundaries: ['Manual atomicB0D1 supplied separately with freshWORDgate/countdown/reload, BYTEbrightness, exactWORDwrap/highA/NZ/C, shared provider/budget and three protectedJSLbytes. Full local9E1A63/26 and F00729/15 source supplied inrender-9e1a.json: normalWORDreturn or explicitE1M1X1 resetterminal80E382, zeroexternalreturn assumptions; normal9E1A and standaloneF007 manualatomicplans supplied, complete reset held at source-required startup boundary. Complete localmain96AB72/25 chronology with17 explicitcallee-return boundaries and fullB0A1/F290/F298 nativewidth source supplied inrender-input-flow.json; both manualatomicwrappers supplied, counterchange isnotcallbackcompletion. Full localpostwait81:8877/886A/88A2/88E1 source185/82 andmanualatomic8877 plan supplied inrender-8877; original80D3D1 BYTEtable512 separate. Native8076 atomic updateplan supplied inrender-8076-native with freshWORD gates/progress/direction/index/count/table, ASLcarry, pointerwrap and shared provider/budget/threeJSLbytes. Full localBE6D206/85 andBCBE413/190 with alltransitive localcallees supplied inrender-be6d.json: closed2835/1318 WORD/DBR graph,32 protectedstackbytes,zeroexternalreturn assumptions; nativeBE6D/BCBE manual atomic composition supplied separately; actualtermination stillopen. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with freshBYTEaliases, hiddenhighA, shared provider/budget and5/7 protectedstackbytes. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json. Full localC1521027/419 eleven-callee graph supplied inrender-c152.json with zeroexternalreturn assumptions; manual atomicC152 supplied with six protectedstackbytes, one chronological provider/budget/commit and fresh orderedtail.',
    'All eleven callbackcallees now have individual complete local source contracts. Fullcallback manual atomiccomposition supplied separately inrender-c152; actual interrupt/transfer/OAM/device lifecycle, nativeA5/97, real01F8 waits and automatic scene/frame binding remain open.'] };
await writeFile('analysis/render-b0d1.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-b0d1.asm.txt', '; European ROM SHA-256 ' + metadata.rom_sha256
  + '\n; CompleteB0D1 73 bytes; caller4, fullowners37, selectedsetup22, callbacktail35. Static source only.\n\n' + blocks.map(formatBlock).join('\n'));
console.log(`B0D1 73/${report.instruction_count}: countdownwrap/freshreload/BYTEbrightness/highA/flags and three WORD-RTLs; no calls or IO.`);
