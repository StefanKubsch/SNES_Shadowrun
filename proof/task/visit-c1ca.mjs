import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import { renderAddress } from '../../src/render/data.mjs';

// Fixed original visit/readiness/release equations; explicit provider bytes.
// Stops before F390 dispatch. No scheduling, elapsed time or inferred return.
export function runTaskVisit(a, { preservePostrunD = false, nativeWaitContinuation = false } = {}) {
  const c = a.ctx;
  if (c.d !== 0 && !(preservePostrunD && a.entry === 0x80c20b)) taskStop('task_visit_D0_required');
  if (c.status & 8) taskStop('task_binary_arithmetic_required');
  const nz = (v, w = 2) => {
    v &= w === 1 ? 255 : 65535;
    c.status = (c.status & ~0x82) | (v & (w === 1 ? 128 : 32768) ? 128 : 0) | (v === 0 ? 2 : 0);
    return v;
  };
  const load = (v) => (c.a = nz(v)),
    ix = (r, v) => (c[r] = nz(v));
  const rw = (n) => a.readWord((c.bank * 65536 + n) & 0xffffff, 24, 'visit-fresh-DBR-WORD');
  const ww = (n, v) => a.writeWord((c.bank * 65536 + n) & 0xffffff, v, 24, 'visit-DBR-WORD');
  const dw = (n, v) => a.writeWord(n, v, 16, 'visit-DP-WORD');
  const dp = (n) => a.readWord(n, 16, 'visit-fresh-DP-WORD');
  const rts = (expected = null, outer = false) => {
    const raw = a.readWord(
      (c.s + 1) & 65535,
      16,
      outer ? 'visit-outer-RTS' : 'visit-inner-RTS',
      outer,
    );
    c.s = (c.s + 2) & 65535;
    c.pc = (raw + 1) & 65535;
    if (expected !== null && c.pc !== expected)
      taskStop('task_visit_return_target_required', { returnTarget: 0x800000 | c.pc });
    return {
      returnTarget: 0x800000 | c.pc,
      outerReturnWord: raw,
      returnTargetExecuted: false,
      frontier: 'actual-visit-return-target',
    };
  };
  const ready = () => {
    load(rw(0xba2 + c.x));
    if (c.a === 0) {
      c.status |= 1;
      return;
    }
    if (c.a & 0x8000) {
      c.status &= ~1;
      return;
    }
    c.status = (c.status & ~2) | (c.a & 0x1000 ? 0 : 2);
    if (c.a & 0x1000) {
      c.status &= ~1;
      return;
    }
    dw(0, 0);
    dw(0x71, c.a);
    load(c.a & 0x6ffe);
    load(c.a & rw(0xc62 + c.x));
    if (c.a !== 0) dw(0, c.a);
    load(dp(0x71));
    c.status = (c.status & ~2) | (c.a & 1 ? 0 : 2);
    if (c.a & 1) {
      const count = nz(rw(0xc02 + c.x) - 1);
      ww(0xc02 + c.x, count);
      if (count === 0) {
        load(1);
        const scratch = dp(0);
        c.status = (c.status & ~2) | (scratch & c.a ? 0 : 2);
        dw(0, scratch | c.a);
        load(dp(0x71));
      }
    }
    load(dp(0));
    if (c.a === 0) c.status &= ~1;
    else {
      ww(0xba2 + c.x, 0);
      c.status |= 1;
    }
  };
  const remove = () => {
    c.status |= 1;
    const left = load(rw(0x252 + c.x)),
      sum = left - 0x3d6,
      result = sum & 65535;
    c.status =
      (c.status & ~0x41) | Number(sum >= 0) | ((left ^ 0x3d6) & (left ^ result) & 0x8000 ? 64 : 0);
    load(result);
    a.pushWord(0xc39f, 'visit-JSR-release');
    ix('y', c.a);
    load(rw(0x3d2 + c.y));
    load(c.a & 0x7fff);
    ww(0x3d2 + c.y, c.a);
    rts(0xc3a0);
    ix('y', rw(0x312 + c.x));
    load(rw(0x24e));
    ww(0x312 + c.x, c.a);
    ww(0x24e, c.x);
    const cursor = rw(0x250);
    c.status = (c.status & ~1) | Number(c.x >= cursor);
    nz(c.x - cursor);
    if (c.x === cursor) ww(0x250, c.y);
    load(rw(0x372 + c.x));
    ix('x', c.y);
    if (!(c.x & 0x8000)) ww(0x372 + c.y, c.a);
    ix('y', c.a);
    if (!(c.y & 0x8000)) {
      load(c.x);
      ww(0x312 + c.y, c.a);
    } else ww(0x24c, c.x);
  };
  const enter = () => {
    a.pushWord(0xc20a, 'visit-JSR-F378');
    load(rw(0x252 + c.x));
    c.d = nz(c.a);
    a.pushWord(a.readWord((c.d + 1) & 65535, 16, 'visit-F378-PEI'), 'visit-F378-PEI');
    for (let n = 0; n < 2; n++) {
      c.bank = nz(a.read((c.s + 1) & 65535, 'visit-F378-PLB'), 1);
      c.s = (c.s + 1) & 65535;
    }
    load(c.s);
    ww(0x1f2, c.a);
    load(a.readWord((c.d + 7) & 65535, 16, 'visit-F378-operand-S'));
    c.s = c.a;
    ix('y', a.readWord((c.d + 3) & 65535, 16, 'visit-F378-PC'));
    return { ...a.fetch(), interpreterEntryExecuted: true };
  };
  const continuation = () => {
    load(rw(0x2b2 + c.x));
    if (c.a === 0) {
      if (nativeWaitContinuation) taskStop('task_native_wait_continuation_required');
      return enter();
    }
    a.pushWord(0xc20a, 'visit-PEA-continuation-return');
    a.pushWord(c.a, 'visit-PHA-continuation');
    rts();
    if (c.pc !== (nativeWaitContinuation ? 0xf509 : 0xf495))
      taskStop('task_visit_continuation_source_required', { returnTarget: 0x800000 | c.pc });
    // PEA bytes are live inner return bytes, not protected external bytes.
    // They were written on this overlay and must still name the exact join.
    if (a.readWord((c.s + 1) & 65535, 16, 'visit-fresh-resume-inner-return') !== 0xc20a)
      taskStop('task_visit_return_target_required');
    return {
      ...runTaskNativeResume(a, [], nativeWaitContinuation ? 0x82d970 : 0x82e623, false),
      continuationTarget: nativeWaitContinuation ? 0x80f509 : 0x80f495,
      continuationOccurrenceProven: true,
    };
  };
  const post = () => {
    while (true) {
      ix('x', rw(0x250));
      load(rw(0xba2 + c.x));
      if (c.a & 0x8000) {
        load(rw(0x372 + c.x));
        ww(0x250, c.a);
        ix('x', c.a);
        return enter();
      }
      load(rw(0x312 + c.x));
      ww(0x250, c.a);
      load(rw(0xba2 + c.x));
      if (c.a !== 0) return null;
      a.pushWord(0xc220, 'visit-JSR-remove');
      remove();
      rts(0xc221);
      ix('x', rw(0x250));
      load(rw(0xba2 + c.x));
      if (!(c.a & 0x8000)) return null;
      ww(0xba2 + c.x, 0);
      return continuation();
    }
  };
  const run = () => {
    a.pushWord(0xc1fb, 'visit-JSR-ready');
    ready();
    rts(0xc1fc);
    if (c.status & 1) return continuation();
    ix('x', rw(0x250));
    load(rw(0x312 + c.x));
    ww(0x250, c.a);
    return null;
  };
  let result;
  if (a.entry === 0x80c3c9) {
    ready();
    result = rts(null, true);
  } else if (a.entry === 0x80c396) {
    remove();
    result = rts(null, true);
  } else if (a.entry === 0x80c20b) {
    result = post() ?? rts(null, true);
  } else if (a.entry === 0x80c1f9) {
    result = run() ?? rts(null, true);
  } else {
    load(rw(0x250));
    a.pushWord(c.a, 'visit-cursor-PHA');
    ix('x', rw(0x24c));
    ww(0x250, c.x);
    if (!(c.x & 0x8000)) {
      a.pushWord(0xc1d8, 'visit-JSR-body');
      result = run();
      if (result)
        return { ...result, scope: 'manual-bounded-C1CA-before-F390', visitReturned: false };
      rts(0xc1d9);
      a.pushWord(0x8080, 'visit-PEA-DBR80');
      for (let n = 0; n < 2; n++) {
        c.bank = nz(a.read((c.s + 1) & 65535, 'visit-PLB'), 1);
        c.s = (c.s + 1) & 65535;
      }
    }
    load(a.pullWord('visit-cursor-PLA'));
    ww(0x250, c.a);
    result = rts(null, true);
  }
  return {
    ...result,
    scope: 'manual-bounded-visit-readiness-release',
    visitReturned: result.frontier !== '80:F390',
  };
}
export const prepareTaskVisit = (options) =>
  prepareTaskPlan(options, [0x80c1ca, 0x80c1f9, 0x80c20b, 0x80c3c9, 0x80c396], (a) => {
    if (
      ![1, 2].every((n) =>
        options.protectedStackBytes.includes(renderAddress((a.ctx.s + n) & 65535)),
      )
    )
      taskStop('task_outer_return_required');
    return runTaskVisit(a);
  });
