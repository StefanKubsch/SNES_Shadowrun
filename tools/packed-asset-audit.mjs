// Read-only inventory of packed source slots and native word-read margins.
// Usage: node tools/packed-asset-audit.mjs > .cache/logs/packed-asset-audit.json
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadCartridge } from '../src/data/cartridge.mjs';
import { lzBits, lzDecode, lzEncode } from '../src/data/lz.mjs';
import { label, requireRomAddress, romOffset } from '../src/data/rom-bytes.mjs';
import { STREAM_BYTES } from '../src/data/tiles.mjs';
import { BYTE_BITS, WORD_BITS, WORD_MASK, HEX_RADIX } from '../src/constants/bits.mjs';

const LENGTH_BYTES = 2;
const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url));
const json = (name) => JSON.parse(read(name));

// The native bit helper fetches whole words, even when the last bit lies in
// their first byte. Token output can also overshoot the requested length.
export function packedTokenMetrics(tokens, bitsFor) {
  let output = 0,
    literals = 0,
    bits = 0;
  const gammaBits = (value) => 2 * Math.floor(Math.log2(value)) + 1;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.length === 1) {
      if (i > 0) bits++;
      literals += token[0];
      output += token[0];
      bits += gammaBits(token[0]);
    } else {
      if (i > 0 && tokens[i - 1].length === 2) bits++;
      bits += bitsFor(output) + gammaBits(token[1] - 2);
      output += token[1];
    }
  }
  const bitStart = LENGTH_BYTES + literals;
  return {
    token_output_bytes: output,
    literal_bytes: literals,
    bit_count: bits,
    encoded_bytes: bitStart + Math.ceil(bits / BYTE_BITS),
    native_read_bytes: bitStart + LENGTH_BYTES * Math.ceil(bits / WORD_BITS),
  };
}

export async function auditPackedAssets() {
  const tiles = json('assets/vm-tiles.json');
  const streams = json('assets/vm-lz.json');
  const map = json('analysis/vm-rom-map.json');
  const manifest = json('assets/vm-cartridge.json');
  if ([tiles, streams, manifest].some((file) => file.source_rom_sha256 !== map.rom_sha256))
    throw new Error('Packed audit inputs must belong to the same European ROM');
  const { rom, present } = await loadCartridge(
    async (name) => new Uint8Array(read(`assets/${name}`)),
  );
  const read8 = (cpu) => {
    const offset = romOffset(cpu);
    if (!present[offset]) throw new Error(`Missing packed source byte at ${label(cpu)}`);
    return rom[offset];
  };
  const bitsFor = lzBits((n) => read8(0x80a033 + n));
  const classes = new Array(rom.length);
  for (const range of map.ranges) {
    const start = parseInt(range.rom_offset, HEX_RADIX);
    classes.fill(range.class, start, start + range.length);
  }
  const rows = [];
  const inspect = (asset, entry, index, headerBytes, length) => {
    const cpu = requireRomAddress(entry.address, 'packed_audit_address_required');
    const start = cpu + headerBytes;
    const found = lzDecode((n) => read8(start + n), length, bitsFor);
    const tokens = entry.tokens.split(' ').map((token) => token.split(':').map(Number));
    const metrics = packedTokenMetrics(tokens, bitsFor);
    const encoded = lzEncode(found.data, tokens, bitsFor);
    if (
      encoded.length !== found.byteLength ||
      encoded.length !== metrics.encoded_bytes ||
      encoded.some((value, n) => value !== read8(start + n)) ||
      JSON.stringify(tokens) !== JSON.stringify(found.tokens)
    )
      throw new Error(`Packed source reconstruction differs at ${entry.address}`);
    const end = start + encoded.length;
    if ((end - 1) >>> WORD_BITS !== cpu >>> WORD_BITS)
      throw new Error(`Packed source crosses a bank at ${entry.address}`);
    const margin = metrics.native_read_bytes - metrics.encoded_bytes;
    rows.push({
      asset,
      index,
      address: entry.address,
      format: entry.format ?? 'room4',
      header_bytes: headerBytes,
      output_bytes: length,
      ...metrics,
      packed_slot_bytes: headerBytes + encoded.length,
      end_exclusive: label(end),
      next_class: (end & WORD_MASK) === 0 ? 'bank_end' : classes[romOffset(end)],
      word_read_margin_bytes: margin,
      word_read_margin_address: margin ? label(end) : null,
      word_read_margin_present: margin ? Boolean(present[romOffset(end)]) : null,
      output_overshoot_bytes: metrics.token_output_bytes - length,
    });
  };
  tiles.streams.forEach((entry, index) => inspect('vm-tiles.json', entry, index, 0, STREAM_BYTES));
  streams.streams.forEach((entry, index) => {
    const cpu = requireRomAddress(entry.address, 'packed_audit_address_required');
    inspect('vm-lz.json', entry, index, LENGTH_BYTES, read8(cpu) | (read8(cpu + 1) << BYTE_BITS));
  });
  const sorted = [...rows].sort(
    (a, b) => romOffset(requireRomAddress(a.address)) - romOffset(requireRomAddress(b.address)),
  );
  const byAddress = new Map(rows.map((row) => [row.address, row]));
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    const end = romOffset(requireRomAddress(row.address)) + row.packed_slot_bytes;
    const next = sorted[i + 1];
    if (next && end > romOffset(requireRomAddress(next.address)))
      throw new Error(`Packed source slots overlap at ${row.address}`);
    row.adjacent_stream = byAddress.has(row.end_exclusive) ? row.end_exclusive : null;
  }
  const formats = {};
  for (const row of rows) {
    const total = (formats[row.format] ??= {
      streams: 0,
      packed_bytes: 0,
      output_bytes: 0,
      word_read_margins: 0,
      output_overshoots: 0,
    });
    total.streams++;
    total.packed_bytes += row.packed_slot_bytes;
    total.output_bytes += row.output_bytes;
    total.word_read_margins += row.word_read_margin_bytes;
    total.output_overshoots += Number(row.output_overshoot_bytes > 0);
  }
  return {
    source_rom_sha256: map.rom_sha256,
    scope:
      'Current decoded European assets, reconstructed without opening a ROM. Slot budgets are existing encoded spans; neighboring bytes and word-read margins are not free space.',
    room_streams: tiles.streams.length,
    length_prefixed_streams: streams.streams.length,
    formats,
    adjacent_streams: rows.filter((row) => row.adjacent_stream).length,
    missing_word_read_margins: rows.filter(
      (row) => row.word_read_margin_bytes && !row.word_read_margin_present,
    ).length,
    streams: rows,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await auditPackedAssets(), null, 2));
