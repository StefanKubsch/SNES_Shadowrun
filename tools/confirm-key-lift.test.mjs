// The lifted confirm key wait 80:F953 (src/game/confirm-key.mjs) against the original's
// loop (src/task/native-input-wait.mjs: JSL 81:B0A1 at 80:F953, JSR 80:9E1A at 80:F957,
// then the newly pressed word 7E:01CE masked with E0C0 until nonzero, RTS). The callees
// are stand-ins: the word wait records its call, the pad word sets the next pressed
// word of a script. The register-level callees read recorded observations and cannot
// be replaced, so this checks the loop against its source contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DialogTestMemory } from './task-native-dialog-harness.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import { drainNativeSequence } from '../src/task/native-call-continuation.mjs';
import { waitForConfirmKeySequence } from '../src/game/confirm-key.mjs';

const PAD_PRESSED = 0x01ce,
  STACK = 0x1c9,
  CALLER_RETURN = 0x1234,
  CONFIRM = [0x8000, 0x4000, 0x2000, 0x0080, 0x0040],
  OTHER = [0x1000, 0x0800, 0x0400, 0x0200, 0x0100, 0x0020, 0x0010, 0x0001];

function run(presses) {
  const mem = new DialogTestMemory(new Uint8Array(0x20000)),
    a = new TaskAccessor({ mem, a: 0, x: 0, y: 0, s: STACK, d: 0, dbr: 0x80, p: 0, pc: 0 });
  a.load();
  a.ctx.programBank = 0x80;
  a.pushWord(CALLER_RETURN);
  const h = dialogAccess(a),
    calls = [];
  let next = 0;
  const returnFrom = (callee, long) => {
    const raw = callee.a.pullWord();
    if (long) {
      callee.ctx.s = (callee.ctx.s + 1) & 0xffff;
      callee.ctx.programBank = callee.a.read(callee.ctx.s);
    }
    callee.ctx.pc = (raw + 1) & 0xffff;
    return { rawReturnWord: raw };
  };
  const routines = new Map([
    [
      0x81b0a1,
      (callee) => {
        calls.push(`wait ${(callee.ctx.programBank << 16) | callee.ctx.pc}`);
        return returnFrom(callee, true);
      },
    ],
    [
      0x809e1a,
      (callee) => {
        const value = presses[next++];
        mem.wram[PAD_PRESSED] = value & 0xff;
        mem.wram[PAD_PRESSED + 1] = value >>> 8;
        calls.push('pad');
        return returnFrom(callee, false);
      },
    ],
  ]);
  drainNativeSequence(waitForConfirmKeySequence(h, null, routines));
  return { calls, a: a.ctx.a, pc: a.ctx.pc, s: a.ctx.s, rounds: next };
}

test('80:F953 waits until B, Y, Select, A or X is newly pressed', () => {
  for (const button of CONFIRM) {
    const r = run([0, ...OTHER, button | 0x0010]);
    assert.equal(r.rounds, OTHER.length + 2);
    assert.equal(r.a, button);
    assert.equal(r.calls.length, 2 * r.rounds);
    assert.ok(r.calls.every((c, n) => (n % 2 ? c === 'pad' : c === `wait ${0x81b0a1}`)));
    assert.equal(r.pc, (CALLER_RETURN + 1) & 0xffff);
    assert.equal(r.s, STACK);
  }
});
