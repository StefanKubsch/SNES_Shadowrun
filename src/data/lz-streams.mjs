// Packed streams of the unpacker $80:9F49/$80:9F4D/$80:9F6D (docs/ROM-FREE.md,
// step 2; packing in src/data/lz.mjs). On entry A is the source offset, Y the
// source bank and X the destination in bank 7E (9F6D: 7F); the stream starts
// with the output length as a word, the packed data follow (d = source + 2;
// src/task/native-unpack.mjs, native-dialog-portrait.mjs). The streams and the
// format of their output come from the probe over all live tests
// (analysis/rom-vram.json, tools/rom-vram-hook.mjs).
// Native form assets/vm-lz.json, per stream: address, format, the original
// packing (tokens as in assets/vm-tiles.json) and the output:
// - bg2, bg4, obj4: characters in the indexed BMP sheet of the format
//   (src/data/vram-tiles.mjs; each stream from a new row, in stream order),
// - map: BG tilemap words in hex, 32 per line,
// - scene: a scene record, its content in assets/vm-scenes.json
//   (src/data/scenes.mjs) under the same address,
// - text: lines of ASCII, each ended by 00; an empty line ends the text,
// - credits: groups of lines, each group a count byte and that many lines
//   ended by 00; a count of 0 ends the list,
// - states: records of 5 bytes, only those that differ from the default,
// - bytes: everything else in hex, 32 bytes per line.
// Scene records: $81:A117 takes source offset and bank of scene n from the
// table $8B:F9E3 + 3 n (word, bank byte) and unpacks the record to 7F:DA14
// (src/task/main-scene-load.mjs). The table has 165 entries: it ends where
// the stream 8B:FBD2 begins, entry 165 is no ROM pointer, and all 165
// records unpack. All records are streams of format scene here; the table is
// written from the addresses in assets/vm-scenes.json (scene n = entry n).
import { VmFault } from '../vm/memory.mjs';
import { lzBits, lzDecode, lzEncode } from './lz.mjs';
import { VRAM_FORMATS, planes, charactersToSheets, sheetsToCharacters } from './vram-tiles.mjs';
import { decodeScene, encodeScene } from './scenes.mjs';
import { STATE_BYTES } from './actors.mjs';
import { placedReader, romOffset, romWriter } from './rom-bytes.mjs';
import {
  WORD_MASK,
  BYTE_MASK,
  BYTE_BITS,
  BYTE_HEX_DIGITS,
  HEX_RADIX,
  WORD_BITS,
  WORD_HEX_DIGITS,
  LONG_BYTES,
} from '../constants/bits.mjs';
import { TILE_SIZE } from '../constants/ppu.mjs';
import { LOROM_OFFSET } from '../constants/memory-map.mjs';

export const SCENE_TABLE = 0x8bf9e3,
  SCENES = 165;

