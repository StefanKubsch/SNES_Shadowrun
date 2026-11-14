import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTaskNativeBlock, taskModulePath, taskNativeNames } from './task-native-catalog.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';

const progress = JSON.parse(await readFile('docs/PORTIERUNGSSTAND.json'));
for (const name of taskNativeNames) {
  if (!progress.work_groups.find((g) => g.manual_native?.module === taskModulePath(name))) continue;
  const b = await loadTaskNativeBlock(name);
  for (const entry of b.entries) {
    test(`${name} ${entry.toString(16)}: context, sources, budgets and protected bytes are atomic`, () => {
      const f = b.fixture(entry),
        p = prepared(b.prepare, f);
      unchangedFailure(b.prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
      if (p.outputBytes) {
        unchangedFailure(
          b.prepare,
          f,
          { maxOutputBytes: p.outputBytes - 1 },
          'task_output_budget_required',
        );
        unchangedFailure(
          b.prepare,
          b.fixture(entry, { writeWindows: [] }),
          {},
          'render_write_window_required',
        );
      }
      unchangedFailure(b.prepare, f, { context: { ...f.context } }, 'task_context_required');
      unchangedFailure(
        b.prepare,
        f,
        { context: Object.freeze({ ...f.context, pc: 0 }) },
        'task_context_required',
      );
      unchangedFailure(b.prepare, f, { protectedStackBytes: [] }, 'task_protected_stack_required');
      const stack = p.accesses.find(
        (v) => v.address < 0x2000 && v.address >= 0x3ef && v.address <= 0x3f4,
      );
      if (stack)
        unchangedFailure(
          b.prepare,
          f,
          { protectedStackBytes: [...f.protectedStackBytes, renderAddress(stack.address)] },
          'task_stack_alias_required',
        );
      const before = f.data.snapshot(),
        other = b.fixture(entry),
        forged = { ...p };
      assert.equal(commitTaskPlan(other.data, p).reason, 'task_plan_owner_required');
      assert.equal(commitTaskPlan(f.data, forged).reason, 'task_plan_owner_required');
      assert.deepEqual(f.data.snapshot(), before);
      f.data.seed(0x100, [1]);
      const stale = f.data.snapshot();
      assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
      assert.deepEqual(f.data.snapshot(), stale);
      const p2 = prepared(b.prepare, f);
      assert.equal(commitTaskPlan(f.data, p2).handled, true);
      const after = f.data.snapshot();
      assert.equal(commitTaskPlan(f.data, p2).reason, 'task_plan_stale');
      assert.deepEqual(f.data.snapshot(), after);
    });
    test(`${name} ${entry.toString(16)}: exact cumulative limits and required final sourceHigh`, () => {
      const f = b.fixture(entry),
        p = prepared(b.prepare, f);
      prepared(b.prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
      const late = p.accesses.findLast((v) => v.kind === 'read');
      assert.ok(
        [
          'fresh-next-opcode-high',
          'fresh-outer-S-high',
          'leaf-outer-RTS-high',
          'fresh-native-pointer-high',
          'counter-outer-RTL-bank',
          'list-outer-RTS-high',
          'input-apu-return-WORD-high',
          'input-apu-return-bank',
          'audio-return-WORD-high',
          'audio-return-bank',
          'menu-return-WORD-high',
          'actions-return-WORD-high',
        ].includes(late.label),
      );
      const missing = b.fixture(entry),
        bytes = missing.data.snapshot().bytes;
      // Rebuild the same explicit fixture without its final source byte.
      const data = createRenderData({ writeWindows: missing.data.snapshot().writeWindows });
      for (const [address, value] of bytes)
        if (address !== renderAddress(late.address)) data.seed(address, [value]);
      unchangedFailure(b.prepare, { ...missing, data }, {}, 'render_source_required');
      assert.equal(p.dynamicDispatchExecuted, false);
      assert.equal(p.fullTaskBinding, false);
    });
  }
}
