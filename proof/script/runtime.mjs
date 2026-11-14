import {
  BYTE_MASK,
  BYTE_BITS,
  BYTE_SIGN,
  HIGH_BYTE_MASK,
  WORD_MASK,
  WORD_BITS,
} from '../../src/constants/bits.mjs';
import { OPCODE } from '../../src/script/opcodes.mjs';
import { decodeScript } from '../../src/script/codec.mjs';
import { isHeapFrameStorage } from './frame-storage.mjs';

export const DEFAULT_STEP_BUDGET = 10000;
const MAX_STEP_BUDGET = 1000000;
const SCRIPT_TRUE = WORD_MASK;

export const executableOpcodes = Object.freeze([
  OPCODE.PUSH_U8,
  OPCODE.LOAD_LOCAL_U8,
  OPCODE.PUSH_I8,
  OPCODE.LOAD_LOCAL_I8,
  OPCODE.PUSH_U16,
  OPCODE.LOAD_LOCAL_U16,
  OPCODE.STORE_LOCAL_U8,
  OPCODE.STORE_LOCAL_U16,
  OPCODE.JUMP_IF_ZERO,
  OPCODE.JUMP_IF_NONZERO,
  OPCODE.JUMP,
  OPCODE.CALL_LOCAL,
  OPCODE.RETURN_LOCAL,
  OPCODE.END,
  OPCODE.ADD,
  OPCODE.SUBTRACT,
  OPCODE.NEGATE,
  OPCODE.SHIFT_LEFT,
  OPCODE.SHIFT_RIGHT,
  OPCODE.BIT_AND,
  OPCODE.BIT_OR,
  OPCODE.BIT_XOR,
  OPCODE.BIT_NOT,
  OPCODE.INCREMENT,
  OPCODE.DECREMENT,
  OPCODE.EQUAL,
  OPCODE.EQUAL_ALIAS,
  OPCODE.NOT_EQUAL,
  OPCODE.NOT_EQUAL_ALIAS,
  OPCODE.DUPLICATE,
  OPCODE.DROP,
  OPCODE.BOOLEAN,
  OPCODE.PUSH_ZERO,
  OPCODE.LOAD_LOCAL0_U8,
]);
const supported = new Set(executableOpcodes);
const signExtend8 = (value) => (value & BYTE_SIGN ? value | HIGH_BYTE_MASK : value);
const word = (value) => value & WORD_MASK;

export const isWord = (value) => Number.isInteger(value) && value >= 0 && value <= WORD_MASK;
export function validateStepBudget(maxSteps) {
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > MAX_STEP_BUDGET)
    throw new Error('Invalid step budget');
}

