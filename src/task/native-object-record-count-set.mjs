import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_RECORD, RECORD_COUNT, WRAM } from './wram.mjs';
import { FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';
import { protectedJakeHealth } from '../game/cheats.mjs';

// 80:CAE0: set the count byte (ammunition or body) of the record of the object (first
// argument) to the low byte of the second argument; no record, no change. With cheats
// on, Jake's health is protected (src/game/cheats.mjs).
export const setObjectRecordCount = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('y', h.dp(FIRST_ARGUMENT)),
        record = h.index('x', h.longRead(h.abs(OBJECT_RECORD) + object));
      if (record === 0) return;
      h.ctx.status |= FLAG_MEMORY_8BIT;
      let count = h.load(h.dp(SECOND_ARGUMENT, 1), 1);
      if (a.vm?.cheats) count = h.load(protectedJakeHealth(a, record, count), 1);
      h.longWrite(WRAM + RECORD_COUNT + record, count, 1);
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
    },
    outerReturn,
  );
