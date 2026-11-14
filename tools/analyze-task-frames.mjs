import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, hex } from './rom.mjs';
import { inspectScriptTables, europeanTables } from './scripts.mjs';
import { disassembleBlock, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw new Error('Wrong European ROM revision');
const inventory = inspectScriptTables(bytes);
const profiles = inventory.scripts.map(script => {
  const id = parseInt(script.id, 16);
  return { id, headerAddress: bytes.readUInt16LE(europeanTables.scriptPointers + id * 2), bankWord: bytes.readUInt16LE(europeanTables.scriptBanks + id), localBytes: script.scratch_bytes, stackHeaderBytes: script.max_stack_bytes, argumentBytes: script.argument_bytes };
});
const entries = [0x80C1A6, 0x80C2C8, 0x80C2F8, 0x80C31B, 0x80C349, 0x80F378, 0x80C34D, 0x80C36D, 0x80C392, 0x80C396, 0x80C3A0, 0x80C3C5, 0x80C221];
const blocks = entries.map(address => disassembleBlock(bytes, address, { e: 0, m: 0, x: 0 }, 128));
await writeFile('assets/task-frame-profiles.json', JSON.stringify({ format: 'shadowrun-e-task-frame-profiles-v1', romSha256: metadata.rom_sha256, bankTable: '82:DB28', pointerTable: '82:DED1', argumentTable: '82:E9CC', profiles }) + '\n');
const report = {
  rom_sha256: metadata.rom_sha256,
  source_blocks: blocks.map(block => ({ entry: hex(block.entry), stop: block.stop, machine_bytes: Buffer.concat(block.instructions.map(ins => ins.raw)).toString('hex').toUpperCase() })),
  extracted_profiles: profiles.length,
  frame_writes: ['offset 5: payload base + 11 (local-subroutine return cursor)', 'argument words in descending workspace-index order, starting at payload base + requested size - 2', 'offset 7: payload base + requested size - 1 - argument bytes (CPU operand-stack cursor)', 'offset 0: script header address + 2, wrapped as a word', 'offset 2: word at scratch 73 = bank low byte plus payload-base low byte in high byte (C2F8 STA 74 overwrites the initial bank-table high byte)', 'offset 3: zero word, overwriting that high byte and byte 4 (initial bytecode offset)'],
  untouched: 'Every other payload byte is retained if known from prior allocator/frame writes, otherwise remains unknown; no local or stack clear',
  task_slot_assignment: 'C333-C346: X from 024E; continuation/status zero; 024E from 0312+X; payload address at 0252+X. No root/child insertion here.',
  heap_failure: 'No guard at C2F8. Failure A=0 or wrapped size difference is used as base; subsequent writes can escape the heap. Port reports task_heap_failure_continuation_required after actual allocator effects, before unsupported memory writes.',
  task_slot_failure: 'C32E sets A=0; C333 sets X=negative head; C336 -> C349 leaves A=0 and X=FFFF after allocation/frame writes. Root append C34D would next index columns with FFFF (odd address before first column), not a valid slot. Port reports task_slot_failure_continuation_required and retains initialized orphan payload; no invented successful task.',
  consumer: 'F378 selects payload as Direct Page, PLB selects bank at byte 2, stack cursor from offset 7 and initial Y from offset 3',
  task_list: 'Standalone appendRoot/insertChild/removeFrame port C34D-C3C8: persistent cursor, exact links, original slot-offset return, parent block/explicit resume and LIFO free-task head; heap release clears only allocation bit. Stale payload/slot fields are retained.',
  boundaries: ['Optional running-frame/scheduler integration uses original heap/list data; see docs/reference/task-system.md#laufender-heap', 'Covered call/wait/END/state/A9 workspace writes are integrated; further native scratch effects require source', 'Heap failure out-of-window writes and task-slot exhaustion append are not executed', 'Known local-byte reuse is integrated; full stack header enforcement and control aliasing remain boundaries', 'No CPU, general RAM, browser clock, graphics or audio'],
};
await writeFile('analysis/task-frames.asm.txt', (`; European ROM SHA-256 ${metadata.rom_sha256}\n; Static evidence, explicit E=0/M=0/X=0 at every entry.\n; After-call continuations have separately supplied mode assumptions.\n\n` + blocks.map(formatBlock).join('\n')).trimEnd() + '\n');
await writeFile('analysis/task-frames.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Frame initialization evidence and ${profiles.length} source profiles written.`);
