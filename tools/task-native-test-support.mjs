import assert from 'node:assert/strict';
import { commitTaskPlan } from '../proof/task/plan.mjs';
export function unchangedFailure(prepare, fixture, patch, reason) {
  const before = fixture.data.snapshot(),
    p = prepare({ ...fixture, ...patch });
  assert.equal(p.handled, false);
  assert.equal(p.reason, reason);
  assert.equal(p.byteWrites, undefined);
  assert.equal(p.accesses, undefined);
  assert.deepEqual(fixture.data.snapshot(), before);
  return p;
}
export function prepared(prepare, fixture) {
  const before = fixture.data.snapshot(),
    p = prepare(fixture);
  assert.equal(p.handled, true);
  assert.deepEqual(fixture.data.snapshot(), before);
  assert.ok(Object.isFrozen(p.outputContext));
  return p;
}
export function commit(prepare, fixture) {
  const p = prepared(prepare, fixture),
    r = commitTaskPlan(fixture.data, p);
  assert.equal(r.handled, true);
  assert.equal(r.outputContext, p.outputContext);
  return p;
}
export const writes = (plan) =>
  plan.accesses.filter((a) => a.kind === 'write').map((a) => [a.address, a.value]);
export const reads = (plan) => plan.accesses.filter((a) => a.kind === 'read').map((a) => a.address);
