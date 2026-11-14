import { languageTextWidth } from './language.mjs';
import { DP_WINDOW_LEFT, DP_WINDOW_TOP, DP_WINDOW_COLUMNS, DP_WINDOW_ROWS } from '../task/wram.mjs';

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
// leave the cursor stride, tile allocation and DMA length inconsistent.
export function fitListWindow(memory, h, ids, options) {
  if (!memory?.language) return;
  const shape = translatedListWindow(
    memory,
    {
      left: h.dp(DP_WINDOW_LEFT),
      top: h.dp(DP_WINDOW_TOP),
      columns: h.dp(DP_WINDOW_COLUMNS),
      rows: h.dp(DP_WINDOW_ROWS),
    },
    ids,
    options,
  );
  h.dpWrite(DP_WINDOW_LEFT, shape.left);
  h.dpWrite(DP_WINDOW_COLUMNS, shape.columns);
}
