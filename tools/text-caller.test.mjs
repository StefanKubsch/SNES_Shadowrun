import test from 'node:test';
import assert from 'node:assert/strict';
import { printTextSequence } from '../src/game/text-print.mjs';
import { printTextSequence as formerText } from '../proof/caller/text-print.mjs';
import { NativeCallContinuation } from '../src/system/native-call-continuation.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { createSide } from './lift-function-harness.mjs';
import { TEXT_BUFFER } from '../src/data/wram.mjs';

// A renderer with multiple cooperative segments exposes lost replies, premature
// bank restoration and missed returns without coupling the producer to a table.
function run(sequence, id, budget, translated) {
  const side = createSide({ seed: 17, wram: new Uint8Array(0x20000) }, new Map()),
    { h, a, mem } = side,
    calls = [];
  mem.write16(2, id);
  if (translated) mem.language = new Map([[id, Uint8Array.from([65, 66, 67])]]);
  Object.assign(a.ctx, { programBank: 0x80, bank: 0x95, pc: 0xfe69, y: 71 });
  h.push(0x1234, 2);
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
    continuation = new NativeCallContinuation(
      a,
      sequence(h, {}, sequence === formerText ? routines : renderer),
      factories,
    );
  const before = mem.wram.slice();
  assert.equal(continuation.run(0), WAIT_PAUSED);
  assert.deepEqual(mem.wram, before);
  let steps = 0;
  while (continuation.run(budget) === WAIT_PAUSED) assert.ok(++steps < 100);
  return { calls, wram: mem.wram, ctx: a.ctx, result: continuation.result };
}

for (const budget of [1, 7])
  for (const id of [0x7074, 0x707d, 0x7446, 0x8000, 0x7077])
    for (const translated of [false, true])
      test(`text renderer interface: ${id.toString(16)}, budget ${budget}, translation ${translated}`, () => {
        const actual = run(printTextSequence, id, budget, translated),
          previous = run(formerText, id, budget, translated);
        assert.deepEqual(actual, previous);
        assert.equal(actual.calls.length, 2);
        assert.equal(actual.ctx.bank, 0x95);
        assert.equal(actual.ctx.pc, 0x1235);
        assert.equal(actual.ctx.y, 44);
      });
