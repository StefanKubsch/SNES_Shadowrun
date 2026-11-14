import { createRenderData } from '../src/render/data.mjs';
export const rows8F20Entry = { bank: 0x80, status: 0xC5,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF] };
export const rows8F20Windows = Array.from({ length: 7 }, (_, row) =>
  [0x7F5450 + row * 512, 0x7F554F + row * 512]);
export const rows8F20Bytes = Uint8Array.from({ length: 1792 }, (_, n) =>
  ((n >>> 8) * 37 + (n & 255) * 13) & 255);

// Explicitly synthetic7F source bytes/windows, not original9F6D output or
// initialized936C dialog data. Missing bytes remain unavailable.
export function rows8F20Fixture({ missingSource = null, writeWindows = rows8F20Windows,
  sourceBytes = rows8F20Bytes } = {}) {
  const data = createRenderData({ writeWindows });
  if (missingSource === null) data.seed(0x7F5350, sourceBytes);
  else {
    const offset = missingSource - 0x7F5350;
    if (offset > 0) data.seed(0x7F5350, sourceBytes.slice(0, offset));
    if (offset < 1791) data.seed(missingSource + 1, sourceBytes.slice(offset + 1));
  }
  return data;
}
