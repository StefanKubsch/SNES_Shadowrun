// Action lists of the kinds (docs/ROM-FREE.md, step 2). 80:D15C and 80:8371
// (src/task/native-object-turn.mjs, native-object-collision.mjs) take for slot kind k (3F28)
// the word at 8C:ED8A + 2 k, a list in bank 8C, and add 2 n for action n
// (DP 02); the word there points to the action record R:
// - R +0 speed to 4088: 80:AC2F adds it to 4030 and steps when bit 7
//   carries out; +1 XOR 80 to 10E8: bits 0-6 the frame count, bit 7 loops
//   (clear: AC2F plays the frames once more after the first pass reload,
//   then ends the action with event 8; 80 alone ends at once); +2 to 1248,
//   +3 to +6 signed to 4240, 4298, 42F0, 4348, +7 to 43A0 (named by their
//   destination only).
// - R + 8 goes to 1090: eight bytes, one per direction (1198), give the
//   offset from R + 8 to the first frame word of that direction (11F0;
//   D15C keeps the frame phase when the direction changes). AC2F adds 2 per
//   frame and hands the word to ACD0: a picture at 9B:(word | 8000), or with
//   bit 15 at 9C:word. All 673 records consist of exactly these eight bytes
//   and their frame runs; all offsets are even, 0 marks a direction without
//   frames (3066 times, the word read there is the direction table itself).
// The 275 table words end exactly at the kind table 8C:EFB0. Kind 274 points
// at the table itself (8C:ED8A), so its action words are the table words.
// The other 253 lists and their 673 records fill 8C:8000 to the table
// without a gap: each list ends where the first record it names begins or
// the next block starts, every list word is a record start and no record
// lies outside. Only these readers point into the range, so the blocks are
// laid out again in order and all pointers come from the layout; a layout
// that runs into the table is refused (action_layout_changed), a shorter
// one is filled with 00.
// Native form assets/vm-actions.json: kinds (block index of the list, or
// null for the table itself), blocks in address order: a list {actions:
// [block index of each record]} or a record {speed, count, loop, fields
// (bytes +2 to +7), directions (index of the first frame or null for
// offset 0), frames (picture addresses)}.
import { VmFault } from '../vm/memory.mjs';
import { KINDS } from './kinds.mjs';
import { hex, romWriter } from './rom-bytes.mjs';
import {
  WORD_MASK,
  BYTE_MASK,
  BYTE_BITS,
  HEX_RADIX,
  WORD_HEX_DIGITS,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { LOROM_OFFSET, LOROM_OFFSET_MASK } from '../constants/memory-map.mjs';

export const ACTION_TABLE = 0x8ced8a,
  ACTION_DATA = 0x8c8000,
  ACTION_END = ACTION_TABLE + 2 * KINDS,
  ACTION_BANK_BASE = 0x8c0000;
// Record: speed, frame count (bits 0-6) and loop (bit 7), six fields, eight
// direction offsets from R + 8, then the frame words.
const RECORD_COUNT = 1,
  RECORD_FIELDS = 2,
  RECORD_DIRECTIONS = 8,
  DIRECTIONS = 8,
  RECORD_FRAMES = RECORD_DIRECTIONS + DIRECTIONS,
  FRAME_COUNT_MASK = 0x7f,
  FRAME_LOOP = 0x80,
  MAX_OFFSET = 0xfe;
// Frame word: a picture at 9B:(word | 8000), or with bit 15 at 9C:word.
const FRAME_HIGH_BANK = WORD_SIGN;

export function readActions(read8) {
  const word = (p) =>
      read8(ACTION_BANK_BASE | p) | (read8(ACTION_BANK_BASE | (p + 1)) << BYTE_BITS),
    table = ACTION_TABLE & WORD_MASK;
  const pointers = Array.from({ length: KINDS }, (_, k) => word(table + 2 * k));
  const lists = new Map(),
    records = new Set();
  for (const start of new Set(pointers)) {
    if (start === table) continue;
    const actions = [];
    for (let p = start, min = WORD_MASK; p < min && p < table; p += 2) {
      const w = word(p);
      actions.push(w);
      records.add(w);
      min = Math.min(min, w);
    }
    lists.set(start, actions);
  }
  const starts = [...new Set([...lists.keys(), ...records])].sort((a, b) => a - b);
  if (
    starts[0] !== (ACTION_DATA & WORD_MASK) ||
    [...lists.keys()].some((l) => records.has(l)) ||
    starts.at(-1) >= table
  )
    throw new VmFault('action_layout_required', ACTION_DATA);
  const index = new Map(starts.map((s, n) => [s, n]));
  const blocks = starts.map((start, n) => {
    const end = starts[n + 1] ?? table;
    if (lists.has(start)) {
      const actions = lists.get(start);
      if (start + 2 * actions.length !== end)
        throw new VmFault('action_layout_required', ACTION_BANK_BASE | start);
      return { actions: actions.map((r) => index.get(r)) };
    }
    const all = Array.from({ length: end - start }, (_, k) =>
      read8(ACTION_BANK_BASE | (start + k)),
    );
    const record = decodeRecord(all);
    if (!record) throw new VmFault('action_layout_required', ACTION_BANK_BASE | start);
    return record;
  });
  return { kinds: pointers.map((p) => (p === table ? null : index.get(p))), blocks };
}

// A record: 8 header bytes, 8 direction offsets from R + 8, frame words.
function decodeRecord(all) {
  if (all.length < RECORD_FRAMES || all.length & 1) return null;
  const count = all[RECORD_COUNT] & FRAME_COUNT_MASK,
    frames = [];
  for (let k = RECORD_FRAMES; k < all.length; k += 2) {
    const w = all[k] | (all[k + 1] << BYTE_BITS);
    frames.push(`${w & FRAME_HIGH_BANK ? '9C' : '9B'}:${hex(w | LOROM_OFFSET, WORD_HEX_DIGITS)}`);
  }
  const directions = all
    .slice(RECORD_DIRECTIONS, RECORD_FRAMES)
    .map((o) =>
      o === 0
        ? null
        : o & 1 || o < RECORD_DIRECTIONS || (o - RECORD_DIRECTIONS) / 2 + count > frames.length
          ? undefined
          : (o - RECORD_DIRECTIONS) / 2,
    );
  if (directions.includes(undefined)) return null;
  return {
    speed: all[0],
    count,
    loop: !!(all[RECORD_COUNT] & FRAME_LOOP),
    fields: all.slice(RECORD_FIELDS, RECORD_DIRECTIONS),
    directions,
    frames,
  };
}

function encodeRecord(r, at) {
  const fail = () => {
    throw new VmFault('action_value_required', at);
  };
  const byte = (v) => (Number.isInteger(v) && v >= 0 && v <= BYTE_MASK ? v : fail());
  if (
    !Number.isInteger(r.count) ||
    r.count < 0 ||
    r.count > FRAME_COUNT_MASK ||
    typeof r.loop !== 'boolean'
  )
    fail();
  if (
    r.fields?.length !== RECORD_DIRECTIONS - RECORD_FIELDS ||
    r.directions?.length !== DIRECTIONS ||
    !Array.isArray(r.frames)
  )
    fail();
  const words = r.frames.map((t) => {
    const m = /^(9B|9C):([89A-F][0-9A-F]{3})$/.exec(t ?? '') ?? fail(),
      o = parseInt(m[2], HEX_RADIX);
    return m[1] === '9C' ? o : o & LOROM_OFFSET_MASK;
  });
  const offsets = r.directions.map((d) =>
    d === null
      ? 0
      : Number.isInteger(d) &&
          d >= 0 &&
          d + r.count <= words.length &&
          RECORD_DIRECTIONS + 2 * d <= MAX_OFFSET
        ? RECORD_DIRECTIONS + 2 * d
        : fail(),
  );
  return [
    byte(r.speed),
    r.count | (r.loop ? FRAME_LOOP : 0),
    ...r.fields.map(byte),
    ...offsets,
    ...words.flatMap((w) => [w & BYTE_MASK, w >> BYTE_BITS]),
  ];
}

export function placeActions(rom, present, { kinds, blocks }) {
  if (kinds?.length !== KINDS || !Array.isArray(blocks))
    throw new VmFault('action_layout_changed', ACTION_TABLE);
  const fail = (at) => {
    throw new VmFault('action_value_required', at);
  };
  // Addresses first, then the bytes with the record pointers of each list.
  const address = [];
  let at = ACTION_DATA;
  blocks.forEach((b, n) => {
    address[n] = at;
    if (Array.isArray(b?.actions)) at += 2 * b.actions.length;
    else if (Array.isArray(b?.frames)) at += RECORD_FRAMES + 2 * b.frames.length;
    else fail(at);
  });
  if (at > ACTION_TABLE) throw new VmFault('action_layout_changed', at);
  const write = romWriter(rom, present, 'action_layout_changed');
  const record = (n, cpu) => (blocks[n]?.frames ? address[n] & WORD_MASK : fail(cpu));
  blocks.forEach((b, n) => {
    const base = address[n];
    const bytes = b.actions
      ? b.actions.flatMap((r) => {
          const p = record(r, base);
          return [p & BYTE_MASK, p >> BYTE_BITS];
        })
      : encodeRecord(b, base);
    bytes.forEach((v, k) => write(base + k, v));
  });
  for (let c = at; c < ACTION_TABLE; c++) write(c, 0);
  kinds.forEach((list, k) => {
    const p =
      list === null
        ? ACTION_TABLE & WORD_MASK
        : blocks[list]?.actions
          ? address[list] & WORD_MASK
          : fail(ACTION_TABLE + 2 * k);
    write(ACTION_TABLE + 2 * k, p & BYTE_MASK);
    write(ACTION_TABLE + 2 * k + 1, p >> BYTE_BITS);
  });
}
