import { CODE_BANK_PAIR } from '../constants/memory-map.mjs';
import {
  TEXT_MASK_BUFFER,
  TEXT_SOURCE_POINTER,
  TEXT_SOURCE_BANK,
  TEXT_PENDING_BYTES,
  TEXT_PIXEL_OFFSET,
  TEXT_WORK_WORD,
  TEXT_BITS_REMAINING,
  TEXT_BIT_BUFFER,
  TEXT_BUFFER_BYTES,
  WRAM,
  WINDOW_COLUMNS,
  WINDOW_ROWS,
  WINDOW_TILE_START,
  WINDOW_TILE_INITIAL,
  WINDOW_CURSOR_TILE,
  WINDOW_CURSOR_PIXEL,
  WINDOW_LEFT_PIXEL,
  TEXT_BUFFER_UPLOAD,
  TEXT_BUFFER_READBACK,
} from './wram.mjs';
import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { runInterruptWordWait, runInterruptRequestWait } from './main-wait-interrupt.mjs';
import {
  WRDIVL,
  WRDIVB,
  RDMPYL,
  RDDIVL,
  WRMPYA,
  WRMPYB,
} from '../constants/hardware-registers.mjs';
import {
  BYTE_MASK,
  WORD_MASK,
  BYTE_SIGN,
  WORD_SIGN,
  BYTE_BITS,
  WORD_BITS,
  BANK_SIZE,
  LONG_MASK,
  LONG_WRAP,
  BANK_WRAP,
} from '../constants/bits.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_CARRY,
  FLAG_DECIMAL,
  FLAG_OVERFLOW,
} from '../constants/cpu-flags.mjs';

const TEXT_TILE_PIXEL_SHIFT = 0x3;
const DP_LINE_WIDTH = 0xbd;
const DP_LINE_POSITION = 0xc0;
const TEXT_PIXEL_MASK = 0x7;
const TEXT_TILE_PIXELS = 0x8;
const NEWLINE_RESERVED_ROWS = 0x4;

const TEXT_REFILL_LAST_BIT = 0xf;
const AEF4_WAIT_RETURN_WORD = 0xaefa;
const AEFC_WAIT_RETURN_WORD = 0xaf02;
const AE4D_NOOP_RETURN_WORD = 0xaead;
const TEXT_MASK_BYTES = 0x10;
const TEXT_MASK_WORDS = 0x8;

