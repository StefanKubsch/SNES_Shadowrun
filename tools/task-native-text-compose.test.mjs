import test from 'node:test';
import assert from 'node:assert/strict';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { prepareTaskTextFE69, prepareTaskTextFB39 } from '../proof/task/native-text-compose.mjs';
import { prepareRenderFE69, prepareRenderFB39 } from '../proof/render/text-compose.mjs';
import { taskTextComposeFixture } from './task-native-text-compose-fixtures.mjs';
const prepare = (helper, f, patch = {}) => {
  const before = f.data.snapshot(),
    p = (helper === 'FE69' ? prepareTaskTextFE69 : prepareTaskTextFB39)({ ...f, ...patch });
  assert.deepEqual(f.data.snapshot(), before);
  return p;
};
const word = (p, address) => {
  const m = new Map(p.byteWrites);
  return m.get(address) | (m.get(address + 1) << 8);
};
const freeze = (values) => Object.freeze(values.map((o) => Object.freeze(o)));
const legacy = (helper, f, extra = {}) =>
  (helper === 'FE69' ? prepareRenderFE69 : prepareRenderFB39)({
    data: f.data,
    bank: f.context.bank,
    status: f.context.status,
    emulation: 0,
    directPage: 0,
    stackWindow: [0x1f00, 0x1fff],
    maxWork: 10000000,
    maxOutputBytes: 1000000,
    ioMode: 'record-requests',
    ioRead4214: [0, 1],
    ioRead4216: [0, 0],
    waitMode: 'record-observations',
    waitRead01FA: [0],
    waitRead01FC: [0],
    ...extra,
  });
