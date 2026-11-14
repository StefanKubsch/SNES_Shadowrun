import { createRenderData } from '../src/render/data.mjs';
export const pairEntry = { bank: 0x80, status: 0xE5, a: 0xAB34, x: 0xBEEF, y: 0x1234,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF],
  ioMode: 'record-requests', ioRead2140: [0x12] };
// Explicitly synthetic flag/buffer/token/register bytes, no initialized APU.
export function pairFixture({ bank = 0x80, flag = 1, buffer = 0x56, token = 0x12,
  poll = token, writeWindows = null } = {}) {
  const base = bank * 65536, owner = bank === 0x7F ? 0x7F0000 : 0x7E0000;
  const physical = bank === 0x7E || bank === 0x7F;
  const data = createRenderData({ writeWindows: writeWindows ?? [[owner + 0x1CE4, owner + 0x1CE7],
    ...(physical ? [[base + 0x2140, base + 0x2142]] : [])] });
  data.seed(base + 0x1CE4, [token]); data.seed(base + 0x1CE6, [flag, buffer]);
  if (physical) data.seed(base + 0x2140, [poll]); return data;
}