// Streams the live tests do not reach or do not see in VRAM, with their
// format from the routine that reads the output (FIXED_SOURCES):
// - 81:F5CE intro text into 7E:62A8 (81:DDFB); 81:DE93 draws one line per
//   call, centred over 32 columns, until a line starts with 00. Each
//   character c is the word at 7E:56A8 + 2 (c - 20) (masked with C0FF).
// - 81:F803 that character map into 7E:56A8 (81:DDEE), 128 words.
// - 81:F2BD the credits into 7E:62A8 (81:CE64); 81:D1F0 reads a count byte
//   and draws that many lines (81:D336 centres, 81:D351 draws through
//   7E:56A8), until the count is 0. The stream ends at 81:F48D, where the
//   table read by 81:CE2D begins.
// - 85:FD38 the character map of the credits into 7E:56A8 (81:CE57), 160 words.
// - 81:FF40 into 7E:23A0 (81:A9B2): a 32 by 29 tilemap; A9B2 adds 2017 to
//   each of its 928 words in place, the DMA at 81:AA28 sends 7E:23A0.
// - Matrix (81:C3CA, through 80:F2A4 = 9F6D into bank 7F): 89:EC1B (one
//   32 by 32 map) into 7F:0216, which 81:B4D3 sends to VRAM 2400, each word
//   converted by 81:B4B9; then 89:E14E (16 such maps) into 7F:0216, of which
//   map n = 7E:1D8F goes through B4D3 to VRAM 2000 (7F:0216 + 800 n); 89:EB4B
//   (one map of the same layout, reader not named yet) into 7F:8216. The
//   three lie back to back from the palette 89:E04E to the list 89:EC26.
// - 8B:FBD2 the new-game state into 7E:2E00 (80:98E9): 703 records of 5
//   bytes (format states). The code reaches a record through its full WRAM
//   address in X (the actor table 8D:B01F + 1 holds it, 80:A3B6;
//   7E:13A8 per object): byte 2 is a count (81:CECB, D079, 9DC8 adds or
//   takes ammunition and uses), word 3 the holder (FFFF none; 80:A3B6
//   creates an actor only while it is FFFF, 9CE4/9D15 set it, EA6E lists
//   the records of holder 1F5A). Bytes 0 and 1 are kept as the word state;
//   byte 0 is 00 in every record, their reader is not named yet.
export const FIXED_SOURCES = [
  [0x81f2bd, 'credits'],
  [0x81f5ce, 'text'],
  [0x81f803, 'map'],
  [0x81ff40, 'map'],
  [0x85fd38, 'map'],
  [0x89e14e, 'map'],
  [0x89eb4b, 'map'],
  [0x89ec1b, 'map'],
  [0x8bfbd2, 'states'],
];
// State record: state word, count byte, holder word.
const STATE_BASE = 0x7e2e00,
  STATE_DEFAULT = { state: '0000', count: 0, holder: 'FFFF' },
  STATE_COUNT = 2,
  STATE_HOLDER = 3;
// Lines per row of the readable forms.
const MAP_WORDS_PER_LINE = 32,
  BYTES_PER_LINE = 32;

// The record address of each scene (a long pointer per entry).
export function readSceneTable(read8) {
  return Array.from({ length: SCENES }, (_, n) => {
    const entry = SCENE_TABLE + LONG_BYTES * n;
    return (read8(entry + 2) << WORD_BITS) | read8(entry) | (read8(entry + 1) << BYTE_BITS);
  });
}

const hexBytes = (bytes) =>
  [...bytes].map((b) => b.toString(HEX_RADIX).toUpperCase().padStart(BYTE_HEX_DIGITS, '0'));
const printable = (line) => /^[ -~]*$/.test(line);
const lineBytes = (line) => [...line].map((c) => c.charCodeAt(0)).concat(0);

// Lines ended by 00 from position at; null if a byte is not printable.
function readLine(data, at) {
  let end = at;
  while (end < data.length && data[end]) end++;
  const line = String.fromCharCode(...data.slice(at, end));
  return end < data.length && printable(line) ? [line, end + 1] : null;
}
function decodeText(data, format, cpu) {
  const out = [];
  let at = 0;
  for (;;) {
    if (format === 'text') {
      if (!data[at]) break;
      const found = readLine(data, at);
      if (!found) break;
      out.push(found[0]);
      at = found[1];
    } else {
      const count = data[at++];
      if (!count) break;
      const group = [];
      for (let n = 0; n < count; n++) {
        const found = at < data.length && readLine(data, at);
        if (!found) throw new VmFault('lz_text_layout_required', cpu);
        group.push(found[0]);
        at = found[1];
      }
      out.push(group);
    }
  }
  if (format === 'text') at++;
  if (at !== data.length) throw new VmFault('lz_text_layout_required', cpu);
  return out;
}
function encodeText(items, format, cpu) {
  const lines = format === 'text' ? items : items.flat();
  if (
    !Array.isArray(items) ||
    lines.some((l) => typeof l !== 'string' || !printable(l)) ||
    (format === 'text' && items.some((l) => !l)) ||
    (format === 'credits' &&
      items.some((g) => !Array.isArray(g) || !g.length || g.length > BYTE_MASK))
  )
    throw new VmFault('lz_text_required', cpu);
  return Uint8Array.from(
    format === 'text'
      ? [...items.flatMap(lineBytes), 0]
      : [...items.flatMap((g) => [g.length, ...g.flatMap(lineBytes)]), 0],
  );
}

