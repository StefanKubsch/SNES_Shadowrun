// Part graphics of the object types (docs/ROM-FREE.md, step 2). A part of an
// object type (src/data/object-types.mjs) selects graphic g; $81:903E reads
// the long pointer at $96:C3FA + 3 g into DP 14/16 (src/task/main-scene-layers.mjs)
// and walks the graphic at [14]:
// - byte 0: low nibble rows - 1 (DP 41, outer loop, each row moves the high
//   byte of DP 38 by one), high nibble cells per row - 1 (DP 44/47, inner
//   loop, each cell adds 2 to DP 38),
// - byte 1: bit 7 set (D14 = 7FFE) gives only the first cell of each row a
//   depth byte, clear (D14 = 0) gives every cell one; bits 0-6 go through
//   8CE0 to the palette bits (DP 4A), as the attribute byte of a tileset,
// - per cell the optional depth byte (added to DP 3E, giving DP 50) and a
//   word, the tile stack entry (XOR the flip bits in DP 35); a zero word
//   leaves the cell empty.
// The table has 658 entries and ends at 96:CBB0, exactly where the graphics
// continue. The graphics lie back to back in nine runs, mostly filling the
// ends of banks; each run ends at a bank end (up to two bytes before it), at
// the table or, for the last, at 96:FD19. The 64 bytes at 8D:FD78 inside
// graphic 70 are also sent to VRAM by DMA as OBJ characters (vm-vram.json);
// those bytes are shared and must stay equal in both files.
// Native form assets/vm-object-graphics.json: per graphic its attribute, the
// depth mode (cell or row) and its rows of cells, a cell being "DD.WWWW" with
// a depth byte or "WWWW" without; per run the order of its graphics.
import { VmFault } from '../vm/memory.mjs';
import { romOffset } from './rom-bytes.mjs';
import {
  WORD_MASK,
  BYTE_MASK,
  BYTE_BITS,
  BYTE_HEX_DIGITS,
  HEX_RADIX,
  WORD_BITS,
  WORD_HEX_DIGITS,
  LONG_BYTES,
  NIBBLE_BITS,
  NIBBLE_MASK,
} from '../constants/bits.mjs';

export const GRAPHIC_TABLE = 0x96c3fa,
  GRAPHICS = 658;
export const GRAPHIC_RUNS = [
  [0x81fff2, 0x820000],
  [0x85ffe7, 0x85ffff],
  [0x88ffe3, 0x890000],
  [0x8bfe15, 0x8bfffd],
  [0x8cff62, 0x8d0000],
  [0x8dfcf8, 0x8e0000],
  [0x95f740, 0x95ffff],
  [0x968000, GRAPHIC_TABLE],
  [0x96cbb0, 0x96fd19],
];
export const GRAPHIC_SHARED = [0x8dfd78, 0x8dfdb8];

const hex2 = (v) => v.toString(HEX_RADIX).toUpperCase().padStart(BYTE_HEX_DIGITS, '0');
const hex4 = (v) => v.toString(HEX_RADIX).toUpperCase().padStart(WORD_HEX_DIGITS, '0');
const label = (cpu) => `${hex2(cpu >> WORD_BITS)}:${hex4(cpu & WORD_MASK)}`;
// Graphic: size byte (columns - 1 in the high, rows - 1 in the low nibble),
// attribute byte (bits 0-6, bit 7: one depth byte per row instead of per cell),
// then per cell an optional depth byte and a word. Table entries are long pointers.
const ROW_DEPTH = 0x80,
  ATTRIBUTE_MASK = 0x7f,
  MAX_CELLS = NIBBLE_MASK + 1,
  CELL_BYTES = 3,
  ENTRY_BYTES = LONG_BYTES;

function readGraphic(read8, at) {
  const b0 = read8(at),
    b1 = read8(at + 1),
    rowDepth = !!(b1 & ROW_DEPTH);
  let y = at + 2;
  const rows = Array.from({ length: (b0 & NIBBLE_MASK) + 1 }, () =>
    Array.from({ length: (b0 >> NIBBLE_BITS) + 1 }, (_, c) => {
      const depth = !rowDepth || c === 0 ? hex2(read8(y++)) + '.' : '';
      const word = read8(y) | (read8(y + 1) << BYTE_BITS);
      y += 2;
      return depth + hex4(word);
    }).join(' '),
  );
  return {
    graphic: { attribute: b1 & ATTRIBUTE_MASK, depth: rowDepth ? 'row' : 'cell', rows },
    end: y,
  };
}

