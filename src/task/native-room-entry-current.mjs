import { leaf } from './native-leaf-support.mjs';
import { ROOM, WRAM } from './wram.mjs';
import { ROOM_TABLE } from '../data/rooms.mjs';

// 80:CCB9: return the header word of the current room from the room table.
// Entries are nine bytes: 8 * room (three ASLs) + room, by ADC without CLC, so the
// carry of the third shift is added as well. The room is read twice, fresh.
export const getCurrentRoomHeader = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.load(h.longRead(WRAM + ROOM));
      h.asl();
      h.asl();
      h.asl();
      h.arithmetic(h.longRead(WRAM + ROOM));
      const entry = h.index('x', h.ctx.a);
      h.result(h.load(h.longRead(ROOM_TABLE + entry)), 'leaf-table-result');
    },
    outerReturn,
  );
