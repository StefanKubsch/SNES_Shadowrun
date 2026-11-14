// Random per-function tests of lifted code against the register-level reference
// (docs/MATRIX-LIFT.md). A sample is a random WRAM image; both sides run one
// routine on their own copy and must leave the same game state: the same WRAM (outside
// the ignored scratch and the CPU stacks), the same device writes and the same result,
// or stop at the same frontier. Game state only (user, 2026-11-14): registers, flags
// and stack bytes count only where a callee or caller reads them as an argument or
// result; stand-ins record their inputs with calleeRecord. Shared by tools/matrix-lift-functions.test.mjs and
// tools/cutscene-lift-functions.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';

const STACK = 0x1c9,
  // The main and NMI stacks: return words and saved registers, no game state.
  CPU_STACKS = [
    [0x0100, 0x01ca],
    [0x1c7c, 0x1cbc],
  ],
  APU_PORT_0 = 0x2140,
  APU_COMMAND_TOKEN = 0x1ce4,
  // Bank 81 for the data bank and the long caller frame.
  LONG_CALLER_BANK = 0x81,
  SAMPLES = 300,
  CALLER_RETURN = 0x1234,
  BYTE_VALUES = 0x100,
  WORD_VALUES = 0x10000,
  COUNTER_SALT = 0x5a5a5a5a,
  WORD_BANK_SHIFT = 16,
  LISTED_BYTES = 8,
  HEX = 16,
  BYTE_BITS = 8;

// One side: a task accessor on its own copy of the sample's WRAM with its device
// writes recorded. The sound driver echoes the command token on APU port 0; other
// reads (beam counters, joypad) get the same sequence of the sample on both sides.
// prepare(mem, s) may add language state to the memory.
export function createSide(s, routines, prepare = () => {}) {
  // The sample's SRAM, if it has one.
  const mem = new DialogTestMemory(s.wram.slice(), s.sram?.slice() ?? null);
  prepare(mem, s);
  const a = new TaskAccessor({
    mem,
    a: 0,
    x: 0,
    y: 0,
    s: STACK,
    d: 0,
    dbr: LONG_CALLER_BANK,
    p: 0,
    pc: 0,
  });
  a.load();
  a.ctx.programBank = LONG_CALLER_BANK;
  const writes = [],
    counter = prng(s.seed ^ COUNTER_SALT);
  a.io = [];
  a.devices = {
    read: (address, width) =>
      (address & (WORD_VALUES - 1)) === APU_PORT_0
        ? mem.wram[APU_COMMAND_TOKEN]
        : Math.floor(counter() * WORD_VALUES) & (width === 1 ? BYTE_VALUES - 1 : WORD_VALUES - 1),
    write(_pc, address, value, width) {
      writes.push([address & (WORD_VALUES - 1), value, width].join());
    },
  };
  return { mem, a, h: dialogAccess(a), writes, routines };
}
// A stand-in's record of one call: its target, the direct page words it reads (dp, a list
// of offsets) and the registers it reads as arguments (registers, a list of names such
// as 'a' or 'x'), as one string.
export function calleeRecord(target, h, { dp = [], registers = [] } = {}) {
  const { wram } = h.a.mem,
    words = dp.map((at) => wram[at] | (wram[at + 1] << BYTE_BITS));
  return [target, ...registers.map((name) => h.a.ctx[name]), ...words]
    .map((v) => v.toString(HEX))
    .join(':');
}
export function outcome(state, run, ignored) {
  let result, stop;
  try {
    result = run();
  } catch (error) {
    if (!error.reason) throw error;
    stop = error.reason;
  }
  const wram = state.mem.wram.slice();
  for (const [from, to] of [...CPU_STACKS, ...ignored]) wram.fill(0, from, to);
  return { result, stop, wram, sram: state.mem.sram?.slice(), writes: state.writes };
}
export function differences({ want, got }) {
  const out = [];
  if (want.stop !== got.stop) out.push(`stop ${want.stop} / ${got.stop}`);
  if (want.stop || got.stop) return out;
  if (want.result !== undefined && want.result !== got.result)
    out.push(`result ${want.result} / ${got.result}`);
  const bytes = [];
  for (let i = 0; i < want.wram.length && bytes.length < LISTED_BYTES; i++)
    if (want.wram[i] !== got.wram[i])
      bytes.push(`${i.toString(HEX)}:${want.wram[i].toString(HEX)}/${got.wram[i].toString(HEX)}`);
  if (bytes.length) out.push(`wram ${bytes.join(' ')}`);
  if (want.sram && want.sram.some((v, i) => v !== got.sram[i])) out.push('sram');
  if (want.writes.join(';') !== got.writes.join(';'))
    out.push(`writes ${want.writes.length} / ${got.writes.length}`);
  return out;
}

// A case: entry (the routine in the reference table), long (RTL), prepare(s) (the
// register inputs; may narrow the sample), reference(h, e, r) (instead of the table
// entry), events() (for the reference), lifted(m, input), result(h) (the reference
// result), samples. side(s) builds a side; runtime(h) the lifted runtime.
export function compareCase(c, s, { side, runtime, ignored }) {
  const input = { a: 0, x: 0, y: 0, ...c.prepare?.(s) };
  const reference = side(s);
  Object.assign(reference.a.ctx, input);
  // The routine runs in its own bank; long routines (RTL) get a long caller frame.
  reference.a.ctx.programBank = c.entry >>> WORD_BANK_SHIFT;
  if (c.long) reference.h.pushByte(LONG_CALLER_BANK);
  reference.h.push(CALLER_RETURN, 2);
  const want = outcome(
    reference,
    () => {
      (c.reference ?? reference.routines.get(c.entry))(
        reference.h,
        c.events?.() ?? null,
        reference.routines,
      );
      return c.result?.(reference.h);
    },
    ignored,
  );
  const lifted = side(s);
  const got = outcome(lifted, () => c.lifted(runtime(lifted.h), input), ignored);
  return { want, got };
}

// Register one test per case. outside: lifted stops that mark a sample outside the
// lifted domain (counted, at most 10 %); the reference's access budget stop counts
// as unmeasured (at most 2 %).
export function registerCases(
  cases,
  { sample, side, runtime, ignored, samples = SAMPLES, outside = new Set() },
) {
  for (const c of cases)
    test(`${c.name}: the lifted function matches the reference on random states`, () => {
      let stopped = 0,
        unmeasured = 0,
        beyond = 0;
      const count = c.samples ?? samples;
      for (let seed = 1; seed <= count; seed++) {
        const pair = compareCase(c, sample(seed * 7919 + c.entry), { side, runtime, ignored }); // magic-number-ok: a prime that spreads the seeds
        // The reference accessor stops after NATIVE_ACCESS_LIMIT accesses, a run time
        // budget, not a game result. Beyond it the reference gives no result.
        if (pair.want.stop === 'native_access_limit') {
          unmeasured++;
          continue;
        }
        if (outside.has(pair.got.stop)) {
          beyond++;
          continue;
        }
        assert.deepEqual(differences(pair), [], `seed ${seed}`);
        if (pair.want.stop) stopped++;
      }
      assert.ok(stopped < count / 2, `${stopped} of ${count} samples stopped at a frontier`);
      assert.ok(unmeasured < count / 50, `${unmeasured} samples beyond the reference budget`); // magic-number-ok: 2 %
      assert.ok(beyond < count / 10, `${beyond} samples outside the lifted domain`); // magic-number-ok: 10 %
    });
}
