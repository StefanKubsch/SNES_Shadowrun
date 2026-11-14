import { taskStop } from './plan.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';

import {
  ANIMATION_CLOCK_START,
  OBJECT_ANIMATION_CLOCK,
  OBJECT_ANIMATION_SPEED,
  OBJECT_BOX_X1,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y1,
  OBJECT_BOX_Y2,
  OBJECT_FRAME_COUNT,
  OBJECT_FRAME_OFFSET,
  OBJECT_FRAME_REPEATS,
  OBJECT_PALETTE,
  OBJECT_DIRECTION,
  OBJECT_KIND,
  OBJECT_PICTURE_CHANGE,
  OBJECT_SELECTION,
  WRAM,
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_BOX_HEIGHT,
} from './wram.mjs';
import {
  FLAG_CARRY,
  FLAG_DECIMAL,
  FLAG_OVERFLOW,
  FLAG_ZERO,
  FLAG_MEMORY_8BIT,
} from '../constants/cpu-flags.mjs';
import {
  WORD_MASK,
  BANK_WRAP,
  WORD_BITS,
  LONG_MASK,
  BYTE_BITS,
  LONG_WRAP,
  BYTE_MASK,
  HIGH_BYTE_MASK,
  BYTE_SIGN,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { INIDISP, NMITIMEN, DMAP0 } from '../constants/hardware-registers.mjs';
import { BANK_WITHOUT_IO, IO_AREA_START, IO_AREA_END } from '../constants/memory-map.mjs';
import { ACTION_TABLE } from '../data/actions.mjs';
// Registers answering inside 2000-7FFF (Book I PDF 93): the B bus 2100-21FF, the joypad ports
// 4016/4017, the CPU registers 4200-421F and the DMA channels 4300-437F.
const B_BUS_END = 0x2200,
  JOYPAD_PORT_1 = 0x4016,
  JOYPAD_PORT_2 = 0x4017,
  CPU_REGISTERS_END = 0x4220,
  DMA_REGISTERS_END = 0x4380,
  IO_FREE_BANK_BIT = BANK_WITHOUT_IO << WORD_BITS;
// A985 direct page: long pointers to the definition entry, the action record and its frame
// table (record + 8, one byte per direction); bit 7 of record byte 1 is the loop flag.
const ACTION_BANK = ACTION_TABLE >>> WORD_BITS,
  DP_ENTRY_BANK = 2,
  DP_RECORD_POINTER = 4,
  DP_RECORD_BANK = 6,
  DP_FRAMES_POINTER = 8,
  DP_FRAMES_BANK = 0x0a,
  RECORD_FRAMES = 8,
  FRAME_LOOP_FLAG = 0x80,
  NO_SELECTION = WORD_MASK,
  SELECTION_MASK = WORD_MASK ^ WORD_SIGN;
// D15C arguments: DP00 object, DP02 selection, DP04 direction (restored to DP02 for AAAF).
const DP_DIRECTION_ARGUMENT = 4;
// Return word of a JSR: the bank offset of the call's last byte.
const callReturn = (address) => address & WORD_MASK;
// Turning towards another object (CF93, D1E3): magnitudes and sign flags (FFFF: negative) of
// the target offset, and the eight facings by the signs of the dominant axis or of both axes
// (minus: target coordinate below the object's).
export const DP_DISTANCE_X = 0xa2,
  DP_DISTANCE_Y = 0xa5,
  DP_MINUS_X = 0xa8,
  DP_MINUS_Y = 0xab,
  FACING = Object.freeze({
    y: 0,
    xy: 1,
    x: 2,
    xMinusY: 3,
    minusY: 4,
    minusXMinusY: 5,
    minusX: 6,
    minusXY: 7,
  });
// Fixed D15C -> A985 -> AAAF equations, not an instruction interpreter.
// Every DP, indexed field, indirect pointer and saved stack value is fresh.
export function taskSelectionSupport(h) {
  const { a, ctx } = h;
  const compare = (left, right) => {
    h.nz((left - right) & WORD_MASK);
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
  };
  const pointer = (n) =>
    a.readWord(n, BANK_WRAP, 'd2-indirect-pointer') |
    (a.read(n + 2, 'd2-indirect-bank') << WORD_BITS);
  // LDA [dp],Y into $6000-$7FFF of banks 00-3F/80-BF (nothing mapped there) reads the open bus:
  // the last byte on the data bus, the pointer's bank byte, for each byte. Original evidence (Mesen,
  // tools/mesen-live-room.test.mjs): 80:A9BF reads 8C:6AA1/6AA2 as 8C, 8C.
  // The same holds for $2000-$5FFF outside the registers: Book I PDF 93 reserves it as the
  // register area of S-PPU, DMA etc.; the registers are 2100-21FF (B bus), 4016/4017, 4200-421F
  // and 4300-437F. Live finding 2026-10-30: from the open-bus record 8C8C, Y carries the counter
  // read into 8D:35B3 (shot, then B in the crosshair).
  // Original evidence (Mesen, tools/live-alley-bus.test.mjs, 2026-11-01): with the same random
  // draws the original reads 8C:6A56/6A57 at 80:A9AF and 8D:35B3/35B4 at 80:A9BF as 8C, 8C, the
  // bank byte of the pointer 8C:8C94. (An earlier check that day saw no reads only because
  // tools/mesen-explore.mjs did not print explore.lua's "RD" lines.)
  const register = (low) =>
    (low >= INIDISP && low < B_BUS_END) ||
    low === JOYPAD_PORT_1 ||
    low === JOYPAD_PORT_2 ||
    (low >= NMITIMEN && low < CPU_REGISTERS_END) ||
    (low >= DMAP0 && low < DMA_REGISTERS_END);
  const openBus = (address) => {
    const low = address & WORD_MASK;
    return (
      !(address & IO_FREE_BANK_BIT) && low >= IO_AREA_START && low < IO_AREA_END && !register(low)
    );
  };
  const indirect = (n, y = 0, width = 2) => {
    const base = pointer(n),
      address = (base + y) & LONG_MASK;
    if (openBus(address) || (width === 2 && openBus((address + 1) & LONG_MASK))) {
      const byte = (at) => (openBus(at) ? base >>> WORD_BITS : a.read(at, 'd2-indirect-BYTE'));
      return width === 1
        ? byte(address)
        : byte(address) | (byte((address + 1) & LONG_MASK) << BYTE_BITS);
    }
    return width === 1
      ? a.read(address, 'd2-indirect-BYTE')
      : a.readWord(address, LONG_WRAP, 'd2-indirect-WORD');
  };
  const call = (returnWord, run) => {
    a.pushWord(returnWord, 'd2-inner-JSR');
    run();
    const actual = a.pullWord('d2-inner-RTS');
    if (actual !== returnWord)
      taskStop('task_native_helper_return_required', { actual, expected: returnWord });
    ctx.pc = (actual + 1) & WORD_MASK;
  };
  const byteArithmetic = (right, subtract) => {
    if (ctx.status & FLAG_DECIMAL) taskStop('task_binary_arithmetic_required');
    const left = ctx.a & BYTE_MASK,
      c = ctx.status & FLAG_CARRY,
      sum = subtract ? left - right - 1 + c : left + right + c,
      result = sum & BYTE_MASK;
    const overflow =
      (subtract ? (left ^ right) & (left ^ result) : ~(left ^ right) & (left ^ result)) & BYTE_SIGN;
    ctx.status =
      (ctx.status & ~(FLAG_CARRY | FLAG_OVERFLOW)) |
      (subtract ? Number(sum >= 0) : Number(sum > BYTE_MASK)) |
      (overflow ? FLAG_OVERFLOW : 0);
    h.load(result, 1);
  };
  return { compare, indirect, call, byteArithmetic };
}
export function runTaskSelection(h, k) {
  const { a, ctx } = h;
  h.index('y', h.dp(FIRST_ARGUMENT));
  h.load(h.dp(SECOND_ARGUMENT));
  k.compare(ctx.a, h.longRead(h.abs(OBJECT_SELECTION) + ctx.y));
  if (ctx.status & FLAG_ZERO) return;
  h.longWrite(h.abs(OBJECT_SELECTION) + ctx.y, ctx.a);
  h.index('x', ctx.y);
  h.load(h.longRead(WRAM + OBJECT_KIND + ctx.x));
  h.asl();
  h.index('x', ctx.a);
  h.load(h.dp(SECOND_ARGUMENT));
  h.asl();
  h.arithmetic(a.readWord(ACTION_TABLE + ctx.x, LONG_WRAP, 'd2-table-WORD'));
  a.writeWord(FIRST_ARGUMENT, ctx.a, BANK_WRAP, 'd2-selection-pointer');
  h.load(ACTION_BANK);
  for (const n of [DP_ENTRY_BANK, DP_RECORD_BANK, DP_FRAMES_BANK])
    a.writeWord(n, ctx.a, BANK_WRAP, 'd2-selection-bank');
  h.load(k.indirect(0));
  a.writeWord(DP_RECORD_POINTER, ctx.a, BANK_WRAP, 'd2-record-pointer');
  h.arithmetic(RECORD_FRAMES);
  h.longWrite(h.abs(OBJECT_ACTION_DIRECTIONS) + ctx.y, ctx.a);
  a.writeWord(DP_FRAMES_POINTER, ctx.a, BANK_WRAP, 'd2-counter-pointer');
  h.index('x', ctx.y);
  h.index('y', h.longRead(h.abs(OBJECT_DIRECTION) + ctx.x));
  h.load(k.indirect(DP_FRAMES_POINTER, ctx.y));
  h.load(ctx.a & BYTE_MASK);
  h.longWrite(h.abs(OBJECT_FRAME_OFFSET) + ctx.x, ctx.a);
  h.load(k.indirect(DP_RECORD_POINTER));
  h.load(ctx.a & BYTE_MASK);
  h.longWrite(WRAM + OBJECT_ANIMATION_SPEED + ctx.x, ctx.a);
  h.index('y', 1);
  h.load(k.indirect(DP_RECORD_POINTER, ctx.y));
  h.load(ctx.a & BYTE_MASK);
  h.load(ctx.a ^ FRAME_LOOP_FLAG);
  h.longWrite(h.abs(OBJECT_FRAME_COUNT) + ctx.x, ctx.a);
  h.load(1);
  h.longWrite(WRAM + OBJECT_FRAME_REPEATS + ctx.x, ctx.a);
  h.index('y', (ctx.y + 1) & WORD_MASK);
  h.load(k.indirect(DP_RECORD_POINTER, ctx.y));
  h.load(ctx.a & BYTE_MASK);
  h.longWrite(h.abs(OBJECT_PALETTE) + ctx.x, ctx.a);
  for (const offset of [OBJECT_BOX_X1, OBJECT_BOX_X2, OBJECT_BOX_Y1, OBJECT_BOX_Y2]) {
    h.index('y', (ctx.y + 1) & WORD_MASK);
    h.load(k.indirect(DP_RECORD_POINTER, ctx.y));
    h.load(ctx.a & BYTE_MASK);
    k.compare(ctx.a, BYTE_SIGN);
    if (ctx.status & FLAG_CARRY) h.load(ctx.a | HIGH_BYTE_MASK);
    h.longWrite(WRAM + offset + ctx.x, ctx.a);
  }
  h.index('y', (ctx.y + 1) & WORD_MASK);
  h.load(k.indirect(DP_RECORD_POINTER, ctx.y));
  h.load(ctx.a & BYTE_MASK);
  h.longWrite(WRAM + OBJECT_BOX_HEIGHT + ctx.x, ctx.a);
  h.load(ANIMATION_CLOCK_START);
  h.longWrite(WRAM + OBJECT_ANIMATION_CLOCK + ctx.x, ctx.a);
  h.load(WORD_MASK);
  h.longWrite(h.abs(OBJECT_PICTURE_CHANGE) + ctx.x, ctx.a);
}
export function runTaskAction(h, k) {
  const { a, ctx } = h;
  h.index('x', h.dp(FIRST_ARGUMENT));
  h.index('y', h.longRead(h.abs(OBJECT_DIRECTION) + ctx.x));
  k.compare(ctx.y, h.dp(SECOND_ARGUMENT));
  if (ctx.status & FLAG_ZERO) return;
  h.load(h.dp(SECOND_ARGUMENT));
  h.longWrite(h.abs(OBJECT_DIRECTION) + ctx.x, ctx.a);
  h.load(h.longRead(h.abs(OBJECT_FRAME_COUNT) + ctx.x));
  let slow = (ctx.status & FLAG_ZERO) !== 0;
  if (!slow) {
    k.compare(ctx.a, FRAME_LOOP_FLAG);
    slow = (ctx.status & FLAG_CARRY) !== 0;
  }
  if (slow) {
    h.load(h.longRead(h.abs(OBJECT_SELECTION) + ctx.x));
    k.compare(ctx.a, NO_SELECTION);
    if (ctx.status & FLAG_ZERO) return;
    h.load(ctx.a & SELECTION_MASK);
    a.writeWord(SECOND_ARGUMENT, ctx.a, BANK_WRAP, 'd2-action-selection');
    h.load(NO_SELECTION);
    h.longWrite(h.abs(OBJECT_SELECTION) + ctx.x, ctx.a);
    k.call(callReturn(0x80aadc), () => runTaskSelection(h, k));
    return;
  }
  h.load(h.longRead(h.abs(OBJECT_ACTION_DIRECTIONS) + ctx.x));
  a.writeWord(DP_FRAMES_POINTER, ctx.a, BANK_WRAP, 'd2-action-pointer');
  h.load(ACTION_BANK);
  a.writeWord(DP_FRAMES_BANK, ctx.a, BANK_WRAP, 'd2-action-bank');
  ctx.status |= FLAG_CARRY;
  ctx.status |= FLAG_MEMORY_8BIT;
  h.load(a.read(h.abs(OBJECT_FRAME_OFFSET) + ctx.x, 'd2-action-field-BYTE'), 1);
  k.byteArithmetic(k.indirect(DP_FRAMES_POINTER, ctx.y, 1), true);
  h.index('y', h.longRead(h.abs(OBJECT_DIRECTION) + ctx.x));
  ctx.status &= ~FLAG_CARRY;
  k.byteArithmetic(k.indirect(DP_FRAMES_POINTER, ctx.y, 1), false);
  h.longWrite(h.abs(OBJECT_FRAME_OFFSET) + ctx.x, ctx.a, 1);
  ctx.status &= ~FLAG_MEMORY_8BIT;
  h.load(ANIMATION_CLOCK_START);
  h.longWrite(WRAM + OBJECT_ANIMATION_CLOCK + ctx.x, ctx.a);
  h.load(WORD_MASK);
  h.longWrite(h.abs(OBJECT_PICTURE_CHANGE) + ctx.x, ctx.a);
}
// 80:D15C (arguments above): set the object's action selection (A985), then its
// direction (AAAF).
export const setObjectActionAndDirection = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const k = taskSelectionSupport(h);
      a.pushWord(h.dp(DP_DIRECTION_ARGUMENT), 'd2-PEI04');
      a.pushWord(h.dp(FIRST_ARGUMENT), 'd2-PEI00');
      k.call(callReturn(0x80d162), () => runTaskSelection(h, k));
      h.load(a.pullWord('d2-restore-slot-PLA'));
      a.writeWord(FIRST_ARGUMENT, h.ctx.a, BANK_WRAP, 'd2-restored-slot');
      h.load(a.pullWord('d2-restore-action-PLA'));
      a.writeWord(SECOND_ARGUMENT, h.ctx.a, BANK_WRAP, 'd2-restored-action');
      k.call(callReturn(0x80d16b), () => runTaskAction(h, k));
    },
    outerReturn,
  );
