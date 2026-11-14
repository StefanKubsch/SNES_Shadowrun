import { taskStop } from './plan.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';

import {
  CELL_COORDINATE_MASK,
  COLLISION_BOX_BOTTOM,
  COLLISION_BOX_OBJECT,
  COLLISION_BOX_TOP,
  COLLISION_BOX_X0,
  COLLISION_BOX_X1,
  COLLISION_BOX_Y0,
  COLLISION_BOX_Y1,
  COLLISION_CELL_HEADS,
  COLLISION_NODE_BOX,
  COLLISION_NODE_NEXT,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_KIND,
  OBJECT_X,
  OBJECT_Y,
  PLAYER_OBJECT,
  WRAM,
} from './wram.mjs';
import { ACTION_TABLE } from '../data/actions.mjs';
import { CODE_BANK, WRAM_BANK } from '../constants/memory-map.mjs';
import { FLAG_CARRY, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import {
  WORD_MASK,
  BANK_WRAP,
  LONG_WRAP,
  LONG_MASK,
  WORD_BITS,
  BYTE_MASK,
  HIGH_BYTE_MASK,
  BYTE_BITS,
  BYTE_SIGN,
  WORD_SIGN,
} from '../constants/bits.mjs';
// 8371 direct page: long pointers to the action record of the object kind (bank 8C) and to
// its box shape (bytes 3 to 6 signed edge offsets, byte 7 the height); the moved object, the
// largest overlap so far, the box edges and their cell columns and rows, and the up to four
// cells of the box corners.
const DP_ACTION_POINTER = 0,
  DP_ACTION_BANK = 2,
  DP_SHAPE_POINTER = 4,
  DP_SHAPE_BANK = 6,
  SHAPE_FIRST_EDGE = 3,
  DP_LOW_X = 0x11,
  DP_HIGH_X = 0x14,
  DP_LOW_Y = 0x17,
  DP_HIGH_Y = 0x1a,
  DP_BOTTOM = 0x1d,
  DP_TOP = 0x20,
  DP_LOW_X_COLUMN = 0x23,
  DP_HIGH_X_COLUMN = 0x26,
  DP_LOW_Y_ROW = 0x29,
  DP_HIGH_Y_ROW = 0x2c,
  DP_CELL_LOW_X_LOW_Y = 0x38,
  DP_CELL_LOW_X_HIGH_Y = 0x32,
  DP_CELL_HIGH_X_LOW_Y = 0x2f,
  DP_CELL_HIGH_X_HIGH_Y = 0x35,
  DP_LARGEST_OVERLAP = 0x3b,
  DP_MOVED_OBJECT = 0x3e;
// The player passes boxes of objects with both flag bits 0 and 1.
const PLAYER_PASSES = 3;
// Return words of the JSR 8486 calls and of the JSL 81:8686 (bank offsets of the last bytes).
const callReturn = (address) => address & WORD_MASK,
  BOXES_RETURN_WORD = callReturn(0x80848e);
// 80:8371: collision test of the object (first argument) moved by DP02 against the object boxes
// of up to four map cells (8486 JSR, 81:8686 JSL/RTL), fixed equations of the original
// graph. DBR is 7E between PHB/PEA7E7E/PLB and the final PLB; every byte is fresh.
export const testObjectCollision = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h;
      const compare = (left, right) => {
        h.nz((left - right) & WORD_MASK);
        ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
      };
      const lsr = () => {
        ctx.status = (ctx.status & ~FLAG_CARRY) | (ctx.a & 1);
        h.load(ctx.a >>> 1);
      };
      const store = (offset, value) => a.writeWord(offset, value, BANK_WRAP, '8371-DP-WORD');
      const indirectY = (n, y) =>
        a.readWord(
          ((a.readWord(n, BANK_WRAP, '8371-pointer') |
            (a.read(n + 2, '8371-pointer-bank') << WORD_BITS)) +
            y) &
            LONG_MASK,
          LONG_WRAP,
          '8371-indirect-WORD',
        );
      const pushByte = (value, label) => {
        a.write(ctx.s, value & BYTE_MASK, label);
        ctx.s = (ctx.s - 1) & WORD_MASK;
      };
      const pullByte = (label) => {
        ctx.s = (ctx.s + 1) & WORD_MASK;
        return a.read(ctx.s, label);
      };
      const plb = () => {
        const bank = pullByte('8371-PLB');
        ctx.bank = bank;
        h.nz(bank, 1);
      };
      const signedByte = (y) => {
        h.load(indirectY(DP_SHAPE_POINTER, y) & BYTE_MASK);
        compare(ctx.a, BYTE_SIGN);
        if (ctx.status & FLAG_CARRY) h.load(ctx.a | HIGH_BYTE_MASK);
      };
      // 81:8686: walk the object list from X; Y = box offset, keep the largest overlap in DP3B.
      const boxes = () => {
        do {
          h.index('y', h.longRead(h.abs(COLLISION_NODE_BOX) + ctx.x));
          const box = (offset) => h.longRead(h.abs(offset) + ctx.y);
          next: {
            h.load(h.dp(DP_HIGH_X));
            compare(ctx.a, box(COLLISION_BOX_X0));
            if (!(ctx.status & FLAG_CARRY)) break next;
            h.load(box(COLLISION_BOX_X1));
            compare(ctx.a, h.dp(DP_LOW_X));
            if (!(ctx.status & FLAG_CARRY)) break next;
            h.load(h.dp(DP_HIGH_Y));
            compare(ctx.a, box(COLLISION_BOX_Y0));
            if (!(ctx.status & FLAG_CARRY)) break next;
            h.load(box(COLLISION_BOX_Y1));
            compare(ctx.a, h.dp(DP_LOW_Y));
            if (!(ctx.status & FLAG_CARRY)) break next;
            h.load(h.dp(DP_TOP));
            compare(ctx.a, box(COLLISION_BOX_BOTTOM));
            if (!(ctx.status & FLAG_CARRY)) break next;
            ctx.status |= FLAG_CARRY;
            h.load(box(COLLISION_BOX_TOP));
            h.arithmetic(h.dp(DP_BOTTOM), true);
            if (!(ctx.status & FLAG_CARRY)) break next;
            compare(ctx.a, h.dp(DP_LARGEST_OVERLAP));
            if (!(ctx.status & FLAG_CARRY)) break next;
            a.pushWord(ctx.a, '8686-PHA');
            a.pushWord(ctx.x, '8686-PHX');
            h.load(ctx.y);
            lsr();
            lsr();
            h.index('x', ctx.a);
            h.load(h.longRead(COLLISION_BOX_OBJECT + ctx.x));
            h.index('x', a.pullWord('8686-PLX'));
            h.index('y', a.pullWord('8686-PLY'));
            compare(ctx.a, h.dp(DP_MOVED_OBJECT));
            if (ctx.status & FLAG_ZERO) break next;
            compare(ctx.a, h.longRead(h.abs(PLAYER_OBJECT)));
            if (ctx.status & FLAG_ZERO) {
              a.pushWord(ctx.y, '8686-PHY');
              h.index('y', h.dp(DP_MOVED_OBJECT));
              h.load(h.longRead(h.abs(OBJECT_FLAGS) + ctx.y));
              h.index('y', a.pullWord('8686-PLY-box'));
              h.load(ctx.a & PLAYER_PASSES);
              compare(ctx.a, PLAYER_PASSES);
              if (ctx.status & FLAG_ZERO) break next;
            }
            store(DP_LARGEST_OVERLAP, ctx.y);
          }
          h.load(h.longRead(h.abs(COLLISION_NODE_NEXT) + ctx.x));
          h.index('x', ctx.a);
        } while (!(ctx.x & WORD_SIGN));
      };
      // 8486: map cell Y -> first object X; JSL 81:8686 unless negative; carry = no overlap.
      const cell = (returnWord) => {
        a.pushWord(returnWord, '8371-8486-JSR');
        h.index('x', h.longRead(h.abs(COLLISION_CELL_HEADS) + ctx.y));
        if (!(ctx.x & WORD_SIGN)) {
          pushByte(CODE_BANK, '8486-JSL-bank');
          a.pushWord(BOXES_RETURN_WORD, '8486-JSL-WORD');
          boxes();
          const raw = a.pullWord('8686-RTL-WORD'),
            bank = pullByte('8686-RTL-bank');
          if (raw !== BOXES_RETURN_WORD || bank !== CODE_BANK)
            taskStop('task_native_long_return_required', { raw, bank });
        }
        h.load(h.dp(DP_LARGEST_OVERLAP));
        ctx.status = (ctx.status & ~FLAG_CARRY) | Number((ctx.status & FLAG_ZERO) !== 0);
        const raw = a.pullWord('8486-RTS');
        if (raw !== returnWord)
          taskStop('task_native_helper_return_required', { actual: raw, expected: returnWord });
        return (ctx.status & FLAG_CARRY) !== 0;
      };
      h.index('x', h.dp(FIRST_ARGUMENT));
      store(DP_MOVED_OBJECT, ctx.x);
      h.load(h.longRead(WRAM + OBJECT_KIND + ctx.x));
      h.asl();
      h.index('x', ctx.a);
      h.load(h.dp(SECOND_ARGUMENT));
      h.asl();
      h.arithmetic(a.readWord(ACTION_TABLE + ctx.x, LONG_WRAP, '8371-table-WORD'));
      store(DP_ACTION_POINTER, ctx.a);
      h.load(ACTION_TABLE >>> WORD_BITS);
      store(DP_ACTION_BANK, ctx.a);
      store(DP_SHAPE_BANK, ctx.a);
      h.load(indirectY(DP_ACTION_POINTER, 0));
      store(DP_SHAPE_POINTER, ctx.a);
      h.index('y', SHAPE_FIRST_EDGE);
      for (const offset of [DP_LOW_X, DP_HIGH_X, DP_LOW_Y, DP_HIGH_Y]) {
        signedByte(ctx.y);
        store(offset, ctx.a);
        h.index('y', (ctx.y + 1) & WORD_MASK);
      }
      h.load(indirectY(DP_SHAPE_POINTER, ctx.y) & BYTE_MASK);
      store(DP_TOP, ctx.a);
      pushByte(ctx.bank, '8371-PHB');
      a.pushWord((WRAM_BANK << BYTE_BITS) | WRAM_BANK, '8371-PEA');
      plb();
      plb();
      h.index('x', h.dp(DP_MOVED_OBJECT));
      store(DP_LARGEST_OVERLAP, 0);
      const field = (offset) => {
        h.load(h.longRead(h.abs(offset) + ctx.x));
        lsr();
        lsr();
        ctx.status &= ~FLAG_CARRY;
      };
      field(OBJECT_HEIGHT);
      store(DP_BOTTOM, ctx.a);
      h.arithmetic(h.dp(DP_TOP));
      store(DP_TOP, ctx.a);
      field(OBJECT_Y);
      h.arithmetic(h.dp(DP_HIGH_Y));
      store(DP_HIGH_Y, ctx.a);
      h.load(ctx.a & CELL_COORDINATE_MASK);
      lsr();
      store(DP_HIGH_Y_ROW, ctx.a);
      field(OBJECT_Y);
      h.arithmetic(h.dp(DP_LOW_Y));
      store(DP_LOW_Y, ctx.a);
      h.load(ctx.a & CELL_COORDINATE_MASK);
      lsr();
      store(DP_LOW_Y_ROW, ctx.a);
      const column = (dp, target, combined) => {
        field(OBJECT_X);
        h.arithmetic(h.dp(dp));
        store(dp, ctx.a);
        h.load(ctx.a & CELL_COORDINATE_MASK);
        h.asl();
        h.asl();
        h.asl();
        const swapped = ((ctx.a >>> BYTE_BITS) | (ctx.a << BYTE_BITS)) & WORD_MASK;
        ctx.a = swapped;
        h.nz(swapped & BYTE_MASK, 1);
        store(target, ctx.a);
        h.load(ctx.a | h.dp(DP_LOW_Y_ROW));
        store(combined, ctx.a);
      };
      column(DP_LOW_X, DP_LOW_X_COLUMN, DP_CELL_LOW_X_LOW_Y);
      column(DP_HIGH_X, DP_HIGH_X_COLUMN, DP_CELL_HIGH_X_LOW_Y);
      h.load(h.dp(DP_HIGH_X_COLUMN) | h.dp(DP_HIGH_Y_ROW));
      store(DP_CELL_HIGH_X_HIGH_Y, ctx.a);
      h.load(h.dp(DP_LOW_X_COLUMN) | h.dp(DP_HIGH_Y_ROW));
      store(DP_CELL_LOW_X_HIGH_Y, ctx.a);
      h.index('y', ctx.a);
      end: {
        if (!cell(callReturn(0x80844c))) break end;
        h.index('y', h.dp(DP_CELL_LOW_X_LOW_Y));
        compare(ctx.y, h.dp(DP_CELL_LOW_X_HIGH_Y));
        if (!(ctx.status & FLAG_ZERO) && !cell(callReturn(0x808457))) break end;
        h.index('y', h.dp(DP_CELL_HIGH_X_LOW_Y));
        compare(ctx.y, h.dp(DP_CELL_LOW_X_HIGH_Y));
        if (!(ctx.status & FLAG_ZERO)) {
          compare(ctx.y, h.dp(DP_CELL_LOW_X_LOW_Y));
          if (!(ctx.status & FLAG_ZERO) && !cell(callReturn(0x808466))) break end;
        }
        h.index('y', h.dp(DP_CELL_HIGH_X_HIGH_Y));
        for (const other of [DP_CELL_LOW_X_HIGH_Y, DP_CELL_LOW_X_LOW_Y, DP_CELL_HIGH_X_LOW_Y]) {
          compare(ctx.y, h.dp(other));
          if (ctx.status & FLAG_ZERO) break end;
        }
        cell(callReturn(0x808479));
      }
      plb();
      if (ctx.status & FLAG_CARRY) store(0, 0);
      else {
        h.load(WORD_MASK);
        store(0, ctx.a);
      }
    },
    outerReturn,
  );
