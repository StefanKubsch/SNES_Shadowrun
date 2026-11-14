import { leaf } from './native-leaf-support.mjs';
import {
  DECKER_COMPUTER_SKILL,
  DECKER_HEALTH,
  DECKER_MEMORY,
  DECKER_RECORD,
  GROUP_NUMBERS,
  GROUP_SLOTS,
  MATRIX_EXTRA_NODES,
  MATRIX_MESSAGES,
  MATRIX_SYSTEM,
  OBJECT_RECORD,
  RECORD_COUNT,
  ROOM,
  SCENE_REQUEST,
  SCENE_REQUEST_MATRIX,
  WRAM,
} from './wram.mjs';
import {
  RECORD_COMPUTER,
  RUNNER_LAST_INDEX,
  RUNNER_OBJECT_NUMBERS,
  RUNNER_RECORD_BANKS,
  RUNNER_RECORD_POINTERS,
} from '../data/runners.mjs';
import { FLAG_CARRY, FLAG_ZERO, FLAG_NEGATIVE, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';
import { BYTE_MASK, WORD_MASK, BANK_WRAP, WORD_BITS, LONG_MASK } from '../constants/bits.mjs';
// 80:E30F: enter the Matrix: slot and position bytes, then two table searches (ROM 9700+X, 7E2DF0+X)
// with the second starting at the first match. Misses end at X=FFFE via DEX/BPL.
// Arguments: DP00 matrix system, DP02 room to return to, DP04 extra nodes, DP06 the
// message list, DP08 the object number of the decker. The deck holds 40 memory.
const DP_SYSTEM = 0,
  DP_ROOM = 2,
  DP_EXTRA_NODES = 4,
  DP_MESSAGES = 6,
  DP_DECKER = 8,
  DP_RECORD = 0xa2,
  DP_RECORD_BANK = 0xa4,
  DECK_MEMORY = 0x40;
export const enterMatrix = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const byte = (offset, value) =>
        a.write(h.abs(offset), value & BYTE_MASK, 'leaf-actualDBR-BYTE');
      const compare = (right) => {
        const left = h.ctx.a;
        h.nz((left - right) & WORD_MASK);
        h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(left >= right);
      };
      const search = (table) => {
        while (true) {
          compare(table());
          if (h.ctx.status & FLAG_ZERO) return true;
          h.index('x', (h.ctx.x - 1) & WORD_MASK);
          h.index('x', (h.ctx.x - 1) & WORD_MASK);
          if (h.ctx.status & FLAG_NEGATIVE) return false;
        }
      };
      h.load(SCENE_REQUEST_MATRIX);
      h.longWrite(h.abs(SCENE_REQUEST), h.ctx.a);
      h.load(h.dp(DP_ROOM));
      h.longWrite(WRAM + ROOM, h.ctx.a);
      h.ctx.status |= FLAG_MEMORY_8BIT;
      h.load(DECK_MEMORY, 1);
      byte(DECKER_MEMORY, h.ctx.a);
      for (const [dp, offset] of [
        [DP_MESSAGES, MATRIX_MESSAGES],
        [DP_SYSTEM, MATRIX_SYSTEM],
        [DP_EXTRA_NODES, MATRIX_EXTRA_NODES],
      ]) {
        h.load(h.dp(dp, 1), 1);
        byte(offset, h.ctx.a);
      }
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
      h.load(h.dp(DP_DECKER));
      h.index('x', RUNNER_LAST_INDEX);
      if (!search(() => h.longRead(h.abs(RUNNER_OBJECT_NUMBERS) + h.ctx.x))) return;
      h.load(h.longRead(h.abs(RUNNER_RECORD_POINTERS) + h.ctx.x));
      a.writeWord(DP_RECORD, h.ctx.a, BANK_WRAP, 'leaf-DP-pointer-WORD');
      h.ctx.status |= FLAG_MEMORY_8BIT;
      h.load(a.read(h.abs(RUNNER_RECORD_BANKS) + h.ctx.x, 'leaf-actualDBR-BYTE'), 1);
      a.write(DP_RECORD_BANK, h.ctx.a & BYTE_MASK, 'leaf-DP-pointer-bank');
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
      h.index('y', RECORD_COMPUTER);
      h.ctx.status |= FLAG_MEMORY_8BIT;
      const pointer = h.dp(DP_RECORD) | (h.dp(DP_RECORD_BANK, 1) << WORD_BITS);
      h.load(a.read((pointer + h.ctx.y) & LONG_MASK, 'leaf-indirect-long-BYTE'), 1);
      byte(DECKER_COMPUTER_SKILL, h.ctx.a);
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
      h.load(h.dp(DP_DECKER));
      if (!search(() => h.longRead(WRAM + GROUP_NUMBERS + h.ctx.x))) return;
      h.index('y', h.longRead(h.abs(GROUP_SLOTS) + h.ctx.x));
      h.index('x', h.longRead(h.abs(OBJECT_RECORD) + h.ctx.y));
      if (h.ctx.x === 0) return;
      h.ctx.status |= FLAG_MEMORY_8BIT;
      h.load(a.read(WRAM + RECORD_COUNT + h.ctx.x, 'leaf-record-BYTE'), 1);
      byte(DECKER_HEALTH, h.ctx.a);
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
      h.longWrite(h.abs(DECKER_RECORD), h.ctx.x);
    },
    outerReturn,
  );
