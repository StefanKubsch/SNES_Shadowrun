import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import {
  OBJECT_DEPTH_ORDER,
  OBJECT_FLAGS,
  OBJECT_HIDDEN,
  OBJECT_COVERED,
  OBJECT_DEPTH_MODE_MASK,
  OBJECT_DEPTH_MODE_CLEAR_MASK,
} from './wram.mjs';
import { FLAG_ZERO } from '../constants/cpu-flags.mjs';

// Depth mode of a visible object that is not covered: bit 0 only.
const DEPTH_MODE_FRONT = 1;

// 80:D0D3: unless the object (first argument) is hidden, set its depth mode from its
// drawing flags: covered gives both mode bits (8001), else bit 0. The other depth bits
// stay. BIT # changes only Z.
export const updateObjectDepthMode = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('y', h.dp(FIRST_ARGUMENT));
      h.load(h.longRead(h.abs(OBJECT_FLAGS) + object));
      const bit = (mask) => {
        h.ctx.status = (h.ctx.status & ~FLAG_ZERO) | ((h.ctx.a & mask) === 0 ? FLAG_ZERO : 0);
        return (h.ctx.a & mask) !== 0;
      };
      if (bit(OBJECT_HIDDEN)) return;
      const covered = bit(OBJECT_COVERED),
        depth = h.abs(OBJECT_DEPTH_ORDER) + object;
      h.load(h.longRead(depth) & OBJECT_DEPTH_MODE_CLEAR_MASK);
      h.longWrite(depth, h.load(h.ctx.a | (covered ? OBJECT_DEPTH_MODE_MASK : DEPTH_MODE_FRONT)));
    },
    outerReturn,
  );
