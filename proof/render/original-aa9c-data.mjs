import { isRenderData } from '../../src/render/data.mjs';

// Pinned original record and palette bytes, without assigning further meanings.
const AA9C_RECORD_BYTES = [0x98, 0xff, 0x80, 0x3a, 0xff, 0x81, 0xc0];
const AA9C_PALETTE_BYTES = [0xd6, 0, 0x10, 0x42, 0, 0];

export function seedOriginalAA9CData(data, asset) {
  const valid = (w, address, expected) =>
    w?.address === address &&
    Array.isArray(w.bytes) &&
    w.bytes.length === expected.length &&
    Array.from(w.bytes).every((v, i) => v === expected[i]);
  if (
    !isRenderData(data) ||
    asset?.format !== 'shadowrun-e-render-aa9c-data-v1' ||
    asset.romSha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690' ||
    !valid(asset.record, 0x80ffad, AA9C_RECORD_BYTES) ||
    !valid(asset.palette, 0x81ff3a, AA9C_PALETTE_BYTES)
  )
    throw Error('Invalid original AA9C data');
  data.seed(asset.record.address, asset.record.bytes);
  data.seed(asset.palette.address, asset.palette.bytes);
}