export function readObjectGraphics(read8) {
  const pointer = (n) =>
    read8(GRAPHIC_TABLE + ENTRY_BYTES * n) |
    (read8(GRAPHIC_TABLE + ENTRY_BYTES * n + 1) << BYTE_BITS) |
    (read8(GRAPHIC_TABLE + ENTRY_BYTES * n + 2) << WORD_BITS);
  const at = Array.from({ length: GRAPHICS }, (_, n) => pointer(n));
  const byAddress = new Map(at.map((cpu, n) => [cpu, n]));
  if (byAddress.size !== GRAPHICS) throw new VmFault('graphic_layout_required');
  const graphics = [],
    runs = GRAPHIC_RUNS.map(([start, end]) => {
      const order = [];
      let next = start;
      while (next < end) {
        const n = byAddress.get(next);
        if (n === undefined) throw new VmFault('graphic_layout_required', next);
        const { graphic, end: after } = readGraphic(read8, next);
        graphics[n] = graphic;
        order.push(n);
        next = after;
      }
      if (next !== end) throw new VmFault('graphic_layout_required', next);
      return { start: label(start), end: label(end), graphics: order };
    });
  if (runs.reduce((count, r) => count + r.graphics.length, 0) !== GRAPHICS)
    throw new VmFault('graphic_layout_required');
  return { graphics, runs };
}

const need = (ok, reason, n) => {
  if (!ok) throw new VmFault(reason, n);
};

// Writes each run's graphics back to back in its order and the table; a run
// must not grow past its end. Only the shared bytes at 8D:FD78 may be
// present already, and only with the same value.
export function placeObjectGraphics(rom, present, { graphics, runs }) {
  need(graphics.length === GRAPHICS && runs.length === GRAPHIC_RUNS.length, 'graphics_required');
  const put = (cpu, value) => {
    const o = romOffset(cpu);
    if (present[o]) {
      if (cpu < GRAPHIC_SHARED[0] || cpu >= GRAPHIC_SHARED[1])
        throw new VmFault('graphic_layout_changed', cpu);
      if (rom[o] !== value) throw new VmFault('graphic_shared_byte_changed', cpu);
      return;
    }
    rom[o] = value;
    present[o] = 1;
  };
  const seen = new Set();
  runs.forEach((run, r) => {
    const [start, end] = GRAPHIC_RUNS[r];
    need(run.start === label(start) && run.end === label(end), 'graphic_run_required', r);
    let at = start;
    for (const n of run.graphics) {
      need(
        Number.isInteger(n) && n >= 0 && n < GRAPHICS && !seen.has(n),
        'graphic_run_required',
        r,
      );
      seen.add(n);
      const { attribute, depth, rows } = graphics[n];
      const cells = rows.map((row) => row.split(' '));
      const width = cells[0].length,
        rowDepth = depth === 'row';
      need(
        Number.isInteger(attribute) &&
          attribute >= 0 &&
          attribute <= ATTRIBUTE_MASK &&
          (rowDepth || depth === 'cell'),
        'graphic_header_required',
        n,
      );
      need(
        cells.length >= 1 &&
          cells.length <= MAX_CELLS &&
          width >= 1 &&
          width <= MAX_CELLS &&
          cells.every((row) => row.length === width),
        'graphic_size_required',
        n,
      );
      need(
        cells.every((row) =>
          row.every((cell, c) =>
            (!rowDepth || c === 0 ? /^[0-9A-F]{2}\.[0-9A-F]{4}$/ : /^[0-9A-F]{4}$/).test(cell),
          ),
        ),
        'graphic_cell_required',
        n,
      );
      const size = 2 + cells.length * (CELL_BYTES * width - (rowDepth ? width - 1 : 0));
      need(at + size <= end, 'graphic_layout_changed', n);
      put(GRAPHIC_TABLE + ENTRY_BYTES * n, at & BYTE_MASK);
      put(GRAPHIC_TABLE + ENTRY_BYTES * n + 1, (at >> BYTE_BITS) & BYTE_MASK);
      put(GRAPHIC_TABLE + ENTRY_BYTES * n + 2, at >> WORD_BITS);
      put(at++, ((width - 1) << NIBBLE_BITS) | (cells.length - 1));
      put(at++, attribute | (rowDepth ? ROW_DEPTH : 0));
      for (const row of cells)
        for (const cell of row) {
          const [depthByte, word] = cell.includes('.') ? cell.split('.') : [null, cell];
          if (depthByte !== null) put(at++, parseInt(depthByte, HEX_RADIX));
          const value = parseInt(word, HEX_RADIX);
          put(at++, value & BYTE_MASK);
          put(at++, value >> BYTE_BITS);
        }
    }
  });
  need(seen.size === GRAPHICS, 'graphics_required');
}
