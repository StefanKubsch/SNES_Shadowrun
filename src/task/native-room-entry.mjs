import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { ROOM_TABLE } from '../data/rooms.mjs';

// 80:CCCC: return the header word of the room (first argument) from the room table.
// Entries are nine bytes: 8 * room (three ASLs) + room, by ADC without CLC, so the
// carry of the third shift is added as well.
export const getRoomHeader = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.load(h.dp(FIRST_ARGUMENT));
      h.asl();
      h.asl();
      h.asl();
      h.arithmetic(h.dp(FIRST_ARGUMENT));
      const entry = h.index('x', h.ctx.a);
      h.result(h.load(h.longRead(ROOM_TABLE + entry)), 'leaf-table-result');
    },
    outerReturn,
  );
