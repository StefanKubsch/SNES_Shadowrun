import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskNativeCC33 as three } from '../proof/task/native-cc33.mjs';
import { prepareTaskNativeCC97 as one } from '../proof/task/native-cc97.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { commit } from './task-native-test-support.mjs';
const put = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);
const word = (f, a) => f.data.readByte(a).value | (f.data.readByte(a + 1).value << 8);
test('Native54 independently writes three full WORD fields, actual DBR, ordered fresh sources and final flags', () => {
  for (const bank of [0x80, 0x7f])
    for (const value of [0, 0x7fff, 0x8000, 0xffff]) {
      const f = taskLeafFixture(0x80cc33, { bank });
      put(f, 0, value);
      put(f, 2, value ^ 0x8000);
      put(f, 4, value ^ 0xffff);
      const p = commit(three, f);
      assert.equal(word(f, bank * 65536 + 0x1ce9), value);
      assert.equal(word(f, bank * 65536 + 0x1ceb), value ^ 0x8000);
      assert.equal(word(f, 0x7e2de2), value ^ 0xffff);
      assert.equal(p.outputContext.a, value ^ 0xffff);
      assert.equal(p.outputContext.status & 0x41, f.context.status & 0x41);
      assert.equal(
        p.outputContext.status & 0x82,
        (value ^ 0xffff) & 0x8000 ? 0x80 : value === 0xffff ? 2 : 0,
      );
      assert.ok(
        !p.accesses.some(
          (a) =>
            a.kind === 'read' &&
            [bank * 65536 + 0x1ce9, bank * 65536 + 0x1ceb, 0x7e2de2].includes(a.address),
        ),
      );
    }
});
test('Native56 independently writes original7FFF and retains full argument WORD with no destination reads', () => {
  for (const bank of [0x80, 0x7f])
    for (const value of [0, 1, 0x8000, 65535]) {
      const f = taskLeafFixture(0x80cc97, { bank });
      put(f, 0, value);
      const p = commit(one, f);
      assert.equal(word(f, 0x7e2de2), value);
      assert.equal(word(f, bank * 65536 + 0x1ce9), 0x7fff);
      assert.equal(p.outputContext.a, 0x7fff);
      assert.equal(p.outputContext.status & 0x82, 0);
      assert.equal(p.outputContext.status & 0x41, f.context.status & 0x41);
    }
});
