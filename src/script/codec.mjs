import { scriptOpcodes, trapOpcodes } from './opcodes.mjs';
import {
  BANK_SIZE,
  BYTE_BITS,
  BYTE_HEX_DIGITS,
  BYTE_MASK,
  HEX_RADIX,
  WORD_MASK,
} from '../constants/bits.mjs';

// One opcode byte followed by the little-endian word operand.
const WORD_OPERAND_INSTRUCTION_BYTES = 3;

export function decodeInstruction(code, pc) {
  if (!(code instanceof Uint8Array) || !Number.isInteger(pc) || pc < 0 || pc >= code.length)
    throw new Error(`Invalid script PC ${pc}`);
  const opcode = code[pc];
  const spec = scriptOpcodes[opcode];
  if (!spec)
    throw new Error(
      `${trapOpcodes.includes(opcode) ? 'Original trap' : 'Unknown'} opcode $${opcode.toString(HEX_RADIX).padStart(BYTE_HEX_DIGITS, '0')} at ${pc}`,
    );
  if (pc + spec.length > code.length) throw new Error(`Truncated operand at ${pc}`);
  const operand =
    spec.operand === 'none'
      ? null
      : spec.operand === 'u8'
        ? code[pc + 1]
        : code[pc + 1] | (code[pc + 2] << BYTE_BITS);
  return {
    pc,
    opcode,
    name: spec.name,
    operand,
    length: spec.length,
    flow: spec.flow,
    nextPc: pc + spec.length,
  };
}

export function encodeInstruction(instruction) {
  const spec = scriptOpcodes[instruction.opcode];
  if (!spec) throw new Error('Cannot encode unknown/trap opcode');
  const value = instruction.operand;
  if (
    spec.operand === 'none'
      ? value !== null
      : !Number.isInteger(value) ||
        value < 0 ||
        value > (spec.operand === 'u8' ? BYTE_MASK : WORD_MASK)
  ) {
    throw new Error('Invalid script operand');
  }
  const bytes = new Uint8Array(spec.length);
  bytes[0] = spec.opcode;
  if (spec.length >= 2) bytes[1] = value & BYTE_MASK;
  if (spec.length === WORD_OPERAND_INSTRUCTION_BYTES) bytes[2] = value >>> BYTE_BITS;
  return bytes;
}

// Explore control flow, including local-call targets and their continuations.
// A supplied ROM slice is an upper bound, not an asserted script length.
// entry: the first PC to explore (0 for a script; later for a dead tail that
// shares the frame of the script before it, src/data/orphan-scripts.mjs).
export function decodeScript(code, entry = 0) {
  if (!(code instanceof Uint8Array) || code.length === 0 || code.length > BANK_SIZE)
    throw new Error('Invalid script slice');
  const pending = [entry];
  const instructions = new Map();
  const ownership = new Int32Array(code.length).fill(-1);
  const edges = [];
  let end = 0;
  while (pending.length) {
    const pc = pending.pop();
    if (!Number.isInteger(pc) || pc < 0 || pc >= code.length)
      throw new Error(`Control flow outside script slice: ${pc}`);
    if (instructions.has(pc)) continue;
    const ins = decodeInstruction(code, pc);
    for (let i = pc; i < ins.nextPc; i++)
      if (ownership[i] !== -1) throw new Error(`Overlapping script instructions at ${pc}`);
    for (let i = pc; i < ins.nextPc; i++) ownership[i] = pc;
    instructions.set(pc, ins);
    end = Math.max(end, ins.nextPc);
    const successors = [];
    if (['jump', 'conditional', 'local_call'].includes(ins.flow))
      successors.push([ins.operand, ins.flow]);
    if (['next', 'conditional', 'local_call'].includes(ins.flow))
      successors.push([ins.nextPc, 'fallthrough']);
    for (const [target, kind] of successors) {
      edges.push({ from: pc, to: target, kind });
      pending.push(target);
    }
  }
  const gaps = [];
  for (let pc = 0; pc < end;) {
    if (ownership[pc] !== -1) {
      pc++;
      continue;
    }
    const start = pc;
    while (pc < end && ownership[pc] === -1) pc++;
    gaps.push({ start, end: pc });
  }
  return {
    instructions: [...instructions.values()].sort((a, b) => a.pc - b.pc),
    edges,
    byteLength: end,
    fullyCovered: gaps.length === 0,
    gaps,
  };
}

// Rebuild from decoded opcode/operand values. Original raw bytes are not used.
export function encodeScript(decoded) {
  if (
    !decoded.fullyCovered ||
    !Number.isInteger(decoded.byteLength) ||
    decoded.byteLength <= 0 ||
    decoded.byteLength > BANK_SIZE
  )
    throw new Error('Cannot encode incomplete script coverage');
  const output = new Uint8Array(decoded.byteLength);
  let pc = 0;
  for (const ins of decoded.instructions) {
    if (ins.pc !== pc) throw new Error('Noncontiguous instruction layout');
    const bytes = encodeInstruction(ins);
    if (pc + bytes.length > output.length) throw new Error('Instruction exceeds script length');
    output.set(bytes, pc);
    pc += bytes.length;
  }
  if (pc !== output.length) throw new Error('Script length does not match instruction layout');
  decodeScript(output); // Also reject edited branches into operands/out of range.
  return output;
}
