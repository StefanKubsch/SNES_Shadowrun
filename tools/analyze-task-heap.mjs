import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, hex } from './rom.mjs';
import { inspectScriptTables } from './scripts.mjs';
import { disassembleBlock, formatBlock } from './disassemble.mjs';
import { scriptAllocationBytes } from '../proof/script/task-heap.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw new Error('Wrong European ROM revision');
const entries = [0x80C1A6, 0x80C242, 0x80C255, 0x80C279, 0x80C2AE, 0x80C2BC, 0x80C2BD, 0x80C2C8, 0x80C2F8, 0x80C349, 0x80C34A, 0x80C34D, 0x80C366, 0x80C369, 0x80A8EF, 0x80C396];
const blocks = entries.map(address => disassembleBlock(bytes, address, { e: 0, m: 0, x: 0 }, 128));
const profiles = inspectScriptTables(bytes).scripts.map(script => ({ id: script.id, allocation_bytes: scriptAllocationBytes({ localBytes: script.scratch_bytes, stackHeaderBytes: script.max_stack_bytes }) }));
const report = {
  rom_sha256: metadata.rom_sha256,
  source_blocks: blocks.map(block => ({ entry: hex(block.entry), stop: block.stop, machine_bytes: Buffer.concat(block.instructions.map(ins => ins.raw)).toString('hex').toUpperCase() })),
  heap: { header_origin: '03D2', payload_origin: '03D6', initial_payload_bytes: 0x07CC, total_bytes: 0x07D0, initial_next_offset: 0, allocated_flag: '8000', header_bytes: 4, split_minimum_remainder: 5, alignment: 'No rounding, including odd offsets and zero-size requests', coalescing: 'Lazy, only when a free block is too small and its next block is also free; merges persist even if allocation later fails', release: 'Clear bit 15; no immediate merge or payload clear' },
  allocation_return: { success_a: '03D6 + header offset', success_x: 'header offset, not scheduler task slot', failure_a: '0 when the last visited block is allocated; wrapped negative size-minus-request when the last visited block is free and too small', failure_check_in_caller: 'None between C2F8 and C349. The source continues frame writes using the returned A; no invented failure sentinel or success should be introduced.' },
  header_size: { instructions: 'C2E1-C2F2 clears A, enters M=1, CLC, adds the two header bytes and then 17 with retained carry; REP does not restore lost high bits', formula: '(((first + second) & FF) + 17 + carry(first + second)) & FF', profiles, maximum_original_allocation_bytes: Math.max(...profiles.map(profile => profile.allocation_bytes)) },
  root_handle: { free_task_slot_head: '024E', initial_offsets: '48 even offsets 0000..005E; C1B8-C1BE constructs the links in 0312', frame_assignment: 'C333-C346 pops 024E and stores payload A in 0252,X; X is the task slot offset', root_append: 'C34D-C362 appends that X and returns it through TXA in A, without changing 0250 or global 0000', slot_write: 'A8EF-A8F1 reloads slot from 0000 and writes A (original task slot offset) to 1350+slot', capacity_boundary: 'If 024E is negative, C336 branches to RTS C349 with no explicit task-slot failure handler; scheduler integration must not manufacture a handle' },
  boundaries: ['Heap/frame/list data and optional running-frame/scheduler allocation/release are integrated; see docs/reference/task-system.md#laufender-heap', 'Release of arbitrary payload or stale header offsets requires more source data', 'Covered workspace writes and native A9 root insertion are integrated; further callers and native effects remain source boundaries', 'No CPU, generic RAM/WRAM, renderer, audio or browser clock'],
};
await writeFile('analysis/task-heap.asm.txt', (`; European ROM SHA-256 ${metadata.rom_sha256}\n; Static evidence, explicit initial E=0/M=0/X=0 for every block.\n; After-call continuations have separately supplied mode assumptions.\n\n` + blocks.map(formatBlock).join('\n')).trimEnd() + '\n');
await writeFile('analysis/task-heap.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Task heap evidence written; ${profiles.length} profiles, maximum allocation ${report.header_size.maximum_original_allocation_bytes} bytes.`);
