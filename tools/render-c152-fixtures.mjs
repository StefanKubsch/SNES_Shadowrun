import { createRenderData } from '../src/render/data.mjs';

// Explicit synthetic sources and write ownership, never original WRAM/frame
// initialization. Used by callback composition tests and reproducible probes.
export const callbackEntry = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests',
  ioRead213A: 0xA5, ioRead4212: [1, 0], ioRead4218: 0xA55A };

export function callbackFixture({ active = false, bank = 0x80, writeWindows = null, missing = [] } = {}) {
  const base = bank * 65536, owner = bank === 0x7F ? 0x7F0000 : 0x7E0000;
  const windows = active ? [[0x7E0082, 0x7E0083], [owner + 0x140, owner + 0x141], [owner + 0x1BC, owner + 0x1BC],
    [owner + 0x1C6, owner + 0x1C9], [owner + 0x1CA, owner + 0x1CB], [owner + 0x1E8, owner + 0x1E9],
    [owner + 0x1F6, owner + 0x1FD], [owner + 0x20A, owner + 0x20D], [owner + 0xCD0, owner + 0xCD1],
    [owner + 0xCD6, owner + 0xCD7], [owner + 0xD0E, owner + 0xD0F], [owner + 0x1562, owner + 0x1563],
    [owner + 0x1CDA, owner + 0x1CDB]] : [[owner + 0x1CA, owner + 0x1CB]];
  if (bank === 0x7E || bank === 0x7F) windows.push([base + 0x2000, base + 0x43FF]);
  const data = createRenderData({ writeWindows: writeWindows ?? windows }), seedBytes = new Map();
  const seed = (address, value, bytes = 2) => {
    seedBytes.set(address, value & 255); if (bytes === 2) seedBytes.set(address + 1, value >>> 8);
  };
  for (const [offset, value] of [[0xCD8, active ? 0 : 1], [0x1F6, active ? 1 : 0], [0x1F8, active ? 1 : 0],
    [0x1FA, active ? 1 : 0], [0x1FC, active ? 1 : 0], [0xD0E, active ? 1 : 0], [0x1CDA, active ? 0x1234 : 0],
    [0x1562, active ? 1 : 0], [0x140, active ? 0 : 0xFFFF], [0x1E8, active ? 0xFFFE : 0],
    [0x1D8, active ? 0x8000 : 0], [0x1C6, active ? 1 : 0]]) seed(base + offset, value);
  for (const [offset, value] of [[0x1D5, 0x12], [0x1BC, active ? 0x80 : 0x8F], [0x1BE, 4], [0x1C0, 1], [0x1C2, 2], [0x1C4, 0x80]]) seed(base + offset, value, 1);
  if (active) {
    for (const [offset, value] of [[0xCD0, 1], [0xCD6, 1], [0xCCC, 0x1000], [0xCCE, 0x1100],
      [0xCD2, 0x1200], [0xCD4, 0x1300], [0xCC4, 0x404], [0xCC6, 0x806], [0x20C, 0x1401],
      [0x20A, 0xFFF0], [0x210, 0x10], [0x20E, 0x7000], [0xD10, 1], [0xD00, 0],
      [0x1CDC, 2], [0x1CCA, 0x10], [0x17D4, 2], [0x17D6, 0], [0x16D4, 0x4500],
      [0x1754, 0x4000], [0x1C8, 1]]) seed(base + offset, value);
    for (const [offset, value] of [[0xD12, 0xAA], [0xD13, 0xBB], [0x1CC8, 0x91], [0x1654, 0x7E], [0x142, 0x91], [0x1D7, 0x34]]) seed(base + offset, value, 1);
    seed(0x82, 0); seed(0xF6, 0xFFFF); seed(0xF8, 0x8D, 1);
  }
  if (bank === 0x7E || bank === 0x7F) {
    seed(base + 0x4212, 0); seed(base + 0x4218, 0xA55A); if (active) seed(base + 0x213A, 0xA5, 1);
  }
  for (const [address, value] of seedBytes) if (!missing.includes(address)) data.seed(address, [value]);
  return data;
}
