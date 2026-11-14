import { HEX_RADIX } from '../../src/constants/bits.mjs';
import { isRenderData } from '../../src/render/data.mjs';

const SOURCE_F160_BYTES = 368;
const SOURCE_F140_BYTES = 48;

// Pinned original 95:F140-F2CF union, not initial WRAM or a device snapshot.
const union =
  'A0004A7DFF7F0018A000FA1CFF7F0500A0006516FF7F8000A00000441042000000000000000000000000000000000000FFFFFF80C0BFDFA0DFAFDFAFDFAFDFAFFFFFFF0000FFFF00FFFFFFFFFFFFFFFFDFAFDFAFDFAFDFAFDFAFDFAFDFAFDFAF00000000000000000000000000000001000000000000000000000000000000FF0000000000000000000000000000001F00010001000100010001000100010001FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF7FFF7FFF7FFF7FFF7FFF7FFF7FFF7FFF3FFF3FFF3FFF3FFF3FFF3FFF3FFF3FFF1FFF1FFF1FFF1FFF1FFF1FFF1FFF1FFF0FFF0FFF0FFF0FFF0FFF0FFF0FFF0FFF07FF07FF07FF07FF07FF07FF07FF07FF03FF03FF03FF03FF03FF03FF03FF03FF01FF01FF01FF01FF01FF01FF01FF01FF00FF00FF00FF00FF00FF00FF00FF000F1F0F1F0F1F0F1F0F1F0F1F0F1F0F1F0F170F170F170F170F170F170F170F170F130F130F130F130F130F130F130F130F110F110F110F110F110F110F110F110F100F100F100F100F100F100F100F1000000101000000000000000001010000';
const specs = [
  [0x95f160, SOURCE_F160_BYTES],
  [0x95f140, SOURCE_F140_BYTES],
];
export function seedOriginalAB2CData(data, asset) {
  if (
    !isRenderData(data) ||
    asset?.format !== 'shadowrun-e-render-ab2c-data-v1' ||
    asset.romSha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690' ||
    !Array.isArray(asset.sources) ||
    asset.sources.length !== 2 ||
    specs.some(([address, length], i) => {
      const w = asset.sources[i],
        start = (address - 0x95f140) * 2;
      return (
        w?.address !== address ||
        !Array.isArray(w.bytes) ||
        w.bytes.length !== length ||
        Array.from(w.bytes).some(
          (v, j) => v !== Number.parseInt(union.slice(start + j * 2, start + j * 2 + 2), HEX_RADIX),
        )
      );
    })
  )
    throw Error('Invalid original AB2C data');
  for (const w of asset.sources) data.seed(w.address, w.bytes);
}
