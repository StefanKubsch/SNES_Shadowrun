import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuLabel } from './rom.mjs';
import { formatBlock } from './disassemble.mjs';
import { proveRender8F20Source, describeRenderDialogBlock as describe } from './render-dialog-source.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const {root, callers, map, proof} = proveRender8F20Source(bytes);
// Fixed arithmetic consequences of the source immediates. These are address
// pairs, not memory/register execution or initialized dialog data.
const rows = Array.from({ length: 7 }, (_, n) => ({
  pass: n + 1, bytes: 256,
  source_first: cpuLabel(0x7F5A4F - n * 256), source_last: cpuLabel(0x7F5950 - n * 256),
  destination_first: cpuLabel(0x7F614F - n * 512), destination_last: cpuLabel(0x7F6050 - n * 512),
}));
const candidates = [];
for (let offset = 0; offset < bytes.length - 2; offset++) if (bytes[offset] === 0x20 && bytes[offset + 1] === 0x20 && bytes[offset + 2] === 0x8F)
  candidates.push(cpuLabel(((0x80 + Math.floor(offset / 0x8000)) << 16) | 0x8000 | (offset & 0x7FFF)));
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope: 'Complete local8F20 source/control/WORD/DBR/stack and fixed seven-pass descending MVP contract. Two selected936C callers separate. No CPU/device/clock/scene/frame execution.',
  windows: [describe(root)],
  full_graph: { closed: true, code_bytes: 26, instructions: map.size, proof, calls: [], native_binding: true,
    actual_termination_proven: true,
    qualification: 'Fixed X5A4F, MVP count00FF and CPX534F give exactly seven passes/1792 byte pairs under intact disjoint code/stack and valid data. No external callee or data-dependent gate; structural proof plus fixed arithmetic, no whole936C or initialized dialog proof.' },
  native_prerequisite: { module: 'proof/render/rows-8f20.mjs', probe: 'analysis/render-8f20-native.json',
    accumulator_bytes: 2, index_bytes: 2, minimum_protected_stack_bytes: 3,
    qualification: 'Manual atomic8F20 only, seven fixed descending256-byte MVP passes, fresh shared7F byte pairs, actual entryDBR/final PLB flags, cumulative work/output budgets and one outer commit. Original9F6D/936C/BF3B source initialization and caller/frame binding remain open.' },
  local: { edges: root.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    copy: { at: '80:8F30', mnemonic: 'MVP', source_bank: 127, destination_bank: 127, direction: 'descending',
      count_word: 255, bytes_per_pass: 256, passes: 7, total_bytes: 1792, rows,
      source_span: ['7F:5350', '7F:5A4F'], destination_envelope: ['7F:5450', '7F:614F'],
      destination_gap_bytes: 256,
      qualification: 'Only seven listed 256-byte destinations are written, with256-byte gaps. Per-byte fresh source read before write; X/Y decrement inside bank7F, MVP sets local DBR7F and finishes AFFFF. No source/destination indexwrap on this fixed root path.' } },
  contract: {
    entry: 'E0/M0/X0/D0000, binary arithmetic, actual entryDBR and3 protected stackbytes including rootJSR2. Incoming A/X/Y are overwritten before use. PHB preserves DBR only, not P; no scratch, header, MMIO or wait source. Valid fresh7F bytes and listed writable destinations remain explicit prerequisites.',
    setup: 'LDX5A4F, LDY624F. Every pass TYA/SEC/SBC0100/TAY creates destinationstart, then WORDLDA00FF initializes MVP length to256 physical bytes. SEC occurs each pass; no entrycarry or previous CPXcarry enters SBC. MVP7F->7F descends source/destination one byte at a time, changes DBR to7F and A toFFFF, without changing flags.',
    loop: 'After each MVP, X decreases0100 and Y decreases0100. CPX534F/BNE8F27 repeats until equality: after pass n X=5A4F-n*0100 and Y=624F-n*0200. First equality at n7, total1792 byte reads/writes; no caller header/output length or data can change fixed loop count. No indexwrap, clamp or reverse memmove approximation.',
    freshness: 'Actual per-byte descending read then write, row1 throughrow7. Sources5350..5A4F and scattered destinations5450..614F overlap. Every destination is above its current source by (8-pass)*0100, so each overwritten sourcebyte has already been read; under disjoint code/stack this fixed order matches original-source bytes. Arbitrary ascending/reversed row order is not equivalent. No writes to gaps, DP, other banks or assumed initialized ROM output.',
    return: 'RTS8F39: AFFFF, X534F, Y544F, actual entryDBR restored by PLB. Last CPX equality sets C1/N0/Z1; last SBC has V0. PLB then replaces N/Z using entryDBR byte (N=DBRbit7, Z=(DBR==0)); final C1/V0, I/M/X/D preserved. No PHP/PLP, so entryP is not restored and N/Z are not final AFFFF or CPX flags.',
    ownership: 'No field/header/pointer reads or writes. Fixed7F buffers require explicit byte ownership and protected code/stack. 9F6D initializes only bytes actually produced by its separate bounded plan; neither selectedcaller nor fixed8F20 count proves all1792 sources exist, original buffer capacity or complete936C initialization.',
  },
  callers: { report: 'analysis/render-bf3b.json', corroborating_report: 'analysis/render-9f6d.json', windows: callers.map(describe),
    order: 'Both936C fragments call actual9F6D withX5250, then8F20 at9450/9473, then9022/905E respectively. 8F20 does not consume returned9F6D A/header or X/Y; its fixed source span begins5350. 9022/8FF5 source supplied separately under4 protected stackbytes; native binding/0140 wait and caller completion open. 905E-8FF5-A954 source95/36 supplied under5 protected stackbytes; native atomic905E supplied under5 protected stackbytes; actual0140 wait and original caller binding remain open.',
    scan: { raw_jsr_candidates: candidates, qualification: 'Raw bytepattern hints only;9450 and9473 instruction-validated. No indirect/reachability/allcallsite proof.' },
    qualification: 'Selected callers only; rest936C remains open. No whole936C stack proof, successful source initialization or automatic scene binding.' },
  next: 'Current next block and open work: docs/PORTIERUNGSSTAND.json.',
};
await writeFile('analysis/render-8f20.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-8f20.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete8F20 descending MVP source; selected936C callers separate. No CPU execution.\n\n`
  + [root, ...callers].map(formatBlock).join('\n'));
console.log(`8F20 26/${map.size}; closed fixed7*256 descending MVP, stack${proof.minimum_protected_stack_bytes}; native supplied, original caller binding OPEN.`);
