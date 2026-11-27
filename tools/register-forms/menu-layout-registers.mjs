// The list window fit of src/data/menu-layout.mjs in its register-level form for the
// register-level callers: the window shape through the accessor's direct page with the
// accumulator width (moved from src/data/menu-layout.mjs).
import { translatedListWindow } from '../../src/data/menu-layout.mjs';
import {
  DP_WINDOW_LEFT,
  DP_WINDOW_TOP,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
} from '../../src/data/wram.mjs';
import './dialog-register-helpers.mjs';

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
