import { WRAM, OAM_HIGH_TABLE } from '../data/wram.mjs';
import { WH0 } from '../constants/hardware-registers.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';
// Window and portrait setup of the dialog $936C. Each function starts at the original entry (frame from the
// caller via h.call) and ends with the original RTS/RTL. h comes from dialogAccess
// (tools/register-forms/native-dialog-support.mjs); events is the shared observation set of the native.

// Portrait windows of 8F3A/8F97 and of E433 (native-member-spell-menu.mjs): the W12SEL/W34SEL
// word and TMW layers, HDMA channel 0 in mode 1 to WH0/WH1 from bank 7E, and edges that move by
// three per frame for X = 2 up to 20 (8F97 from 1F down). 8EFE adds the biases to X (right
// edges) and to X EOR FF (left edges) of the left and the right window.
export const PORTRAIT_WINDOW = Object.freeze({
  select: 0x2222,
  layers: 0x0f,
  hdmaMode: 1,
  hdmaTarget: WH0 & BYTE_MASK,
  hdmaChannel: 1,
  edgeFirst: 2,
  edgeStep: 3,
  edgeEnd: 0x21,
  edgeLast: 0x1f,
  leftWindowRightBias: 0x39,
  leftWindowLeftBias: 0x3b,
  rightWindowRightBias: 0xc5,
  rightWindowLeftBias: 0xc7,
});
// A portrait: OBJSEL as a word (OAMADDL gets 0), the record pointer [F6] (byte 2 the bank),
// the unpack buffer 7F:5250 and the 1000-byte VRAM DMA of 8FF5 (address increment after the
// high byte, mode 1 to VMDATAL/VMDATAH).
export const PORTRAIT_OBJSEL = 0x40,
  DP_PORTRAIT_POINTER = 0xf6,
  DP_PORTRAIT_BANK = 0xf8,
  PORTRAIT_RECORD_BANK_BYTE = 2,
  PORTRAIT_BUFFER = 0x5250;
// CGRAM start of the second portrait palette and its VRAM word address.
export const SECOND_PORTRAIT_PALETTE = 0xa1,
  SECOND_PORTRAIT_VRAM = 0x800;
// 905E and E48D set the second portrait's HDMA words (905E adds the mirror bit of the\n// dialog flags as bit 14 of the second word) and its OAM high table byte.
export const SECOND_PORTRAIT_HDMA = Object.freeze({
  firstAddress: 0x7e3d10,
  first: 0x1a1a,
  secondAddress: 0x7e3d12,
  second: 0x3480,
  oamHighAddress: WRAM + OAM_HIGH_TABLE,
  oamHigh: 0x28,
});
// 886A clears the fixed colour: COLDATA red, green and blue planes (bits 5 to 7, ppu.mjs) at 0.
export const FIXED_COLOUR_BLACK = 0xe0;
// FA92: DP04 is the width in pixels; zero or negative is added to the column count minus 2.
export const DP_PIXEL_WIDTH = 4;
