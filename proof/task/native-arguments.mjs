import { prepareTaskPlan } from './plan.mjs';
export function runTaskNativeArguments(a) {
  const operandWord = a.streamWord('native-ID-WORD');
  a.ctx.y = (a.ctx.y + 1) & 65535;
  const id = operandWord & 255;
  a.writeWord((a.ctx.d + 3) & 65535, a.ctx.y, 16, 'saved-PC');
  a.writeWord((a.ctx.d + 9) & 65535, id, 16, 'saved-ID');
  a.ctx.x = id;
  const metadataWord = a.readWord(0x82da4c + id, 24, 'native-argument-metadata-WORD'),
    count = metadataWord & 255;
  let wordPops = 0;
  if (count) {
    a.ctx.y = count;
    a.ctx.x = 0;
    do {
      a.ctx.a = a.pullWord('native-argument-PLA');
      a.writeWord(a.ctx.bank * 65536 + a.ctx.x, a.ctx.a, 24, 'native-argument-workspace');
      a.ctx.x = (a.ctx.x + 2) & 65535;
      a.ctx.y = (a.ctx.y - 1) & 65535;
      wordPops++;
    } while (a.ctx.y !== 0);
  }
  const freshId = a.readWord((a.ctx.d + 9) & 65535, 16, 'fresh-native-ID');
  a.ctx.status = (a.ctx.status & ~1) | Number(freshId >= 32768);
  a.ctx.x = (freshId * 2) & 65535;
  a.ctx.a = a.ctx.s;
  a.writeWord((a.ctx.d + 7) & 65535, a.ctx.a, 16, 'saved-operand-S');
  a.ctx.a = a.readWord(a.ctx.bank * 65536 + 0x1f2, 24, 'fresh-outer-S');
  a.ctx.status = (a.ctx.status & ~0x82) | (a.ctx.a & 0x8000 ? 0x80 : 0) | (a.ctx.a === 0 ? 2 : 0);
  a.ctx.pc = 0xf4f6;
  return {
    operandWord,
    id,
    metadataWord,
    wordPops,
    freshId,
    frontier: '80:F4F6',
    scope: 'manual-native-argument-prefix-before-TCS',
    stackMigrationExecuted: false,
    dynamicDispatchExecuted: false,
  };
}
export const prepareTaskNativeArguments = (options) =>
  prepareTaskPlan(options, [0x80f4cb], runTaskNativeArguments);
