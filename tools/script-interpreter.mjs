// The script bytecode interpreter (docs/READABLE-GAME.md, phase 2): the reference the
// decompiled scripts of src/scripts/ are checked against (tools/decompile-scripts.test.mjs).
// It was the game's interpreter until phase 2, lifted from the European interpreter at
// 80:F389 with the jump table 80:F2B4, over a task in plain JS: the script PC, the local
// bytes, the operand stack (words, bottom first), the local return stack (call_local) and
// the pending call. The original keeps the same state in a heap frame created by 80:C2C8:
//
//   +00 bytecode pointer with bank   +03 PC   +05 local return pointer
//   +07 operand stack pointer        +09 ID of the pending call
//   +0B..+12 local return words, written downward from +11
//   +13 locals (header byte 0 of the script), then the operand stack, which grows
//   downward from the frame's last byte (header byte 1 plus 4 bytes)
//
// The frame size is header byte 0 + header byte 1 + 17h. The script's argument words
// are copied to the top of the frame, so they are the operand stack's first content.
// Bounds the original does not check become frontiers: a push into the locals, a pull
// above the frame, a fifth local call (its return word would overwrite the call ID at
// +09) and a local index outside the declared locals. Opcodes no script uses (the status
// returns 54, 90, 98, A0 and A8, the unused table entries, division and remainder 68 to
// 76) stop at the frontier `script_opcode_unused`.

import { taskStop } from '../src/system/task-stop.mjs';
import {
  FRAME_CALL_ID,
  FRAME_FIXED_BYTES,
  FRAME_LOCALS,
  FRAME_RETURN_BASE,
  NATIVE_ARGUMENT_COUNTS,
  NATIVE_RETURN_BYTES,
  SCRIPT_ARGUMENT_BYTES,
  SCRIPT_BANKS,
  SCRIPT_POINTERS,
  SCRIPT_RETURN_BYTES,
} from '../src/vm/layout.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../src/constants/bits.mjs';
import { OPCODE } from './script-opcodes.mjs';
import { WRAM } from '../src/data/wram.mjs';

// Two header bytes before the first opcode: local bytes and operand stack bytes.
const SCRIPT_HEADER_BYTES = 2;
// Local return words fit between the call ID (+09) and the locals (+13).
export const LOCAL_RETURN_SLOTS = (FRAME_RETURN_BASE - FRAME_CALL_ID) >>> 1;
// Bytes between the locals and the end of the frame, beyond the declared stack bytes.
const STACK_EXTRA_BYTES = FRAME_FIXED_BYTES - FRAME_LOCALS;

export const CALL_NATIVE = 'native';
export const CALL_SCRIPT = 'script';

// Where script `id` lives and what its frame holds (80:C2C8 reads the same tables).
export function scriptInfo(mem, id) {
  const bank = mem.read8(SCRIPT_BANKS + id),
    header = (bank << WORD_BITS) | mem.read16(SCRIPT_POINTERS + 2 * id),
    localBytes = mem.read8(header),
    stackBytes = mem.read8((header + 1) & LONG_MASK);
  return {
    code: (header + SCRIPT_HEADER_BYTES) & LONG_MASK,
    localBytes,
    stackBytes,
    frameBytes: localBytes + stackBytes + FRAME_FIXED_BYTES,
    argumentBytes: mem.read8(SCRIPT_ARGUMENT_BYTES + id),
  };
}

// Operand stack words that fit between the locals and the end of the frame.
export const stackCapacity = (info) => (info.stackBytes + STACK_EXTRA_BYTES) >>> 1;

export const scriptArgumentWords = (mem, id) => mem.read8(SCRIPT_ARGUMENT_BYTES + id) >>> 1;
export const nativeArgumentWords = (mem, id) => mem.read8(NATIVE_ARGUMENT_COUNTS + id);

// A new task for script `id`. `args` lists the argument words in the order the
// calling script pulled them (args[0] was its top word, the original's word 00).
export function createTask(mem, id, args = []) {
  const info = scriptInfo(mem, id);
  // 80:C30F counts the argument bytes down by two until zero; an odd count never ends.
  if (info.argumentBytes & 1) taskStop('script_argument_bytes_odd', { script: id });
  if (args.length !== info.argumentBytes >>> 1)
    taskStop('script_argument_count', { script: id, args: args.length });
  // 80:C2C8 adds the header bytes in 8 bits; a carry would shrink the frame.
  if (info.frameBytes > BYTE_MASK) taskStop('script_frame_size_carry', { script: id });
  const capacity = stackCapacity(info);
  if (args.length > capacity) taskStop('script_operand_stack_overflow', { script: id });
  return {
    script: id,
    code: info.code,
    frameBytes: info.frameBytes,
    pc: 0,
    locals: new Uint8Array(info.localBytes),
    stack: args.slice().reverse(),
    stackCapacity: capacity,
    returns: [],
    call: null, // { kind: CALL_NATIVE | CALL_SCRIPT, id } while a call is pending
  };
}

