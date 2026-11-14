import { BYTE_MASK } from '../../src/constants/bits.mjs';
import { isRenderData } from '../../src/render/data.mjs';

const AF1F_TABLE_BYTES = 62;
const AF1F_POINTER_BYTES = [0xdc, 0x33];

export function seedOriginalAF1FData(data, asset) {
  const valid = (w, address, length) =>
    w?.address === address &&
    Array.isArray(w.bytes) &&
    w.bytes.length === length &&
    Array.from(w.bytes).every((v) => Number.isInteger(v) && v >= 0 && v <= BYTE_MASK);
  if (
    !isRenderData(data) ||
    asset?.format !== 'shadowrun-e-render-af1f-data-v1' ||
    asset.romSha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690' ||
    !valid(asset.pointer, 0x8db8d2, 2) ||
    !valid(asset.table, 0x81b026, AF1F_TABLE_BYTES) ||
    asset.pointer.bytes[0] !== AF1F_POINTER_BYTES[0] ||
    asset.pointer.bytes[1] !== AF1F_POINTER_BYTES[1]
  )
    throw Error('Invalid original AF1F data');
  data.seed(asset.pointer.address, asset.pointer.bytes);
  data.seed(asset.table.address, asset.table.bytes);
}
