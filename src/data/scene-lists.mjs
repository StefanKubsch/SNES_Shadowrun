// Command lists of the scene loader $81:EC16 (src/task/main-scene-video.mjs):
// X/Y give the list address, each command is a byte that indexes the word
// table 81:EC2F, its arguments follow. 00 ends the list; 01 and 06 to 08 do
// nothing; 02 (EC42) two words to DP 6E/70; 03 (EC68) VRAM word address,
// source offset, source bank word and DMA length: 80:F2A0 unpacks the stream
// into 7E:46A8 and the DMA sends it to VRAM; 04 (EC4F) three words for the
// palette copy ECF2; 05 (ECB7) port word and value byte.
// Palettes: 04 takes X, a bank word and an offset; ECF2 writes 2 (X & FF)
// bytes from bank:offset to CGRAM from colour X >> 8 (2121/2122, one byte per
// store) and to the shadow 7E:0D1E. A count of 0 would wrap the 16-bit Y and
// is refused. The palettes of every known list are taken (readSceneListPalettes),
// also of the lists without a proven register state (PALETTE_LISTS). A
// palette that runs into a packed stream ends there; the stream keeps those
// bytes (81:FF1A, 64 colours in 81:F586, reaches the stream 81:FF40 after 19).
// The format of a stream follows from the VRAM address and the BG and OBJ
// registers at the end of its list, when the scene is shown; lists often
// set them after the transfers (Book I chapter 27, PDF 115-119; docs/PPU-BROWSER.md;
// the same bases as src/video/ppu-frame.mjs): BGnSC 2107-2109 (map base
// (v & FC) << 8 words, 32 or 64 columns and rows), BG12NBA/BG34NBA 210B/210C
// (character base nibble << 12 words), OBSEL 2101 (base (v & 7) << 13
// words), BGMODE 2105 must be mode 1 (BG1 and BG2 4 bpp, BG3 2 bpp). If
// layers with different formats share the address, the layers enabled in
// TM 212C decide (81:F768: BG2 and BG3 characters at 2000, only BG3 shown).
// Only lists with a proven register state give formats (listSeeds):
// - 81:EBE9 sets 2107=00 2108=04 2109=08 210B=24 210C=01 2101=43 2105=09 212C=17.
// - 81:CDF8 calls EBE9 and then EC16 with entry DP 1E of the table 81:F48D;
//   the table has six entries and ends where the first list begins.
// - 81:D60F calls EBE9 and then EC16 with 81:F6EF; 81:DFE7 follows with 81:F79F.
// - 81:DDDB calls EBE9 and then EC16 with 81:F768.
// - 81:C3CA calls EC16 with 81:CDB2 without EBE9; that list sets all
//   registers itself before its first stream.
import { VmFault } from '../vm/memory.mjs';
import { FIXED_SOURCES } from './lz-streams.mjs';
import { hex, label, romWriter, wordReader } from './rom-bytes.mjs';
import {
  BYTE_MASK,
  WORD_MASK,
  BYTE_BITS,
  HEX_RADIX,
  WORD_BITS,
  NIBBLE_BITS,
  NIBBLE_MASK,
  BYTE_HEX_DIGITS,
  WORD_HEX_DIGITS,
} from '../constants/bits.mjs';
import {
  OBJSEL,
  BGMODE,
  BG1SC,
  BG2SC,
  BG3SC,
  BG12NBA,
  BG34NBA,
  TM,
} from '../constants/hardware-registers.mjs';
import {
  BGSC_BASE_MASK,
  BGSC_BASE_SHIFT,
  BGSC_WIDE,
  BGSC_TALL,
  SCREEN_MAP_BYTES,
  CHARACTER_BASE_STEP,
  OBJSEL_BASE_MASK,
  OBJ_NAME_BASE_STEP,
  BGMODE_MODE_MASK,
  VRAM_WORD_BYTES,
} from '../constants/ppu.mjs';

// The lists and the CDF8 table lie in bank $81.
const LIST_BANK = 0x81,
  LIST_BANK_BASE = 0x810000;
const CDF8_LISTS = 0x81f48d,
  CDF8_LIST_COUNT = 6;
