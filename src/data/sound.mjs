// Sound data catalog (docs/ROM-FREE.md, step 2; docs/SOUND-DRIVER.md).
// 81:F092 (src/apu/music-mode.mjs loadSoundDirectory) takes directory X (0 or 3) from
// the long pointer at 98:FFFA + X and sends the block list named by the
// long pointer at directory + 2 with driver command 01; F130 walks the
// entries from directory + 5, 4 bytes each (number, long pointer to a block
// list) up to number FF, and sends each with command 10. The word at
// directory + 0 is the directory length and the offset of its mode list
// right behind it: F1FA (from F25A, called by EF47) takes the word at [8C]
// as index Y and walks byte pairs (mode, item number) up to a 00 byte; for
// each pair whose mode equals the byte at 7E:1CE5 it loads the item with A =
// 80xx through F130 (directory 0 at 9F:FEAC: four pairs from 9F:FF0A;
// directory 3: an empty list).
// Block list (F092/F122/F1B9/F1E8): word total + 2, word ARAM destination,
// then chunks until the total is used: word n < 8000 with a long source (n
// raw bytes) or word 8000 | n with a fill word (n words). The offsets stay in
// the bank of the list (LDA [$89],Y).
// The driver reads a base list at 0EFE as sections (0x04E1 in
// src/apu/sound-driver.mjs): each a length word, then the data; the word
// counts 4-byte sample directory entries (DSP DIR), 9-byte BRR blocks, header
// bytes ($12), 16-byte sounds ($14), vibrato pointers ($16, words), vibrato
// bytes, sequence pointers ($1A, words), sequence bytes, song pointers ($18,
// words) and, if not 0, more words. The length words come from fill chunks
// of count 1, so every raw chunk lies inside one section; its role is that
// section. Songs are open-ended: a chunk from the start of the last section
// on (also an item list loaded behind the base) belongs to the songs.
// Data chunks are named by address in the lists, and several lists share
// chunks, so each chunk keeps its address and length (sound_layout_changed).
// Native form: assets/vm-sound.json (directories with mode lists, lists, data with role and
// ARAM addresses) and one WAV per sample in assets/vm-samples/. The table
// chunks (sample directory, header, sounds, vibrato and note tables, pointer
// tables) and the songs are decoded in the JSON (CODECS below). A sample
// names its WAV (decoded PCM) and keeps its block headers and, where the PCM
// does not determine them, its nibbles (src/data/brr.mjs).
import { VmFault } from '../vm/memory.mjs';
import { BRR_BLOCK, decodeBrr, encodeBrr } from './brr.mjs';
import { hex, label, requireRomAddress, romWriter, wordReader } from './rom-bytes.mjs';
import {
  WORD_MASK,
  BYTE_MASK,
  BYTE_BITS,
  HEX_RADIX,
  WORD_BITS,
  WORD_SIGN,
  BANK_SIZE,
  LONG_BYTES,
  BYTE_HEX_DIGITS,
  WORD_HEX_DIGITS,
} from '../constants/bits.mjs';
import { LOROM_OFFSET } from '../constants/memory-map.mjs';
import { ARAM_SIZE } from '../apu/spc-io.mjs';
import { TRACK_COUNT } from '../apu/sound-driver-memory.mjs';

const SOUND_POINTERS = 0x98fffa,
  SOUND_DIRECTORIES = [0, 3];
// Block list: total word and ARAM destination word, then the chunks: a word
// 8000 | n with a fill word (four bytes) or a length word with a long source
// (five bytes).
const LIST_HEADER_BYTES = 4,
  LIST_DESTINATION = 2,
  CHUNK_ARGUMENT = 2,
  FILL_FLAG = WORD_SIGN,
  FILL_COUNT_MASK = WORD_SIGN - 1,
  FILL_CHUNK_BYTES = 4,
  RAW_CHUNK_BYTES = 5;
// Directory: length word, long pointer to the base list, then items of four
// bytes (number, long pointer to a block list) up to the number FF, then the
// mode list of byte pairs up to a 00 byte.
const DIRECTORY_BASE = 2,
  DIRECTORY_ITEMS = 5,
  DIRECTORY_FIXED_BYTES = 6,
  ITEM_BYTES = 4,
  ITEM_LIST = 1,
  ITEMS_END = 0xff;
// Song header: track list pointers from +1, the tempo list pointer at +11.
const SONG_TRACKS = 1,
  SONG_TEMPO = 0x11;
