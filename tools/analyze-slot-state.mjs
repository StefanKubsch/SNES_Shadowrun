import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, hex } from './rom.mjs';
import { inspectScriptTables } from './scripts.mjs';
import { disassembleBlock, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw new Error('Wrong European ROM revision');
const inventory = inspectScriptTables(bytes);
// A772 is reached by JSL $81:A772 at $80:964E/$80:A52B. A779 is the
// continuation after A840; A840 is fully listed to verify preserved E/M/X.
// A83D is the taken BPL path in native A9, not a guessed routine start.
const entries = [0x81A772, 0x81A840, 0x81A779, 0x81A7F1, 0x81A7F3, 0x80A835, 0x80A83D, 0x80A8EF, 0x80A8F4, 0x80C366, 0x80C369, 0x80C34A, 0x80C34D, 0x80C2C8];
const blocks = entries.map(address => disassembleBlock(bytes, address, { e: 0, m: 0, x: 0 }, 256));
const helper = blocks.find(block => block.entry === 0x81A840);
if (helper.stop !== 'RTL boundary' || helper.instructions.some(ins => ['REP', 'SEP', 'PLP', 'XCE', 'JSR', 'JSL'].includes(ins.mnemonic))) throw new Error('Unexpected initialization helper mode/control flow');
const links = Array.from({ length: 120 }, (_, index) => {
  const offset = index * 2;
  const next = offset + 2;
  return { offset: hex(offset, 4), next: hex(next + (next & 0x10), 4) };
});
let node = 2;
const initialChain = [];
while (node <= 0xEE) {
  if (initialChain.includes(node)) throw new Error('Unexpected initial link cycle');
  initialChain.push(node);
  node = parseInt(links[node / 2].next, 16);
}
const report = {
  rom_sha256: metadata.rom_sha256,
  initializer: { entry: '81:A772', calls: ['80:964E', '80:A52B'], data_continuation: '81:A779', pool_tail: '81:A7CB', final_return: '81:A7FA', scope: 'Only the slot/list data writes are ported; rendering state and DMA in this routine and helper are not ported.' },
  source_blocks: blocks.map(block => ({ entry: hex(block.entry), stop: block.stop, machine_bytes: Buffer.concat(block.instructions.map(ins => ins.raw)).toString('hex').toUpperCase() })),
  slots: { count: 44, offsets: 'even byte offsets 0000..0056', source: ['80:A835 descending free-slot search', '81:A779 initialization'], definition_origin: '7E:3F28', initial_definition_word: 'FFFF', initial_counts_and_heads: 'Unknown: this initialization does not write 12A0/12F8. Native A9 writes them to zero when selecting a free slot.' },
  active_list: { source_origin: '14B2', last_offset_origin: '14B0', initial_last_offset: 'FFFE', entry_words: 44, initial_entries: 'Unknown, not zero', creation: 'A9 increments last offset by two, appends selected slot offset', removal: 'B9 decrements last offset by two, removes last matching entry by shifting its suffix; final stale word is retained' },
  pool: { link_origin: '1564', free_count_origin: '0D1C', head_origin: '0D1E', initial_free_count: '0040', initial_head: '0002', written_link_offsets: 'even 0000..00EE', formula: 'next = offset + 2 + ((offset + 2) & 0010)', links, reachable_chain: initialChain.map(value => hex(value, 4)), first_outside_link: hex(node, 4), reachable_nodes: initialChain.length, note: '63 reachable nodes and free counter 0040 are separate source facts. Do not normalize them or treat the outside link 0100 as zero.' },
  native_creation: {
    ...inventory.native_functions[0xA9],
    supported: 'No free slot: unchanged first argument. Free slot: complete initialization/list append from extracted definitions; nonnegative fifth argument additionally spawns an independent original task with the allocated scheduler.',
    negative_fifth_argument: 'BMI to A8F4 bypasses C366 and the write to 1350; previous 1350 word remains unchanged',
    no_free_slot: 'RTS at A83C without writing 0000; return the original first pop argument, not a chosen failure sentinel',
    coordinate_words: '0E28/0E80/0ED8 = each corresponding argument * 4 modulo 65536; 0F30 = wrapped sum of first two scaled words, logical shift right one',
    definition_read: '8C:EFB4 + ((6 * first argument + original argument bit 14) & FFFF); second ASL supplies carry to ADC, with no intervening CLC; odd offsets are retained',
    other_path: 'C366 calls C34A, which calls C2C8 then appends without visiting. A8C5 writes game slot to 0000; A8CC writes doubled definition to 0002; remaining ABI prefix unchanged. A8E1/A8E4 append game list before task allocation. C359 returns original task slot in A for 1350+slot. Integrated via request-bound scheduler preparation; source gaps stop before mutation, genuine allocation failures retain preceding writes. See docs/reference/task-system.md#a9-taskerzeugung.',
    positive_call_boundary: 'Listings after calls are separately seeded with explicit E/M/X assumptions; arbitrary return state is not inferred.',
  },
  definition_data_window: { source_cpu: '8C:EFB4', source_rom_offset: '066FB4', byte_length: 0x104C, final_cpu_byte: '8C:FFFF', asset: 'assets/slot-definitions.json', actual_logical_extent: 'Unassigned; this selected ROM bank remainder is an implementation data window, not a proven count of game definitions. Reads beyond it remain unsupported.' },
  native_removal: { ...inventory.native_functions[0xB9], supported: 'Known source data in the 44-slot/even-offset window and covered pool links only; unknown/missing/out-of-window inputs keep the native pending with no partial effect.' },
};
await writeFile('analysis/slot-state.asm.txt', (`; European ROM SHA-256 ${metadata.rom_sha256}\n; Explicit E=0/M=0/X=0; static evidence, no machine-code execution.\n; A779 continuation follows fully listed mode-preserving A840 RTL.\n\n` + blocks.map(formatBlock).join('\n')).trimEnd() + '\n');
await writeFile('analysis/slot-state.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('assets/slot-definitions.json', JSON.stringify({ format: 'shadowrun-e-slot-definitions-v1', romSha256: metadata.rom_sha256, sourceCpu: '8C:EFB4', sourceRomOffset: '066FB4', scope: 'Explicitly selected ROM bank remainder; logical definition extent/meaning unassigned. Only covered 16-bit reads are supported.', bytes: Array.from(bytes.subarray(0x66FB4, 0x68000)) }, null, 2) + '\n');
console.log('44 slots, original pool links, covered A9 paths and bounded definition data extracted.');
