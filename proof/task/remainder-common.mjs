import { taskStop } from '../../src/task/plan.mjs';

// Original F6B2 modifies the saved Y WORD, not a mathematical modulo.
// Access budgets bound a plan attempt; they do not alter the ROM's loop.
export function remainderBody(a) {
  const signCount = a.ctx.x,
    absolute = a.ctx.bank * 65536 + 0x1ea;
  const compare = () => {
    const value = a.stackWord(1, 'fresh-remainder-CMP');
    a.ctx.status = (a.ctx.status & ~1) | Number(a.ctx.a >= value);
    return value;
  };
  const initialLeft = compare();
  if (a.ctx.a >= initialLeft)
    return { ...a.fetch(), signCount, bypass: true, zeroExit: false, negated: false };
  a.pushWord(a.ctx.y, 'saved-Y-PHY');
  a.ctx.y = 0;
  let saved;
  do {
    a.ctx.y = (a.ctx.y + 1) & 65535;
    a.ctx.a = (a.ctx.a * 2) & 65535;
    saved = compare();
  } while (a.ctx.a < saved);
  const zeroExit = () => {
    a.writeWord((a.ctx.s + 1) & 65535, 0, 16, 'saved-Y-zero');
    a.ctx.y = a.pullWord('changed-Y-PLY');
    return { ...a.fetch(), signCount, bypass: false, zeroExit: true, negated: false };
  };
  if (a.ctx.a === saved) return zeroExit();
  a.ctx.status = (a.ctx.status & ~1) | (a.ctx.a & 1);
  a.ctx.a >>>= 1;
  a.writeWord(absolute, a.ctx.a, 24, 'remainder-scratch');
  while (true) {
    const left = a.pullWord('saved-Y-PLA');
    if (a.ctx.status & 8) taskStop('task_binary_arithmetic_required');
    const right = a.readWord(absolute, 24, 'fresh-remainder-scratch-SBC'),
      difference = left - right,
      result = difference & 65535;
    a.ctx.status =
      (a.ctx.status & ~0x41) |
      Number(difference >= 0) |
      ((left ^ right) & (left ^ result) & 0x8000 ? 0x40 : 0);
    a.ctx.a = result;
    a.pushWord(result, 'changed-Y-PHA');
    a.ctx.a = a.readWord(absolute, 24, 'fresh-remainder-scratch-LDA');
    while (true) {
      a.ctx.y = (a.ctx.y - 1) & 65535;
      if (a.ctx.y === 0) {
        a.ctx.y = a.pullWord('changed-Y-PLY');
        a.ctx.x = (a.ctx.x - 1) & 65535;
        if (a.ctx.x === 0) {
          a.ctx.a = -a.pullWord('fresh-left-negation-PLA') & 65535;
          a.pushWord(a.ctx.a, 'left-negation-PHA');
        }
        return {
          ...a.fetch(),
          signCount,
          bypass: false,
          zeroExit: false,
          negated: signCount === 1,
        };
      }
      a.ctx.status = (a.ctx.status & ~1) | (a.ctx.a & 1);
      a.ctx.a >>>= 1;
      saved = compare();
      if (a.ctx.a === saved) return zeroExit();
      if (a.ctx.a < saved) {
        a.writeWord(absolute, a.ctx.a, 24, 'remainder-scratch');
        break;
      }
    }
  }
}
