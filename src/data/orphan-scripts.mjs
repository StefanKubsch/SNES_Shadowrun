// Unreferenced scripts (docs/ROM-FREE.md, step 2): event bytecode in the
// script banks that no entry of the script tables (tools/scripts.mjs) names
// and no call_script reaches, because call_script takes a table ID. Two forms:
// - headed: two header bytes (locals, stack header) and a script whose
//   control flow is fully covered and ends with end or the jump 48. Nothing
//   in the ROM holds their addresses as a table entry; they look like
//   scripts that were removed from the tables.
// - tail: bytes right behind the final end of a table script, decoded in
//   that script's frame (jump targets are relative to its bytecode start).
//   9C:E720 behind script 33D uses its locals 3 to 6, and its loop jump
//   lands on an instruction only in that frame.
// No reader is claimed; the bytes stay in the original layout. Native form
// assets/vm-orphan-scripts.json: header and bytecode per script, the owning
// script, entry PC and bytecode per tail.
import { VmFault } from '../vm/memory.mjs';
import { decodeScript, encodeScript } from '../script/codec.mjs';
import { OPCODE } from '../script/opcodes.mjs';
import { romAddress, romWriter } from './rom-bytes.mjs';
import { WORD_MASK, BANK_SIZE, BYTE_VALUES } from '../constants/bits.mjs';

// CPU addresses of the header bytes.
export const ORPHAN_SCRIPTS = [
  0x82f281, 0x82f28a, 0x82fa25, 0x9bd79f, 0x9eb0b7, 0x9f8624, 0x9f89ad, 0x9fd7af,
];
// [CPU address, owning script ID].
export const SCRIPT_TAILS = [[0x9ce720, 0x33d]];

const ENDS = new Set([0x48, 0x56]);

// Checks one headed script: fully covered, ending with end or jump 48, IDs
// inside the tables. Returns the bytecode length.
export function checkOrphan(bytecode, counts) {
  const decoded = decodeScript(bytecode);
  const last = decoded.instructions.reduce((a, b) => (b.pc > a.pc ? b : a));
  if (!decoded.fullyCovered || decoded.byteLength !== bytecode.length || !ENDS.has(last.opcode))
    throw new Error('Orphan script is not a complete script');
  for (const ins of decoded.instructions)
    if (
      (ins.opcode === OPCODE.CALL_SCRIPT && ins.operand >= counts.scripts) ||
      (ins.opcode === OPCODE.CALL_NATIVE && ins.operand >= counts.natives)
    )
      throw new Error('Orphan script ID outside the tables');
  const rebuilt = encodeScript(decoded);
  if (rebuilt.some((v, i) => v !== bytecode[i]))
    throw new Error('Orphan script round trip differs');
  return decoded.byteLength;
}

// Checks one tail in the frame of its owner (owner: bytecode of the table
// script, ending with end). Returns the tail length.
export function checkTail(owner, tail) {
  const ownerEnd = decodeScript(owner).instructions.reduce((a, b) => (b.pc > a.pc ? b : a));
  if (ownerEnd.opcode !== OPCODE.END || ownerEnd.nextPc !== owner.length)
    throw new Error('Tail owner does not end with end');
  const frame = new Uint8Array(owner.length + tail.length);
  frame.set(owner);
  frame.set(tail, owner.length);
  const decoded = decodeScript(frame, owner.length);
  const last = decoded.instructions.reduce((a, b) => (b.pc > a.pc ? b : a));
  if (
    decoded.byteLength !== frame.length ||
    last.opcode !== OPCODE.END ||
    decoded.instructions.some((i) => i.pc < owner.length) ||
    decoded.gaps.length !== 1 ||
    decoded.gaps[0].start !== 0 ||
    decoded.gaps[0].end !== owner.length
  )
    throw new Error('Tail is not a complete script part');
  return tail.length;
}

// Reads a headed script from the ROM view (read8) up to the end of its bank.
export function readOrphan(read8, cpu, counts) {
  const room = BANK_SIZE - (cpu & WORD_MASK) - 2,
    slice = Uint8Array.from({ length: room }, (_, i) => read8(cpu + 2 + i));
  const length = decodeScript(slice).byteLength;
  const bytecode = slice.subarray(0, length);
  checkOrphan(bytecode, counts);
  return { localBytes: read8(cpu), stackHeaderBytes: read8(cpu + 1), bytecode: [...bytecode] };
}

// Reads the tail at cpu behind its owner's bytecode up to the end of the bank.
export function readTail(read8, cpu, owner) {
  const room = BANK_SIZE - (cpu & WORD_MASK),
    frame = new Uint8Array(owner.length + room);
  frame.set(owner);
  for (let i = 0; i < room; i++) frame[owner.length + i] = read8(cpu + i);
  const tail = frame.slice(owner.length, decodeScript(frame, owner.length).byteLength);
  checkTail(owner, tail);
  return [...tail];
}

// scriptLayout: section scripts of the package manifest; bundle: scripts.json.
export function placeOrphanScripts(rom, present, { scripts, tails }, scriptLayout, bundle) {
  if (!Array.isArray(scripts) || !Array.isArray(tails)) throw new VmFault('orphan_layout_changed');
  const counts = { scripts: bundle.scripts.length, natives: bundle.nativeFunctions.length };
  const cpuOf = (address) => romAddress(address) ?? 0;
  const put = romWriter(rom, present, 'orphan_layout_changed');
  for (const { address, localBytes, stackHeaderBytes, bytecode } of scripts) {
    const cpu = cpuOf(address),
      code = Uint8Array.from(bytecode ?? []);
    try {
      if (
        !cpu ||
        (cpu & WORD_MASK) + 2 + code.length > BANK_SIZE ||
        !(
          localBytes >= 0 &&
          localBytes < BYTE_VALUES &&
          stackHeaderBytes >= 0 &&
          stackHeaderBytes < BYTE_VALUES
        )
      )
        throw 0;
      checkOrphan(code, counts);
    } catch {
      throw new VmFault('orphan_script_required', cpu);
    }
    put(cpu, localBytes);
    put(cpu + 1, stackHeaderBytes);
    code.forEach((v, i) => put(cpu + 2 + i, v));
  }
  for (const { address, script, entry, bytecode } of tails) {
    const cpu = cpuOf(address),
      code = Uint8Array.from(bytecode ?? []),
      owner = bundle.scripts[script];
    try {
      if (
        !cpu ||
        !owner ||
        owner.bytecode.length !== entry ||
        scriptLayout.scriptAddresses[script] + 2 + entry !== cpu ||
        (cpu & WORD_MASK) + code.length > BANK_SIZE
      )
        throw 0;
      checkTail(Uint8Array.from(owner.bytecode), code);
    } catch {
      throw new VmFault('orphan_script_required', cpu);
    }
    code.forEach((v, i) => put(cpu + i, v));
  }
}
