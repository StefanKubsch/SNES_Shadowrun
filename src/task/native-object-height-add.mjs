import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_HEIGHT } from './wram.mjs';

// 80:A977: raise the height of the object (first argument) by four times the second
// argument (two ASLs, CLC, binary ADC; heights are stored in quarter units).
export const addObjectHeight = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.load(h.dp(SECOND_ARGUMENT));
      h.asl();
      h.asl();
      const height = h.abs(OBJECT_HEIGHT) + object;
      h.longWrite(height, h.add(h.ctx.a, h.longRead(height)));
    },
    outerReturn,
  );
