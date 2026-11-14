import { WRAM_BANK, CODE_BANK } from '../constants/memory-map.mjs';
import { WINDOW_MAP_SOURCE, WINDOW_MAP_SOURCE_BANK, WINDOW_MAP_BUFFER } from './wram.mjs';
import { taskStop } from './plan.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';
import { unpackStep } from './native-unpack-body.mjs';
import { unpackStreamLong } from './native-unpack.mjs';
import { drawJakeStateBar } from './native-bar-tiles.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
import { WORD_MASK, WORD_BITS } from '../constants/bits.mjs';

const REPEATED_BANK_BYTE_FACTOR = 0x101;
const WINDOW_MAP_LAST_WORD_OFFSET = 0x73e;
const WINDOW_MAP_TILE_BIAS = 0x2017;

// 81:A9B2: unpack the window map (source WINDOW_MAP_SOURCE, real JSL to 80:9F49) into
// WINDOW_MAP_BUFFER, add the tile bias 2017 to each of its words from the last down
// (one CLC before the loop; each ADC passes its carry to the next), then draw the
// bars with 81:AF1F. DBR is saved, switched to 7E and 80, and restored.
export function unpackWindowMap(a, outerReturn = true, events = null) {
  const h = taskTextAccess(a),
    { ctx } = h,
    interruptAccess = { a, ctx };
  const index = (name, value) => {
    ctx[name] = h.nz(value, 2);
  };
  const call = (at, next, target, run) => {
    const bank = ctx.programBank;
    h.pushByte(bank, 'A9B2-JSL-bank');
    a.pushWord((next - 1) & WORD_MASK, 'A9B2-JSL-WORD');
    ctx.programBank = target >>> WORD_BITS;
    ctx.pc = target & WORD_MASK;
    const result = run();
    if (
      result.rawReturnWord !== ((next - 1) & WORD_MASK) ||
      ctx.programBank !== bank ||
      ctx.pc !== (next & WORD_MASK)
    )
      taskStop('task_native_helper_return_required', {
        at,
        raw: result.rawReturnWord,
        bank: ctx.programBank,
      });
    return result;
  };
  const select = (bank) => {
    a.pushWord(bank * REPEATED_BANK_BYTE_FACTOR, 'A9B2-PEA');
    ctx.bank = h.pullByte('A9B2-PLB-first');
    h.nz(ctx.bank, 1);
    ctx.bank = h.pullByte('A9B2-PLB-second');
    h.nz(ctx.bank, 1);
  };
  h.pushByte(ctx.bank, 'A9B2-PHB');
  h.load(h.read(h.abs(WINDOW_MAP_SOURCE)));
  index('y', h.read(h.abs(WINDOW_MAP_SOURCE_BANK)));
  index('x', WINDOW_MAP_BUFFER);
  const unpack = call(0x81a9bc, 0x81a9c0, 0x809f49, () =>
    unpackStreamLong(a, false, 0x809f49, events),
  );
  select(WRAM_BANK);
  index('x', WINDOW_MAP_LAST_WORD_OFFSET);
  ctx.status &= ~FLAG_CARRY;
  let conversionWords = 0;
  do {
    h.load(h.read(h.abs(WINDOW_MAP_BUFFER) + ctx.x));
    unpackStep(interruptAccess, events, 0x81a9cc);
    h.arithmetic(WINDOW_MAP_TILE_BIAS);
    h.write(h.abs(WINDOW_MAP_BUFFER) + ctx.x, ctx.a);
    conversionWords++;
    index('x', (ctx.x - 1) & WORD_MASK);
    index('x', (ctx.x - 1) & WORD_MASK);
  } while (!(ctx.status & FLAG_NEGATIVE));
  select(CODE_BANK);
  const af1f = call(0x81a9db, 0x81a9df, 0x81af1f, () => drawJakeStateBar(a, false));
  ctx.bank = h.pullByte('A9B2-PLB-restored-fresh');
  h.nz(ctx.bank, 1);
  return { ...h.finish(outerReturn), outcome: af1f.outcome, conversionWords, unpack, af1f };
}
