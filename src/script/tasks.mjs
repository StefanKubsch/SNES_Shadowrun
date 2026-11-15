// Task model of the script VM (docs/SCRIPT-VM-LIFT.md, phase 1).
//
// A task runs one script. Its state is plain JS: the script PC, the local bytes, the
// operand stack (words, bottom first), the local return stack (call_local) and the
// pending call. The original keeps the same state in a heap frame created by 80:C2C8:
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
// +09) and a local index outside the declared locals. New frames start zeroed: no script
// reads a local before writing it (tools/probe-fresh-script-locals.mjs).
import { taskStop } from '../system/task-stop.mjs';
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
} from '../vm/layout.mjs';
import { BYTE_MASK, LONG_MASK, WORD_BITS } from '../constants/bits.mjs';

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