// 80:F509 (native) and 80:F495 (script, after the child task ended): the call's
// result word is pushed when the call has a result (tables 82:D970 and 82:E623). A
// script that ended with an empty stack has no defined result (null).
export function finishCall(mem, task, result) {
  const call = task.call;
  if (call === null) taskStop('script_call_not_pending', { script: task.script });
  const table = call.kind === CALL_NATIVE ? NATIVE_RETURN_BYTES : SCRIPT_RETURN_BYTES;
  task.call = null;
  if (mem.read8(table + call.id) === 0) return;
  if (result === null) taskStop('script_result_undefined', { script: task.script, call: call.id });
  pushWord(task, result);
}

export function pushWord(task, value) {
  if (task.stack.length >= task.stackCapacity)
    taskStop('script_operand_stack_overflow', { script: task.script, pc: task.pc });
  task.stack.push(value);
}
export function pullWord(task) {
  if (task.stack.length === 0)
    taskStop('script_operand_stack_underflow', { script: task.script, pc: task.pc });
  return task.stack.pop();
}

export const EXIT_END = 'end';
export const EXIT_NATIVE = CALL_NATIVE;
export const EXIT_SCRIPT = CALL_SCRIPT;
export const EXIT_BUDGET = 'budget';

const TRUE = WORD_MASK;
// A script that loops without calling a native hangs the original; stop it instead.
const OPCODE_LIMIT = 1 << 24;
const SHIFT_LIMIT = 16;
// Opcode byte plus a byte or a word operand.
const BYTE_INSTRUCTION_BYTES = 2,
  WORD_INSTRUCTION_BYTES = 3;
const SIGN_EXTEND = WORD_MASK ^ BYTE_MASK;

const truth = (condition) => (condition ? TRUE : 0);
const negative = (word) => (word & WORD_SIGN) !== 0;
const signExtend = (byte) => (byte & BYTE_SIGN ? SIGN_EXTEND | byte : byte);
// right - 1 as the original's DEC before CMP (0 becomes FFFFh).
const below = (right) => (right - 1) & WORD_MASK;

// The comparisons, as (left, right) with right the top word. Each original compares
// with CMP and some gate on the sign of one operand first.
const COMPARE = {
  [OPCODE.COMPARE_8A_HANDLER]: (l, r) => below(r) >= l,
  [OPCODE.COMPARE_8C_HANDLER]: (l, r) => negative(l) || below(r) >= l,
  [OPCODE.COMPARE_8E_HANDLER]: (l, r) => !negative(r) && below(r) >= l,
  [OPCODE.COMPARE_92_HANDLER]: (l, r) => r >= l,
  [OPCODE.COMPARE_94_HANDLER]: (l, r) => negative(l) || r >= l,
  [OPCODE.COMPARE_96_HANDLER]: (l, r) => !negative(r) && r >= l,
  [OPCODE.COMPARE_9A_HANDLER]: (l, r) => r < l,
  [OPCODE.COMPARE_9C_HANDLER]: (l, r) => !negative(l) && r < l,
  [OPCODE.COMPARE_9E_HANDLER]: (l, r) => negative(r) || r < l,
  [OPCODE.COMPARE_A2_HANDLER]: (l, r) => below(r) >= l,
  [OPCODE.COMPARE_A4_HANDLER]: (l, r) => !negative(l) && below(r) < l,
  [OPCODE.COMPARE_A6_HANDLER]: (l, r) => negative(r) || below(r) < l,
  [OPCODE.EQUAL]: (l, r) => l === r,
  [OPCODE.EQUAL_ALIAS]: (l, r) => l === r,
  [OPCODE.COMPARE_AC_HANDLER]: (l, r) => !negative(l) && r !== l,
  [OPCODE.COMPARE_AE_HANDLER]: (l, r) => !negative(r),
  [OPCODE.NOT_EQUAL]: (l, r) => l !== r,
  [OPCODE.NOT_EQUAL_ALIAS]: (l, r) => l !== r,
  [OPCODE.COMPARE_B4_HANDLER]: (l, r) => negative(l) || r !== l,
  [OPCODE.COMPARE_B6_HANDLER]: (l, r) => negative(r) || r !== l,
};

