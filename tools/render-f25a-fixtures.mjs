import { createRenderData } from '../src/render/data.mjs';
import { modeEntry, modeFixture } from './render-f1fa-fixtures.mjs';
import { sampleFixture } from './render-f130-fixtures.mjs';
export const selectionEntry = { ...modeEntry, status: 0xC5, y: 0x1234 };
delete selectionEntry.x;

// Synthetic mode/sample directory with an optional second real F130 dataset.
// No original EF47 cache initialization, SPC boot or inferred APU reply.
export function selectionFixture({ modeLoader = null, directory = 0x908000, bank = 0x80,
  token = 0, mode = 6, writeWindows = null, ...options } = {}) {
  const data = modeFixture({ ...options, directory, bank, token, writeWindows });
  if (modeLoader !== null) {
    const pointer = modeLoader.blockPointer ?? 0x908300;
    const blocks = (modeLoader.blocks ?? [{ kind: 'raw', values: [0xAB] }]).map((block, n) =>
      block.kind === 'raw' ? { ...block, pointer: block.pointer ?? 0x928000 + n * 0x1000 } : block);
    const extra = sampleFixture({ ...modeLoader, blocks, bank, selector: 255 - mode,
      blockPointer: pointer, directory: 0x908200, token });
    const owner = bank === 0x7F ? 0x7F0000 : 0x7E0000;
    for (const [address, value] of extra.snapshot().bytes) {
      if (address >= 0x7E008C && address <= 0x7E008E || address === 0x7E0099
        || address >= owner + 0x1CE4 && address <= owner + 0x1CE7
        || [0x7E, 0x7F].includes(bank) && address === bank * 65536 + 0x2140) continue;
      data.seed(address, [value]);
    }
    data.seed(directory + 9, [255 - mode, pointer & 255, pointer >>> 8 & 255, pointer >>> 16, 255]);
  }
  return data;
}
// A zero mode must not require any pointer, list, cache or loader source.
export function selectionZeroFixture({ bank = 0x80, token = 0, writeWindows = null } = {}) {
  const owner = bank === 0x7F ? 0x7F0000 : 0x7E0000, base = bank * 65536;
  const data = createRenderData({ writeWindows: writeWindows ?? [[owner + 0x1CE4, owner + 0x1CE4],
    ...([0x7E, 0x7F].includes(bank) ? [[base + 0x2140, base + 0x2143]] : [])] });
  data.seed(base + 0x1CE4, [token]);
  if ([0x7E, 0x7F].includes(bank)) data.seed(base + 0x2140, [token]);
  return data;
}
