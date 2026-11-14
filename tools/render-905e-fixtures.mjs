import { createRenderData } from '../src/render/data.mjs';
export const fields905EEntry = { bank: 0x80, status: 0xC5, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1FFB, 0x1FFF],
  ioMode: 'record-requests', waitMode: 'record-observations', waitRead0140: [0x8001] };
export const fields905EBytes = [0x7E3D10,0x7E3D11,0x7E3D12,0x7E3D13,0x7E3F08,0x7E3F09];
export function fields905EWindows(bank = 0x80) {
  const base = (bank === 0x7F ? 0x7F : 0x7E) * 65536;
  return [[base + 0x140, base + 0x143], [base + 0x1562, base + 0x1563],
    ...fields905EBytes.map(address => [address, address]),
    ...([0x7E,0x7F].includes(bank) ? [[base + 0x2115, base + 0x2115],[base + 0x4300, base + 0x4306]] : [])];
}
// Explicit synthetic selector/gate/window/observation bytes, no initialized
// original936C transferbuffer, callback completion or scene evidence.
export function fields905EFixture({ bank = 0x80, selector = 0x80, value = 0xFFFF,
  initial = null, writeWindows = fields905EWindows(bank) } = {}) {
  const data = createRenderData({ writeWindows }), base = bank === 0x7F ? 0x7F0000 : 0x7E0000;
  for (const [offset, word] of [[0x1BA,selector],[0x1562,value],[0x140,initial]])
    if (word !== null) data.seed(base + offset, [word & 255,word >>> 8]);
  return data;
}
