// The object turn (lifted from 80:AAAF with the animation selection 80:A985;
// register-level versions in src/task/native-object-turn.mjs, which the other callers
// still use).
//
// An object (slot in the direct page word 00) turns to the direction in word 02. Its
// action record (src/data/actions.mjs) gives one byte per direction: the offset of the
// direction's first frame. When the object plays a short animation (1 to 7F frames),
// the frame offset moves by the difference of the two directions' offsets, which
// keeps the frame phase, and the animation clock restarts. Otherwise its last
// selected animation, if any, is selected again for the new direction.
//
// The selection takes the kind's action list at ACTION_TABLE, the record of the
// action and its eight direction offsets, and loads the object's animation fields
// from the record: speed, frame count (bit 7 flipped: loop), palette, the signed box
// and its height. It leaves the direct page words as the original: the list entry
// pointer 00, the record 04, the direction offsets 08 and the bank words 02, 06 and
// 0A (8C); the turn's fast path leaves 08 and 0A.
//
// The records lie in bank 8C. A pointer into 2000-7FFF of a bank with a system area
// that hits no register reads the open bus: the pointer's bank byte (Book I PDF 93;
// Mesen evidence in native-object-turn.mjs). Only a damaged object reaches it.
//
// The fields the original reads through its data bank 80 are reached the same way
// (src/system/data-bank.mjs): a slot past them, such as FFFF, reads the WRAM mirror of
// bank 81 or what lies above, as the original. The return words of the JSR to the turn and of its JSR to
// the selection lie on the stack as in the original.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { taskStop } from '../task/plan.mjs';
import {
  ANIMATION_CLOCK_START,
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_ANIMATION_CLOCK,
  OBJECT_ANIMATION_SPEED,
  OBJECT_BOX_HEIGHT,
  OBJECT_BOX_X1,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y1,
  OBJECT_BOX_Y2,
  OBJECT_DIRECTION,
  OBJECT_FRAME_COUNT,
  OBJECT_FRAME_OFFSET,
  OBJECT_FRAME_REPEATS,
  OBJECT_KIND,
  OBJECT_PALETTE,
  OBJECT_PICTURE_CHANGE,
  OBJECT_SELECTION,
} from '../task/wram.mjs';
import { ACTION_TABLE } from '../data/actions.mjs';
import {
  FLAG_CARRY,
  FLAG_DECIMAL,
  FLAG_NEGATIVE,
  FLAG_OVERFLOW,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';
import { INIDISP, NMITIMEN, DMAP0 } from '../constants/hardware-registers.mjs';
import {
  BANK_WITHOUT_IO,
  CODE_BANK_BASE,
  IO_AREA_END,
  IO_AREA_START,
} from '../constants/memory-map.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  HIGH_BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';

const NONE = WORD_MASK;
// The direct page: the object and the direction (or selection), then the long
// pointers to the list entry, the record and its direction offsets.
const DP_OBJECT = 0,
  DP_ARGUMENT = 2,
  DP_ENTRY = 0,
  DP_ENTRY_BANK = 2,
  DP_RECORD = 4,
  DP_RECORD_BANK = 6,
  DP_FRAMES = 8,
  DP_FRAMES_BANK = 0x0a;
// The record: speed, frame count, palette, the box (four signed bytes), its height,
// then the direction offsets.
const ACTION_BANK = ACTION_TABLE >>> WORD_BITS,
  RECORD_FRAME_COUNT = 1,
  RECORD_PALETTE = 2,
  RECORD_BOX = 3,
  RECORD_BOX_HEIGHT = 7,
  RECORD_DIRECTIONS = 8,
  // The last of the four box bytes.
  RECORD_BOX_LAST = 3,
  FRAME_LOOP_FLAG = 0x80;
// The return words of the JSRs (the bank offsets of their last bytes).
const JSR_LAST_BYTE = 2,
  SELECTION_RETURN = 0xaadc;
// Registers inside 2000-7FFF (Book I PDF 93): the B bus 2100-21FF, the joypad ports
// 4016/4017, the CPU registers 4200-421F and the DMA channels 4300-437F.
const B_BUS_END = 0x2200,
  JOYPAD_PORT_1 = 0x4016,
  JOYPAD_PORT_2 = 0x4017,
  CPU_REGISTERS_END = 0x4220,
  DMA_REGISTERS_END = 0x4380,
  NO_IO_BANK_BIT = BANK_WITHOUT_IO << WORD_BITS;

const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const register = (low) =>
  (low >= INIDISP && low < B_BUS_END) ||
  low === JOYPAD_PORT_1 ||
  low === JOYPAD_PORT_2 ||
  (low >= NMITIMEN && low < CPU_REGISTERS_END) ||
  (low >= DMAP0 && low < DMA_REGISTERS_END);
const openBus = (address) => {
  const low = address & WORD_MASK;
  return !(address & NO_IO_BANK_BIT) && low >= IO_AREA_START && low < IO_AREA_END && !register(low);
};
// A byte of bank 8C at pointer + offset (which may cross into the next bank).
function actionByte(mem, pointer, offset) {
  const address = ((ACTION_BANK << WORD_BITS) + pointer + offset) & LONG_MASK;
  return openBus(address) ? ACTION_BANK : mem.read8(address);
}
const actionWord = (mem, pointer, offset) =>
  actionByte(mem, pointer, offset) | (actionByte(mem, pointer, offset + 1) << BYTE_BITS);
const readWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
const signedByte = (value) => (value & BYTE_SIGN ? value | HIGH_BYTE_MASK : value);

// Select the animation in word 02 for the object in word 00 (80:A985) after the
// original's check for an unchanged selection (selectObjectAnimation), or as the turn
// calls it (the turn has set the object's selection to none). Returns the carry of the
// last box byte's sign test and the overflow of the direction offsets' addition, which
// the original leaves.
function selectAnimation(mem, wram) {
  const slot = word(wram, DP_OBJECT),
    selection = word(wram, DP_ARGUMENT);
  setDataBankWord(mem, OBJECT_SELECTION, slot, selection);
  // The entry of the kind's list: the selection doubled (ASL, its bit 15 to the carry)
  // plus the list word with that carry; the record's direction offsets take the carry
  // of that sum.
  const kindOffset = (word(wram, OBJECT_KIND + slot) << 1) & WORD_MASK,
    sum =
      ((selection << 1) & WORD_MASK) +
      readWord(mem, ACTION_TABLE + kindOffset) +
      (selection >>> (WORD_BITS - 1)),
    entry = sum & WORD_MASK;
  setWord(wram, DP_ENTRY, entry);
  for (const at of [DP_ENTRY_BANK, DP_RECORD_BANK, DP_FRAMES_BANK]) setWord(wram, at, ACTION_BANK);
  const record = actionWord(mem, entry, 0),
    directions = (record + RECORD_DIRECTIONS + (sum >>> WORD_BITS)) & WORD_MASK;
  setWord(wram, DP_RECORD, record);
  setDataBankWord(mem, OBJECT_ACTION_DIRECTIONS, slot, directions);
  setWord(wram, DP_FRAMES, directions);
  const byte = (offset) => actionByte(mem, record, offset);
  setDataBankWord(
    mem,
    OBJECT_FRAME_OFFSET,
    slot,
    actionByte(mem, directions, dataBankWord(mem, OBJECT_DIRECTION, slot)),
  );
  setWord(wram, OBJECT_ANIMATION_SPEED + slot, byte(0));
  setDataBankWord(mem, OBJECT_FRAME_COUNT, slot, byte(RECORD_FRAME_COUNT) ^ FRAME_LOOP_FLAG);
  setWord(wram, OBJECT_FRAME_REPEATS + slot, 1);
  setDataBankWord(mem, OBJECT_PALETTE, slot, byte(RECORD_PALETTE));
  [OBJECT_BOX_X1, OBJECT_BOX_X2, OBJECT_BOX_Y1, OBJECT_BOX_Y2].forEach((table, n) =>
    setWord(wram, table + slot, signedByte(byte(RECORD_BOX + n))),
  );
  setWord(wram, OBJECT_BOX_HEIGHT + slot, byte(RECORD_BOX_HEIGHT));
  setWord(wram, OBJECT_ANIMATION_CLOCK + slot, ANIMATION_CLOCK_START);
  setDataBankWord(mem, OBJECT_PICTURE_CHANGE, slot, NONE);
  return {
    carry: byte(RECORD_BOX + RECORD_BOX_LAST) >= BYTE_SIGN,
    overflow: (~(record ^ RECORD_DIRECTIONS) & (record ^ directions) & WORD_SIGN) !== 0,
  };
}

// Select the animation in word 02 for the object in word 00 unless it is already
// selected (80:A985 as 80:D15C calls it).
export function selectObjectAnimation(mem, wram) {
  const slot = word(wram, DP_OBJECT);
  if (word(wram, DP_ARGUMENT) === dataBankWord(mem, OBJECT_SELECTION, slot)) return;
  selectAnimation(mem, wram);
}

// Turn the object in word 00 to the direction in word 02 (80:AAAF); a is the
// accessor whose stack takes the selection's return word. Returns the registers the
// original leaves: A (undefined: unchanged), X the slot, Y, the sign and zero of
// the last load or comparison, the carry and the overflow (undefined: unchanged).
export function turnObject(mem, wram, a) {
  const slot = word(wram, DP_OBJECT),
    direction = word(wram, DP_ARGUMENT);
  const before = dataBankWord(mem, OBJECT_DIRECTION, slot);
  // An unchanged direction or no selection to repeat: the comparison found them equal.
  const equal = (value) => ({ a: value, x: slot, y: before, sign: 0, carry: true });
  if (before === direction) return equal(undefined);
  setDataBankWord(mem, OBJECT_DIRECTION, slot, direction);
  const frames = dataBankWord(mem, OBJECT_FRAME_COUNT, slot);
  if (frames === 0 || frames >= FRAME_LOOP_FLAG) {
    const selection = dataBankWord(mem, OBJECT_SELECTION, slot);
    if (selection === NONE) return equal(NONE);
    // The original sets the object's selection to none first, which the selection
    // then replaces (for a slot far out of range the word may alias another).
    setWord(wram, DP_ARGUMENT, selection & ~WORD_SIGN);
    setDataBankWord(mem, OBJECT_SELECTION, slot, NONE);
    // The selection's check for an unchanged selection: it holds only where that word
    // did not take the write (ROM above the WRAM mirror); the selection then returns
    // with A the selection, Y the slot and the comparison's flags.
    const wanted = word(wram, DP_ARGUMENT);
    if (wanted === dataBankWord(mem, OBJECT_SELECTION, slot))
      return { a: wanted, x: slot, y: slot, sign: 0, carry: true };
    a.pushWord(SELECTION_RETURN);
    const { carry, overflow } = selectAnimation(mem, wram);
    a.pullWord();
    return { a: NONE, x: slot, y: RECORD_BOX_HEIGHT, sign: NONE, carry, overflow };
  }
  const directions = dataBankWord(mem, OBJECT_ACTION_DIRECTIONS, slot);
  setWord(wram, DP_FRAMES, directions);
  setWord(wram, DP_FRAMES_BANK, ACTION_BANK);
  // The frame offset's byte keeps its phase: the 8-bit SBC and ADC of the two offsets.
  const frameOffset = (CODE_BANK_BASE + OBJECT_FRAME_OFFSET + slot) & LONG_MASK,
    back = (mem.read8(frameOffset) - actionByte(mem, directions, before)) & BYTE_MASK,
    forward = actionByte(mem, directions, direction),
    sum = back + forward,
    offset = sum & BYTE_MASK;
  mem.write8(frameOffset, offset);
  setWord(wram, OBJECT_ANIMATION_CLOCK + slot, ANIMATION_CLOCK_START);
  setDataBankWord(mem, OBJECT_PICTURE_CHANGE, slot, NONE);
  return {
    a: NONE,
    x: slot,
    y: direction,
    sign: NONE,
    carry: sum > BYTE_MASK,
    overflow: (~(back ^ forward) & (back ^ offset) & BYTE_SIGN) !== 0,
  };
}

// The turn as called with JSR (80:AAAF), its return word on the stack: direct page 0
// and binary arithmetic. Leaves A, X, Y and the flags as the original and returns
// with its RTS.
export function turnObjectRoutine(h) {
  const { ctx, a } = h;
  if (ctx.d !== 0) taskStop('task_direct_page_zero_required');
  if (ctx.status & FLAG_DECIMAL) taskStop('task_binary_arithmetic_required');
  const { mem } = a,
    left = turnObject(mem, mem.wram, a);
  if (left.a !== undefined) ctx.a = left.a;
  ctx.x = left.x;
  ctx.y = left.y;
  flag(ctx, FLAG_NEGATIVE, left.sign & WORD_SIGN);
  flag(ctx, FLAG_ZERO, left.sign === 0);
  flag(ctx, FLAG_CARRY, left.carry);
  if (left.overflow !== undefined) flag(ctx, FLAG_OVERFLOW, left.overflow);
  return h.rts();
}

// The turn called with a JSR from site (its return word on the stack).
export function turnObjectCall(h, site) {
  const { mem, wram } = sceneRuntime(h);
  h.a.pushWord((site + JSR_LAST_BYTE) & WORD_MASK);
  turnObject(mem, wram, h.a);
  h.a.pullWord();
}

// The animation selection as called with JSR (80:A985), its return word on the stack:
// direct page 0. Game state only (docs/STRATEGY.md, 2026-11-14): it leaves no registers
// for its callers, which read none, and returns with its RTS.
export function selectAnimationRoutine(h) {
  if (h.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  const { mem } = h.a;
  selectObjectAnimation(mem, mem.wram);
  return h.rts();
}
