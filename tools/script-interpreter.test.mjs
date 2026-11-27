// The JS script interpreter (src/script/interpreter.mjs) against the frozen outcomes of
// the register-level interpreter (retired with proof/vm), docs/SCRIPT-VM-LIFT.md phase 1.
//
// Corpus: each ROM script starts from a random WRAM with a frame as 80:C2C8 builds it;
// the JS task starts with zeroed locals. Each native and script call returns a random
// result (finishCall), so the run goes on through the script. The trace holds the PC,
// operand stack, local return stack and written locals after every opcode; the outcome
// adds the final WRAM without the frame and the interpreter's work bytes. A local load
// of a byte the script has not written (the fresh read guard) ends the run with its site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import {
  ARITHMETIC_SCRATCH,
  FRAME_PC,
  FRAME_RETURN,
  FRAME_RETURN_BASE,
  OUTER_STACK,
  SCRIPT_RETURN_BYTES,
  TASK_CURSOR,
  TASK_FRAME,
} from '../src/vm/layout.mjs';
import { createTask, finishCall, scriptInfo, CALL_SCRIPT } from '../src/script/tasks.mjs';
import { OPCODE, scriptOpcodes, trapOpcodes } from '../src/script/opcodes.mjs';
import { runTask, EXIT_END, EXIT_NATIVE, EXIT_SCRIPT } from '../src/script/interpreter.mjs';

const rom = new Uint8Array(readFileSync(new URL('../Shadowrun (E).smc', import.meta.url)));
// Frozen reference (removal plan step 5): the outcomes of the register-level interpreter
// (retired with proof/vm) are kept as vectors; the JS side is compared with them.
useLiftVectors(import.meta.url);
const SCRIPT_COUNT = 937;

function prng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const EDGE = [0, 1, 2, 0x7f, 0x80, 0xff, 0x100, 0x7fff, 0x8000, 0x8001, 0xfffe, 0xffff];
const randomWord = (rnd) =>
  rnd() < 0.4
    ? EDGE[(rnd() * EDGE.length) | 0]
    : rnd() < 0.5
      ? (rnd() * 0x10) | 0
      : (rnd() * 0x10000) | 0;

const OUTER_S = 0x1c00,
  TASK_SLOT = 0x10;

// Local loads and the bytes they read (index from the operand unless fixed).
const LOCAL_READS = {
  [OPCODE.LOAD_LOCAL_U8]: { bytes: 1 },
  [OPCODE.LOAD_LOCAL_I8]: { bytes: 1 },
  [OPCODE.LOAD_LOCAL_U16]: { bytes: 2 },
  [OPCODE.LOAD_LOCAL0_U8]: { bytes: 1, index: 0 },
};

