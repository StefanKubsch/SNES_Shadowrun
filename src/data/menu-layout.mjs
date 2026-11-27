import { languageTextWidth } from './language.mjs';
import { DP_WINDOW_LEFT, DP_WINDOW_TOP, DP_WINDOW_COLUMNS, DP_WINDOW_ROWS } from './wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';

const TILE_PIXELS = 8,
  BORDER_COLUMNS = 2,
  MAX_COLUMNS = 30;
// Menu rows cannot wrap: each entry has one separately positioned line.
// Preserve the right edge while fitting translated labels and value columns.
export function translatedListWindow(memory, shape, ids, { column = 1, valueColumns = 0 } = {}) {
  let widest = 0;
  for (const id of ids) widest = Math.max(widest, languageTextWidth(memory, id) ?? 0);
  const columns = Math.min(
    MAX_COLUMNS,
    Math.max(
      shape.columns,
      Math.ceil((widest + 1) / TILE_PIXELS) + BORDER_COLUMNS + column + valueColumns,
    ),
  );
  return { ...shape, columns, left: Math.max(1, shape.left + shape.columns - columns) };
}

// Read an original zero-terminated text list, or a fixed-size table.
export function listTextIds(memory, pointer, count) {
  const ids = [];
  for (let row = 0; row < count; row++) {
    const id = memory.read16(pointer + 2 * row);
    if (!id) break;
    ids.push(id);
  }
  return ids;
}

// Fit before F963 allocates tiles: changing only the frame afterwards would
// leave the cursor stride, tile allocation and DMA length inconsistent. The window
// shape lies in the direct page words of its callers (D = 0), read and written as words
// in WRAM (user decision 2026-11-17: no register widths; the register-level form for
// register-level callers is in tools/register-forms/menu-layout-registers.mjs).
const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
export function fitListWindow(memory, ids, options) {
  if (!memory?.language) return;
  const { wram } = memory,
    shape = translatedListWindow(
      memory,
      {
        left: word(wram, DP_WINDOW_LEFT),
        top: word(wram, DP_WINDOW_TOP),
        columns: word(wram, DP_WINDOW_COLUMNS),
        rows: word(wram, DP_WINDOW_ROWS),
      },
      ids,
      options,
    );
  setWord(wram, DP_WINDOW_LEFT, shape.left);
  setWord(wram, DP_WINDOW_COLUMNS, shape.columns);
}
