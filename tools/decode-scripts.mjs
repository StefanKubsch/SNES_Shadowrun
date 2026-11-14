import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { inspectRom, hex } from './rom.mjs';
import { inspectScriptTables } from './scripts.mjs';
import { decodeScript, encodeScript } from '../src/script/codec.mjs';
import { scriptOpcodes, trapOpcodes } from '../src/script/opcodes.mjs';
import { disassembleBlock, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw new Error('Wrong European ROM revision');
const inventory = inspectScriptTables(bytes);
const sorted = inventory.scripts.map(s => parseInt(s.rom_offset, 16)).sort((a, b) => a - b);
const report = { rom_sha256: metadata.rom_sha256, scope: 'Static structure only; decoded native/script calls are not implemented game actions.', opcode_count: Object.keys(scriptOpcodes).length, complete: [], incomplete: [], rejected: [] };
const bundle = {
  format: 'shadowrun-e-event-scripts-v1', source_rom_sha256: metadata.rom_sha256,
  scripts: [],
  nativeFunctions: inventory.native_functions.map(n => ({ id: parseInt(n.id, 16), argumentWords: n.argument_words, returnBytes: n.return_bytes })),
};
let listing = '; European Shadowrun event bytecode. Offsets exclude the two-byte allocation header.\n';
const output = resolve('analysis');
await mkdir(output, { recursive: true });
let handlers = '';
for (let opcode = 0; opcode <= 0xC2; opcode += 2) {
  const target = bytes.readUInt16LE(0x72B4 + opcode);
  const spec = scriptOpcodes[opcode];
  if (spec && spec.handler !== target) throw new Error(`Dispatch target mismatch for ${hex(opcode, 2)}`);
  if (!spec && target !== 0xF927 && bytes.subarray(target - 0x8000, target - 0x8000 + 3).toString('hex') !== '4c27f9') throw new Error('Unexpected trap target');
  handlers += `; Opcode $${hex(opcode, 2)}: ${spec?.name ?? 'original_trap'}\n` + formatBlock(disassembleBlock(bytes, 0x800000 | target, { e: 0, m: 0, x: 0, c: null }, 128)) + '\n';
}
await writeFile(resolve(output, 'opcode-handlers.asm.txt'), handlers.trimEnd() + '\n');
await writeFile(resolve(output, 'opcode-spec.json'), JSON.stringify({ operations: Object.values(scriptOpcodes), traps: trapOpcodes }, null, 2) + '\n');
for (const script of inventory.scripts) {
  const offset = parseInt(script.rom_offset, 16);
  const next = sorted.find(o => o > offset) ?? bytes.length;
  const bound = Math.min(next, (Math.floor(offset / 0x8000) + 1) * 0x8000);
  try {
    const decoded = decodeScript(bytes.subarray(offset + 2, bound));
    for (const ins of decoded.instructions) {
      if (ins.opcode === 0x52 && ins.operand >= inventory.script_count) throw new Error('Script-call ID outside table');
      if (ins.opcode === 0x58 && ins.operand >= inventory.native_function_count) throw new Error('Native-call ID outside table');
    }
    const source = bytes.subarray(offset + 2, offset + 2 + decoded.byteLength);
    const entry = {
      id: script.id, rom_offset: script.rom_offset, cpu_address: script.cpu_address,
      slice_bound_rom_offset: hex(bound), byteLength: decoded.byteLength,
      instruction_count: decoded.instructions.length,
      script_calls: [...new Set(decoded.instructions.filter(i => i.opcode === 0x52).map(i => hex(i.operand, 3)))],
      native_calls: [...new Set(decoded.instructions.filter(i => i.opcode === 0x58).map(i => hex(i.operand, 2)))],
      fullyCovered: decoded.fullyCovered,
      gaps: decoded.gaps.map(gap => ({ ...gap, opaque_hex: source.subarray(gap.start, gap.end).toString('hex').toUpperCase() })),
    };
    entry.bytecode_sha256 = createHash('sha256').update(source).digest('hex');
    if (decoded.fullyCovered) {
      const rebuilt = encodeScript(decoded);
      if (!Buffer.from(rebuilt).equals(source)) throw new Error('Round-trip mismatch');
      entry.round_trip_verified = true;
      report.complete.push(entry);
    } else { entry.round_trip_verified = false; report.incomplete.push(entry); }
    const scriptListing = `\n; Script $${script.id}, ROM $${script.rom_offset}, args=${script.argument_bytes}, return=${script.return_bytes}, locals=${script.scratch_bytes}, stack-header=${script.max_stack_bytes}\n`
      + decoded.instructions.map(ins => `${hex(ins.pc, 4)}  ${hex(ins.opcode, 2)}  ${ins.name.padEnd(24)}${ins.operand === null ? '' : '$' + hex(ins.operand, ins.length === 2 ? 2 : 4)}`.trimEnd()).join('\n') + '\n'
      + entry.gaps.map(g => `; Opaque/unreachable $${hex(g.start, 4)}-$${hex(g.end - 1, 4)}: ${g.opaque_hex}\n`).join('');
    listing += scriptListing;
    if (['197', '04B', '000'].includes(script.id)) await writeFile(resolve(output, `event-script-${script.id}.txt`), scriptListing);
    bundle.scripts.push({
      id: parseInt(script.id, 16), argumentBytes: script.argument_bytes, returnBytes: script.return_bytes,
      localBytes: script.scratch_bytes, stackHeaderBytes: script.max_stack_bytes,
      bytecode: [...source], opaqueRanges: decoded.gaps, bytecodeSha256: entry.bytecode_sha256,
    });
  } catch (error) { report.rejected.push({ id: script.id, rom_offset: script.rom_offset, reason: error.message }); }
}
await writeFile(resolve(output, 'script-decoding.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(resolve(output, 'event-scripts.txt'), listing);
if (report.rejected.length) throw new Error('Script extraction incomplete; asset bundle was not written');
bundle.scripts.sort((a, b) => a.id - b.id);
await mkdir(resolve('assets'), { recursive: true });
await writeFile(resolve('assets', 'scripts.json'), JSON.stringify(bundle) + '\n');
console.log(`${report.opcode_count} opcode formats; ${report.complete.length} fully covered and byte-exact round trips; ${report.incomplete.length} with gaps; ${report.rejected.length} rejected.`);
console.log('Rejected examples:', report.rejected.slice(0, 5));
console.log(`${bundle.scripts.length} event scripts extracted to assets/scripts.json; browser runtime no longer needs the ROM for this data.`);
