import { createRenderData } from '../src/render/data.mjs';
export const fa92Entry = { bank: 0x80, status: 0xC5, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF] };

// Synthetic DP/dimension/write-window inputs, not an original initialized
// F963 buffer, successful allocation or a whole936C dialog execution.
export function fa92Fixture({ index = 2, first = 0x54, second = 0xFFF8,
  dimension = 0x1E, writeWindows = null } = {}) {
  const data = createRenderData({ writeWindows: writeWindows ??
    [[0x7E2100 + index, 0x7E2101 + index], [0x7E2120 + index, 0x7E2121 + index]] });
  for (const [address, value] of [[0, index], [2, first], [4, second], [0x7E2020 + index, dimension]])
    if (value !== null) data.seed(address, [value & 255, value >>> 8]);
  return data;
}