const EBE9_REGISTERS = {
  [BG1SC]: 0x00,
  [BG2SC]: 0x04,
  [BG3SC]: 0x08,
  [BG12NBA]: 0x24,
  [BG34NBA]: 0x01,
  [OBJSEL]: 0x43,
  [BGMODE]: 0x09,
  [TM]: 0x17,
};
const TRACKED = [OBJSEL, BGMODE, BG1SC, BG2SC, BG3SC, BG12NBA, BG34NBA, TM];
// Commands and the bytes of their arguments.
const LIST_END = 0,
  LIST_POINTER = 2,
  LIST_UNPACK = 3,
  LIST_PALETTE = 4,
  LIST_PORT = 5,
  LIST_NOPS = [1, 6, 7, 8],
  LAST_COMMAND = 8,
  ARGUMENT_BYTES = { [LIST_POINTER]: 4, [LIST_UNPACK]: 8, [LIST_PALETTE]: 6, [LIST_PORT]: 3 };
// Mode 1: BG1 and BG2 4 bpp, BG3 2 bpp; TM bit 4 is OBJ.
const MODE_1 = 1,
  MODE_1_LAYERS = 3,
  BG3_LAYER = 2,
  OBJ_LAYER = 4;

// Chains of lists run in order on one register state; null = unknown state.
function listSeeds(read8) {
  const word = wordReader(read8);
  const cdf8 = Array.from({ length: CDF8_LIST_COUNT }, (_, n) => [
    EBE9_REGISTERS,
    [LIST_BANK_BASE | word(CDF8_LISTS + 2 * n)],
  ]);
  if (Math.min(...cdf8.map(([, [cpu]]) => cpu)) !== CDF8_LISTS + 2 * CDF8_LIST_COUNT)
    throw new VmFault('scene_list_table_required', CDF8_LISTS);
  return [
    ...cdf8,
    [EBE9_REGISTERS, [0x81f6ef, 0x81f79f]],
    [EBE9_REGISTERS, [0x81f768]],
    [null, [0x81cdb2]],
  ];
}

// Lists whose register state is not proven: 81:E7BC with 8A:8000 and
// 89:EC26, 81:E171 with 81:F7B5, 81:D6E8/D71A with 81:F6DF/F6E5.
const PALETTE_LISTS = [0x8a8000, 0x89ec26, 0x81f7b5, 0x81f6df, 0x81f6e5];

// The commands of one list as [op, argument address].
function listCommands(read8, list) {
  const out = [];
  for (let p = list; ;) {
    const op = read8(p++);
    if (op === LIST_END) return out;
    if (op > LAST_COMMAND) throw new VmFault('scene_list_command_required', p - 1);
    out.push([op, p]);
    p += ARGUMENT_BYTES[op] ?? 0;
  }
}

// The palette ranges [cpu, bytes] of all known lists, sorted, overlaps merged.
export function readSceneListPalettes(read8) {
  const word = wordReader(read8),
    ranges = [];
  const lists = [...listSeeds(read8).flatMap(([, chain]) => chain), ...PALETTE_LISTS];
  for (const list of lists)
    for (const [op, p] of listCommands(read8, list))
      if (op === LIST_PALETTE) {
        const count = word(p) & BYTE_MASK;
        if (!count) throw new VmFault('scene_list_palette_required', p);
        ranges.push([(word(p + 2) << WORD_BITS) | word(p + 4), 2 * count]); // magic-number-ok: argument offsets
      }
  const starts = [
    ...FIXED_SOURCES.map(([cpu]) => cpu),
    ...readSceneListStreams(read8).map(([cpu]) => cpu),
  ];
  return mergeRanges(
    ranges.map(([cpu, length]) => [
      cpu,
      Math.min(
        length,
        ...starts.filter((at) => at > cpu && at < cpu + length).map((at) => at - cpu),
      ),
    ]),
  );
}
export function mergeRanges(ranges) {
  const out = [];
  for (const [cpu, length] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = out.at(-1);
    if (last && cpu <= last[0] + last[1]) last[1] = Math.max(last[1], cpu + length - last[0]);
    else out.push([cpu, length]);
  }
  return out;
}

