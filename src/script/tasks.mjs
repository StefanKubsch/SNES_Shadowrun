// Tasks of the scheduler (docs/READABLE-GAME.md, phase 2). A task runs one script: the
// decompiled script of src/scripts/ as a generator, started with the task's arguments.
// Each step runs the script until it calls a native, starts another script or ends; the
// scheduler then makes the call and hands the result back with finishCall.
//
// No script trips the original's frame limits (an odd argument byte count, a frame size
// past FF, more arguments than stack words), and the decompiled scripts keep their
// operand stack in expressions (tools/decompile-scripts.test.mjs compares them with the
// bytecode interpreter of tools/script-interpreter.mjs).
import { taskStop } from '../system/task-stop.mjs';
import {
  NATIVE_ARGUMENT_COUNTS,
  NATIVE_RETURN_BYTES,
  SCRIPT_ARGUMENT_BYTES,
  SCRIPT_RETURN_BYTES,
} from '../vm/layout.mjs';
import { SCRIPTS } from '../scripts/index.mjs';
import { ScriptEnd, NATIVE, SCRIPT } from '../scripts/runtime.mjs';
import { scriptState } from '../state/scripts.mjs';

export const CALL_NATIVE = NATIVE;
export const CALL_SCRIPT = SCRIPT;
export const EXIT_END = 'end';

export const scriptArgumentWords = (mem, id) => mem.read8(SCRIPT_ARGUMENT_BYTES + id) >>> 1;
export const nativeArgumentWords = (mem, id) => mem.read8(NATIVE_ARGUMENT_COUNTS + id);

// A new task for script `id`. `args` lists the argument words in the order the script
// takes them (args[0] its first argument, the calling script's top word).
export function createTask(mem, id, args = []) {
  if (args.length !== scriptArgumentWords(mem, id))
    taskStop('script_argument_count', { script: id, args: args.length });
  return {
    script: id,
    args,
    run: null,
    input: undefined,
    call: null, // { kind: CALL_NATIVE | CALL_SCRIPT, id } while a call is pending
  };
}

// Run the task's script on until its next call or its end: { kind, id, args } for a call
// (pending until finishCall), { kind: EXIT_END, result } at the end (result null when
// the script left no word). scripts: the script generators by number.
export function stepTask(mem, task, scripts = SCRIPTS) {
  task.run ??= scripts[task.script](scriptState(mem), ...task.args);
  let next;
  try {
    next = task.run.next(task.input);
  } catch (error) {
    if (error instanceof ScriptEnd) return { kind: EXIT_END, result: error.result };
    throw error;
  }
  task.input = undefined;
  if (next.done) return { kind: EXIT_END, result: next.value };
  const { kind, id, args } = next.value;
  task.call = { kind, id };
  return { kind, id, args };
}

// The result of the pending call goes back to the script when the call has one; a script
// that ended without a word has no defined result.
export function finishCall(mem, task, result) {
  const call = task.call;
  if (call === null) taskStop('script_call_not_pending', { script: task.script });
  const table = call.kind === CALL_NATIVE ? NATIVE_RETURN_BYTES : SCRIPT_RETURN_BYTES;
  task.call = null;
  if (mem.read8(table + call.id) === 0) return;
  if (result === null) taskStop('script_result_undefined', { script: task.script, call: call.id });
  task.input = result;
}
