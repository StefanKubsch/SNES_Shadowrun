import { createRenderData } from '../src/render/data.mjs';
export const panEntry = { bank: 0x80, status: 0xC5, a: 0x40, y: 0xBEEF, emulation: 0,
  directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests', ioRead4217: [17, 34] };
export const panWord = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
// Explicit synthetic slot/camera operands only; no original scene or device.
export function panFixture({ index = 0xFFFF, bank = 0x80, position = 0, other = 0, scroll = 0,
  writeWindows = [] } = {}) {
  const data = createRenderData({ writeWindows }); panWord(data, 0, index);
  if (index < 0x8000) for (const [offset, value] of [[0x0E80 + index, position], [0x0E28 + index, other], [0x0CC4, scroll]])
    panWord(data, bank * 65536 + offset, value);
  return data;
}