// The format a stream sent to VRAM word address v takes under registers r.
function formatAt(r, v, cpu) {
  if (TRACKED.some((p) => r[p] === undefined) || (r[BGMODE] & BGMODE_MODE_MASK) !== MODE_1)
    throw new VmFault('scene_list_registers_required', cpu);
  // VRAM word addresses: the byte bases of the PPU fields halved.
  const words = (bytes) => bytes / VRAM_WORD_BYTES;
  const found = [];
  for (let layer = 0; layer < MODE_1_LAYERS; layer++) {
    const sc = r[BG1SC + layer],
      base = words((sc & BGSC_BASE_MASK) << BGSC_BASE_SHIFT),
      extent = words(SCREEN_MAP_BYTES) * (sc & BGSC_WIDE ? 2 : 1) * (sc & BGSC_TALL ? 2 : 1);
    if (v >= base && v < base + extent) found.push(['map', layer]);
    const nibble = (r[BG12NBA + (layer >> 1)] >> ((layer & 1) * NIBBLE_BITS)) & NIBBLE_MASK;
    if (v === nibble * words(CHARACTER_BASE_STEP))
      found.push([layer === BG3_LAYER ? 'bg2' : 'bg4', layer]);
  }
  if (v === (r[OBJSEL] & OBJSEL_BASE_MASK) * words(OBJ_NAME_BASE_STEP))
    found.push(['obj4', OBJ_LAYER]);
  const formats = (list) => [...new Set(list.map(([format]) => format))];
  let result = formats(found);
  if (result.length > 1) result = formats(found.filter(([, layer]) => (r[TM] >> layer) & 1));
  if (result.length !== 1) throw new VmFault('scene_list_format_required', cpu);
  return result[0];
}

// Every stream of the seeded lists as [cpu, format, list]; a stream that two
// lists read must take the same format.
export function readSceneListStreams(read8) {
  const word = wordReader(read8),
    streams = new Map();
  for (const [initial, chain] of listSeeds(read8)) {
    const r = { ...(initial ?? {}) };
    for (const list of chain) {
      const sent = [];
      for (const [op, p] of listCommands(read8, list)) {
        if (op === LIST_UNPACK)
          sent.push([(word(p + 4) << WORD_BITS) | word(p + 2), word(p)]); // magic-number-ok: argument offsets
        else if (op === LIST_PORT && TRACKED.includes(word(p))) r[word(p)] = read8(p + 2);
      }
      for (const [cpu, v] of sent) {
        const format = formatAt(r, v, cpu);
        if (streams.has(cpu) && streams.get(cpu)[1] !== format)
          throw new VmFault('scene_list_format_required', cpu);
        if (!streams.has(cpu)) streams.set(cpu, [cpu, format, list]);
      }
    }
  }
  return [...streams.values()].sort((a, b) => a[0] - b[0]);
}

// The lists as readable JSON (assets/vm-scene-lists.json). They lie in runs
// that end where other proven data begins: 81:F48D (the CDF8 table, then its
// lists) to the text stream 81:F5CE, 81:F6DF to the stream 81:F803, 81:CDB2 to
// the code at 81:CDF8, 8A:8000 to the palette 8A:8031, 89:EC26 to the palette
// 89:EC4D. A list runs to the next list of its run; it ends with 00, or it has
// none and continues into the next (81:F529 into 81:F53E, the same tail).
// Commands: {pointer} (02, DP 6E/70), {unpack, vram, length} (03), {palette,
// first, count} (04), {port, value} (05), {nop} (01, 06-08); addresses as
// bank:offset, the rest in hex. A bank word above FF is refused.
export const LIST_RUNS = [
  [0x81f48d, 0x81f5ce, true],
  [0x81f6df, 0x81f803],
  [0x81cdb2, 0x81cdf8],
  [0x8a8000, 0x8a8031],
  [0x89ec26, 0x89ec4d],
];
const parse = (text) =>
  /^[0-9A-F]{2}:[0-9A-F]{4}$/.test(text ?? '') ? parseInt(text.replace(':', ''), HEX_RADIX) : NaN;

export function readSceneLists(read8) {
  const word = wordReader(read8);
  const long = (offset, bank) => {
    if (word(bank) > BYTE_MASK) throw new VmFault('scene_list_bank_required', bank);
    return label((word(bank) << WORD_BITS) | word(offset));
  };
  const starts = new Set([...listSeeds(read8).flatMap(([, chain]) => chain), ...PALETTE_LISTS]);
  return LIST_RUNS.map(([run, end, table]) => {
    const entries = table
      ? Array.from({ length: CDF8_LIST_COUNT }, (_, n) => LIST_BANK_BASE | word(run + 2 * n))
      : [];
    const first = run + 2 * entries.length,
      inRun = [...starts].filter((s) => s >= first && s < end).sort((a, b) => a - b);
    if (inRun[0] !== first) throw new VmFault('scene_list_layout_required', run);
    const lists = inRun.map((address, i) => {
      const next = inRun[i + 1] ?? end,
        commands = [];
      let p = address,
        ended = false;
      while (p < next) {
        const op = read8(p++);
        if (op === LIST_END) {
          ended = true;
          break;
        }
        if (op === LIST_POINTER) {
          commands.push({ pointer: long(p, p + 2) });
        } else if (op === LIST_UNPACK) {
          commands.push({
            unpack: long(p + 2, p + 4), // magic-number-ok: argument offset
            vram: hex(word(p), WORD_HEX_DIGITS),
            length: hex(word(p + 6), WORD_HEX_DIGITS), // magic-number-ok: argument offset
          });
        } else if (op === LIST_PALETTE) {
          commands.push({
            palette: long(p + 4, p + 2), // magic-number-ok: argument offset
            first: hex(read8(p + 1), BYTE_HEX_DIGITS),
            count: hex(read8(p), BYTE_HEX_DIGITS),
          });
        } else if (op === LIST_PORT) {
          commands.push({
            port: hex(word(p), WORD_HEX_DIGITS),
            value: hex(read8(p + 2), BYTE_HEX_DIGITS),
          });
        } else if (LIST_NOPS.includes(op)) commands.push({ nop: op });
        else throw new VmFault('scene_list_command_required', p - 1);
        p += ARGUMENT_BYTES[op] ?? 0;
      }
      if (p !== next) throw new VmFault('scene_list_layout_required', address);
      return { address: label(address), ...(!ended && { continues: true }), commands };
    });
    return { address: label(run), ...(table && { table: entries.map(label) }), lists };
  });
}

