import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { inspectRom, hex } from './rom.mjs';
import { inspectScriptTables } from './scripts.mjs';
import { disassembleBlock, formatBlock } from './disassemble.mjs';
import { decodeScript } from '../src/script/codec.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw new Error('Wrong European ROM revision');
const inventory = inspectScriptTables(bytes);
const operations = [[0x03, 'and_word'], [0x12, 'write_word'], [0x57, 'read_word'], [0x9B, 'or_word'], [0x56, 'write_two_fixed_words']];
let listing = `; European ROM SHA-256 ${metadata.rom_sha256}\n; Static native state evidence, explicit E=0 M=0 X=0 at each entry.\n; Four indexed actions: source $7E:3BBB, first pop argument is a byte offset.\n; Native $56: fixed words at $7E:2DE2 and $1CE9.\n\n`;
const nativeFunctions = operations.map(([id, operation]) => {
  const entry = inventory.native_functions[id];
  const block = disassembleBlock(bytes, parseInt(entry.cpu_address.replace(':', ''), 16), { e: 0, m: 0, x: 0 }, 32);
  if (block.stop !== 'RTS boundary' || block.instructions.some(ins => ins.target !== undefined)) throw new Error('Unexpected state native control flow');
  listing += `; Native $${entry.id}: ${operation}\n${formatBlock(block)}\n`;
  return { ...entry, operation, machine_bytes: Buffer.concat(block.instructions.map(ins => ins.raw)).toString('hex').toUpperCase() };
});
const sorted = inventory.scripts.map(script => parseInt(script.rom_offset, 16)).sort((a, b) => a - b);
let scriptsListing = '; Original European scripts; five base state actions, optional covered B9 slot state.\n; $060 needs sourced occupied-slot data for B9/END; $10A/$10B wait once, then END. Bytecode PCs exclude the two-byte header.\n';
const scripts = [0x060, 0x10A, 0x10B].map(id => {
  const entry = inventory.scripts[id];
  const offset = parseInt(entry.rom_offset, 16);
  const bound = Math.min(sorted.find(value => value > offset) ?? bytes.length, (Math.floor(offset / 0x8000) + 1) * 0x8000);
  const decoded = decodeScript(bytes.subarray(offset + 2, bound));
  scriptsListing += `\n; Script $${entry.id}, CPU $${entry.cpu_address}, ROM $${entry.rom_offset}, args=${entry.argument_bytes}, return=${entry.return_bytes}\n`;
  for (const ins of decoded.instructions) scriptsListing += `${hex(ins.pc, 4)}  ${hex(ins.opcode, 2)}  ${ins.name}${ins.operand === null ? '' : ' $' + hex(ins.operand, ins.length === 2 ? 2 : 4)}\n`;
  return { ...entry, bytecode_hex: bytes.subarray(offset + 2, offset + 2 + decoded.byteLength).toString('hex').toUpperCase(), supported_execution: id === 0x060 ? { conditional_native_id: 'B9', pc: '0008', required_state: 'Explicitly sourced occupied-slot/list data and covered chain; optional slotState provider', without_slot_state: 'native_implementation_required', end_pc_with_known_state: '000A' } : { native_id: '56', pc: '000F', wait_native_id: '9F', wait_pc: '0014', wait_mask: 1, wait_counter: 1, end_pc: '0017' } };
});
// B9 has one call; its complete callee preserves E/M/X and does not write $00.
// Explicitly seed the post-call continuation and both otherwise-stopped paths.
const b9Entries = [0x80A8F5, 0x80AA4C, 0x80A8F8, 0x80A91C];
let b9Listing = `; European ROM SHA-256 ${metadata.rom_sha256}\n; Native $B9: ported for covered even slot offsets with known slot/list/chain data.\n; This listing is static evidence, not machine-code execution.\n; E=0/M=0/X=0; continuation A8F8 follows the mode-preserving AA4C RTS.\n; AA4C conditional target AAAE is its listed RTS; A90D/AA95 loops are within listed blocks.\n\n`;
for (const address of b9Entries) b9Listing += formatBlock(disassembleBlock(bytes, address, { e: 0, m: 0, x: 0 }, 128)) + '\n';
const report = {
  rom_sha256: metadata.rom_sha256,
  data_origin: '7E:3BBB', index_unit: 'byte offset, not word index', word_bytes: 2,
  source_index_validation: 'None in these four handlers; host window boundaries are implementation limits, not original game rules.',
  initial_state: 'Unknown until explicitly sourced or written; no default original zero initialization.',
  fixed_word_action: { native_id: '56', writes: [{ source: '7E:2DE2', value: 'argument word' }, { source: '1CE9 (native ABI DBR=80)', value: '7FFF' }], initial_words: 'unknown', consumers: 'Not implemented; no scene, graphics or text result is claimed.' },
  implemented: nativeFunctions,
  original_script_prefixes: scripts,
  conditional_b9: {
    ...inventory.native_functions[0xB9],
    static_blocks: b9Entries.map(address => hex(address)),
    callee: '80:AA4C',
    effects: ['reset twelve indexed word fields in AA4C', 'when count at 12A0+X is nonzero: add it modulo 65536 to 0D1C and move that many nodes from the 12F8+X chain to the 0D1E chain through links at 1564+Y; clear count', 'write FFFF at 7E:3F28+X', 'decrement 14B0 twice, search backward through 14B2+X for the argument, shifting subsequent entries'],
    required_sources: ['44 even slot offsets 0000..0056; extent pinned by A9 search and 81:A779 initialization', 'actual per-slot 12A0/12F8 chain data; initialization of an occupied slot by native A9 remains outside this slice', 'known pool links in even 0000..00EE, free counter/head and active-list membership; missing coverage retains the request'],
    task_list: 'No direct script-task-list call or access in these complete B9/AA4C paths; other consumers are not inferred.',
    implementation: 'proof/state/slots.mjs, optional slotState in createScriptState; no partial effect at a data/window/membership boundary',
  },
  boundaries: ['complete data extent, original initial state and semantic field names remain unassigned', 'cross-bank indexed accesses are outside the first supported window', 'other native actions remain pending', 'no gameplay scene or browser clock is claimed'],
};
await mkdir('analysis', { recursive: true });
await writeFile('analysis/state-actions.asm.txt', listing.trimEnd() + '\n');
await writeFile('analysis/state-script-prefixes.txt', scriptsListing.trimEnd() + '\n');
await writeFile('analysis/state-b9.asm.txt', b9Listing.trimEnd() + '\n');
await writeFile('analysis/state-actions.json', JSON.stringify(report, null, 2) + '\n');
console.log('Five European native state actions, B9 source boundary and original script evidence written.');