// Fixed byte equations used only by these individually pinned text roots.
// Actual context and stack owners belong to the shared outer Task plan.
function access(a, { entryM = 0 } = {}) {
  const { ctx } = a;
  if (ctx.d !== 0) taskStop('task_direct_page_zero_required');
  if (
    ![0, 1].includes(entryM) ||
    (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)) !== (entryM ? FLAG_MEMORY_8BIT : 0)
  )
    taskStop(entryM ? 'task_text_byte_mode_required' : 'task_text_word_mode_required');
  const width = () => (ctx.status & FLAG_MEMORY_8BIT ? 1 : 2);
  const mask = () => (width() === 1 ? BYTE_MASK : WORD_MASK);
  const nz = (value, bytes = width()) => {
    const m = bytes === 1 ? BYTE_MASK : WORD_MASK,
      sign = bytes === 1 ? BYTE_SIGN : WORD_SIGN;
    value &= m;
    ctx.status =
      (ctx.status & ~(FLAG_ZERO | FLAG_NEGATIVE)) |
      (value & sign ? FLAG_NEGATIVE : 0) |
      (value === 0 ? FLAG_ZERO : 0);
    return value;
  };
  const load = (value, bytes = width()) => {
    const m = bytes === 1 ? BYTE_MASK : WORD_MASK;
    ctx.a = (ctx.a & ~m) | nz(value, bytes);
    return ctx.a & m;
  };
  const abs = (offset) => ctx.bank * BANK_SIZE + offset;
  const read = (address, bytes = width()) =>
    bytes === 1
      ? a.read(address & LONG_MASK, 'text-root-BYTE')
      : a.readWord(address & LONG_MASK, LONG_WRAP, 'text-root-WORD');
  const write = (address, value, bytes = width()) => {
    if (bytes === 1) a.write(address & LONG_MASK, value & BYTE_MASK, 'text-root-BYTE');
    else a.writeWord(address & LONG_MASK, value & WORD_MASK, LONG_WRAP, 'text-root-WORD');
  };
  const dp = (offset, bytes = width()) =>
    bytes === 1
      ? a.read(offset, 'text-root-DP-BYTE')
      : a.readWord(offset, BANK_WRAP, 'text-root-DP-WORD');
  const dpWrite = (offset, value, bytes = width()) => {
    if (bytes === 1) a.write(offset, value & BYTE_MASK, 'text-root-DP-BYTE');
    else a.writeWord(offset, value & WORD_MASK, BANK_WRAP, 'text-root-DP-WORD');
  };
  const compare = (left, right) => {
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
    nz((left - right) & mask());
  };
  const arithmetic = (right, subtract = false) => {
    if (ctx.status & FLAG_DECIMAL) taskStop('task_binary_arithmetic_required');
    const m = mask(),
      sign = width() === 1 ? BYTE_SIGN : WORD_SIGN,
      left = ctx.a & m,
      c = ctx.status & FLAG_CARRY,
      sum = subtract ? left - right - 1 + c : left + right + c,
      next = sum & m;
    const overflow =
      (subtract ? (left ^ right) & (left ^ next) : ~(left ^ right) & (left ^ next)) & sign;
    ctx.status =
      (ctx.status & ~(FLAG_CARRY | FLAG_OVERFLOW)) |
      (subtract ? Number(sum >= 0) : Number(sum > m)) |
      (overflow ? FLAG_OVERFLOW : 0);
    load(next);
  };
  const asl = () => {
    const n = ctx.a & mask();
    ctx.status =
      (ctx.status & ~FLAG_CARRY) | (n >>> (width() === 1 ? BYTE_BITS - 1 : WORD_BITS - 1));
    load(n << 1);
  };
  const lsr = () => {
    const n = ctx.a & mask();
    ctx.status = (ctx.status & ~FLAG_CARRY) | (n & 1);
    load(n >>> 1);
  };
  const xba = () => {
    ctx.a = ((ctx.a >>> BYTE_BITS) | (ctx.a << BYTE_BITS)) & WORD_MASK;
    nz(ctx.a & BYTE_MASK, 1);
  };
  const pushByte = (value, label) => {
    a.write(ctx.s, value, label);
    ctx.s = (ctx.s - 1) & WORD_MASK;
  };
  const pullByte = (label, outer = false) => {
    const value = a.read((ctx.s + 1) & WORD_MASK, label, outer);
    ctx.s = (ctx.s + 1) & WORD_MASK;
    return value;
  };
  const selectBank = () => {
    pushByte(ctx.bank, 'text-PHB');
    a.pushWord(CODE_BANK_PAIR, 'text-PEA8080');
    ctx.bank = pullByte('text-PLB-first');
    nz(ctx.bank, 1);
    ctx.bank = pullByte('text-PLB-second');
    nz(ctx.bank, 1);
  };
  const restoreBank = () => {
    ctx.bank = pullByte('text-PLB-restored-fresh');
    nz(ctx.bank, 1);
  };
  const finish = (outerReturn = true) => {
    if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)) taskStop('task_text_word_mode_required');
    const rawReturnWord = a.readWord(
      (ctx.s + 1) & WORD_MASK,
      BANK_WRAP,
      'text-RTL-WORD-fresh',
      outerReturn,
    );
    ctx.s = (ctx.s + 2) & WORD_MASK;
    const returnBank = pullByte('text-RTL-bank-fresh', outerReturn);
    ctx.programBank = returnBank;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    return {
      rawReturnWord,
      returnBank,
      returnTarget: returnBank * BANK_SIZE + ctx.pc,
      frontier: 'observed-outer-RTL-target',
      scope: 'manual-source-specific-text-root-return-target-not-executed',
      dynamicDispatchExecuted: false,
      returnTargetExecuted: false,
    };
  };
  return {
    ctx,
    nz,
    load,
    abs,
    read,
    write,
    dp,
    dpWrite,
    compare,
    arithmetic,
    asl,
    lsr,
    xba,
    pushByte,
    pullByte,
    selectBank,
    restoreBank,
    finish,
  };
}
export { access as taskTextAccess };