// The records as {base, count, default, records}: only records that differ
// from the default are listed, with their WRAM address.
function decodeStates(data, cpu) {
  if (data.length % STATE_BYTES) throw new VmFault('lz_states_length_required', cpu);
  const records = [];
  for (let n = 0; n < data.length / STATE_BYTES; n++) {
    const r = data.subarray(STATE_BYTES * n, STATE_BYTES * (n + 1));
    const record = {
      state: hex4(r[0] | (r[1] << BYTE_BITS)),
      count: r[STATE_COUNT],
      holder: hex4(r[STATE_HOLDER] | (r[STATE_HOLDER + 1] << BYTE_BITS)),
    };
    if (
      record.state !== STATE_DEFAULT.state ||
      record.count !== STATE_DEFAULT.count ||
      record.holder !== STATE_DEFAULT.holder
    )
      records.push({
        address: `7E:${hex4((STATE_BASE + STATE_BYTES * n) & WORD_MASK)}`,
        ...record,
      });
  }
  return { count: data.length / STATE_BYTES, records };
}
function encodeStates(states, cpu) {
  const n = states?.count;
  if (
    !Number.isInteger(n) ||
    n < 1 ||
    STATE_BYTES * n > WORD_MASK ||
    !Array.isArray(states.records)
  )
    throw new VmFault('lz_states_required', cpu);
  const data = new Uint8Array(STATE_BYTES * n),
    put = (k, { state, count, holder }) => {
      const s = parseInt(state, HEX_RADIX),
        h = parseInt(holder, HEX_RADIX);
      if (
        !/^[0-9A-F]{4}$/.test(state ?? '') ||
        !/^[0-9A-F]{4}$/.test(holder ?? '') ||
        !Number.isInteger(count) ||
        count < 0 ||
        count > BYTE_MASK
      )
        throw new VmFault('lz_states_required', cpu);
      data.set(
        [s & BYTE_MASK, s >> BYTE_BITS, count, h & BYTE_MASK, h >> BYTE_BITS],
        STATE_BYTES * k,
      );
    };
  for (let k = 0; k < n; k++) put(k, STATE_DEFAULT);
  for (const r of states.records) {
    const k =
      (parseInt((r.address ?? '').replace(/^7E:/, ''), HEX_RADIX) - (STATE_BASE & WORD_MASK)) /
      STATE_BYTES;
    if (!/^7E:[0-9A-F]{4}$/.test(r.address ?? '') || !Number.isInteger(k) || k < 0 || k >= n)
      throw new VmFault('lz_states_required', cpu);
    put(k, r);
  }
  return data;
}
const hex4 = (v) => v.toString(HEX_RADIX).toUpperCase().padStart(WORD_HEX_DIGITS, '0');

const lines = (items, per) =>
  Array.from({ length: Math.ceil(items.length / per) }, (_, i) =>
    items.slice(i * per, (i + 1) * per).join(' '),
  );

// From the ROM view (read8 at CPU addresses): one stream per [cpu, format].
export function readLzStreams(read8, sources) {
  const bitsFor = lzBits((n) => read8(0x80a033 + n));
  const streams = sources.map(([cpu, format]) => {
    const length = read8(cpu) | (read8(cpu + 1) << BYTE_BITS);
    const found = lzDecode((n) => read8(cpu + 2 + n), length, bitsFor);
    const data = Uint8Array.from(found.data.slice(0, length));
    if (
      (VRAM_FORMATS[format] && length % (planes(format) * TILE_SIZE)) ||
      (format === 'map' && length & 1)
    )
      throw new VmFault('lz_format_length_required', cpu);
    return { cpu, format, data, tokens: found.tokens.map((t) => t.join(':')).join(' ') };
  });
  const graphic = streams.filter((s) => VRAM_FORMATS[s.format]);
  const { tiles, sheets } = charactersToSheets(
    graphic.map((s) => ({ format: s.format, bytes: s.data })),
  );
  graphic.forEach((s, i) => {
    s.tiles = tiles[i];
  });
  for (const s of streams) {
    if (s.format === 'map')
      s.words = lines(
        Array.from({ length: s.data.length / 2 }, (_, i) =>
          (s.data[2 * i] | (s.data[2 * i + 1] << BYTE_BITS))
            .toString(HEX_RADIX)
            .toUpperCase()
            .padStart(WORD_HEX_DIGITS, '0'),
        ),
        MAP_WORDS_PER_LINE,
      );
    else if (s.format === 'bytes') s.bytes = lines(hexBytes(s.data), BYTES_PER_LINE);
    else if (s.format === 'text') s.lines = decodeText(s.data, 'text', s.cpu);
    else if (s.format === 'credits') s.groups = decodeText(s.data, 'credits', s.cpu);
    else if (s.format === 'states') s.states = decodeStates(s.data, s.cpu);
    else if (s.format === 'scene') s.scene = decodeScene(s.data);
    else if (!VRAM_FORMATS[s.format]) throw new VmFault('lz_format_required', s.cpu);
  }
  return { streams, sheets };
}

