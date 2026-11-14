import { createRenderData } from '../src/render/data.mjs';
export const setup8FF5Entry = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1FFE, 0x1FFF],
  ioMode: 'record-requests', waitMode: 'record-observations', waitRead0140: [0x1234, 0, 0x8001] };

// Synthetic writable metadata/observation bytes only. No ROM transferbuffer,
// original936C initialization, callback execution or real DMA completion.
export function setup8FF5Fixture({ bank = 0x80, writeWindows = null, initial = null } = {}) {
  const base = (bank === 0x7F ? 0x7F : 0x7E) * 65536;
  const data = createRenderData({ writeWindows: writeWindows ?? [[base + 0x140, base + 0x141],
    ...([0x7E, 0x7F].includes(bank) ? [[base + 0x2115, base + 0x2115], [base + 0x4300, base + 0x4306]] : [])] });
  if (initial !== null) data.seed(base + 0x140, [initial & 255, initial >>> 8]);
  return data;
}
