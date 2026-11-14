import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { renderAddress } from '../../src/render/data.mjs';
export function prepareTaskNativeBridge(options) {
  return prepareTaskPlan(options, [0x80f4f6], (a) =>
    runTaskNativeBridge(a, options.protectedStackBytes),
  );
}
export function runTaskNativeBridge(a, protectedStackBytes) {
  if (![1, 2].every((n) => protectedStackBytes.includes(renderAddress((a.ctx.a + n) & 65535))))
    taskStop('task_outer_return_required');
  const nz = (v, w = 2) => {
    a.ctx.status =
      (a.ctx.status & ~0x82) | (v & (w === 1 ? 128 : 32768) ? 128 : 0) | (v === 0 ? 2 : 0);
    return v;
  };
  a.ctx.s = a.ctx.a;
  a.ctx.a = nz(0);
  a.ctx.d = nz(0);
  a.pushWord(0x8080, 'native-bridge-PEA');
  for (let n = 0; n < 2; n++) {
    a.ctx.bank = nz(a.read((a.ctx.s + 1) & 65535, 'native-bridge-PLB'), 1);
    a.ctx.s = (a.ctx.s + 1) & 65535;
  }
  const pointerWord = a.readWord(0x82d7b8 + a.ctx.x, 24, 'fresh-native-pointer');
  a.ctx.a = nz(pointerWord);
  a.writeWord(0xa2, pointerWord, 16, 'native-pointer-DP-A2');
  a.pushWord(0xf508, 'native-bridge-JSR-F52F');
  a.ctx.pc = 0xf52f;
  return {
    pointerWord,
    frontier: '80:F52F',
    scope: 'manual-native-stack-pointer-prefix-before-indirect-jump',
    stackMigrationExecuted: true,
    dynamicDispatchExecuted: false,
  };
}
