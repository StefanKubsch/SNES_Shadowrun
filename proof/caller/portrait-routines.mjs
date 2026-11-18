// The portrait unpack 80:9F6D and the portrait DMA job 80:8FF5 as register forms for
// register-level callers (moved from src/game/portrait-upload.mjs, whose lifted forms
// take their inputs as parameters and leave no registers).
import { unpackPortraitStream, uploadPortraitTiles } from '../../src/game/portrait-upload.mjs';
import { recordedRoutine } from '../../src/system/recorded-routines.mjs';
import { PORTRAIT_DMA_REQUEST } from '../../src/data/wram.mjs';
import { BYTE_BITS } from '../../src/constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';

// The stream in A and Y, the offset in X; A, X and Y as the original's copy leaves them.
export function unpackPortraitRoutine(h, events) {
  const recorded = recordedRoutine(events, 'portrait-unpack');
  if (recorded) return recorded(h, events);
  const { ctx } = h;
  const unpacked = unpackPortraitStream(h, ctx.a, ctx.y, ctx.x);
  Object.assign(ctx, { a: unpacked.length, x: unpacked.sourceEnd, y: unpacked.outputEnd });
  return h.rts();
}
// The VRAM address in X; A the finished request word, its sign set.
export function* uploadPortraitTilesSequence(h, events) {
  const { ctx } = h,
    result = yield* uploadPortraitTiles(h, events, ctx.x),
    { wram } = h.a.mem;
  ctx.a = wram[PORTRAIT_DMA_REQUEST] | (wram[PORTRAIT_DMA_REQUEST + 1] << BYTE_BITS);
  ctx.status = (ctx.status | FLAG_NEGATIVE) & ~FLAG_ZERO;
  return result;
}