// One script from one seed. Returns 'equal' (budget or END), 'fresh:<script>@<pc>',
// or 'frontier:<reason>' (the JS side stops where the register-level side went on).
function compareScript(id, seed, maxSteps = 1000) {
  const rnd = prng(seed * 0x10000 + id);
  const wram = new Uint8Array(0x20000);
  for (let n = 0; n < wram.length; n++) wram[n] = rnd() < 0.5 ? 0 : (rnd() * 256) | 0;
  const info = scriptInfo(new VmMemory(rom, wram.slice()), id),
    frame = 0x0400 + ((rnd() * 0x100) & ~1),
    args = Array.from({ length: info.argumentBytes >>> 1 }, () => randomWord(rnd));
  // Frame as 80:C2C8 builds it; the arguments on top, args[0] the top word.
  const bank = info.code >>> 16,
    put = (at, value) => {
      wram[at] = value & 0xff;
      wram[at + 1] = value >>> 8;
    };
  put(frame, info.code & 0xffff);
  wram[frame + 2] = bank;
  put(frame + FRAME_PC, 0);
  put(frame + FRAME_RETURN, frame + FRAME_RETURN_BASE);
  const top = frame + info.frameBytes - 1,
    s = top - 2 * args.length;
  args.forEach((value, n) => put(s + 1 + 2 * n, value));
  put(OUTER_STACK, OUTER_S);
  put(TASK_CURSOR, TASK_SLOT);
  put(TASK_FRAME + TASK_SLOT, frame);

  const newMem = new VmMemory(rom, wram.slice());
  const task = createTask(newMem, id, args);
  // The JS side's trace: exit, PC, stacks and written locals after every opcode.
  const trace = [];
  // Local bytes the script has written; only these are compared.
  const written = new Uint8Array(info.localBytes);
  let steps = 0,
    result = 'equal',
    unknownResult = false;
  for (; steps < maxSteps; steps++) {
    const opcode = newMem.read8(task.code + task.pc),
      operand = newMem.read8(task.code + task.pc + 1),
      read = LOCAL_READS[opcode];
    if (read) {
      const index = read.index ?? operand;
      if (
        index + read.bytes <= info.localBytes &&
        !written.subarray(index, index + read.bytes).every(Boolean)
      ) {
        result = `fresh:${id.toString(16)}@${task.pc.toString(16)}`;
        break;
      }
    }
    if (opcode === OPCODE.STORE_LOCAL_U8) written[operand] = 1;
    if (opcode === OPCODE.STORE_LOCAL_U16) written[operand] = written[operand + 1] = 1;
    let newExit;
    try {
      newExit = runTask(newMem, task, 1);
    } catch (error) {
      if (!error?.taskBoundary) throw error;
      result = `frontier:${error.reason}`;
      break;
    }
    trace.push([
      newExit.kind,
      newExit.id ?? null,
      newExit.args ?? null,
      newExit.result ?? null,
      task.pc,
      [...task.stack],
      [...task.returns],
      task.locals.map((value, n) => (written[n] ? value : 0)),
    ]);
    // An empty stack leaves the original's result undefined (the word above the frame).
    if (newExit.kind === EXIT_END) {
      unknownResult = newExit.result === null;
      if (!unknownResult) newMem.write16(0x7e0000, newExit.result);
      break;
    }
    // Each native and script call returns a random result in DP 00, with the
    // arguments in the words 00.. as the original passes them (80:F4CB, 80:F460).
    if (newExit.kind === EXIT_NATIVE || newExit.kind === EXIT_SCRIPT) {
      newExit.args.forEach((value, n) => newMem.write16(0x7e0000 + 2 * n, value));
      const value = randomWord(rnd);
      newMem.write16(0x7e0000, value);
      finishCall(newMem, task, value);
    }
  }
  const masked = (n) =>
    (n >= frame && n < frame + info.frameBytes) ||
    (n >= ARITHMETIC_SCRATCH && n < ARITHMETIC_SCRATCH + 8) ||
    (n >= OUTER_S - 2 && n <= OUTER_S);
  // The final WRAM as compared, without the undefined result word.
  const final = newMem.wram.slice();
  for (let n = 0; n < final.length; n++) if (masked(n) || (unknownResult && n < 2)) final[n] = 0;
  const outcome = { result, trace, wram: createHash('sha256').update(final).digest('hex') };
  assertFrozenRun(outcome, null, `script ${id} seed ${seed}`);
  return result;
}

// Fresh local reads the corpus reaches with random native results. Script DD at 84:
// the loop 71-8D writes local 4 only when the wait native 9F (mask 0801h, counter 5)
// ends by event 0800h; after a timeout it reads local 4 unwritten, so the original
// reads heap residue there (docs/SCRIPT-VM-LIFT.md). The others follow a chain of
// equality tests that writes the local for a fixed set of values only (directions,
// the result of native 57), so they need a value outside that set.
const KNOWN_FRESH_READS = new Set([
  'fresh:dd@84',
  'fresh:f@1be',
  'fresh:ef@1b0',
  'fresh:1e4@146',
  'fresh:223@58',
  'fresh:23d@fe',
  'fresh:31b@10d',
  'fresh:3a3@54',
]);

test('every ROM script runs on the JS interpreter as on the register-level interpreter', () => {
  const tally = {};
  for (let seed = 1; seed <= 2; seed++)
    for (let id = 0; id < SCRIPT_COUNT; id++) {
      const result = compareScript(id, seed);
      tally[result] = (tally[result] ?? 0) + 1;
    }
  const unexpected = Object.keys(tally).filter(
    (result) => result !== 'equal' && !KNOWN_FRESH_READS.has(result),
  );
  assert.deepEqual(unexpected, [], JSON.stringify(tally));
  assert.ok(tally.equal > 1800, JSON.stringify(tally));
});

