import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { inspectRom, hex } from './rom.mjs';
import { inspectScriptTables } from './scripts.mjs';
import { disassembleBlock, formatBlock } from './disassemble.mjs';
import { decodeScript } from '../src/script/codec.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw new Error('Wrong European ROM revision');
const inventory = inspectScriptTables(bytes);
const sections = [
  ['Initialize outer list and free slots', [0x80C1A6]],
  ['Append independent root at list tail', [0x80C34A, 0x80C34D]],
  ['Immediate tail visit saves/restores outer cursor', [0x80C1CA, 0x80C1D9, 0x80C1DE]],
  ['Reverse traversal from cursor; reset only at end', [0x80C1E3, 0x80C1EB, 0x80C1ED]],
  ['Root creation followed by immediate visit', [0x8091D1, 0x8091D4, 0x8091D7]],
  ['NMI counter and callback registration', [0x80C112, 0x80C109, 0x80C14F]],
  ['Observed main-path NMI callback selection and enable', [0x809663, 0x80966D]],
  ['Main loop wait, subsystem calls, sweep and back edge', [0x8096AB, 0x8096AF, 0x8096B3, 0x8096B7, 0x8096BA, 0x8096BD, 0x8096C0, 0x8096C3, 0x8096C6]],
  ['Wait for NMI counter change (not elapsed-frame catchup)', [0x81B0A1]],
  ['Script call opcode $52', [0x80F460, 0x80F495, 0x80F4B6]],
  ['Argument stack construction', [0x80C2C8, 0x80C2F8]],
  ['Insert child after waiting parent', [0x80C36A, 0x80C36D, 0x80C392]],
  ['Run, release child, and resume parent', [0x80C1F9, 0x80C1FC, 0x80C208, 0x80C20B, 0x80C21E, 0x80C221, 0x80C22F, 0x80C239]],
  ['Unlink zero-status task; deallocator does not write shared $0000', [0x80C396, 0x80C2BD, 0x80C3A0, 0x80C3C5]],
  ['Normal END writes shared word; zero-mask removal skips END', [0x80F4BE]],
  ['Native opcode $58 and return', [0x80F4CB, 0x80F509]],
  ['Native $9F wait registration and readiness', [0x80C401, 0x80C3C9, 0x80C3FC]],
  ['Native $4C sound calls (not yet implemented)', [0x80C46E, 0x80C487, 0x80C48C, 0x80C493, 0x80C4A6, 0x80C4B2]],
  ['APU command transport (not a browser audio implementation)', [0x81F007, 0x81F023]],
];
let listing = `; European ROM SHA-256 ${metadata.rom_sha256}\n; Static analysis only. Each entry has explicit E=0 M=0 X=0.\n; Continuations after calls are separately seeded; their modes are assumptions.\n\n`;
for (const [title, entries] of sections) {
  listing += `; ${title}\n`;
  for (const address of entries) listing += formatBlock(disassembleBlock(bytes, address, { e: 0, m: 0, x: 0, c: null }, 128)) + '\n';
}
const sorted = inventory.scripts.map(script => parseInt(script.rom_offset, 16)).sort((a, b) => a - b);
const literalScan = { wait_calls: 0, literal_zero_mask_candidates: [], scope: 'Only an immediately preceding contiguous literal-zero push is detected. Computed values, branch bypasses and other dynamic entry paths are not inferred.' };
for (const script of inventory.scripts) {
  const offset = parseInt(script.rom_offset, 16);
  const next = sorted.find(value => value > offset) ?? bytes.length;
  const bound = Math.min(next, (Math.floor(offset / 0x8000) + 1) * 0x8000);
  const instructions = decodeScript(bytes.subarray(offset + 2, bound)).instructions;
  for (let index = 0; index < instructions.length; index++) {
    const call = instructions[index];
    if (call.opcode !== 0x58 || call.operand !== 0x9F) continue;
    literalScan.wait_calls++;
    const previous = instructions[index - 1];
    if (previous?.nextPc === call.pc && (previous.opcode === 0xC0 || [0x00, 0x0A, 0x14].includes(previous.opcode) && previous.operand === 0)) {
      literalScan.literal_zero_mask_candidates.push({ script_id: script.id, pc: hex(call.pc, 4) });
    }
  }
}
const report = {
  rom_sha256: metadata.rom_sha256,
  native_functions: [0x9F, 0x4C].map(id => inventory.native_functions[id]),
  script: inventory.scripts[0x04B],
  implemented: ['script call/return within one cooperative chain', 'native argument/return ABI', 'nonzero-mask wait checks', 'zero-mask registration removes the current frame without executing its native continuation', 'independent roots append at tail', 'explicit reverse sweep with persistent cursor and blocked parent visits', 'immediate start at tail preserves cursor', 'pending native action suspends the whole scheduler'],
  zero_mask_wait_evidence: {
    argument_write: '$80:F4E3-F4EA writes the popped mask zero to global $0000',
    registration: '$80:C401-C415 writes status zero, saves the native continuation and yields',
    removal: '$80:C219-C21E removes the zero-status frame before another readiness check',
    deallocator: '$80:C2BD-C2C7 and $80:C3A0-C3C8 do not modify global $0000',
    caller_resume: '$80:C221-C22C resumes a blocked parent; $80:F4B2 reads zero if the removed child has a word-return profile',
    root_result: 'removed, not ended; no root result or native $9F return is fabricated',
    literal_scan: literalScan,
  },
  scheduling_evidence: {
    tail: '$024C', cursor: '$0250', predecessor: '$0312,X', successor: '$0372,X',
    initialization: '$80:C1A6', append: '$80:C34A', immediate_visit: '$80:C1CA', sweep: '$80:C1E3',
    counter_increment: '$80:C133', counter_wait: '$81:B0A1', main_loop_wait: '$80:96AB', main_loop_sweep: '$80:96C0', main_loop_back_edge: '$80:96C6',
    main_path_nmi_registration: '$80:9663 selects $80:C152 via $80:C109; $80:9671 writes $81 to $4200',
    timing: 'The observed loop waits for any change in the NMI counter; it does not catch up for its delta. Immediate visits also exist. No universal milliseconds per readiness check.',
  },
  boundaries: ['other native actions require explicit host implementations', 'general shared scratch semantics, no-return END stack reads, interrupt interleaving and externally imposed zero-status continuations remain outside the implemented slice', 'standalone original heap is ported (analysis/task-heap.json); in-game root creation/abort, frame/task-slot integration and allocation-failure continuations remain unimplemented', 'negative post-run wait masks require original successor execution and fault the outer scheduler', 'event generation and full NMI callback/game subsystem effects remain open', 'no browser clock or measured PAL timing is implemented', 'sound dispatch is identified but audio is not implemented'],
};
await mkdir('analysis', { recursive: true });
await writeFile('analysis/task-flow.asm.txt', listing.trimEnd() + '\n');
await writeFile('analysis/task-flow.json', JSON.stringify(report, null, 2) + '\n');
console.log('European task flow evidence written; native $9F=$80:C401, $4C=$80:C46E.');
