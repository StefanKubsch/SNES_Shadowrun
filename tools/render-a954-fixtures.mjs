import { createRenderData } from '../src/render/data.mjs';
export const a954Entry = { bank: 0x80, status: 0xC5, a: 0x28, x: 0x800, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF] };

// Synthetic known1562 bytes and windows; no original905E/936C initialization,
// callback scheduling, gate ownership or game-frame observation.
export function a954Fixture({ bank = 0x80, value = 0xFFFF, writeWindows = null } = {}) {
  const address = bank === 0x7F ? 0x7F1562 : 0x7E1562;
  const data = createRenderData({ writeWindows: writeWindows ?? [[address, address + 1]] });
  if (value !== null) data.seed(address, [value & 255, value >>> 8]);
  return data;
}