// Event lists end with an FF byte.
const EVENT_LIST_END = 0xff;
const SOUND_SECTIONS = [
  'directory',
  'samples',
  'header',
  'sounds',
  'vibrato_table',
  'vibrato_pitch',
  'sequence_table',
  'sequences',
  'song_table',
  'songs',
];
const SECTION_FACTORS = [4, 9, 1, 16, 2, 1, 2, 1, 2, 2];
const parse = (text, at) => requireRomAddress(text, 'sound_value_required', at);

// Every structure must stay inside its bank (the readers index within it).
function span(cpu, length) {
  if ((cpu & WORD_MASK) < LOROM_OFFSET || (cpu & WORD_MASK) + length > BANK_SIZE)
    throw new VmFault('sound_bank_crossed', cpu);
  return cpu;
}

// The section ranges of a base list in ARAM, read as 0x04E1 reads them.
function baseSections(list, aramByte) {
  let q = list.destination;
  const word = () => {
    const w = aramByte(q) | (aramByte(q + 1) << BYTE_BITS);
    q += 2;
    return w;
  };
  return SOUND_SECTIONS.map((name, s) => {
    const n = (word() * SECTION_FACTORS[s]) & WORD_MASK,
      start = q;
    q += n;
    return { name, start, end: q };
  });
}

export function readSound(read8) {
  const word = wordReader(read8);
  const long = (cpu) => word(cpu) | (read8(cpu + 2) << WORD_BITS);
  const lists = new Map(),
    data = new Map();
  const readList = (address) => {
    if (lists.has(address)) return lists.get(address);
    let remaining = word(address) - 2,
      y = LIST_HEADER_BYTES;
    const list = { address, destination: word(address + LIST_DESTINATION), chunks: [] };
    while (remaining) {
      if (remaining < 0) throw new VmFault('sound_list_length', address);
      const head = word(address + y);
      if (head & FILL_FLAG) {
        list.chunks.push({
          count: head & FILL_COUNT_MASK,
          word: word(address + y + CHUNK_ARGUMENT),
        });
        remaining -= 2 * (head & FILL_COUNT_MASK);
        y += FILL_CHUNK_BYTES;
      } else {
        const source = span(long(address + y + CHUNK_ARGUMENT), head);
        if (data.has(source) && data.get(source).length !== head)
          throw new VmFault('sound_data_length', source);
        if (!data.has(source)) data.set(source, { address: source, length: head, uses: [] });
        list.chunks.push({ source, length: head });
        remaining -= head;
        y += RAW_CHUNK_BYTES;
      }
    }
    list.length = y;
    span(address, y);
    lists.set(address, list);
    return list;
  };
  const directories = SOUND_DIRECTORIES.map((x) => {
    const address = long(SOUND_POINTERS + x),
      items = [];
    for (let y = DIRECTORY_ITEMS; read8(address + y) !== ITEMS_END; y += ITEM_BYTES)
      items.push({ id: read8(address + y), list: readList(long(address + y + ITEM_LIST)) });
    const length = DIRECTORY_FIXED_BYTES + ITEM_BYTES * items.length;
    span(address, length);
    if (word(address) !== length) throw new VmFault('sound_directory_length', address);
    const modes = [];
    for (let y = length; read8(address + y); y += 2)
      modes.push({ mode: read8(address + y), item: read8(address + y + 1) });
    span(address, length + 2 * modes.length + 1);
    return { address, base: readList(long(address + DIRECTORY_BASE)), items, modes };
  });

  // Roles: lay every list of a directory into its ARAM and name the section.
  for (const d of directories) {
    const aram = new Uint8Array(ARAM_SIZE);
    const lay = (list) => {
      let p = list.destination;
      for (const c of list.chunks) {
        const n = c.source === undefined ? 2 * c.count : c.length;
        for (let i = 0; i < n; i++)
          aram[(p + i) & WORD_MASK] =
            c.source === undefined
              ? i & 1
                ? c.word >> BYTE_BITS
                : c.word & BYTE_MASK
              : read8(c.source + i);
        if (c.source !== undefined) c.aram = p;
        p += n;
      }
    };
    lay(d.base);
    const sections = baseSections(d.base, (a) => aram[a & WORD_MASK]);
    for (const list of [d.base, ...d.items.map((i) => i.list)]) {
      if (list !== d.base) lay(list);
      for (const c of list.chunks) {
        if (c.source === undefined) continue;
        const s =
          c.aram >= sections.at(-1).start
            ? { name: 'songs' }
            : sections.find((s) => c.aram >= s.start && c.aram + c.length <= s.end);
        if (!s) throw new VmFault('sound_section_required', c.source);
        const entry = data.get(c.source);
        if (entry.role && entry.role !== s.name) throw new VmFault('sound_role_conflict', c.source);
        entry.role = s.name;
        if (s.name === 'vibrato_pitch') {
          const table = sections[SOUND_SECTIONS.indexOf('vibrato_table')];
          entry.vibratos = (table.end - table.start) / 2;
        }
        if (!entry.uses.includes(c.aram)) entry.uses.push(c.aram);
      }
    }
    // Songs: parse every song of the table with the base and each item
    // loaded, so a song may use patterns of another chunk (807D of
    // directory 3 uses patterns of 98:C666).
    const songChunks = (list) =>
      list.chunks.filter((c) => c.source !== undefined && data.get(c.source).role === 'songs');
    const table = d.base.chunks.find(
      (c) => c.source !== undefined && data.get(c.source).role === 'song_table',
    );
    const heads = table
      ? Array.from({ length: table.length / 2 }, (_, n) => word(table.source + 2 * n))
      : [];
    for (const items of [[], ...d.items.map((i) => songChunks(i.list)).filter((s) => s.length)]) {
      const set = [...songChunks(d.base), ...items];
      if (set.length) parseSongs(set, heads, data, read8);
    }
  }
  const sorted = [...data.values()].sort((a, b) => a.address - b.address),
    samples = {};
  sorted.forEach((d, n) => {
    if (n && d.address < sorted[n - 1].address + sorted[n - 1].length)
      throw new VmFault('sound_data_overlap', d.address);
  });
  return {
    directories: directories.map((d) => ({
      address: label(d.address),
      base: label(d.base.address),
      items: d.items.map((i) => ({ id: hex(i.id, BYTE_HEX_DIGITS), list: label(i.list.address) })),
      modes: d.modes.map((m) => ({
        mode: hex(m.mode, BYTE_HEX_DIGITS),
        item: hex(m.item, BYTE_HEX_DIGITS),
      })),
    })),
    lists: [...lists.values()]
      .sort((a, b) => a.address - b.address)
      .map((l) => ({
        address: label(l.address),
        destination: hex(l.destination, WORD_HEX_DIGITS),
        chunks: l.chunks.map((c) =>
          c.source === undefined
            ? { fill: c.count, word: hex(c.word, WORD_HEX_DIGITS) }
            : { data: label(c.source) },
        ),
      })),
    data: sorted.map((d) => {
      const entry = {
        address: label(d.address),
        role: d.role,
        aram: d.uses.map((a) => hex(a, WORD_HEX_DIGITS)),
      };
      const bytes = Array.from({ length: d.length }, (_, i) => read8(d.address + i));
      const codec = CODECS[d.role];
      if (!codec) {
        if (d.role !== 'samples') throw new VmFault('sound_codec_required', d.address);
        checkBrr(bytes, d.address);
        const { pcm, headers, nibbles } = decodeBrr(Uint8Array.from(bytes));
        const file = sampleFile(d.address);
        samples[file] = pcm;
        return {
          ...entry,
          file,
          blocks: hexBytes(headers),
          ...(Object.keys(nibbles).length ? { nibbles } : {}),
        };
      }
      const fields = codec.decode(bytes, d);
      if (!fields) throw new VmFault('sound_codec_mismatch', d.address, { decode: true });
      const again = codec.encode({ ...entry, ...fields }, d.address);
      if (again.join() !== bytes.join())
        throw new VmFault('sound_codec_mismatch', d.address, {
          first: again.findIndex((v, i) => v !== bytes[i]),
          length: again.length,
          expected: bytes.length,
        });
      return { ...entry, ...fields };
    }),
    samples,
  };
}

