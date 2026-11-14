import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { renderAddress } from '../../src/render/data.mjs';
export function prepareTaskNativeResume(options) {
  return prepareTaskPlan(options, [0x80f509], (a) =>
    runTaskNativeResume(a, options.protectedStackBytes),
  );
}
export function runTaskNativeResume(
  a,
  protectedStackBytes,
  metadataBase = 0x82d970,
  externalReturn = true,
  expectedNativeId = null,
) {
  if (
    externalReturn &&
    ![1, 2].every((n) => protectedStackBytes.includes(renderAddress((a.ctx.s + n) & 65535)))
  )
    taskStop('task_outer_return_required');
  const nz = (v, w = 2) => {
    a.ctx.status =
      (a.ctx.status & ~0x82) | (v & (w === 1 ? 128 : 32768) ? 128 : 0) | (v === 0 ? 2 : 0);
    return v;
  };
  const dp = (n) => (a.ctx.d + n) & 65535,
    abs = (n) => (a.ctx.bank * 65536 + n) & 0xffffff;
  a.ctx.x = nz(a.readWord(abs(0x250), 24, 'resume-task-index'));
  a.ctx.a = nz(a.readWord(abs(0x252) + a.ctx.x, 24, 'resume-task-D'));
  a.ctx.d = nz(a.ctx.a);
  a.pushWord(a.readWord(dp(1), 16, 'resume-PEI-DP01'), 'resume-PEI');
  for (let n = 0; n < 2; n++) {
    a.ctx.bank = nz(a.read((a.ctx.s + 1) & 65535, 'resume-PLB'), 1);
    a.ctx.s = (a.ctx.s + 1) & 65535;
  }
  a.ctx.a = nz(a.ctx.s);
  a.writeWord(abs(0x1f2), a.ctx.a, 24, 'resume-saved-outer-S');
  a.ctx.a = nz(a.readWord(dp(7), 16, 'resume-fresh-operand-S'));
  a.ctx.s = a.ctx.a;
  a.ctx.x = nz(a.readWord(dp(9), 16, 'resume-fresh-native-ID'));
  if (expectedNativeId !== null && a.ctx.x !== expectedNativeId)
    taskStop('task_native_resume_id_required', { nativeId: a.ctx.x, expectedNativeId });
  const metadataWord = a.readWord(metadataBase + a.ctx.x, 24, 'resume-return-metadata-WORD');
  a.ctx.a = nz(metadataWord & 255);
  let resultPushed = false;
  if (a.ctx.a !== 0) {
    a.ctx.a = nz(a.readWord(abs(0), 24, 'resume-fresh-result'));
    a.pushWord(a.ctx.a, 'resume-result-PHA');
    resultPushed = true;
  }
  a.ctx.y = nz(a.readWord(dp(3), 16, 'resume-fresh-PC'));
  return { ...a.fetch(), metadataWord, resultPushed, stackMigrationExecuted: true };
}
