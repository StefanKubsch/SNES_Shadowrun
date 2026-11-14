// Dialog records (docs/ROM-FREE.md, step 2). 80:936C (src/task/
// native-dialog.mjs) takes the word at 80:94F7 + 2 n for dialog n, the record
// address in bank 8D ([11]); 80:9178 (src/task/native-dialog-text.mjs)
// looks up the text for a key. A record:
// - +0 the long pointer of the portrait record (src/data/portraits.mjs);
// - +3 a flag byte to $01BA: bits 0-6 the music (index into 80:94E8, 0
//   keeps the music), bit 7 mirrors the second portrait (80:905E);
// - from +4 entries up to the byte F8: key (FF greeting, FE talk, FD the
//   fallback 9178 takes when no entry matches, else the topic number), a
//   length byte (9178 skips key + 1 + length), a flag byte (bits 0-3 the
//   count of topic numbers 80:908C adds to the list 7E:3CA3, bit 7 an
//   action), the topic numbers, with bit 7 the action word (the script
//   80:91CA appends through C34A and visits) and the text word (bit 15
//   selects bank 9E, src/data/texts.mjs).
// The table has 139 words (src/data/portraits.mjs). The 139 records lie back
// to back from 8D:80C0 to the room table 8D:929D; every length byte equals
// the entry's size and all texts are text starts. Only the table names the
// records, so the loader lays them out again in the stored order and
// writes the table; a layout past 8D:929D is refused
// (dialog_layout_changed), a shorter one is filled with 00.
// Native form assets/vm-dialogs.json: per record in address order the
// dialog number, portrait, music, mirror and the entries.
import { VmFault } from '../vm/memory.mjs';
import { DIALOG_TABLE, DIALOGS, DIALOG_BANK_BASE } from './portraits.mjs';
import {
  label,
  romAddress,
  romWriter,
  wordReader,
  textPointerLabel,
  textPointerWord,
} from './rom-bytes.mjs';
import { BYTE_MASK, BYTE_BITS, HEX_RADIX, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

export const DIALOG_DATA = 0x8d80c0,
  DIALOG_END = 0x8d929d;
const KEYS = { 0xff: 'greeting', 0xfe: 'talk', 0xfd: 'fallback' };
// Record: long portrait pointer, flags (music in bits 0-6, bit 7 mirror),
// entries up to an F8 byte. Entry: key, length, flag (topic count in bits 0-3,
// bit 7 script word present), topics, the script word, the text pointer.
const RECORD_FLAGS = 3,
  RECORD_ENTRIES = 4,
  RECORD_END = 0xf8,
  MUSIC_MASK = 0x7f,
  MIRROR = 0x80,
  MIRROR_SHIFT = 7,
  ENTRY_LENGTH = 1,
  ENTRY_FLAG = 2,
  ENTRY_TOPICS = 3,
  TOPIC_COUNT_MASK = 0x0f,
  FLAG_UNUSED = 0x70,
  FLAG_SCRIPT = 0x80,
  // Number keys below the record end byte; F8 and up are the end and named keys.
  KEY_MAX = RECORD_END - 1;

export function readDialogs(read8) {
  const word = wordReader(read8);
  const numbers = new Map();
  for (let n = 0; n < DIALOGS; n++) numbers.set(DIALOG_BANK_BASE | word(DIALOG_TABLE + 2 * n), n);
  const records = [...numbers.keys()].sort((a, b) => a - b);
  let at = DIALOG_DATA;
  const dialogs = records.map((address) => {
    if (address !== at) throw new VmFault('dialog_layout_required', address);
    const portrait =
        read8(address) | (read8(address + 1) << BYTE_BITS) | (read8(address + 2) << WORD_BITS),
      flags = read8(address + RECORD_FLAGS);
    const entries = [];
    let y = address + RECORD_ENTRIES;
    while (read8(y) !== RECORD_END) {
      const key = read8(y),
        flag = read8(y + ENTRY_FLAG),
        count = flag & TOPIC_COUNT_MASK;
      if (flag & FLAG_UNUSED) throw new VmFault('dialog_flag_required', y);
      let k = y + ENTRY_TOPICS + count;
      const entry = {
        key: KEYS[key] ?? key,
        topics: Array.from({ length: count }, (_, i) => read8(y + ENTRY_TOPICS + i)),
      };
      if (flag & FLAG_SCRIPT) {
        entry.script = word(k);
        k += 2;
      }
      entry.text = textPointerLabel(word(k));
      k += 2;
      if (y + 1 + read8(y + ENTRY_LENGTH) !== k) throw new VmFault('dialog_length_required', y);
      entries.push(entry);
      y = k;
    }
    at = y + 1;
    return {
      dialog: numbers.get(address),
      portrait: label(portrait),
      music: flags & MUSIC_MASK,
      mirror: flags >> MIRROR_SHIFT === 1,
      entries,
    };
  });
  if (at !== DIALOG_END) throw new VmFault('dialog_layout_required', at);
  return dialogs;
}

const KEY_BYTES = Object.fromEntries(Object.entries(KEYS).map(([b, name]) => [name, +b]));
const byte = (v, max, at) => {
  if (!Number.isInteger(v) || v < 0 || v > max) throw new VmFault('dialog_value_required', at);
  return v;
};
function encodeRecord(d, at) {
  const portrait = romAddress(d?.portrait);
  if (portrait === null || !Array.isArray(d.entries) || typeof d.mirror !== 'boolean')
    throw new VmFault('dialog_value_required', at);
  const out = [
    portrait & BYTE_MASK,
    (portrait >> BYTE_BITS) & BYTE_MASK,
    portrait >> WORD_BITS,
    byte(d.music, MUSIC_MASK, at) | (d.mirror ? MIRROR : 0),
  ];
  for (const e of d.entries) {
    const key = typeof e?.key === 'string' ? KEY_BYTES[e.key] : byte(e?.key, KEY_MAX, at);
    const t = /^(9D|9E):([89A-F][0-9A-F]{3})$/.exec(e?.text ?? '');
    if (key === undefined || !t || !Array.isArray(e.topics) || e.topics.length > TOPIC_COUNT_MASK)
      throw new VmFault('dialog_value_required', at);
    const text = textPointerWord(t[1], t[2]);
    const body = [...e.topics.map((v) => byte(v, BYTE_MASK, at))];
    if (e.script !== undefined)
      body.push(byte(e.script, WORD_MASK, at) & BYTE_MASK, e.script >> BYTE_BITS);
    body.push(text & BYTE_MASK, text >> BYTE_BITS);
    // The length byte counts from itself: length and flag bytes plus the body.
    out.push(
      key,
      body.length + ENTRY_TOPICS - ENTRY_LENGTH,
      e.topics.length | (e.script !== undefined ? FLAG_SCRIPT : 0),
      ...body,
    );
  }
  out.push(RECORD_END);
  return out;
}

export function placeDialogs(rom, present, { dialogs }) {
  if (
    dialogs?.length !== DIALOGS ||
    new Set(dialogs.map((d) => d?.dialog)).size !== DIALOGS ||
    dialogs.some((d) => !Number.isInteger(d?.dialog) || d.dialog < 0 || d.dialog >= DIALOGS)
  )
    throw new VmFault('dialog_layout_changed', DIALOG_TABLE);
  const put = romWriter(rom, present, 'dialog_layout_changed');
  let at = DIALOG_DATA;
  for (const d of dialogs) {
    const bytes = encodeRecord(d, at);
    if (at + bytes.length > DIALOG_END) throw new VmFault('dialog_layout_changed', at);
    put(DIALOG_TABLE + 2 * d.dialog, at & BYTE_MASK);
    put(DIALOG_TABLE + 2 * d.dialog + 1, (at >> BYTE_BITS) & BYTE_MASK);
    bytes.forEach((v, i) => put(at + i, v));
    at += bytes.length;
  }
  for (; at < DIALOG_END; at++) put(at, 0);
}
