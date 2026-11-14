import { WORD_MASK, BYTE_BITS, HEX_RADIX } from '../../src/constants/bits.mjs';
import { OPCODE } from '../../src/script/opcodes.mjs';

const WORD_INSTRUCTION_BYTES = 3;
// First four recovered operations of the game's event-script language.
// This standalone proof model contains no SNES CPU/runtime.
// The operand stack is an array of unsigned 16-bit values; its end is the top.
// Pass bytecode AFTER the script's two-byte allocation header.
export function stepStackPrimitive(bytecode, pc, stack) {
  if (
    !(bytecode instanceof Uint8Array) ||
    !Number.isInteger(pc) ||
    pc < 0 ||
    pc >= bytecode.length
  ) {
    throw new Error('Invalid bytecode position');
  }
  if (!Array.isArray(stack) || stack.some((v) => !Number.isInteger(v) || v < 0 || v > WORD_MASK)) {
    throw new Error('Stack must contain unsigned 16-bit words');
  }
  const opcode = bytecode[pc];
  const operations = {
    [OPCODE.PUSH_U8]: ['push_u8', 2],
    [OPCODE.PUSH_U16]: ['push_u16', WORD_INSTRUCTION_BYTES],
    [OPCODE.DROP]: ['drop', 1],
    [OPCODE.PUSH_ZERO]: ['push_zero', 1],
  };
  const operation = operations[opcode];
  if (!operation)
    throw new Error(`Unimplemented script opcode $${opcode.toString(HEX_RADIX).padStart(2, '0')}`);
  const [name, length] = operation;
  if (pc + length > bytecode.length) throw new Error('Truncated script operand');
  if (opcode === OPCODE.DROP && stack.length === 0) throw new Error('Script stack underflow');
  if (opcode === OPCODE.PUSH_U8) stack.push(bytecode[pc + 1]);
  if (opcode === OPCODE.PUSH_U16) stack.push(bytecode[pc + 1] | (bytecode[pc + 2] << BYTE_BITS));
  if (opcode === OPCODE.PUSH_ZERO) stack.push(0);
  if (opcode === OPCODE.DROP) stack.pop();
  return { opcode, name, nextPc: pc + length };
}