// A synthetic program in WRAM 0800 (bank 80); returns the operand stack.
function runSynthetic(bytes, steps) {
  const wram = new Uint8Array(0x20000),
    frame = 0x0400;
  wram.set(bytes, 0x0800);
  wram[frame + 1] = 0x08;
  wram[frame + 2] = 0x80;
  const newMem = new VmMemory(rom, wram.slice());
  const task = {
    script: -1,
    code: 0x800800,
    pc: 0,
    locals: new Uint8Array(0),
    stack: [],
    stackCapacity: 8,
    returns: [],
    call: null,
  };
  runTask(newMem, task, steps);
  return task.stack;
}

test('every implemented arithmetic, logic and comparison opcode matches at edge values', () => {
  const binary = Object.values(scriptOpcodes)
    .filter((spec) => spec.operand === 'none' && spec.flow === 'next')
    .map((spec) => spec.opcode)
    .filter(
      (op) =>
        !(op >= OPCODE.DIVIDE_UU_HANDLER && op <= OPCODE.REMAINDER_SS_HANDLER) &&
        ![OPCODE.END, OPCODE.PUSH_ZERO, OPCODE.LOAD_LOCAL0_U8, OPCODE.DROP].includes(op),
    );
  const values = [...EDGE, 0x12c, 0x1234, 0x5678, 0x1ff, 0x8123, 0xfe00];
  for (const op of binary)
    for (const left of values)
      for (const right of values) {
        const program = [0x14, left & 0xff, left >>> 8, 0x14, right & 0xff, right >>> 8, op];
        const js = runSynthetic(program, 3);
        assertFrozenRun(js, null, `opcode ${op.toString(16)} ${left} ${right}`);
      }
});

test('the multiply follows the original, not the true product', () => {
  // 80:F584 takes left high x right high for the third product.
  const js = runSynthetic([0x14, 0x2c, 0x01, 0x14, 0x2c, 0x01, OPCODE.MULTIPLY_UU_HANDLER], 3);
  assert.deepEqual(js, [0x3490]);
});

test('unbounded original paths stop at frontiers', () => {
  const mem = new VmMemory(rom, new Uint8Array(0x20000));
  const stop = (bytes, reason, setup = () => {}) => {
    mem.wram.fill(0, 0x0800, 0x0900);
    mem.wram.set(bytes, 0x0800);
    const task = {
      script: -1,
      code: 0x800800,
      pc: 0,
      locals: new Uint8Array(2),
      stack: [],
      stackCapacity: 2,
      returns: [],
      call: null,
    };
    setup(task);
    assert.throws(
      () => runTask(mem, task),
      (error) => error.taskBoundary && error.reason === reason,
      reason,
    );
  };
  for (const op of [
    ...trapOpcodes,
    0x54,
    0x90,
    0x98,
    0xa0,
    0xa8,
    OPCODE.DIVIDE_UU_HANDLER,
    OPCODE.REMAINDER_SS_HANDLER,
  ])
    stop([0xc0, 0xc0, op], 'script_opcode_unused');
  stop([OPCODE.DROP], 'script_operand_stack_underflow');
  stop([0xc0, 0xc0, 0xc0], 'script_operand_stack_overflow');
  stop([OPCODE.RETURN_LOCAL], 'script_local_return_empty');
  stop([OPCODE.LOAD_LOCAL_U16, 1], 'script_local_outside');
  stop([OPCODE.CALL_LOCAL, 0, 0], 'script_local_call_depth');
  // A script result that the caller takes but the child left undefined.
  const task = createTask(mem, 1, [0]);
  const id = [...Array(SCRIPT_COUNT).keys()].find((n) => mem.read8(SCRIPT_RETURN_BYTES + n));
  task.call = { kind: CALL_SCRIPT, id };
  assert.throws(
    () => finishCall(mem, task, null),
    (error) => error.reason === 'script_result_undefined',
  );
});
