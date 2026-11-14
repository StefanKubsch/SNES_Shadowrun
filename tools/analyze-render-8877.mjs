import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 };
const specs = [['reset8861', 0x818861, 0x81886A], ['sharedTail886A', 0x81886A, 0x818877],
  ['postWait8877', 0x818877, 0x81891A], ['selectedMainCall96AF', 0x8096AF, 0x8096B3],
  ['selectedPreloop96A1', 0x8096A1, 0x8096AB], ['selectedResetCallA524', 0x80A524, 0x80A528]];
const blocks = specs.map(([name, entry, end]) => {
  const state = { ...word }, instructions = [];
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, state); if (i.next > end) throw Error('8877 window overrun');
    instructions.push(i); pc = i.next;
    if (['SEP', 'REP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = Number(i.mnemonic === 'SEP');
      if (i.value & 16) state.x = Number(i.mnemonic === 'SEP');
    }
  }
  return { name, entry, initialState: word, instructions,
    stop: name.startsWith('selected') ? 'Selected caller only; full return/mode/DBR ownership remains open'
      : 'Complete local code; alternate entries included, no CPU/device/time execution' };
});
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next),
    covered_bytes: raw.length, instruction_count: b.instructions.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const local = new Map(blocks.slice(0, 3).flatMap(b => b.instructions.map(i => [i.cpu, i])));
const proofs = [0x818861, 0x818877, 0x8188A2, 0x8188E1].map(entry => proveWordStack(local, entry));
const raw = bytes.subarray(cpuToOffset(0x80D3D1, bytes.length), cpuToOffset(0x80D5D1, bytes.length));
const table = { address: 0x80D3D1, sourceCpu: '80:D3D1', sourceRomOffset: cpuToOffset(0x80D3D1, bytes.length),
  sha256: createHash('sha256').update(raw).digest('hex'), bytes: [...raw] };
const flow = JSON.parse(await readFile('analysis/render-input-flow.json', 'utf8'));
if (flow.rom_sha256 !== metadata.rom_sha256 || flow.windows.find(w => w.name === 'selectedPostWait8877').machine_bytes
  !== describe(blocks[2]).machine_bytes.slice(0, 42)) throw Error('Postwait dependency drift');