// Marks the piece starts of all songs whose header lies in the chunks of
// set (list chunks with their ARAM address): song headers, track lists,
// tempo lists and patterns, as song06A3, list0A9A and tempoList0A1C reach
// them. A start must keep one kind.
function parseSongs(set, heads, data, read8) {
  const find = (a) => set.find((c) => a >= c.aram && a < c.aram + c.length);
  const at = (a) => {
    const c = find(a);
    if (!c) throw new VmFault('sound_song_outside', a);
    return c;
  };
  const byte = (a) => read8(at(a).source + a - at(a).aram);
  const word = (a) => byte(a) | (byte(a + 1) << BYTE_BITS);
  const mark = (a, kind) => {
    const c = at(a),
      entry = data.get(c.source),
      k = a - c.aram;
    entry.kinds ??= new Map();
    if (entry.kinds.has(k) && entry.kinds.get(k) !== kind)
      throw new VmFault('sound_song_kind', c.source + k);
    entry.kinds.set(k, kind);
  };
  for (const s of heads) {
    if (!find(s)) continue;
    mark(s, 'song');
    mark(word(s + SONG_TEMPO), 'tempo');
    for (let t = 0; t < TRACK_COUNT; t++) {
      const list = word(s + SONG_TRACKS + 2 * t);
      if (!list) continue;
      mark(list, 'track');
      for (let p = list; word(p); p += 2) mark(word(p), 'pattern');
    }
  }
}

