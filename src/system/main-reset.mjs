import { taskStop } from './task-stop.mjs';

import { dialogAccess } from './native-dialog-support.mjs';

import { MAIN_STARTUP_ENTRY } from './main-startup.mjs';

import {
  INIDISP,
  OBJSEL,
  BGMODE,
  BG34NBA,
  BG1HOFS,
  VMAINC,
  M7SEL,
  M7A,
  M7B,
  M7C,
  M7D,
  M7X,
  M7Y,
  CGADD,
  W12SEL,
  CGSWSEL,
  CGADSUB,
  COLDATA,
  SETINI,
  APUIO0,
  APUIO1,
  APUIO2,
  APUIO3,
  NMITIMEN,
  WRIO,
  MDMAEN,
  HDMAEN,
  MEMSEL,
} from '../constants/hardware-registers.mjs';

import {
  INIDISP_FORCED_BLANK,
  COLDATA_RED,
  COLDATA_GREEN,
  COLDATA_BLUE,
} from '../constants/ppu.mjs';

import { BYTE_BITS, WORD_BITS, BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';

import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_IRQ_DISABLE,
  FLAG_CARRY,
  FLAG_DECIMAL,
  FLAG_NEGATIVE,
} from '../constants/cpu-flags.mjs';

import { CODE_BANK, CODE_BANK_PAIR } from '../constants/memory-map.mjs';

// Reset entries: the power-on reset E382 runs in bank 00 or 80 (the 16-bit
// offset is compared), the software reset 80:9E3D. The reset code sets the
// stack to $013F; the emulation mode stack lives in page 1.
// Register resets 80:E3FA and 81:EE4F: all WRIO outputs high, COLDATA 0 on all three
// components, colour math prevented everywhere (CGWSEL bits 4-5 = 3,
// src/video/ppu-frame.mjs) and FastROM.
export const WRIO_ALL_HIGH = 0xff,
  CGSWSEL_MATH_PREVENTED = 0x30,
  MEMSEL_FAST_ROM = 1;
const RESET_ENTRY = 0xe382,
  RESET_STACK = 0x013f;

// Index widths the reset entry requires (SEP #$30 state of the E1 entry).
const BOTH_8BIT = FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT;

// Fixed original reset code. The initial E1 registers/memory are supplied,
// not manufactured. Stores remain hardware requests. No CPU is decoded.
// Instruction addresses are written for bank 80; the store uses the 16-bit
// offset with the actual program bank.
export function runMainReset(a) {
  const { ctx } = a;
  if (
    ctx.e !== 1 ||
    ctx.d !== 0 ||
    ![0, CODE_BANK].includes(ctx.programBank) ||
    ctx.pc !== RESET_ENTRY ||
    ![0, CODE_BANK].includes(ctx.bank) ||
    (ctx.status & BOTH_8BIT) !== BOTH_8BIT ||
    ctx.s >>> BYTE_BITS !== 1 ||
    ctx.x > BYTE_MASK ||
    ctx.y > BYTE_MASK
  )
    taskStop('main_reset_entry_required');
  const h = dialogAccess(a),
    pb = ctx.programBank << WORD_BITS,
    write = (offset, value, pc) => h.portWrite(offset, value, 1, pb | (pc & WORD_MASK));
  ctx.status |= FLAG_IRQ_DISABLE;
  for (const [offset, pc] of [
    [NMITIMEN, 0x80e383],
    [HDMAEN, 0x80e386],
    [MDMAEN, 0x80e389],
    [APUIO0, 0x80e38c],
    [APUIO1, 0x80e38f],
    [APUIO2, 0x80e392],
    [APUIO3, 0x80e395],
  ])
    write(offset, 0, pc);
  h.load(INIDISP_FORCED_BLANK);
  write(INIDISP, ctx.a & BYTE_MASK, 0x80e39a);
  ctx.status &= ~FLAG_CARRY;
  // CLC/XCE: exchange the actual E1 with C0; widths stay BYTE until REP30.
  ctx.e = 0;
  ctx.status |= FLAG_CARRY;
  ctx.status &= ~FLAG_DECIMAL;
  h.push(CODE_BANK_PAIR, 2);
  h.plb();
  h.plb();
  // OBJSEL, OAMADDL/H and VMAINC, VMADDL/H.
  h.index('x', 2);
  do {
    write(OBJSEL + ctx.x, 0, 0x80e3a7);
    write(VMAINC + ctx.x, 0, 0x80e3aa);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  // BGMODE to BG34NBA, and both writes of the scroll registers BG1HOFS to BG4VOFS.
  h.index('x', BG34NBA - BGMODE);
  do {
    write(BGMODE + ctx.x, 0, 0x80e3b2);
    write(BG1HOFS + ctx.x, 0, 0x80e3b5);
    write(BG1HOFS + ctx.x, 0, 0x80e3b8);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  write(M7SEL, 0, 0x80e3be);
  write(CGADD, 0, 0x80e3c1);
  h.load(1);
  // Mode 7 matrix: A and D = 1.0 (high byte 1), B, C, X and Y = 0.
  for (const [offset, value, pc] of [
    [M7A, 0, 0x80e3c6],
    [M7A, 1, 0x80e3c9],
    [M7B, 0, 0x80e3cc],
    [M7B, 0, 0x80e3cf],
    [M7C, 0, 0x80e3d2],
    [M7C, 0, 0x80e3d5],
    [M7D, 0, 0x80e3d8],
    [M7D, 1, 0x80e3db],
    [M7X, 0, 0x80e3de],
    [M7X, 0, 0x80e3e1],
    [M7Y, 0, 0x80e3e4],
    [M7Y, 0, 0x80e3e7],
    [SETINI, 0, 0x80e3ea],
  ])
    write(offset, value, pc);
  // W12SEL to CGADSUB, and NMITIMEN to the same offset ($4200-$420E).
  h.index('x', CGADSUB - W12SEL);
  do {
    write(W12SEL + ctx.x, 0, 0x80e3ef);
    write(NMITIMEN + ctx.x, 0, 0x80e3f2);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  for (const [value, offset, pc] of [
    [WRIO_ALL_HIGH, WRIO, 0x80e3fa],
    [COLDATA_RED | COLDATA_GREEN | COLDATA_BLUE, COLDATA, 0x80e3ff],
    [CGSWSEL_MATH_PREVENTED, CGSWSEL, 0x80e404],
  ]) {
    h.load(value);
    write(offset, ctx.a & BYTE_MASK, pc);
  }
  h.rep(BOTH_8BIT);
  h.load(0);
  ctx.d = ctx.a;
  h.nz(ctx.d, 2);
  h.load(RESET_STACK);
  ctx.s = ctx.a;
  h.load(MEMSEL_FAST_ROM);
  h.portWrite(MEMSEL, ctx.a, 2, pb | (0x80e414 & WORD_MASK));
  ctx.programBank = CODE_BANK;
  ctx.pc = MAIN_STARTUP_ENTRY;
  return ctx.pc;
}
