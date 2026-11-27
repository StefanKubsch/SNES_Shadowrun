import test from 'node:test';
import assert from 'node:assert/strict';
import { printNumberJsr, printTextJsr } from './register-forms/jsr-forms.mjs';
import { NativeCallContinuation } from './register-forms/native-call-continuation.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { createSide, assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { TEXT_BUFFER } from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

// The depth of the free stack bytes ignored below the entry S (as the lift function
// harness ignores them).
const FREE_STACK_DEPTH = 0x70;

// A renderer with multiple cooperative segments exposes lost replies, premature
// bank restoration and missed returns without coupling the producer to a table.
function run(sequence, id, budget, translated) {
  const side = createSide({ seed: 17, wram: new Uint8Array(0x20000) }, new Map()),
    { h, a, mem } = side,
    calls = [];
  mem.write16(2, id);
  // The original decimal routine uses the divider. Preserve its device traffic
  // while isolating caller composition from the hardware implementation.
  let dividend = 0,
    quotient = 0,
    remainder = 0;
  const writes = [];
  a.devices = {
    bus: side.picture,
    write(pc, address, value, width) {
      writes.push([pc, address, value, width]);
      if ((address & 0xffff) === 0x4204) dividend = value;
      if ((address & 0xffff) === 0x4206) {
        quotient = Math.floor(dividend / value);
        remainder = dividend % value;
      }
    },
    read(address) {
      if ((address & 0xffff) === 0x4214) return quotient;
      assert.equal(address & 0xffff, 0x4216);
      return remainder;
    },
  };
  if (translated) mem.language = new Map([[id, Uint8Array.from([65, 66, 67])]]);
  Object.assign(a.ctx, { programBank: 0x80, bank: 0x95, pc: 0xfe69, y: 71 });
  h.push(0x1234, 2);
  const entryStack = a.ctx.s;
  function* renderer(callee) {
    yield () =>
      calls.push(['enter', callee.ctx.bank, mem.wram.slice(TEXT_BUFFER, TEXT_BUFFER + 256)]);
    yield () => calls.push(['resume', callee.ctx.bank]);
    let result;
    yield () => {
      callee.ctx.a = 42;
      callee.ctx.x = 43;
      callee.ctx.y = 44;
      result = callee.rts();
    };
    return result;
  }
  const routines = new Map([[0x80fb39, () => assert.fail('renderer must run cooperatively')]]),
    runRenderer = routines.get(0x80fb39),
    factories = new Map([
      [
        runRenderer,
        {
          run: runRenderer,
          create: () => new NativeCallContinuation(a, renderer(h)),
        },
      ],
    ]),
    continuation = new NativeCallContinuation(a, sequence(h, {}, renderer), factories);
  const before = mem.wram.slice();
  assert.equal(continuation.run(0), WAIT_PAUSED);
  assert.deepEqual(mem.wram, before);
  let steps = 0;
  while (continuation.run(budget) === WAIT_PAUSED) assert.ok(++steps < 100);
  // The free bytes below the entry S are not game state (user decision 2026-11-17): the
  // lifted routines keep the words the original only parks there in locals.
  mem.wram.fill(0, Math.max(0, entryStack - FREE_STACK_DEPTH), entryStack + 1);
  return { calls, writes, wram: mem.wram, ctx: a.ctx, result: continuation.result };
}

// The registers a lifted renderer no longer leaves.
const strip = ({ ctx: { a, x, y, status, ...ctx }, ...rest }) => ({ ...rest, ctx });

for (const budget of [1, 7])
  for (const id of [0x7074, 0x707d, 0x7446, 0x8000, 0x7077])
    for (const translated of [false, true])
      test(`text renderer interface: ${id.toString(16)}, budget ${budget}, translation ${translated}`, () => {
        // Game state only (user decision 2026-11-17): the lifted text print leaves no A,
        // X, Y and flags; the Y below is the stub renderer's.
        const actual = run(printTextJsr, id, budget, translated);
        assertFrozenRun(strip(actual));
        assert.equal(actual.calls.length, 2);
        assert.equal(actual.ctx.bank, 0x95);
        assert.equal(actual.ctx.pc, 0x1235);
        assert.equal(actual.ctx.y, 44);
      });

for (const budget of [1, 7])
  for (const value of [0, 1, 9, 10, 99, 100, 9999, 10000, 65535])
    test(`number renderer interface: ${value}, budget ${budget}`, () => {
      // Game state only (user decision 2026-11-17): the lifted number leaves no A, X, Y
      // and flags.
      const actual = run(printNumberJsr, value, budget, false);
      assertFrozenRun(strip(actual));
      const bytes = actual.calls[0][2],
        end = bytes.indexOf(0);
      assert.equal(String.fromCharCode(...bytes.subarray(0, end)), String(value));
      assert.equal(actual.ctx.bank, 0x95);
      assert.equal(actual.ctx.pc, 0x1235);
      assert.equal(actual.calls.length, 2);
    });