// 81:AF04: read the next bit of the packed text stream.
export function readTextBit(a, outerReturn = true) {
  const h = access(a),
    { ctx } = h;
  const remaining = h.nz((h.read(h.abs(TEXT_BITS_REMAINING)) - 1) & WORD_MASK);
  h.write(h.abs(TEXT_BITS_REMAINING), remaining);
  const reloaded = Boolean(ctx.status & FLAG_NEGATIVE);
  if (reloaded) {
    a.pushWord(ctx.a, 'AF04-PHA');
    h.load(TEXT_REFILL_LAST_BIT);
    h.write(h.abs(TEXT_BITS_REMAINING), ctx.a);
    const pointer = h.dp(TEXT_SOURCE_POINTER) | (h.dp(TEXT_SOURCE_BANK, 1) << WORD_BITS);
    h.load(h.read(pointer));
    h.xba();
    h.write(h.abs(TEXT_BIT_BUFFER), ctx.a);
    h.dpWrite(TEXT_SOURCE_POINTER, h.nz((h.dp(TEXT_SOURCE_POINTER) + 1) & WORD_MASK));
    h.dpWrite(TEXT_SOURCE_POINTER, h.nz((h.dp(TEXT_SOURCE_POINTER) + 1) & WORD_MASK));
    h.load(a.pullWord('AF04-PLA-fresh'));
  }
  const old = h.read(h.abs(TEXT_BIT_BUFFER)),
    shifted = (old << 1) & WORD_MASK;
  ctx.status = (ctx.status & ~FLAG_CARRY) | (old >>> (WORD_BITS - 1));
  h.write(h.abs(TEXT_BIT_BUFFER), h.nz(shifted));
  return { ...h.finish(outerReturn), outcome: 'bit_read', reloaded };
}