const parseHex = (text, digits, cpu) => {
  const values = text.join(' ').split(' ').filter(Boolean);
  if (values.some((v) => !new RegExp(`^[0-9A-F]{${digits}}$`).test(v)))
    throw new VmFault('lz_hex_required', cpu);
  return values.map((v) => parseInt(v, HEX_RADIX));
};

// Writes length word and packed data of each stream to rom; a stream keeps its
// address and must not overwrite a byte already present (lz_layout_changed).
export function placeLzStreams(rom, present, { streams }, sheets, { scenes }) {
  const put = romWriter(rom, present, 'lz_layout_changed');
  const records = new Map(scenes.map((s) => [s.address, s]));
  if (scenes.length !== SCENES || records.size !== SCENES) throw new VmFault('lz_scenes_required');
  if (streams.filter((s) => s.format === 'scene').length !== SCENES)
    throw new VmFault('lz_scene_stream_required');
  scenes.forEach(({ address }, n) => {
    if (streams.find((s) => s.address === address)?.format !== 'scene')
      throw new VmFault('lz_scene_stream_required', n);
    const cpu = parseInt(address.replace(':', ''), HEX_RADIX);
    [cpu & BYTE_MASK, (cpu >> BYTE_BITS) & BYTE_MASK, cpu >>> WORD_BITS].forEach((value, k) =>
      put(SCENE_TABLE + LONG_BYTES * n + k, value),
    );
  });
  const placed = placedReader(rom, present),
    bitsFor = lzBits((n) => placed(0x80a033 + n));
  const graphic = streams.filter((s) => VRAM_FORMATS[s.format]);
  const characters = new Map(
    sheetsToCharacters(graphic, sheets).map((bytes, i) => [graphic[i], bytes]),
  );
  for (const s of streams) {
    const cpu = parseInt(s.address.replace(':', ''), HEX_RADIX);
    let data;
    if (VRAM_FORMATS[s.format]) data = characters.get(s);
    else if (s.format === 'map')
      data = Uint8Array.from(
        parseHex(s.words, WORD_HEX_DIGITS, cpu).flatMap((w) => [w & BYTE_MASK, w >> BYTE_BITS]),
      );
    else if (s.format === 'bytes') data = Uint8Array.from(parseHex(s.bytes, BYTE_HEX_DIGITS, cpu));
    else if (s.format === 'text') data = encodeText(s.lines, 'text', cpu);
    else if (s.format === 'credits') data = encodeText(s.groups, 'credits', cpu);
    else if (s.format === 'states') data = encodeStates(s.states, cpu);
    else if (s.format === 'scene') data = encodeScene(records.get(s.address));
    else throw new VmFault('lz_format_required', cpu);
    const parse = s.tokens.split(' ').map((t) => t.split(':').map(Number));
    const packed = lzEncode(data, parse, bitsFor),
      bytes = [data.length & BYTE_MASK, data.length >> BYTE_BITS, ...packed];
    bytes.forEach((value, k) => {
      const address = cpu + k,
        o = romOffset(address);
      if (
        (address & WORD_MASK) < LOROM_OFFSET ||
        address >>> WORD_BITS !== cpu >>> WORD_BITS ||
        present[o]
      )
        throw new VmFault('lz_layout_changed', address);
      rom[o] = value;
      present[o] = 1;
    });
  }
}
