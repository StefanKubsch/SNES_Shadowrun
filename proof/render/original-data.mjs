import { BYTE_MASK, BYTE_VALUES } from '../../src/constants/bits.mjs';
import { createRenderData } from '../../src/render/data.mjs';

const BIT_LENGTH_TABLE_BYTES = BYTE_VALUES;
const SOURCE_80FF98_BYTES = 21;
const SOURCE_81FF40_BYTES = 63;

// Known ROM bytes only. Write authority and stack protection stay explicit;
// the source asset never hydrates or resets WRAM.
export function createOriginalRenderData(asset, options = {}) {
  const validBytes = (w, address, length) =>
    w?.address === address &&
    Array.isArray(w.bytes) &&
    w.bytes.length === length &&
    Array.from(w.bytes).every((v) => Number.isInteger(v) && v >= 0 && v <= BYTE_MASK);
  if (
    asset?.format !== 'shadowrun-e-render-unpack-data-v1' ||
    asset.romSha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690' ||
    !validBytes(asset.table, 0x80a033, BIT_LENGTH_TABLE_BYTES) ||
    !Array.isArray(asset.sources) ||
    asset.sources.length !== 2 ||
    !validBytes(asset.sources[0], 0x80ff98, SOURCE_80FF98_BYTES) ||
    !validBytes(asset.sources[1], 0x81ff40, SOURCE_81FF40_BYTES) ||
    asset.table.bytes.some((v, n) => v !== (n ? Math.floor(Math.log2(n)) + 1 : 0))
  )
    throw Error('Invalid original render data');
  const data = createRenderData(options);
  data.seed(asset.table.address, asset.table.bytes);
  for (const source of asset.sources) data.seed(source.address, source.bytes);
  return data;
}