function compareOld(helper, f, extra = {}) {
  const p = prepare(helper, f),
    old = legacy(helper, f, extra);
  assert.equal(p.handled, true, JSON.stringify(p));
  assert.equal(old.handled, true);
  assert.deepEqual(
    [
      p.outputContext.a,
      p.outputContext.x,
      p.outputContext.y,
      p.outputContext.bank,
      p.outputContext.status,
      p.glyphs,
      p.rows,
      p.newlines,
    ],
    [old.a, old.x, old.y, old.bank, old.status, old.glyphs, old.rows, old.newlines],
  );
  const writes = new Map(p.byteWrites);
  for (const [address, value] of old.byteWrites)
    assert.equal(writes.get(address), value, `${helper} @${address.toString(16)}`);
  assert.deepEqual(
    p.ioRequests.map(({ kind, address, value, width }) => [kind, address, value, width]),
    old.ioRequests.map(({ kind, address, value, bytes }) => [kind, address, value, bytes]),
  );
  return p;
}
test('Whole Task FE69/FB39: complete dictionary/glyph paths, actual mixed stack returns and one branded commit', () => {
  for (const helper of ['FE69', 'FB39']) {
    const f = taskTextComposeFixture(helper),
      p = compareOld(helper, f);
    assert.equal(p.returnTarget, 0x80f509);
    assert.equal(p.outputContext.s, 0x701);
    assert.equal(p.glyphs, 1);
    assert.equal(p.rows, 8);
    assert.equal(p.waitObservationsUsed, 10);
    assert.equal(word(p, 0x7e20c2), 0x21);
    assert.equal(word(p, 0x7e20e2), 4);
    assert.equal(p.accesses.filter((e) => e.label === 'FB39-glyph-PHX-high').length, 8);
    assert.equal(p.accesses.filter((e) => e.label === 'FB39-glyph-PHA-high').length, 8);
    assert.equal(p.accesses.filter((e) => e.label === 'FB39-glyph-PLA-fresh-low').length, 8);
    assert.equal(p.accesses.filter((e) => e.label === 'FB39-glyph-PLX-fresh-low').length, 8);
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  }
});
test('Whole Task FE69: first/second character and newline dictionary alternatives, original bank selector and empty text', () => {
  for (const [leaf, expected] of [
    [0xc100, [65]],
    [0xc142, [65, 66]],
    [0xc10a, [65]],
    [0x8a00, []],
  ]) {
    const f = taskTextComposeFixture('FE69', { waitFA: expected.length ? [0] : [] });
    f.data.seed(0x9d8000, [leaf & 255, leaf >>> 8]);
    const p = compareOld('FE69', f);
    assert.equal(p.characters, expected.length);
    assert.equal(p.bits, [0x8a00, 0xc10a].includes(leaf) ? 1 : 2);
    const writes = new Map(p.byteWrites);
    for (const [n, v] of [...expected, 0].entries()) assert.equal(writes.get(0x7e21a0 + n), v);
  }
  const f = taskTextComposeFixture('FE69', { sourceOffset: 0x8010 });
  compareOld('FE69', f);
});
test('Whole Task FB39: every style BYTE, fresh glyph rows, marker rewrite, word reset and hidden HighA agree independently', () => {
  for (let style = 0; style < 256; style++)
    compareOld('FB39', taskTextComposeFixture('FB39', { style, text: [97, 0, 0] }));
  for (const options of [
    { text: [0x7c, 65, 32, 66, 0, 0] },
    { style: 0xf8, text: [0x7c, 97, 32, 98, 0, 0] },
    { text: [32, 0, 0], style: 0x10 },
    { text: [127, 0, 0] },
    { index: 65535 },
  ]) {
    const f = taskTextComposeFixture('FB39', options);
    if (options.text?.[0] === 127) f.data.seed(0x81ac8c, [4]);
    compareOld('FB39', f);
  }
});
test('Whole Task FB39: full chronological newline MMIO, separate second quotient and repeated wait calls', () => {
  const io = [
    { pc: 0x81addd, address: 0x804216, width: 2, value: 0 },
    { pc: 0x81ae39, address: 0x804216, width: 2, value: 0 },
    { pc: 0x81ae73, address: 0x804214, width: 1, value: 0 },
    { pc: 0x81ae7d, address: 0x804214, width: 1, value: 1 },
    { pc: 0x81ae94, address: 0x804216, width: 2, value: 1 },
    { pc: 0x81addd, address: 0x804216, width: 2, value: 0 },
    { pc: 0x81ae39, address: 0x804216, width: 2, value: 0 },
  ];
  const f = taskTextComposeFixture('FB39', {
      width: 4,
      text: [65, 66, 32, 67, 68, 69, 0, 0],
      io,
      waitFA: [5, 0, 7, 8, 0],
    }),
    p = compareOld('FB39', f, { ioRead4216: [0, 0, 1, 0, 0], waitRead01FA: [5, 0, 7, 8, 0] });
  assert.equal(p.newlines, 1);
  assert.equal(p.glyphs, 6);
  assert.equal(p.rows, 48);
  assert.equal(p.waitObservationsUsed, 14);
  assert.equal(p.calls.filter((c) => c.target === 0x81aef4).length, 2);
  assert.equal(p.calls.filter((c) => c.target === 0x81ae4d).length, 1);
});
test('Whole Task FB39: full wrapping left/right register loops keep original owners and reject insufficient work', () => {
  const f = taskTextComposeFixture('FB39', { width: 100, glyphWidth: 255, style: 0x20 });
  f.data.seed(0x81ae9d, [0x34, 0x12]);
  const p = compareOld('FB39', f);
  assert.ok(p.work > 65535);
  assert.equal(prepare('FB39', f, { maxWork: 65535 }).reason, 'task_work_budget_required');
  const right = taskTextComposeFixture('FB39', { width: 65535, offset: 65535, text: [0, 0] });
  right.data.seed(0x82ac8b, [0, 0]);
  compareOld('FB39', right);
});
test('Whole Task text: every original source byte is fresh; missing discarded highbyte and late glyph bytes abort all effects', () => {
  for (const omit of [0x81ac0c + 66, 0x95f2d0 + 65 * 8 + 7, 0x9d8001]) {
    const helper = omit === 0x9d8001 ? 'FE69' : 'FB39',
      f = taskTextComposeFixture(helper, { omit }),
      p = prepare(helper, f);
    assert.equal(p.handled, false);
    assert.equal(p.reason, 'render_source_required');
    assert.equal(p.address, omit);
    assert.equal(p.byteWrites, undefined);
  }
});
test('Whole Task text: real stack owner aliases, mode/budgets/windows and immutable observations fail atomically', () => {
  for (const helper of ['FE69', 'FB39']) {
    const f = taskTextComposeFixture(helper),
      p = prepare(helper, f);
    assert.equal(p.handled, true);
    assert.equal(prepare(helper, f, { maxWork: p.work - 1 }).reason, 'task_work_budget_required');
    assert.equal(
      prepare(helper, f, { maxOutputBytes: p.outputBytes - 1 }).reason,
      'task_output_budget_required',
    );
    assert.equal(
      prepare(helper, f, { protectedStackBytes: [...f.protectedStackBytes, 0x7e06ff] }).reason,
      'task_stack_alias_required',
    );
    assert.equal(
      prepare(helper, f, { waitObservations: freeze([]) }).reason,
      'task_wait_observation_required',
    );
    assert.equal(
      prepare(helper, f, { waitObservations: [...f.waitObservations] }).reason,
      'task_wait_observations_required',
    );
    assert.equal(
      prepare(helper, f, {
        waitObservations: freeze([...f.waitObservations, f.waitObservations.at(-1)]),
      }).reason,
      'task_wait_observation_unused',
    );
    assert.equal(
      prepare(helper, f, { ioObservations: freeze(f.ioObservations.slice(0, 1)) }).reason,
      'task_io_observation_required',
    );
    assert.equal(
      prepare(helper, f, { ioObservations: freeze([...f.ioObservations, f.ioObservations.at(-1)]) })
        .reason,
      'task_io_observation_unused',
    );
    assert.equal(
      prepare(helper, f, { context: Object.freeze({ ...f.context, d: 1 }) }).reason,
      'task_direct_page_zero_required',
    );
    assert.equal(
      prepare(helper, f, { context: Object.freeze({ ...f.context, status: 0x4d }) }).reason,
      'task_binary_arithmetic_required',
    );
    const other = taskTextComposeFixture(helper);
    assert.equal(commitTaskPlan(other.data, p).reason, 'task_plan_owner_required');
    f.data.seed(0, [1]);
    assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  }
  const f = taskTextComposeFixture('FB39', { s: 0x1ff, waitFC: [0] }),
    p = prepare('FB39', f);
  assert.equal(p.reason, 'task_native_helper_return_required');
  assert.equal(
    prepare('FE69', taskTextComposeFixture('FE69', { s: 0x209 })).reason,
    'task_native_helper_return_required',
  );
  const legal = taskTextComposeFixture('FB39', { s: 0xcf });
  compareOld('FB39', legal);
});
test('Whole Task FB39: the $01FC wait stores the eight NMI mask words at $7E2AE0 before the original AND masks them', () => {
  // Offset 3: A2 = ~((FFFF>>3) & XBA) = E0E0; FB7E ANDs the words the NMI reads
  // from VRAM rather than the previous buffer contents.
  const words = [0xffff, 0x0000, 0x1234, 0xfedc, 0x8001, 0x7ffe, 0x00ff, 0xff00];
  const f = taskTextComposeFixture('FB39', { offset: 3, mask: words }),
    p = prepare('FB39', f);
  assert.equal(p.handled, true, JSON.stringify(p));
  for (const [n, value] of words.entries()) {
    const writes = p.accesses
      .filter((e) => e.kind === 'write' && e.address === 0x7e2ae0 + 2 * n)
      .map((e) => e.value);
    assert.deepEqual(writes.slice(0, 2), [value & 255, value & 0xe0], `row ${n}`);
  }
  const missing = taskTextComposeFixture('FB39', { offset: 3 });
  assert.equal(
    prepare('FB39', missing, {
      waitObservations: Object.freeze(missing.waitObservations.filter((o, n) => n !== 3)),
    }).reason,
    'task_wait_observation_required',
  );
});