// Song pieces. A song header is the 0x4B bytes song06A3 copies: tempo ($92),
// eight track list pointers ($93, 0000 none), the tempo list pointer ($A3),
// eight voice masks ($A5, $2C of a note), eight volumes left ($79) and right
// ($81) and up to 32 sound numbers ($AD, sound of instrument i). In every
// song the next piece begins right behind the sounds its patterns use, so
// song06A3 copies its bytes into the unused slots; the header ends where the
// next piece begins. A track list is
// pattern pointers up to 0000 (list0A9A; 0000 ends the track). A pattern
// (events0B1E) and a tempo list (tempoList0A1C) are events up to FF, here as
// strings. Pattern: "w N" byte N < 80 waits N + 1 steps; "n NN I V" note NN
// (octave and semitone nibbles) with instrument I at volume nibble V (80 | V);
// "o NN I" releases note NN of instrument I (A0 | I); "b X YY" bends the
// pitch by the word X YY / 256 (C0 | X). Tempo list: "w N" waits N + 1
// times four steps; "t N" sets tempo N (F8); "v C L R" sets the volumes of
// track C (80 | C); "r S C L R" ramps them by steps L and R (80 | S << 3 | C).
const PATTERN_EVENTS = {
  decode: (b, k) => {
    const a = b[k];
    if (a < 0x80) return [`w ${a}`, 1];
    if (a < 0x90) return [`n ${h2(b[k + 1])} ${b[k + 2]} ${hex(a & 15, 1)}`, 3];
    if (a >= 0xa0 && a < 0xc0) return [`o ${h2(b[k + 1])} ${a & 0x1f}`, 2];
    if (a >= 0xc0 && a < 0xe0) return [`b ${hex(a & 0x1f, BYTE_HEX_DIGITS)} ${h2(b[k + 1])}`, 2];
    return null;
  },
  encode: (e, at) => {
    const [op, ...v] = String(e).split(' ');
    if (op === 'w' && v.length === 1) return [num(+v[0], 0x7f, at)];
    if (op === 'n' && v.length === 3)
      return [0x80 | hexValue(v[2], 1, at), hexValue(v[0], 2, at), num(+v[1], 255, at)];
    if (op === 'o' && v.length === 2) return [0xa0 | num(+v[1], 0x1f, at), hexValue(v[0], 2, at)];
    if (op === 'b' && v.length === 2)
      return [0xc0 | num(hexValue(v[0], 2, at), 0x1f, at), hexValue(v[1], 2, at)];
    throw new VmFault('sound_value_required', at);
  },
};
const TEMPO_EVENTS = {
  decode: (b, k) => {
    const a = b[k];
    if (a < 0x80) return [`w ${a}`, 1];
    if (a === 0xf8) return [`t ${b[k + 1]}`, 2];
    const ramp = Math.floor(a / BYTE_BITS) & 15;
    return [
      ramp ? `r ${ramp} ${a & 7} ${b[k + 1]} ${b[k + 2]}` : `v ${a & 7} ${b[k + 1]} ${b[k + 2]}`,
      3,
    ];
  },
  encode: (e, at) => {
    const [op, ...v] = String(e).split(' '),
      n = v.map(Number);
    if (op === 'w' && v.length === 1) return [num(n[0], 0x7f, at)];
    if (op === 't' && v.length === 1) return [0xf8, num(n[0], 255, at)];
    if (op === 'v' && v.length === 3)
      return [0x80 | num(n[0], 7, at), num(n[1], 255, at), num(n[2], 255, at)];
    if (op === 'r' && v.length === 4) {
      const a = 0x80 | (num(n[0], 15, at) << 3) | num(n[1], 7, at);
      if (!n[0] || a === 0xf8 || a === 0xff) throw new VmFault('sound_value_required', at);
      return [a, num(n[2], 255, at), num(n[3], 255, at)];
    }
    throw new VmFault('sound_value_required', at);
  },
};
const eventList = (events) => ({
  decode: (b, k) => {
    const out = [];
    for (let y = k; y < b.length;) {
      if (b[y] === EVENT_LIST_END) return [out, y + 1 - k];
      const e = events.decode(b, y);
      if (!e || y + e[1] > b.length) return null;
      out.push(e[0]);
      y += e[1];
    }
    return null;
  },
  encode: (list, at) => {
    if (!Array.isArray(list)) throw new VmFault('sound_value_required', at);
    return [...list.flatMap((e) => events.encode(e, at)), EVENT_LIST_END];
  },
});
const SONG_PIECES = {
  song: {
    decode: (b, k, limit) => {
      const n = Math.min(0x4b, limit - k);
      return n <= 0x2b
        ? null
        : [
            {
              tempo: b[k],
              tracks: Array.from({ length: 8 }, (_, t) => h4(words(b, k + 1 + 2 * t))),
              tempo_list: h4(words(b, k + 0x11)),
              voices: Array.from(b.slice(k + 0x13, k + 0x1b), h2),
              left: Array.from(b.slice(k + 0x1b, k + 0x23)),
              right: Array.from(b.slice(k + 0x23, k + 0x2b)),
              sounds: Array.from(b.slice(k + 0x2b, k + n), h2),
            },
            n,
          ];
    },
    encode: (s, at) => {
      if (
        s?.tracks?.length !== 8 ||
        s.voices?.length !== 8 ||
        s.left?.length !== 8 ||
        s.right?.length !== 8 ||
        !(s.sounds?.length >= 1 && s.sounds.length <= 32)
      )
        throw new VmFault('sound_value_required', at);
      return [
        num(s.tempo, 255, at),
        ...s.tracks.flatMap((w) => wordBytes(hexValue(w, 4, at))),
        ...wordBytes(hexValue(s.tempo_list, 4, at)),
        ...s.voices.map((v) => hexValue(v, 2, at)),
        ...s.left.map((v) => num(v, 255, at)),
        ...s.right.map((v) => num(v, 255, at)),
        ...s.sounds.map((v) => hexValue(v, 2, at)),
      ];
    },
  },
  track: {
    decode: (b, k) => {
      const out = [];
      for (let y = k; y + 1 < b.length; y += 2) {
        const w = words(b, y);
        if (!w) return [out, y + 2 - k];
        out.push(h4(w));
      }
      return null;
    },
    encode: (list, at) => {
      if (!Array.isArray(list)) throw new VmFault('sound_value_required', at);
      return [
        ...list.flatMap((w) => {
          const v = hexValue(w, 4, at);
          if (!v) throw new VmFault('sound_value_required', at);
          return wordBytes(v);
        }),
        0,
        0,
      ];
    },
  },
  tempo: eventList(TEMPO_EVENTS),
  pattern: eventList(PATTERN_EVENTS),
};