const scan = pattern => {
  const hits = [];
  for (let n = 0; n <= bytes.length - pattern.length; n++) if (pattern.every((v, j) => bytes[n + j] === v))
    hits.push(cpuLabel(0x808000 + Math.floor(n / 0x8000) * 0x10000 + n % 0x8000));
  return hits;
};
const report = { rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json', windows: blocks.map(describe),
  local_bytes: 185, instruction_count: local.size, scope: 'Full local8861-8919 including main8877, shared886A tail and alternate88A2/88E1 entries. Selected callers only. Original80D3D1 table512 separate; no CPU/device/interrupt/time execution.',
  graph: { calls: [], proofs, edges: [...local.values()].filter(i => i.target !== undefined)
    .map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })) },
  contract: {
    entry: 'BinaryE0M0X0/D0, actualDBR, three protectedJSLbytes, no localpushes/calls. Every structuralreturn isWORD RTL with entryDBR, X/Y preserved except active ramps replace X with maskedphase. Fullmain return/mode/DBR ownership remains open.',
    priority: '8877 freshWORD1FDC: negative takes AND7FFC/store then886A; zero RTL8886 withA0/N0/Z1. Otherwise BITimmediate1 testsZ only; bit1 (mask0001) takes one-shot and skips both ramps. Mask0002 ramp precedes0004. Alternate88A2 loadsWORDgate and starts atmask2, ignoring sign/zero/mask1; alternate88E1 loadsWORDgate and starts atmask4.',
    reset: '8861 clearsWORD1FDC, setsWORD1FDE=0180 then886A. Sharedtail BYTE2132=E0, BYTE2131=0, REP20/RTL8876. HighA retained from reset0180 or negativegate&7FFC; NZ fromBYTEE0, C/V/I retained.',
    one_shot: 'BYTE2132=E5 thenBYTE2131=E3; REP20/LDA0001 then freshWORDTRB1FDC. TRB setsZ from fresholdWORD&0001 and preservesN/C/V. A1, N0, Z independent of resultingmemory. No phase/table read; flagclear after both requests.',
    ramp2: 'FreshWORD1FDE+0040 withCLC, moduloWORD thenAND01FF, store1FDE, TAX. FreshBYTEactualDBR:D3D1+X, threeLSRs; nonzero shiftedvalue getsSEC/SBC01, ORAE0; BYTE2132=result, BYTE2131=23. REP20 then freshWORD1FDE/CMP0180. Equal: LDA0002/freshTRB1FDC, Z from freshgate&2, A2/N0/C1. Unequal: A=freshphase, NZ/C fromCMP, V from reachedBYTE-SBC orWORD-ADC. No syntheticguaranteedtermination.',
    ramp4: 'FreshWORD1FDE+0010 withCLC, WORDwrap/AND01FF/store/TAX. FreshBYTEDBR:D3D1+X, fourLSRs, nonzero getsSEC/SBC01, ORA20. SeparateBYTE2132=derived then2132=C0 then2131=23. REP20/freshWORD1FDC returnsgate/NZ; no clearingmask4 or comparingphase0180. C fromlastLSR bit3 if shiftedzero, otherwiseSBC C1; V fromADC orSBC.',
    addressing: 'No PHB/PLB: absolute table uses actualDBR, notprogrambank81. Originaltable is80:D3D1-D5D0, also00 alias; otherbanks require their actual explicitbytes. Physical7E/7F table/registers use realsharedWRAMbytes. Tableindex is0..511, oneBYTEread only, no implicitoriginal-ROM seeding.',
    idle: 'No matchingmask2/4 returns originalgate; immediateBIT4 changesZ only, retainsN/C/V. This also applies to alternateentries aftertheirfreshWORDload. No mainframe/wait completion asserted.' },
  table: { ...table, bytes: undefined, length: raw.length },
  owners: { reset: '8861 fullparameterreset andsharedtail; negativegatewrite887F, phasewrites88B4/88F3, freshTRBflags889D/88DC fullylocal. Selected96A1/A524 callers do not close fullmain/reset lifecycle.',
    raw_patterns: { jsl8877: scan([0x22, 0x77, 0x88, 0x81]), jsl8861: scan([0x22, 0x61, 0x88, 0x81]),
      sta1FDC: scan([0x8D, 0xDC, 0x1F]), sta1FDE: scan([0x8D, 0xDE, 0x1F]), trb1FDC: scan([0x1C, 0xDC, 0x1F]) },
    qualification: 'Rawpattern hits are not complete writer/caller census. Script direct/indirect parameterwriters and nativeA5/97 context remain separate; renderprovider is manual and not bound to script/task/interrupt owners.' },
  boundaries: ['Manual atomic8877 request/data plan supplied separately; original512BYTEtable separate from syntheticgate/phase/DBR fixtures. No CPU/device/time execution or automaticmain/frame binding.',
    'Native8076 atomic updateplan supplied inrender-8076-native with freshWORD gates/progress/direction/index/count/table, ASLcarry, pointerwrap and shared provider/budget/threeJSLbytes. Full localBE6D206/85 andBCBE413/190 with alltransitive localcallees supplied inrender-be6d.json: closed2835/1318 WORD/DBR graph,32 protectedstackbytes,zeroexternalreturn assumptions; nativeBE6D/BCBE manual atomic composition supplied separately; actualtermination stillopen. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with freshBYTEaliases, hiddenhighA, shared provider/budget and5/7 protectedstackbytes. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json. AutomaticBE6D framebinding and fullBF3B callees, B0A1 wait, main/interrupt lifecycle and full80E382 startup remain open.'] };
await writeFile('analysis/render-8877.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-8877.asm.txt', '; European ROM SHA-256 ' + metadata.rom_sha256 + '\n; Local185bytes, separate originalBYTEtable512; static only.\n\n' + blocks.map(formatBlock).join('\n'));
await writeFile('assets/render-8877-data.json', JSON.stringify({ format: 'shadowrun-e-render-8877-data-v1', romSha256: metadata.rom_sha256, sources: [table] }) + '\n');
console.log(`8877: local185/${local.size}, four closed WORDreturn proofs, original80D3D1 BYTEtable512.`);