// 80:F584 multiplies with three 8x8 products of the hardware unit. Before the third,
// it writes the right factor's high byte to WRMPYA, so the third product is
// left high x right high instead of left high x right low: the result is
// ll*rl + ((ll*rh + lh*rh) << 8) in 16 bits, not the true product.
function multiply(left, right) {
  const leftLow = left & BYTE_MASK,
    leftHigh = left >>> BYTE_BITS,
    rightLow = right & BYTE_MASK,
    rightHigh = right >>> BYTE_BITS;
  return (
    (leftLow * rightLow + ((leftLow * rightHigh + leftHigh * rightHigh) << BYTE_BITS)) & WORD_MASK
  );
}
// 80:F546 (left signed), 80:F556 (right signed), 80:F566 (both): multiply the
// magnitudes, negate the result when exactly one signed factor was negative.
function signedProduct(left, right, leftSigned, rightSigned) {
  const leftNegative = leftSigned && negative(left),
    rightNegative = rightSigned && negative(right);
  const product = multiply(
    leftNegative ? -left & WORD_MASK : left,
    rightNegative ? -right & WORD_MASK : right,
  );
  return leftNegative !== rightNegative ? -product & WORD_MASK : product;
}

// Binary operations on (left, right); the result replaces both words.
const BINARY = {
  [OPCODE.ADD]: (l, r) => (l + r) & WORD_MASK,
  [OPCODE.SUBTRACT]: (l, r) => (l - r) & WORD_MASK,
  [OPCODE.MULTIPLY_UU_HANDLER]: (l, r) => multiply(l, r),
  [OPCODE.MULTIPLY_SU_HANDLER]: (l, r) => signedProduct(l, r, true, false),
  [OPCODE.MULTIPLY_US_HANDLER]: (l, r) => signedProduct(l, r, false, true),
  [OPCODE.MULTIPLY_SS_HANDLER]: (l, r) => signedProduct(l, r, true, true),
  [OPCODE.BIT_AND]: (l, r) => l & r,
  [OPCODE.BIT_OR]: (l, r) => l | r,
  [OPCODE.BIT_XOR]: (l, r) => l ^ r,
  // 80:F6FD and 80:F709: the count is the top word; a count of 0 keeps the value.
  [OPCODE.SHIFT_LEFT]: (l, r) => (r >= SHIFT_LIMIT ? 0 : (l << r) & WORD_MASK),
  [OPCODE.SHIFT_RIGHT]: (l, r) => (r >= SHIFT_LIMIT ? 0 : l >>> r),
};
for (const [opcode, compare] of Object.entries(COMPARE))
  BINARY[opcode] = (l, r) => truth(compare(l, r));

// Unary operations on the top word.
const UNARY = {
  [OPCODE.NEGATE]: (v) => -v & WORD_MASK,
  [OPCODE.BIT_NOT]: (v) => v ^ WORD_MASK,
  [OPCODE.INCREMENT]: (v) => (v + 1) & WORD_MASK,
  [OPCODE.DECREMENT]: (v) => (v - 1) & WORD_MASK,
  [OPCODE.BOOLEAN]: (v) => truth(v !== 0),
};

function localIndex(task, index, bytes) {
  if (index + bytes > task.locals.length)
    taskStop('script_local_outside', { script: task.script, pc: task.pc, index });
  return index;
}
const loadLocal8 = (task, index) => task.locals[localIndex(task, index, 1)];
function loadLocal16(task, index) {
  const at = localIndex(task, index, 2);
  return task.locals[at] | (task.locals[at + 1] << BYTE_BITS);
}
function storeLocal16(task, index, value) {
  const at = localIndex(task, index, 2);
  task.locals[at] = value & BYTE_MASK;
  task.locals[at + 1] = value >>> BYTE_BITS;
}

function pullArguments(task, count) {
  const args = new Array(count);
  for (let n = 0; n < count; n++) args[n] = pullWord(task);
  return args;
}