// Readable forms of the table chunks; each encode gives the original bytes
// (checked by readSound), decode returns null if the bytes do not fit.
const words = (b, k) => b[k] | (b[k + 1] << BYTE_BITS);
const wordBytes = (w) => [w & BYTE_MASK, (w >> BYTE_BITS) & BYTE_MASK];
const h2 = (v) => hex(v, BYTE_HEX_DIGITS),
  h4 = (v) => hex(v, WORD_HEX_DIGITS);
const num = (v, max, at) => {
  if (!Number.isInteger(v) || v < 0 || v > max) throw new VmFault('sound_value_required', at);
  return v;
};
const hexValue = (text, digits, at) => {
  if (!new RegExp(`^[0-9A-F]{${digits}}$`).test(text ?? ''))
    throw new VmFault('sound_value_required', at);
  return parseInt(text, HEX_RADIX);
};
const wordList = {
  decode: (b) =>
    b.length % 2
      ? null
      : { words: Array.from({ length: b.length / 2 }, (_, n) => h4(words(b, 2 * n))) },
  encode: (f, at) => (f.words ?? []).flatMap((w) => wordBytes(hexValue(w, WORD_HEX_DIGITS, at))),
};
const CODECS = {
  // DSP DIR (Book I PDF 176/178): per sample number the ARAM start and loop.
  directory: {
    decode: (b) =>
      b.length % 4
        ? null
        : {
            entries: Array.from({ length: b.length / 4 }, (_, n) => ({
              start: h4(words(b, 4 * n)),
              loop: h4(words(b, 4 * n + 2)),
            })),
          },
    encode: (f, at) =>
      (f.entries ?? []).flatMap((e) => [
        ...wordBytes(hexValue(e?.start, 4, at)),
        ...wordBytes(hexValue(e?.loop, 4, at)),
      ]),
  },
  // $12, read by 0x0366: echo volume factors left and right ($22/$23, times
  // the main volume / 256), then the DSP registers of the list at ARAM 03B7
  // in the driver: EFB, ESA (also the first echo page cleared), EDL, FIR C0
  // to C7, FLG (Book I PDF 175-177).
  header: {
    decode: (b) =>
      b.length !== 14
        ? null
        : {
            echo_left: b[0],
            echo_right: b[1],
            efb: h2(b[2]),
            esa: h2(b[3]),
            edl: b[4],
            fir: Array.from(b.slice(5, 13), h2),
            flg: h2(b[13]),
          },
    encode: (f, at) => {
      if (f.fir?.length !== 8) throw new VmFault('sound_value_required', at);
      return [
        num(f.echo_left, 255, at),
        num(f.echo_right, 255, at),
        hexValue(f.efb, 2, at),
        hexValue(f.esa, 2, at),
        num(f.edl, 255, at),
        ...f.fir.map((v) => hexValue(v, 2, at)),
        hexValue(f.flg, 2, at),
      ];
    },
  },
  // $14, sound n at $14 + 16 n (play0776/start07A0): vibrato number (0 none,
  // else entry n - 1 of $16), volume (times $26/$27 / 256 to VOL L/R), pitch
  // word, sample number (SRCN), ADSR1, ADSR2, GAIN, release (ADSR2 at the
  // end, 0 key off), duration word ($31/$39), flags (bit 0 noise NON, 1 echo
  // EON, 2 rank kept without duration, 3 refused at equal rank, 4 fixed
  // pitch, bits 6-7 glide mode), rank ($66), byte 13 (no reader, 00 in all),
  // note table word ($0192/$019A: 12 pitch words, used unless bit 4).
  sounds: {
    decode: (b) =>
      b.length % 16 ||
      Array.from({ length: b.length / 16 }, (_, n) => b[16 * n + 13]).some((v) => v)
        ? null
        : {
            sounds: Array.from({ length: b.length / 16 }, (_, n) => {
              const r = b.slice(16 * n, 16 * n + 16);
              return {
                vibrato: r[0],
                volume: r[1],
                pitch: h4(words(r, 2)),
                sample: r[4],
                adsr1: h2(r[5]),
                adsr2: h2(r[6]),
                gain: h2(r[7]),
                release: h2(r[8]),
                duration: words(r, 9),
                flags: h2(r[11]),
                rank: r[12],
                notes: h4(words(r, 14)),
              };
            }),
          },
    encode: (f, at) =>
      (f.sounds ?? []).flatMap((s) => [
        num(s?.vibrato, 255, at),
        num(s.volume, 255, at),
        ...wordBytes(hexValue(s.pitch, 4, at)),
        num(s.sample, 255, at),
        hexValue(s.adsr1, 2, at),
        hexValue(s.adsr2, 2, at),
        hexValue(s.gain, 2, at),
        hexValue(s.release, 2, at),
        ...wordBytes(num(s.duration, 0xffff, at)),
        hexValue(s.flags, 2, at),
        num(s.rank, 255, at),
        0,
        ...wordBytes(hexValue(s.notes, 4, at)),
      ]),
  },
  // $16: ARAM pointers to the vibrato records.
  vibrato_table: wordList,
  // The section after $16: first the vibrato records, 6 bytes apart (start07A0
  // reads phase word to $0142/$014A, rate word to $0152/$015A and depth to
  // $0172 for 0x0DBF; byte 5 has no reader, 00 in all), then the note tables of the
  // sounds, 12 pitch words each: the low nibble of a note picks the word,
  // the high nibble shifts its octave (octave(), 5 unchanged).
  vibrato_pitch: {
    decode: (b, d) => {
      const v = d.vibratos,
        rest = b.length - 6 * v;
      if (
        !Number.isInteger(v) ||
        rest < 0 ||
        rest % 24 ||
        Array.from({ length: v }, (_, n) => b[6 * n + 5]).some((x) => x)
      )
        return null;
      return {
        vibratos: Array.from({ length: v }, (_, n) => ({
          phase: h4(words(b, 6 * n)),
          rate: h4(words(b, 6 * n + 2)),
          depth: b[6 * n + 4],
        })),
        pitches: Array.from({ length: rest / 24 }, (_, n) =>
          Array.from({ length: 12 }, (_, k) => h4(words(b, 6 * v + 24 * n + 2 * k))),
        ),
      };
    },
    encode: (f, at) => [
      ...(f.vibratos ?? []).flatMap((v) => [
        ...wordBytes(hexValue(v?.phase, 4, at)),
        ...wordBytes(hexValue(v.rate, 4, at)),
        num(v.depth, 255, at),
        0,
      ]),
      ...(f.pitches ?? []).flatMap((t) => {
        if (t?.length !== 12) throw new VmFault('sound_value_required', at);
        return t.flatMap((w) => wordBytes(hexValue(w, 4, at)));
      }),
    ],
  },
  // $18: ARAM pointers to the song headers (song06A3, song n at entry n - 1).
  song_table: wordList,
  // A songs chunk is its pieces in address order (SONG_PIECES), found by
  // parseSongs. Pointers stay ARAM words; a pointer into the chunk's own
  // ARAM range must name a piece start of the right kind, so a piece that
  // changes its length without moving the pointers is refused
  // (sound_song_layout_changed). Pointers into other chunks are not checked.
  songs: {
    decode: (b, d) => {
      const starts = [...(d.kinds?.keys() ?? [])].sort((x, y) => x - y),
        pieces = [];
      if (starts[0] !== 0) return null;
      for (const [n, k] of starts.entries()) {
        const kind = d.kinds.get(k),
          piece = SONG_PIECES[kind].decode(b, k, starts[n + 1] ?? b.length);
        if (!piece || k + piece[1] !== (starts[n + 1] ?? b.length)) return null;
        pieces.push({ [kind]: piece[0] });
      }
      return { pieces };
    },
    encode: (f, at) => {
      const kinds = new Map(),
        bytes = [];
      for (const p of f.pieces ?? []) {
        const kind = Object.keys(p ?? {})[0];
        if (!SONG_PIECES[kind] || Object.keys(p).length !== 1)
          throw new VmFault('sound_value_required', at);
        kinds.set(bytes.length, kind);
        for (const v of SONG_PIECES[kind].encode(p[kind], at)) bytes.push(v);
      }
      const base = /^[0-9A-F]{4}$/.test(f.aram?.[0] ?? '') ? parseInt(f.aram[0], HEX_RADIX) : null;
      const check = (w, kind) => {
        const k = parseInt(w, HEX_RADIX) - base;
        if (base !== null && k >= 0 && k < bytes.length && kinds.get(k) !== kind)
          throw new VmFault('sound_song_layout_changed', at);
      };
      for (const p of f.pieces ?? []) {
        if (p.song) {
          p.song.tracks.filter((w) => w !== '0000').forEach((w) => check(w, 'track'));
          check(p.song.tempo_list, 'tempo');
        }
        if (p.track) p.track.forEach((w) => check(w, 'pattern'));
      }
      return bytes;
    },
  },
};

