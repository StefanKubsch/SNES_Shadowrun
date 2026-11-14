// Instant window text (quality-of-life option instantText, docs/INSTANT-TEXT.md).
// Each text row of a window or dialog requests a transfer from the game NMI
// handler 80:C152 and waits for it at 81:ACAF, ACBD, ACC3 or ACC9. The handler
// services all four requests in its callback 81:A9E1. The original needs one
// NMI per request because the DMA must run in VBlank; the port renders the
// picture only at the next real NMI, so the transfer can run at the wait
// itself. With the option on, a blocking text wait runs A9E1 at once and
// continues without a frame. Picture, audio, pad and the frame counter
// (RANDOM_STATE) do not advance; every other NMI service stays where it was.
import { clearTextTiles } from '../task/main-initialize.mjs';
import { BLOCKING_BRANCHES } from '../vm/frame-events.mjs';
import { NMI_CALLBACK, NMI_CALLBACK_BANK, NMI_STACK_TOP } from '../task/wram.mjs';
import { NMITIMEN_NMI_ENABLE } from '../constants/hardware-registers.mjs';
import {
  FLAG_DECIMAL,
  FLAG_INDEX_8BIT,
  FLAG_IRQ_DISABLE,
  FLAG_MEMORY_8BIT,
} from '../constants/cpu-flags.mjs';
import { BANK_WRAP, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

// Back branches of the four text waits (src/vm/frame-events.mjs).
const TEXT_WAIT_BRANCHES = new Set([0x81acb2, 0x81acc0, 0x81acc6, 0x81accc]);
// The game NMI callback and its long call of A9E1 (JSL at 80:C15F).
const GAME_NMI_CALLBACK = 0x80c152,
  TEXT_SERVICE = 0x81a9e1,
  TEXT_SERVICE_CALLER_BANK = 0x80,
  TEXT_SERVICE_RETURN_WORD = 0xc162;

// Returns true when the text request was serviced and the wait needs no NMI.
// Called by the lag-free interrupt step before it would deliver an NMI.
export function serviceTextWait(frames, h, events, status, pc) {
  if (!TEXT_WAIT_BRANCHES.has(pc) || !BLOCKING_BRANCHES.get(pc)(status)) return false;
  if (frames.inNmi || !(frames.nmitimen & NMITIMEN_NMI_ENABLE)) return false;
  const { a, ctx } = h,
    callback = a.readWord(NMI_CALLBACK, BANK_WRAP) | (a.read(NMI_CALLBACK_BANK) << WORD_BITS);
  // Only the game handler calls A9E1; other handlers keep their real frames.
  if (callback !== GAME_NMI_CALLBACK) return false;
  const saved = { ...ctx };
  // Register state as the handler has it at 80:C15F: native mode, 16-bit
  // registers, direct page and data bank 0, NMI stack.
  ctx.status =
    (ctx.status | FLAG_IRQ_DISABLE) & ~(FLAG_DECIMAL | FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
  ctx.d = 0;
  ctx.bank = 0;
  ctx.s = NMI_STACK_TOP;
  h.pushByte(TEXT_SERVICE_CALLER_BANK);
  a.pushWord(TEXT_SERVICE_RETURN_WORD);
  ctx.programBank = TEXT_SERVICE >>> WORD_BITS;
  ctx.pc = TEXT_SERVICE & WORD_MASK;
  // The transfer counts as VBlank access (Book I PDF 121: VRAM data only in
  // VBlank or forced blank); no picture is presented in between.
  frames.inNmi = true;
  try {
    clearTextTiles(h, events);
  } finally {
    frames.inNmi = false;
    Object.assign(ctx, saved);
  }
  return true;
}