// Compile the game-event bytecode once; every invocation has a fresh frame.
// Neither this compiler nor runner interprets SNES machine instructions.
// Initial arguments are words in bottom-to-top operand-stack order.
export function compileScriptFrame(code, { localBytes, returnBytes, argumentBytes }) {
  if (
    !Number.isInteger(localBytes) ||
    localBytes < 0 ||
    localBytes > BYTE_MASK ||
    ![0, 2].includes(returnBytes)
  )
    throw new Error('Invalid script frame profile');
  if (
    argumentBytes !== undefined &&
    (!Number.isInteger(argumentBytes) ||
      argumentBytes < 0 ||
      argumentBytes > BYTE_MASK ||
      argumentBytes % 2)
  )
    throw new Error('Invalid script argument profile');
  if (
    !(Array.isArray(code) || code instanceof Uint8Array) ||
    Array.from(code).some((v) => !Number.isInteger(v) || v < 0 || v > BYTE_MASK)
  )
    throw new Error('Invalid script bytes');
  const decoded = decodeScript(Uint8Array.from(code));
  const instructions = new Map(decoded.instructions.map((ins) => [ins.pc, ins]));
  return (initialStack = [], { storage = null } = {}) => {
    if (storage !== null && !isHeapFrameStorage(storage))
      throw new Error('Invalid heap frame storage');
    if (!Array.isArray(initialStack) || initialStack.some((v) => !isWord(v)))
      throw new Error('Invalid initial word stack');
    if (argumentBytes !== undefined && initialStack.length * 2 !== argumentBytes)
      throw new Error('Script argument count mismatch');
    const stack = [...initialStack];
    const locals = new Uint8Array(localBytes);
    const initialized = new Uint8Array(localBytes);
    if (storage)
      storage.initialLocals().forEach((value, index) => {
        if (value !== null) {
          locals[index] = value;
          initialized[index] = 1;
        }
      });
    const calls = [];
    let pc = 0;
    let steps = 0;
    let awaitingCall = false;
    let ended = false;
    const requireStack = (n) => {
      if (stack.length < n) throw new Error(`Script stack underflow at ${pc}`);
    };
    const push = (value) => {
      storage?.writeStack(stack.length + 1, value);
      stack.push(value);
    };
    const replaceTop = (value) => {
      storage?.writeStack(stack.length, value);
      stack[stack.length - 1] = value;
    };
    const localRange = (offset, width, read = false) => {
      if (offset + width > locals.length) throw new Error(`Local access outside frame at ${pc}`);
      if (read && !initialized.subarray(offset, offset + width).every((v) => v === 1))
        throw new Error(`Uninitialized local read at ${pc}`);
    };
    const step = () => {
      if (ended || awaitingCall) throw new Error('Script frame is not runnable');
      const ins = instructions.get(pc);
      if (!ins) throw new Error(`PC outside decoded instruction boundaries: ${pc}`);
      const { opcode: op, operand: arg } = ins;
      if (op === OPCODE.CALL_SCRIPT || op === OPCODE.CALL_NATIVE)
        return { kind: op === OPCODE.CALL_SCRIPT ? 'script_call' : 'native_call', id: arg, pc };
      if (!supported.has(op))
        throw new Error(`Game operation ${ins.name} at ${pc} is not implemented`);
      steps++;
      let next = ins.nextPc;
      if (
        op === OPCODE.PUSH_U8 ||
        op === OPCODE.PUSH_U16 ||
        op === OPCODE.PUSH_I8 ||
        op === OPCODE.PUSH_ZERO
      ) {
        push(op === OPCODE.PUSH_ZERO ? 0 : op === OPCODE.PUSH_I8 ? signExtend8(arg) : arg);
      } else if (
        [
          OPCODE.LOAD_LOCAL_U8,
          OPCODE.LOAD_LOCAL_I8,
          OPCODE.LOAD_LOCAL_U16,
          OPCODE.LOAD_LOCAL0_U8,
        ].includes(op)
      ) {
        const offset = op === OPCODE.LOAD_LOCAL0_U8 ? 0 : arg;
        const width = op === OPCODE.LOAD_LOCAL_U16 ? 2 : 1;
        localRange(offset, width, true);
        const value = locals[offset] | (width === 2 ? locals[offset + 1] << BYTE_BITS : 0);
        push(op === OPCODE.LOAD_LOCAL_I8 ? signExtend8(value) : value);
      } else if (op === OPCODE.STORE_LOCAL_U8 || op === OPCODE.STORE_LOCAL_U16) {
        const width = op === OPCODE.STORE_LOCAL_U16 ? 2 : 1;
        localRange(arg, width);
        requireStack(1);
        const value = stack.pop();
        storage?.writeLocal(arg, width, value);
        locals[arg] = value & BYTE_MASK;
        initialized[arg] = 1;
        if (width === 2) {
          locals[arg + 1] = value >>> BYTE_BITS;
          initialized[arg + 1] = 1;
        }
      } else if (op === OPCODE.JUMP_IF_ZERO || op === OPCODE.JUMP_IF_NONZERO) {
        requireStack(1);
        const value = stack.pop();
        if (op === OPCODE.JUMP_IF_ZERO ? value === 0 : value !== 0) next = arg;
      } else if (op === OPCODE.JUMP) next = arg;
      else if (op === OPCODE.CALL_LOCAL) {
        storage?.pushReturn(calls.length, next);
        calls.push(next);
        next = arg;
      } else if (op === OPCODE.RETURN_LOCAL) {
        if (calls.length === 0) throw new Error(`Local return without call at ${pc}`);
        next = storage ? storage.popReturn(calls.length) : calls.at(-1);
        calls.pop();
      } else if (op === OPCODE.END) {
        // END exits the entire script, including from a local subroutine.
        // The original handler switches back to the host stack and RTS.
        if (returnBytes) requireStack(1);
        const workspaceWord = storage?.endWord(stack.length);
        const value = returnBytes ? stack.pop() : null;
        if (storage && !returnBytes && stack.length) stack.pop();
        ended = true;
        return {
          kind: 'end',
          value,
          stack: [...stack],
          locals: locals.slice(),
          steps,
          endPc: pc,
          ...(storage ? { workspaceWord } : {}),
        };
      } else if (op === OPCODE.DUPLICATE) {
        requireStack(1);
        push(stack.at(-1));
      } else if (op === OPCODE.DROP) {
        requireStack(1);
        stack.pop();
      } else if (
        [
          OPCODE.NEGATE,
          OPCODE.BIT_NOT,
          OPCODE.INCREMENT,
          OPCODE.DECREMENT,
          OPCODE.BOOLEAN,
        ].includes(op)
      ) {
        requireStack(1);
        const value = stack.at(-1);
        replaceTop(
          word(
            op === OPCODE.NEGATE
              ? -value
              : op === OPCODE.BIT_NOT
                ? ~value
                : op === OPCODE.INCREMENT
                  ? value + 1
                  : op === OPCODE.DECREMENT
                    ? value - 1
                    : value
                      ? SCRIPT_TRUE
                      : 0,
          ),
        );
      } else {
        requireStack(2);
        const right = stack.pop();
        const left = stack.at(-1);
        let value;
        switch (op) {
          case OPCODE.ADD:
            value = left + right;
            break;
          case OPCODE.SUBTRACT:
            value = left - right;
            break;
          case OPCODE.SHIFT_LEFT:
            value = right >= WORD_BITS ? 0 : left << right;
            break;
          case OPCODE.SHIFT_RIGHT:
            value = right >= WORD_BITS ? 0 : left >>> right;
            break;
          case OPCODE.BIT_AND:
            value = left & right;
            break;
          case OPCODE.BIT_OR:
            value = left | right;
            break;
          case OPCODE.BIT_XOR:
            value = left ^ right;
            break;
          case OPCODE.EQUAL:
          case OPCODE.EQUAL_ALIAS:
            value = left === right ? SCRIPT_TRUE : 0;
            break;
          case OPCODE.NOT_EQUAL:
          case OPCODE.NOT_EQUAL_ALIAS:
            value = left !== right ? SCRIPT_TRUE : 0;
            break;
          default:
            throw new Error('Missing executable operation');
        }
        replaceTop(word(value));
      }
      pc = next;
      return { kind: 'step' };
    };
    const callArguments = (count) => {
      const ins = instructions.get(pc);
      if (
        ended ||
        awaitingCall ||
        ![OPCODE.CALL_SCRIPT, OPCODE.CALL_NATIVE].includes(ins?.opcode) ||
        !Number.isInteger(count) ||
        count < 0
      )
        throw new Error('Invalid call boundary');
      requireStack(count);
      return count ? stack.slice(-count) : [];
    };
    return {
      step,
      callArguments,
      enterCall(count) {
        const args = callArguments(count);
        stack.length -= count;
        const instruction = instructions.get(pc);
        pc = instruction.nextPc;
        storage?.saveCall(pc, instruction.operand, stack.length);
        awaitingCall = true;
        steps++;
        return args;
      },
      resumeCall(value, resultBytes) {
        if (
          !awaitingCall ||
          ![0, 2].includes(resultBytes) ||
          (resultBytes ? !isWord(value) : value !== null)
        )
          throw new Error('Invalid call return');
        if (resultBytes) push(value);
        awaitingCall = false;
      },
      snapshot: () => ({
        pc,
        stack: [...stack],
        locals: locals.slice(),
        steps,
        ...(storage ? { memory: storage.describe() } : {}),
      }),
    };
  };
}

export function createScriptRunner(code, profile) {
  const createFrame = compileScriptFrame(code, profile);
  return (initialStack = [], { maxSteps = DEFAULT_STEP_BUDGET } = {}) => {
    validateStepBudget(maxSteps);
    const frame = createFrame(initialStack);
    for (let n = 0; n < maxSteps; n++) {
      const event = frame.step();
      if (event.kind === 'end') {
        const { kind, ...result } = event;
        return result;
      }
      if (event.kind !== 'step')
        throw new Error(
          `Game operation ${event.kind} at ${event.pc} is not implemented in the synchronous runner`,
        );
    }
    throw new Error('Script instruction budget exhausted');
  };
}