// A sample is BRR (Book I PDF 178/179): 9-byte blocks, header bit 0 (end)
// only in the last block. The loop bit there decides whether the voice
// jumps to the loop address of its directory entry (src/apu/dsp.mjs).
function checkBrr(bytes, address) {
  if (!bytes.length || bytes.length % BRR_BLOCK) throw new VmFault('sound_brr_required', address);
  for (let k = 0; k < bytes.length; k += BRR_BLOCK)
    if ((bytes[k] & 1) !== (k + BRR_BLOCK === bytes.length ? 1 : 0))
      throw new VmFault('sound_brr_required', address);
}
const hexBytes = (bytes) => Array.from(bytes, (v) => hex(v, BYTE_HEX_DIGITS)).join('');
// One WAV per sample, named by its ROM address.
const sampleFile = (address) => `vm-samples/${label(address).replace(':', '')}.wav`;
// Block headers from the hex string of a sample entry.
function sampleHeaders(d, address) {
  if (typeof d.blocks !== 'string' || !d.blocks.length || !/^([0-9A-F]{2})+$/.test(d.blocks))
    throw new VmFault('sound_value_required', address);
  return Uint8Array.from(d.blocks.match(/../g), (v) => parseInt(v, HEX_RADIX));
}
const dataLength = (d) =>
  CODECS[d.role] ? CODECS[d.role].encode(d, d.address).length : (d.blocks.length / 2) * BRR_BLOCK;