export function runTaskTextGeometry(a, kind, outerReturn = true) {
  if (!['ADBA', 'AE14', 'AE4D'].includes(kind)) taskStop('task_text_entry_required');
  const h = access(a),
    { ctx } = h;
  let adjusted = false,
    newlineReset = false,
    noopCalled = false;
  h.selectBank();
  ctx.status |= FLAG_CARRY;
  h.load(h.read(WRAM + WINDOW_CURSOR_TILE + ctx.x));
  h.arithmetic(h.read(WRAM + WINDOW_TILE_START + ctx.x), true);
  const dividendPc = kind === 'ADBA' ? 0x81adc9 : kind === 'AE14' ? 0x81ae23 : 0x81ae5c;
  a.absoluteWrite(WRDIVL, ctx.a, 2, dividendPc, 'text-dividend');
  if (kind === 'AE14') {
    h.load(h.read(WRAM + WINDOW_COLUMNS + ctx.x));
    h.load((ctx.a - 1) & WORD_MASK);
    h.load((ctx.a - 1) & WORD_MASK);
    ctx.status |= FLAG_MEMORY_8BIT;
    a.absoluteWrite(WRDIVB, ctx.a & BYTE_MASK, 1, 0x81ae2e, 'AE14-divisor');
    ctx.status &= ~FLAG_MEMORY_8BIT;
    for (let n = 0; n < TEXT_TILE_PIXEL_SHIFT; n++) h.asl();
    h.dpWrite(DP_LINE_WIDTH, ctx.a);
    h.load(a.absoluteRead(RDMPYL, 2, 0x81ae39, 'AE14-remainder'));
    for (let n = 0; n < TEXT_TILE_PIXEL_SHIFT; n++) h.asl();
    h.arithmetic(h.read(WRAM + WINDOW_CURSOR_PIXEL + ctx.x));
    h.dpWrite(DP_LINE_POSITION, ctx.a);
    ctx.status |= FLAG_CARRY;
    h.load(h.dp(DP_LINE_WIDTH));
    h.arithmetic(h.dp(DP_LINE_POSITION), true);
  } else {
    ctx.status |= FLAG_MEMORY_8BIT;
    h.load(h.read(WRAM + WINDOW_COLUMNS + ctx.x));
    h.load((ctx.a - 1) & BYTE_MASK);
    h.load((ctx.a - 1) & BYTE_MASK);
    a.absoluteWrite(
      WRDIVB,
      ctx.a & BYTE_MASK,
      1,
      kind === 'ADBA' ? 0x81add4 : 0x81ae67,
      'text-byte-divisor',
    );
    if (kind === 'ADBA') {
      ctx.status &= ~FLAG_MEMORY_8BIT;
      h.xba();
      h.xba();
      h.load(a.absoluteRead(RDMPYL, 2, 0x81addd, 'ADBA-remainder'));
      for (let n = 0; n < TEXT_TILE_PIXEL_SHIFT; n++) h.asl();
      h.arithmetic(h.read(WRAM + WINDOW_CURSOR_PIXEL + ctx.x));
      ctx.status |= FLAG_CARRY;
      h.arithmetic(h.read(WRAM + WINDOW_LEFT_PIXEL + ctx.x), true);
      if (!(ctx.status & FLAG_CARRY)) {
        adjusted = true;
        h.load(ctx.a ^ WORD_MASK);
        h.load((ctx.a + 1) & WORD_MASK);
        a.pushWord(ctx.a, 'ADBA-PHA');
        h.load(ctx.a & TEXT_PIXEL_MASK);
        h.arithmetic(h.read(WRAM + WINDOW_CURSOR_PIXEL + ctx.x));
        h.compare(ctx.a, TEXT_TILE_PIXELS);
        h.load(ctx.a & TEXT_PIXEL_MASK);
        h.write(WRAM + WINDOW_CURSOR_PIXEL + ctx.x, ctx.a);
        h.load(a.pullWord('ADBA-PLA-fresh'));
        h.pushByte(ctx.status, 'ADBA-PHP');
        for (let n = 0; n < TEXT_TILE_PIXEL_SHIFT; n++) h.lsr();
        ctx.status = h.pullByte('ADBA-PLP-fresh');
        if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT))
          taskStop('task_text_word_mode_required');
        h.arithmetic(h.read(WRAM + WINDOW_CURSOR_TILE + ctx.x));
        h.write(WRAM + WINDOW_CURSOR_TILE + ctx.x, ctx.a);
      }
    } else {
      ctx.status |= FLAG_CARRY;
      h.load(h.read(WRAM + WINDOW_ROWS + ctx.x));
      h.arithmetic(NEWLINE_RESERVED_ROWS, true);
      h.compare(ctx.a & BYTE_MASK, a.absoluteRead(RDDIVL, 1, 0x81ae73, 'AE4D-first-quotient'));
      newlineReset = !(ctx.status & FLAG_CARRY);
      if (newlineReset) a.absoluteWrite(WRMPYA, 0, 1, 0x81ae78, 'AE4D-reset-factor');
      else {
        h.load(a.absoluteRead(RDDIVL, 1, 0x81ae7d, 'AE4D-second-quotient-fresh'));
        h.load((ctx.a + 1) & BYTE_MASK);
        a.absoluteWrite(WRMPYA, ctx.a & BYTE_MASK, 1, 0x81ae81, 'AE4D-row-factor');
      }
      h.load(h.read(WRAM + WINDOW_COLUMNS + ctx.x));
      h.load((ctx.a - 1) & BYTE_MASK);
      h.load((ctx.a - 1) & BYTE_MASK);
      a.absoluteWrite(WRMPYB, ctx.a & BYTE_MASK, 1, 0x81ae8a, 'AE4D-column-factor');
      ctx.status &= ~FLAG_MEMORY_8BIT;
      ctx.status &= ~FLAG_CARRY;
      h.load(h.read(WRAM + WINDOW_TILE_START + ctx.x));
      h.arithmetic(a.absoluteRead(RDMPYL, 2, 0x81ae94, 'AE4D-product'));
      h.write(WRAM + WINDOW_CURSOR_TILE + ctx.x, ctx.a);
      a.pushWord(ctx.a, 'AE4D-PHA');
      h.load(0);
      h.write(WRAM + WINDOW_CURSOR_PIXEL + ctx.x, ctx.a);
      h.load(a.pullWord('AE4D-PLA-fresh'));
      h.compare(ctx.a, h.read(WRAM + WINDOW_TILE_INITIAL + ctx.x));
      if (ctx.status & FLAG_ZERO) {
        noopCalled = true;
        const callerBank = ctx.programBank;
        h.pushByte(callerBank, 'AE4D-JSL-bank');
        a.pushWord(AE4D_NOOP_RETURN_WORD, 'AE4D-JSL-WORD');
        const raw = a.pullWord('AE4C-RTL-WORD-fresh'),
          bank = h.pullByte('AE4C-RTL-bank-fresh');
        if (raw !== AE4D_NOOP_RETURN_WORD || bank !== callerBank)
          taskStop('task_native_helper_return_required', { raw, bank });
      }
    }
  }
  h.restoreBank();
  return {
    ...h.finish(outerReturn),
    outcome: 'text_geometry_prepared',
    helper: kind,
    adjusted,
    newlineReset,
    noopCalled,
  };
}

