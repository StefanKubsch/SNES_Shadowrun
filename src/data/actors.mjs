// Actor table 8D:B01F (docs/ROM-FREE.md, step 2). A room actor names an
// offset into it (src/data/rooms.mjs stores offset / 7); 80:A3B6, A2FA,
// A1E6 and EA6E read an entry of 7 bytes:
// - +0 flags: A3B6 skips the actor when flags ORA 7E:2DE4 is 0 (80:A3FB),
//   EA6E lists it only when flags AND 2DE4 AND 7F is not 0 (80:E5A1);
//   bits 6 and 7 go to 1400.
// - +1 word: WRAM address of its record in the new-game state 7E:2E00
//   (src/data/lz-streams.mjs, format states) or 0. A3B6 skips the actor
//   when the holder at +3 of the record is not FFFF; 9CE4, 9DC8, CB2B and
//   others read the record through it. Each of the 703 records belongs to
//   exactly one entry.
// - +3 word: kind, to DP 00 for 80:A835 (3F28; index into the kind table
//   8C:EFB0, src/data/kinds.mjs, which reads its flags at +4).
// - +5 word: script that A835 appends through C34A (all below 937).
// The 1191 entries follow without a gap and end at 8D:D0B0, where the
// tilesets begin. Offsets are fixed in the rooms and in WRAM (150A), so the
// table keeps its count (actor_layout_changed).
// Native form assets/vm-actors.json: per entry flags (hex), record (WRAM
// address in hex or null), kind and script.
import { VmFault } from '../vm/memory.mjs';
import { hex, romWriter, wordReader } from './rom-bytes.mjs';
import {
  BYTE_MASK,
  BYTE_BITS,
  HEX_RADIX,
  BYTE_HEX_DIGITS,
  WORD_HEX_DIGITS,
  WORD_MASK,
} from '../constants/bits.mjs';

// Entry: flags byte, record word, kind word, script word.
export const ACTOR_BYTES = 7;
export const ACTOR_RECORD = 1,
  ACTOR_KIND = 3,
  ACTOR_SCRIPT = 5;
export const ACTOR_TABLE = 0x8db01f,
  ACTORS = 1191,
  ACTOR_END = ACTOR_TABLE + ACTOR_BYTES * ACTORS;
// State records of five bytes from 7E:2E00 (also the "states" stream, lz-streams.mjs).
export const STATE_BYTES = 5;
// State record: state word, count byte, holder word (lz-streams.mjs).
export const STATE_COUNT = 2,
  STATE_HOLDER = 3;
// Flags byte: bits 0 to 6 are gated by 7E:2DE4, bits 6 and 7 go to 1400.
export const ACTOR_STAGE_FLAGS = 0x7f,
  ACTOR_DEPTH_FLAGS = 0xc0,
  LAST_ACTOR = ACTOR_BYTES * (ACTORS - 1);
const STATE = 0x2e00,
  STATES = 703;
const isStateRecord = (record) =>
  record >= STATE && record < STATE + STATE_BYTES * STATES && (record - STATE) % STATE_BYTES === 0;

export function readActors(read8) {
  const word = wordReader(read8);
  return Array.from({ length: ACTORS }, (_, n) => {
    const at = ACTOR_TABLE + ACTOR_BYTES * n,
      record = word(at + ACTOR_RECORD);
    if (record && !isStateRecord(record)) throw new VmFault('actor_layout_required', at);
    return {
      flags: hex(read8(at), BYTE_HEX_DIGITS),
      record: record ? hex(record, WORD_HEX_DIGITS) : null,
      kind: word(at + ACTOR_KIND),
      script: word(at + ACTOR_SCRIPT),
    };
  });
}

export function placeActors(rom, present, { actors }) {
  const put = romWriter(rom, present, 'actor_layout_changed');
  if (actors?.length !== ACTORS) throw new VmFault('actor_layout_changed', ACTOR_TABLE);
  actors.forEach((e, n) => {
    const at = ACTOR_TABLE + ACTOR_BYTES * n;
    const value = (v, max) => {
      if (!Number.isInteger(v) || v < 0 || v > max) throw new VmFault('actor_value_required', at);
      return v;
    };
    const text = (t, digits) => {
      if (!new RegExp(`^[0-9A-F]{${digits}}$`).test(t ?? ''))
        throw new VmFault('actor_value_required', at);
      return parseInt(t, HEX_RADIX);
    };
    const record = e.record === null ? 0 : text(e.record, WORD_HEX_DIGITS);
    if (record && !isStateRecord(record)) throw new VmFault('actor_value_required', at);
    const kind = value(e.kind, WORD_MASK),
      script = value(e.script, WORD_MASK);
    [
      text(e.flags, BYTE_HEX_DIGITS),
      record & BYTE_MASK,
      record >> BYTE_BITS,
      kind & BYTE_MASK,
      kind >> BYTE_BITS,
      script & BYTE_MASK,
      script >> BYTE_BITS,
    ].forEach((v, k) => {
      put(at + k, v);
    });
  });
}
