import { createRenderData } from '../src/render/data.mjs';

export const cursorEntry = { bank: 0x80, status: 0xC5, y: 0xBEEF, emulation: 0,
  directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests', ioRead4216: [40] };
export const cursorWord = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
// Synthetic manual cursor parameters; no original scene or arithmetic device.
export function cursorFixture({ index = 2, row = 10, width = 6, position = 0x2000,
  delta = 3, writeWindows = [[0x7E20C0 + index, 0x7E20C1 + index],
    [0x7E20E0 + index, 0x7E20E1 + index]] } = {}) {
  const data = createRenderData({ writeWindows });
  cursorWord(data, 0, index); cursorWord(data, 2, delta); cursorWord(data, 4, row);
  cursorWord(data, 0x7E2020 + index, width); cursorWord(data, 0x7E2060 + index, position);
  return data;
}