// The ROM ranges the catalog occupies: pointer table, directories with their
// mode lists, lists, data.
export function soundRanges(read8) {
  const word = wordReader(read8);
  const sound = readSound(read8);
  return [
    [SOUND_POINTERS, LONG_BYTES * SOUND_DIRECTORIES.length],
    ...sound.directories.map((d) => [
      parse(d.address),
      word(parse(d.address)) + 2 * d.modes.length + 1,
    ]),
    ...sound.lists.map((l) => [parse(l.address), listBytes(l.chunks)]),
    ...sound.data.map((d) => [parse(d.address), dataLength(d)]),
  ];
}

const listBytes = (chunks) =>
  LIST_HEADER_BYTES + chunks.reduce((n, c) => n + (c.data ? RAW_CHUNK_BYTES : FILL_CHUNK_BYTES), 0);

// samples maps each sample's file name to its PCM (readWav in brr.mjs).
export function placeSound(rom, present, { directories, lists, data }, samples) {
  const put = romWriter(rom, present, 'sound_layout_changed');
  const putWord = (cpu, v) => {
    put(cpu, v);
    put(cpu + 1, v >> BYTE_BITS);
  };
  const putLong = (cpu, v) => {
    putWord(cpu, v);
    put(cpu + 2, v >> WORD_BITS);
  };
  if (directories?.length !== SOUND_DIRECTORIES.length)
    throw new VmFault('sound_layout_changed', SOUND_POINTERS);
  const lengths = new Map();
  for (const d of data ?? []) {
    const address = parse(d.address, SOUND_POINTERS);
    if (CODECS[d.role]) {
      const encoded = CODECS[d.role].encode(d, address);
      if (!encoded.length || encoded.length >= FILL_FLAG)
        throw new VmFault('sound_value_required', address);
      span(address, encoded.length);
      encoded.forEach((v, i) => put(address + i, v));
      lengths.set(address, encoded.length);
      continue;
    }
    if (d.role !== 'samples' || d.file !== sampleFile(address))
      throw new VmFault('sound_value_required', address);
    if (!samples?.[d.file]) throw new VmFault('sound_bytes_required', address);
    const headers = sampleHeaders(d, address);
    if (headers.length * BRR_BLOCK >= FILL_FLAG) throw new VmFault('sound_value_required', address);
    const bytes = encodeBrr(samples[d.file], headers, d.nibbles ?? {}, address);
    checkBrr(bytes, address);
    span(address, bytes.length);
    bytes.forEach((v, i) => put(address + i, v));
    lengths.set(address, bytes.length);
  }
  const listAddresses = new Set();
  for (const l of lists ?? []) {
    const address = parse(l.address, SOUND_POINTERS);
    const destination = parseInt(l.destination, HEX_RADIX);
    if (!/^[0-9A-F]{4}$/.test(l.destination ?? ''))
      throw new VmFault('sound_value_required', address);
    let total = 0,
      y = LIST_HEADER_BYTES;
    span(address, listBytes(l.chunks));
    for (const c of l.chunks) {
      if (c.data) {
        const source = parse(c.data, address);
        if (!lengths.has(source)) throw new VmFault('sound_data_required', address);
        putWord(address + y, lengths.get(source));
        putLong(address + y + CHUNK_ARGUMENT, source);
        total += lengths.get(source);
        y += RAW_CHUNK_BYTES;
      } else {
        if (
          !Number.isInteger(c.fill) ||
          c.fill < 1 ||
          c.fill >= FILL_FLAG ||
          !/^[0-9A-F]{4}$/.test(c.word ?? '')
        )
          throw new VmFault('sound_value_required', address);
        putWord(address + y, FILL_FLAG | c.fill);
        putWord(address + y + CHUNK_ARGUMENT, parseInt(c.word, HEX_RADIX));
        total += 2 * c.fill;
        y += FILL_CHUNK_BYTES;
      }
    }
    if (total + 2 > WORD_MASK) throw new VmFault('sound_value_required', address);
    putWord(address, total + 2);
    putWord(address + LIST_DESTINATION, destination);
    listAddresses.add(address);
  }
  const list = (text, at) => {
    const address = parse(text, at);
    if (!listAddresses.has(address)) throw new VmFault('sound_list_required', at);
    return address;
  };
  directories.forEach((d, n) => {
    const address = parse(d.address, SOUND_POINTERS);
    const length = DIRECTORY_FIXED_BYTES + ITEM_BYTES * d.items.length;
    if (!Array.isArray(d.modes)) throw new VmFault('sound_layout_changed', address);
    span(address, length + 2 * d.modes.length + 1);
    putLong(SOUND_POINTERS + SOUND_DIRECTORIES[n], address);
    putWord(address, length);
    putLong(address + DIRECTORY_BASE, list(d.base, address));
    d.items.forEach((item, k) => {
      if (!/^[0-9A-F]{2}$/.test(item.id ?? '') || item.id === 'FF')
        throw new VmFault('sound_value_required', address);
      put(address + DIRECTORY_ITEMS + ITEM_BYTES * k, parseInt(item.id, HEX_RADIX));
      putLong(address + DIRECTORY_ITEMS + ITEM_LIST + ITEM_BYTES * k, list(item.list, address));
    });
    put(address + DIRECTORY_ITEMS + ITEM_BYTES * d.items.length, ITEMS_END);
    d.modes.forEach((m, k) => {
      if (
        !/^[0-9A-F]{2}$/.test(m.mode ?? '') ||
        m.mode === '00' ||
        !/^[0-9A-F]{2}$/.test(m.item ?? '')
      )
        throw new VmFault('sound_value_required', address);
      put(address + length + 2 * k, parseInt(m.mode, HEX_RADIX));
      put(address + length + 2 * k + 1, parseInt(m.item, HEX_RADIX));
    });
    put(address + length + 2 * d.modes.length, 0);
  });
}