// Runs `task` until it exits; returns { kind, id, args } for a call (the task's
// `call` is then pending, see finishCall), { kind: EXIT_END, result } at the end (result
// null after an empty stack), or
// { kind: EXIT_BUDGET } when `budget` opcodes ran.
export function runTask(mem, task, budget = Infinity) {
  const byte = (offset) => mem.read8((task.code + ((task.pc + offset) & WORD_MASK)) & LONG_MASK);
  const word = (offset) => byte(offset) | (byte(offset + 1) << BYTE_BITS);
  for (let n = 0; ; n++) {
    if (n >= budget) return { kind: EXIT_BUDGET };
    if (n >= OPCODE_LIMIT) taskStop('original_endless_loop', { script: task.script, pc: task.pc });
    const opcode = byte(0);
    let next = (task.pc + 1) & WORD_MASK;
    const u8 = () => {
      next = (task.pc + BYTE_INSTRUCTION_BYTES) & WORD_MASK;
      return byte(1);
    };
    const u16 = () => {
      next = (task.pc + WORD_INSTRUCTION_BYTES) & WORD_MASK;
      return word(1);
    };
    const binary = BINARY[opcode],
      unary = UNARY[opcode];
    if (binary !== undefined) {
      const right = pullWord(task);
      pushWord(task, binary(pullWord(task), right));
    } else if (unary !== undefined) pushWord(task, unary(pullWord(task)));
    else
      switch (opcode) {
        case OPCODE.PUSH_U8:
          pushWord(task, u8());
          break;
        case OPCODE.PUSH_I8:
          pushWord(task, signExtend(u8()));
          break;
        case OPCODE.PUSH_U16:
          pushWord(task, u16());
          break;
        case OPCODE.PUSH_ZERO:
          pushWord(task, 0);
          break;
        case OPCODE.LOAD_LOCAL_U8:
          pushWord(task, loadLocal8(task, u8()));
          break;
        case OPCODE.LOAD_LOCAL_I8:
          pushWord(task, signExtend(loadLocal8(task, u8())));
          break;
        case OPCODE.LOAD_LOCAL_U16:
          pushWord(task, loadLocal16(task, u8()));
          break;
        case OPCODE.LOAD_LOCAL0_U8:
          pushWord(task, loadLocal8(task, 0));
          break;
        case OPCODE.STORE_LOCAL_U8:
          task.locals[localIndex(task, u8(), 1)] = pullWord(task) & BYTE_MASK;
          break;
        case OPCODE.STORE_LOCAL_U16:
          storeLocal16(task, u8(), pullWord(task));
          break;
        case OPCODE.LOAD_STATE_U8:
          pushWord(task, mem.read8(WRAM + u16()));
          break;
        case OPCODE.LOAD_STATE_I8:
          pushWord(task, signExtend(mem.read8(WRAM + u16())));
          break;
        case OPCODE.LOAD_STATE_U16:
          pushWord(task, mem.read16(WRAM + u16()));
          break;
        case OPCODE.STORE_STATE_U8:
          mem.write8(WRAM + u16(), pullWord(task) & BYTE_MASK);
          break;
        case OPCODE.STORE_STATE_U16:
          mem.write16(WRAM + u16(), pullWord(task));
          break;
        case OPCODE.DUPLICATE: {
          const top = pullWord(task);
          pushWord(task, top);
          pushWord(task, top);
          break;
        }
        case OPCODE.DROP:
          pullWord(task);
          break;
        case OPCODE.JUMP_IF_ZERO: {
          const target = u16();
          if (pullWord(task) === 0) next = target;
          break;
        }
        case OPCODE.JUMP_IF_NONZERO: {
          const target = u16();
          if (pullWord(task) !== 0) next = target;
          break;
        }
        case OPCODE.JUMP:
          next = u16();
          break;
        case OPCODE.CALL_LOCAL: {
          const target = u16();
          if (task.returns.length >= LOCAL_RETURN_SLOTS)
            taskStop('script_local_call_depth', { script: task.script, pc: task.pc });
          task.returns.push(next);
          next = target;
          break;
        }
        case OPCODE.RETURN_LOCAL:
          if (task.returns.length === 0)
            taskStop('script_local_return_empty', { script: task.script, pc: task.pc });
          next = task.returns.pop();
          break;
        case OPCODE.CALL_SCRIPT: {
          const id = u16(),
            bytes = mem.read8(SCRIPT_ARGUMENT_BYTES + id);
          // 80:F460 moves bytes / 2 words; one byte alone would move 65536 words.
          if (bytes & 1) taskStop('script_argument_bytes_odd', { script: id });
          task.pc = next;
          task.call = { kind: CALL_SCRIPT, id };
          return { kind: EXIT_SCRIPT, id, args: pullArguments(task, bytes >>> 1) };
        }
        case OPCODE.CALL_NATIVE: {
          const id = u8();
          task.pc = next;
          task.call = { kind: CALL_NATIVE, id };
          return {
            kind: EXIT_NATIVE,
            id,
            args: pullArguments(task, nativeArgumentWords(mem, id)),
          };
        }
        case OPCODE.END:
          // Many scripts end with an empty stack; 80:F4BE then returns the word above
          // the frame (the next heap block's header). That result is null here.
          return { kind: EXIT_END, result: task.stack.length ? task.stack.pop() : null };
        default:
          taskStop('script_opcode_unused', { script: task.script, pc: task.pc, opcode });
      }
    task.pc = next;
  }
}
