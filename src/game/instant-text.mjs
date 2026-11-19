// Instant window text (quality-of-life option instantText, docs/INSTANT-TEXT.md).
// Each text row of a window or dialog requests a transfer from the game NMI
// handler 80:C152 and waits for it at 81:ACAF, ACBD, ACC3 or ACC9. The handler
// services all four requests in its callback 81:A9E1. The original needs one
// NMI per request because the DMA must run in VBlank; the port renders the
// picture only at the next real NMI, so the transfer can run at the wait
// itself. With the option on, a blocking text wait runs A9E1 at once and
// continues without a frame. Picture, audio, pad and the frame counter
// (RANDOM_STATE) do not advance; every other NMI service stays where it was.
// The service runs the lifted A9E1 job of src/game/game-nmi.mjs on game state only
// (user decision 2026-11-17): no CPU registers and no NMI stack frame are set up,
// since the job reads and writes only WRAM and the hardware port.
import { clearTextTiles } from './game-nmi.mjs';
import { BLOCKING_BRANCHES } from '../vm/frame-events.mjs';
import { NMI_CALLBACK, NMI_CALLBACK_BANK } from '../data/wram.mjs';
import { NMITIMEN_NMI_ENABLE } from '../constants/hardware-registers.mjs';
import { accessorPort } from '../system/hardware-port.mjs';
import { BANK_WRAP, WORD_BITS } from '../constants/bits.mjs';

// Back branches of the four text waits (src/vm/frame-events.mjs).
const TEXT_WAIT_BRANCHES = new Set([0x81acb2, 0x81acc0, 0x81acc6, 0x81accc]);
// The game NMI callback, which calls A9E1 (JSL at 80:C15F).
const GAME_NMI_CALLBACK = 0x80c152;

// Returns true when the text request was serviced and the wait needs no NMI.
// Called by the lag-free interrupt step before it would deliver an NMI.
export function serviceTextWait(frames, h, events, status, pc) {
  if (!TEXT_WAIT_BRANCHES.has(pc) || !BLOCKING_BRANCHES.get(pc)(status)) return false;
  if (frames.inNmi || !(frames.nmitimen & NMITIMEN_NMI_ENABLE)) return false;
  const { a } = h,
    callback = a.readWord(NMI_CALLBACK, BANK_WRAP) | (a.read(NMI_CALLBACK_BANK) << WORD_BITS);
  // Only the game handler calls A9E1; other handlers keep their real frames.
  if (callback !== GAME_NMI_CALLBACK) return false;
  // The transfer counts as VBlank access (Book I PDF 121: VRAM data only in
  // VBlank or forced blank); no picture is presented in between.
  frames.inNmi = true;
  try {
    clearTextTiles(a.mem.wram, accessorPort(a));
  } finally {
    frames.inNmi = false;
  }
  return true;
}