function encodeSceneList({ commands, continues }, cpu) {
  const out = [],
    words = (...values) => values.forEach((v) => out.push(v & BYTE_MASK, v >> BYTE_BITS));
  const at = (text) => {
    const v = parse(text);
    if (Number.isNaN(v)) throw new VmFault('scene_list_address_required', cpu);
    return v;
  };
  const h = (text, digits) => {
    if (!new RegExp(`^[0-9A-F]{${digits}}$`).test(text ?? ''))
      throw new VmFault('scene_list_hex_required', cpu);
    return parseInt(text, HEX_RADIX);
  };
  if (!Array.isArray(commands)) throw new VmFault('scene_list_command_required', cpu);
  for (const c of commands) {
    if ('pointer' in c) {
      const v = at(c.pointer);
      out.push(LIST_POINTER);
      words(v & WORD_MASK, v >>> WORD_BITS);
    } else if ('unpack' in c) {
      const v = at(c.unpack);
      out.push(LIST_UNPACK);
      words(
        h(c.vram, WORD_HEX_DIGITS),
        v & WORD_MASK,
        v >>> WORD_BITS,
        h(c.length, WORD_HEX_DIGITS),
      );
    } else if ('palette' in c) {
      const v = at(c.palette);
      out.push(LIST_PALETTE);
      words(
        (h(c.first, BYTE_HEX_DIGITS) << BYTE_BITS) | h(c.count, BYTE_HEX_DIGITS),
        v >>> WORD_BITS,
        v & WORD_MASK,
      );
    } else if ('port' in c) {
      out.push(LIST_PORT);
      words(h(c.port, WORD_HEX_DIGITS));
      out.push(h(c.value, BYTE_HEX_DIGITS));
    } else if (LIST_NOPS.includes(c.nop)) out.push(c.nop);
    else throw new VmFault('scene_list_command_required', cpu);
  }
  if (!continues) out.push(LIST_END);
  return out;
}

// Writes the runs; each list must end exactly where the next begins (or at
// the end of its run), so no pointer to a list moves (scene_list_layout_changed).
export function placeSceneLists(rom, present, { runs }) {
  const put = romWriter(rom, present, 'scene_list_layout_changed');
  if (runs?.length !== LIST_RUNS.length) throw new VmFault('scene_list_runs_required');
  runs.forEach((run, r) => {
    const [start, end, table] = LIST_RUNS[r],
      bytes = [];
    if (
      parse(run.address) !== start ||
      !!table !== Array.isArray(run.table) ||
      (table && run.table.length !== CDF8_LIST_COUNT)
    )
      throw new VmFault('scene_list_layout_changed', start);
    for (const entry of run.table ?? []) {
      const v = parse(entry);
      if (v >>> WORD_BITS !== LIST_BANK) throw new VmFault('scene_list_layout_changed', start);
      bytes.push(v & BYTE_MASK, (v >> BYTE_BITS) & BYTE_MASK);
    }
    run.lists.forEach((list, i) => {
      const address = parse(list.address),
        next = i + 1 < run.lists.length ? parse(run.lists[i + 1].address) : end;
      if (address !== start + bytes.length) throw new VmFault('scene_list_layout_changed', address);
      bytes.push(...encodeSceneList(list, address));
      if (start + bytes.length !== next) throw new VmFault('scene_list_layout_changed', address);
    });
    bytes.forEach((value, k) => {
      put(start + k, value);
    });
  });
}
