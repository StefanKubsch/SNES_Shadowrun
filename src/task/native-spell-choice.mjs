import { WORD_SIGN } from '../constants/bits.mjs';

// E1CF: window 0E/05/10/07 (kept in DP0E) and a menu of five visible rows; the list loop
// stops the port after 8000 entries (no original bound).
export const SPELL_WINDOW = Object.freeze({
    left: 0x0e,
    top: 5,
    columns: 0x10,
    rows: 7,
    visibleRows: 5,
  }),
  DP_SPELL_WINDOW = 0x0e,
  LIST_ENTRY_LIMIT = WORD_SIGN;