// 81:AEC8: close the text mask at the current pixel offset and store the buffer length.
export function closeTextMask(a, outerReturn = true) {
  const h = access(a),
    { ctx } = h;
  let visits = 0;
  h.load(h.dp(TEXT_PENDING_BYTES));
  ctx.x = h.nz(h.dp(TEXT_PIXEL_OFFSET));
  if (ctx.x !== 0) {
    ctx.status &= ~FLAG_CARRY;
    h.arithmetic(TEXT_MASK_BYTES);
    h.dpWrite(TEXT_PENDING_BYTES, ctx.a);
    ctx.y = h.nz(ctx.a);
    h.load(ctx.x);
    h.asl();
    ctx.x = h.nz(ctx.a);
    h.load(h.read(0x81ac8d + ctx.x));
    h.dpWrite(TEXT_WORK_WORD, ctx.a);
    ctx.x = h.nz(TEXT_MASK_WORDS);
    do {
      h.load(h.read(h.abs(TEXT_MASK_BUFFER - 2) + ctx.y));
      h.load(ctx.a | h.dp(TEXT_WORK_WORD));
      h.write(h.abs(TEXT_MASK_BUFFER - 2) + ctx.y, ctx.a);
      visits++;
      ctx.y = h.nz((ctx.y - 1) & WORD_MASK);
      ctx.y = h.nz((ctx.y - 1) & WORD_MASK);
      ctx.x = h.nz((ctx.x - 1) & WORD_MASK);
    } while (ctx.x !== 0);
    h.load(h.dp(TEXT_PENDING_BYTES));
  }
  h.write(h.abs(TEXT_BUFFER_BYTES), ctx.a);
  return { ...h.finish(outerReturn), outcome: 'text_mask_prepared', visits };
}

export function runTaskTextWait(a, name, observations, outerReturn = true) {
  const h = access(a),
    { ctx } = h;
  if (!['AEF4', 'AEFC', 'ACC3', 'ACC9'].includes(name)) taskStop('task_text_entry_required');
  if (observations?.interruptEvents?.interrupts !== undefined) {
    const e = observations.interruptEvents,
      dh = dialogAccess(a);
    if (name === 'AEF4' || name === 'AEFC')
      return runInterruptRequestWait(dh, e, name === 'AEF4' ? 0x81aef4 : 0x81aefc);
    return runInterruptWordWait(dh, e, name === 'ACC3' ? 0x81acc3 : 0x81acc9);
  }
  const request = name === 'AEF4' || name === 'AEFC',
    first = name === 'AEF4' || name === 'ACC3',
    offset = first ? TEXT_BUFFER_UPLOAD : TEXT_BUFFER_READBACK,
    pc = first ? 0x81acc3 : 0x81acc9,
    returnWord = first ? AEF4_WAIT_RETURN_WORD : AEFC_WAIT_RETURN_WORD,
    callerBank = ctx.programBank;
  if (request) {
    h.write(h.abs(offset), h.nz((h.read(h.abs(offset)) + 1) & WORD_MASK));
    h.pushByte(callerBank, 'text-wait-JSL-bank');
    a.pushWord(returnWord, 'text-wait-JSL-WORD');
  }
  if (observations?.mode !== 'record-observations') taskStop('task_wait_mode_required');
  let polls = 0;
  const waitEvents = [];
  do {
    const address = h.abs(offset),
      o = observations.values?.[polls];
    if (!o || o.pc !== pc || o.address !== address || o.width !== 2)
      taskStop('task_wait_observation_required', {
        pc,
        address,
        width: 2,
        observationIndex: polls,
      });
    polls++;
    h.write(address, o.value);
    waitEvents.push(Object.freeze({ ...o }));
    h.load(h.read(address));
  } while (ctx.a !== 0);
  // At $01FC the NMI ($A9E1) has read 16 VRAM bytes to $2AE0 via DMA: one observation per word with
  // the same PC, stored at the original address $7E2AE0 (DMA target; above $1FFF there is no bank 0 mirror).
  let nmiWords = 0;
  if (!first)
    for (
      let offset = WRAM + TEXT_MASK_BUFFER;
      offset < WRAM + TEXT_MASK_BUFFER + TEXT_MASK_BYTES;
      offset += 2
    ) {
      const o = observations.values?.[polls + nmiWords];
      if (!o || o.pc !== pc || o.address !== offset || o.width !== 2)
        taskStop('task_wait_observation_required', {
          pc,
          address: offset,
          width: 2,
          observationIndex: polls + nmiWords,
        });
      nmiWords++;
      a.writeWord(offset, o.value);
      waitEvents.push(Object.freeze({ ...o }));
    }
  if (polls + nmiWords !== (observations.values?.length ?? 0))
    taskStop('task_wait_observation_unused', {
      observationIndex: polls + nmiWords,
    });
  if (request) {
    const raw = a.pullWord('text-wait-RTL-WORD-fresh'),
      bank = h.pullByte('text-wait-RTL-bank-fresh');
    if (raw !== returnWord || bank !== callerBank)
      taskStop('task_native_helper_return_required', { raw, bank });
  }
  return {
    ...h.finish(outerReturn),
    outcome: request ? 'request_wait_prepared' : 'wait_zero',
    polls,
    nmiWords,
    waitEvents: Object.freeze(waitEvents),
  };
}
