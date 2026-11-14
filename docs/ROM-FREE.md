# Game without the ROM

User decision of 2026-10-30: the previous plan (recording) is set aside for
now. The product should no longer need the original ROM; all content
(scripts, graphics, maps, texts, music, samples, tables) is available
natively. Chosen path: **original format first, then decoded.**

- **Step 1 (original format):** all data ranges are a data package in
  `assets/`, the code bytes are absent. The product runs without the ROM,
  and all original comparisons stay bit-exact because the bytes are the
  same.
- **Step 2 (decoded, per category):** ranges are identified by content and
  turned into editable formats (PNG, JSON, text, WAV) with a lossless way
  back into the original layout. A test per category proves that the way
  back gives the same bytes.

The ROM remains reserved for tools and original comparisons (Mesen, source
contracts, generators). Since 2026-11-09, the European `Shadowrun (E).smc`
and German `Shadowrun (G).sfc` are local, ignored inputs rather than tracked
files. Existing local copies stay in the repository root; a fresh checkout
needs separately supplied copies before ROM-based tools or tests can run.
The browser and static web build use the versioned native assets instead.
Removing the files from the current tree does not remove historical Git
LFS pointers or previously uploaded LFS objects; history was not rewritten.

Current follow-up (2026-11-09): the product runs from decoded assets with
188 original-form bytes retained (93 code/read-margin bytes and 95
unidentified data bytes). The [retained-code audit](ROM-CODE-AUDIT.md)
removed 200 unnecessary margins at transitions between two code classes;
all decoded data, recorded readers and genuine data margins remain intact.
The [unidentified-data audit](ROM-UNREAD-AUDIT.md)
records the three remaining structures, neighboring readers, recording
limits and the preserved European assets of four unused characters named
by the supplied TCRF PDFs. No raw bytes or unused graphics were removed.
The dated procedure and delivery notes below describe the earlier stages.

The [text-reference inventory](TEXT-REFERENCES.md) now covers all 1,603
Huffman text starts through 1,786 established references, with numeric
matches kept separate. The [editable text layer](EDITABLE-TEXT.md) supports
variable-length Huffman and ASCII frontend content behind stable original
identities. The [matrix editing contract](MATRIX-TEXT-EDITING.md) now records
all 22 matrix identities, original rendering controls, glyph mappings,
layout limits and the dynamic IC-count path. All 22 identities now support
variable-length English/German edits through the shared edit file, with
29-column lines, bounded streams and enqueue-time language/count snapshots.
No pointer rewriting is needed for the delivered edit layer.

The [packed intro/credits contract](PACKED-TEXT-EDITING.md) establishes
the two remaining packed text identities, language-specific fonts and
aliases, structural terminators, safe line/page layouts and occupied
placement neighbors. Original/native boundary comparisons cover the
credits' 32-column stride and low-byte stores. Both streams now accept
variable-length line content through the shared edit file, with fixed
line/page counts, validated glyphs and temporary bounded source banks.
Text/map/font snapshots stay coherent across language switches. Native
live checks observe edited output and installed fonts in both languages.

The [packed graphics/map audit](PACKED-ASSET-EDITING.md) records the original
source spans of all 1,536 room tile streams and 253 length-prefixed streams.
Of those, 1,759 directly adjoin another stream; 883 native word reads borrow
one existing neighbor byte. The separate `vm-room-tile-edits.json` layer now
supports room tile pixel edits within unchanged source slots, with complete
validation before applying any edits, original tails retained for shorter
streams, and atomic rejection of invalid or oversized edit sets. Empty edits
preserve the baseline cartridge. Native and cold live checks cover the output.

The [character consumer audit](CHARACTER-STREAM-EDITING.md) establishes static
consumers for all 58 length-prefixed character sources, including 37 shared
portrait sources used by 139 records. Twenty-three scene commands transfer
WRAM beyond the stream output, which remains outside the pixel identity.
Two language-specific fonts stay separate. The `vm-character-edits.json`
layer implements fixed-slot pixel changes for the other 56 shared sources,
with atomic validation, original headers/tails retained and language-shared
portrait aliases. Focused checks cover native unpack and visible frontend
output. Release results are recorded in HANDOFF.md.

## Findings about the ROM

- The ported code reads data only through `VmMemory.read8`. No module in
  `src/` reads the ROM any other way. The address view is therefore the only
  interface, and the data package replaces the ROM without touching the
  ported routines.
- Code lies only in banks 80 and 81 (64 KiB). Every ROM address outside them
  in the JS port is a data table. Banks 82 to 9F (960 KiB) hold scripts,
  script tables and further data.
- The text reader 81:D531 reads a word at the terminator and thus one byte
  past the end of the text (81:D59E, the first byte of the next routine).
  Such word reads make a margin necessary (see below).

## Step 1: procedure

1. **Code coverage** (`node tools/rom-code-coverage.mjs [scenario]`, needs
   Mesen): every instruction start executed in Mesen with P and E at its
   first execution, merged into `analysis/rom-code-observed.json`.
   Scenarios: cold start, intro without input, new game, morgue, street,
   alley with fight and dog, apartment (saved game), group overview, item
   list, bed menu, karma menu, status screen with spells, the business
   man's offer and room tours over all room table entries.
2. **Bytes read** (`node --import ./tools/rom-reads-hook.mjs --test
--test-concurrency=1 tools/live-*.test.mjs`, then `node tools/rom-reads.mjs`):
   every ROM byte the native product reads, merged into
   `analysis/rom-reads.json`.
3. **ROM map** (generator `analyze:vm-rom-map`, `tools/rom-map.mjs`): a class
   per byte in `analysis/vm-rom-map.json`:
   - `code`: executed by Mesen, length from the observed M/X. Only these
     bytes are left out.
   - `code_kept`: executed code that is read, and as a margin the first code
     byte after each non-code byte (a word read at the end of data).
   - `code_static`: traced as code only statically (entries from vectors,
     the native and opcode tables, all listings in `analysis/*.asm.txt` and
     the observed instructions). It stays in the package, because tracing
     mistakes would otherwise delete data (example: menu texts behind
     81:E250).
   - `script`, `script_table`: scripts and their tables.
   - `unknown`: everything else, kept as data.
4. **Data package** (generator `extract:vm-cartridge`, `tools/build-cartridge.mjs`):
   in step 1 `assets/vm-cartridge.bin` with every byte except `code`, the
   range list in `assets/vm-cartridge.json`. Since 2026-11-01 there is no
   binary part: see "No binary part" below.
5. **Product:** `src/data/cartridge.mjs` assembles the address view;
   `VmMemory` reports a read of an absent byte as `rom_byte_absent`. The
   browser loads the package instead of a ROM file.

Safety direction: incomplete code coverage only leaves too much code in the
package, never too little data. A missing data byte shows up as
`rom_byte_absent` and is added with its read recording.

## Status

Step 1 delivered (2026-10-30): the browser and live tests run from the data
package without the ROM. The page no longer offers a ROM selection. The live
tests `live-aim`, `live-cold-start`, `live-game-browser`, `live-mouse`,
`live-save`, `live-talk` use `tools/cartridge-harness.mjs`. Original
comparisons, observed rooms (`ObservedRoom`) and generators still read the
ROM.

## Numbers (2026-10-30)

| Class                        | Bytes   |
| ---------------------------- | ------- |
| `code` (left out)            | 30.897  |
| `code_kept` (read or margin) | 285     |
| `code_static` (kept)         | 18.260  |
| `script`                     | 88.067  |
| `script_table`               | 5.565   |
| `unknown` (data)             | 905.502 |

- Package: 1.017.679 bytes in 893 ranges.
- Mesen coverage: 13.744 instruction starts from five scenarios (cold start
  3.600 frames, morgue, street, alley, apartment).
- Bytes read: 293.574 from all live tests (`live-game-over` with the closed
  plan up to the Lone Star mark included). Two of them are executed code
  (81:D59E, 81:D694) and stay in the package.
- Static tracing: 8 conflicts, 73 state corrections from observation,
  21 PLP without PHP on the path, 11 indirect jumps without targets.

## Step 2: categories (delivered)

Order by benefit; each category with source evidence (reading routine in the
port), format description, decoder, encoder and way-back test:

- **Scripts (delivered 2026-10-30):** header (local bytes, stack header) and
  bytecode of all 937 scripts and all seven tables (script bank, pointer,
  return and argument bytes; native pointer, return bytes and argument
  words) come from `assets/scripts.json` and the `scripts` section of the
  manifest (addresses per script and native, location of the tables). Code:
  [src/data/scripts.mjs](../src/data/scripts.mjs). 93.632 bytes are absent
  from the binary part for this. The builder assembles the package with the
  product's loader and stops at any difference from the ROM. The 448 bytes
  in 105 gaps between scripts stay undetermined in the binary part.
- **Texts (delivered 2026-10-30):** 1603 dialog and term texts as readable
  JSON in `assets/vm-texts.json` (generator `extract:vm-texts`,
  `tools/extract-texts.mjs`). Format and encoder:
  [src/data/texts.mjs](../src/data/texts.mjs). Evidence from the port:
  - Tree from 9D:8000, 351 nodes of two words each, 352 leaves (257
    character pairs, 95 single characters). Bit 15 marks a leaf with the
    first character in bits 8 to 14 and the second in bits 0 to 6; bit 7 is
    set when a second character is present. FE69 outputs the high character
    first.
  - AF04 reads words, but through XBA it outputs the bits of the first byte
    first. In effect this is a byte stream with the highest bit first.
  - Bit 15 of the text pointer selects the bank (9D or 9E). Character 10
    ends the text.
  - In the original the texts follow without gaps: 9D:857C to 9D:FFE8 (1159
    texts) and 9E:8000 to 9E:AD27 (444 texts), then scripts.

  The way back is byte-identical for all texts: a greedy encoder that prefers
  a character pair over a single character, with zero fill bits. Limit: each
  text keeps its address, because pointers to it are in scripts and tables.
  A text may therefore only change so that its encoded length stays the
  same; otherwise the loader reports `text_layout_changed`. Free editing
  later needs a directory of all text pointers. The 2026-11-09
  [inventory](TEXT-REFERENCES.md) supplies the established slots and explicit
  candidate boundaries; the loader's length constraint is still in force.

  The German texts of the alternative language are a separate asset,
  `assets/vm-texts-de.json` from the German ROM; they are not part of the
  cartridge data and replace texts only at display time
  ([LANGUAGES.md](LANGUAGES.md)).

- **Menu texts (delivered 2026-10-31):** the 15 texts that 81:D531 writes
  (copyright line, main menu, saved games, options) as ASCII in
  `assets/vm-menu-texts.json` (generator `extract:vm-menu-texts`, code
  [src/data/menu-texts.mjs](../src/data/menu-texts.mjs)). Every caller loads
  Y with a fixed address in bank 81 (LDY #), so each text keeps its address
  and length (`menu_text_layout_changed`). Four runs between code: 81:D582
  to D59E, E3B2 to E3DA, E425 to E446, E4A1 to E50C. Class `menu_text`,
  208 bytes; the raw part has 486.255 bytes.
- **Room tiles (delivered 2026-10-30):** 1536 packed streams of four 8×8
  tiles at 4 bits each as indexed BMP sheets `assets/vm-tiles-82.bmp` to
  `-87.bmp`. This is lossless and raw (user rule): every pixel is the
  original index 0 to 15; the grey palette only serves the view. Added to
  that is `assets/vm-tiles.json` with address and decomposition per stream
  (generator `extract:vm-tiles`; code
  [src/data/tiles.mjs](../src/data/tiles.mjs), [src/data/lz.mjs](../src/data/lz.mjs)).
  Evidence:
  - A1E1 fetches the word for a tile from the table 8D:A41F (1536 entries).
    The bank is 82 + entry / 256; the data stand at the pointer + 2.
  - 9E7E always unpacks 128 bytes. 9AE6 reads 32 bytes per tile, plane by
    plane (byte p·8 + y).
  - The packing format is derived from native-unpack.mjs and described in
    src/data/lz.mjs.
  - The streams follow each other without gaps from xx:8000 in each bank.

  Way back: the lengths of the references equal the greedy longest match,
  the positions are not unique (greedy with the latest match hits only 162
  of 444 observed streams). The original decomposition per stream is
  therefore in the JSON. When it fits the pixels, the result is
  byte-identical (checked for all 1536). After an edit the loader packs
  greedily and validly. The stream must stay in its place, however;
  otherwise the loader reports `tile_layout_changed`.

- **Palettes, part 1 (delivered 2026-10-30):** the 40 ranges (42 transfers,
  overlaps merged, 1.198 bytes) that the game writes in the live tests by
  DMA straight from the ROM to CGRAM (`analysis/rom-palettes.json`). They
  are BGR555 hex words in `assets/vm-palettes.json` (generator
  `extract:vm-palettes`, code [src/data/palettes.mjs](../src/data/palettes.mjs)).
- **Palettes, part 2 (delivered 2026-10-30):** both palette tables in full.
  - 80:999A writes 30 bytes from 8C:F624 + 32·n (number from CFE), 81:A919
    30 bytes from 8D:F1BA + 16·n (number from 17D6); evidence in
    src/task/main-game-nmi.mjs.
  - The lower bound is number 0 (block with colour 0 from 8C:F622 or
    8D:F1B8). No upper bound is in the code; the first table ends before
    the first word with bit 15 (8C:FF62).
  - Correction (2026-10-31): the second table ends at 8D:FB78, not 8D:FB98.
    At 8D:FB78 begin the OBJ characters that 80:C06B sends to VRAM
    (4302 = FB78, 4304 = 8D, 4301 = 18; tools/analyze-render-c06b.mjs). The
    last block n = 154 ends exactly there (8D:F1BA + 16 n + 30).
  - Together 10 ranges with 5.102 bytes.

  - Palettes of the scene command lists (2026-10-31): command 04 of 81:EC16
    copies 2 (X & FF) bytes from bank:offset through 81:ECF2 to CGRAM from
    colour X >> 8 (src/data/scene-lists.mjs, readSceneListPalettes). All
    known lists count, also those without a proven register state. 15
    ranges with 1.510 bytes; 81:FF1A (64 colours in the ending list
    81:F586) runs into the stream 81:FF40 after 19 colours and ends there.
    Together 25 ranges; the raw part has 490.010 bytes.

  - Palette cycles (2026-10-31): `assets/vm-palette-cycles.json`
    (generator `extract:vm-palette-cycles`, code
    [src/data/palette-cycles.mjs](../src/data/palette-cycles.mjs)). 81:801A
    looks a palette number up in the table 8B:FD75 (six entries) and copies
    the record header (first colour with a reverse bit, DMA length, speed,
    steps) into the cycle slots; 81:8076 steps the index, 81:80C4 sends
    length bytes from colour 2 index by DMA to CGRAM. A record holds
    2 (steps - 1) + length bytes of colours; the six records follow the
    table back to back and end at 8B:FE15, where the part graphics begin.
    The 10 bytes at 8B:FDE3 the probe saw belong to the fifth record and
    left `vm-palettes.json` (now 24 ranges). Class `palette_cycle`, 160
    bytes; the raw part has 486.105 bytes.

  Open: palettes copied through WRAM.

- **VRAM characters (delivered 2026-10-31):** all ROM ranges the game sends
  by general DMA straight to VRAM in the live tests, as indexed BMP sheets
  `assets/vm-vram-obj4.bmp` (OBJ, 4 bpp) and `assets/vm-vram-bg2.bmp` (BG,
  2 bpp) plus `assets/vm-vram.json` (address, format and number of
  characters per range). Generator `extract:vm-vram`, code
  [src/data/vram-tiles.mjs](../src/data/vram-tiles.mjs). 80 ranges, 2408
  characters, 76.704 bytes in banks 8D to 95.
  - Probe (kept in the repo this time): `node --import
./tools/rom-vram-hook.mjs --test --test-concurrency=1
tools/live-*.test.mjs`, then `node tools/rom-vram.mjs` writes
    `analysis/rom-vram.json`. The hook records every DMA from ROM to
    2118/2119 with source, length, VMAIN and VRAM address, owns each written
    VRAM byte by its transfer and marks at every NMI entry how the visible
    screen uses owned bytes, with the addressing of the renderer: BG tilemap,
    BG1/BG2 4 bpp, BG3 2 bpp, OBJ 4 bpp.
  - Result over all 20 live tests (16 minutes): 1193 distinct sources of 64
    bytes (two OBJ characters each), all used as OBJ characters at phase 0
    or, if never seen on screen (69 sources), sent to the same VRAM word
    addresses as those. One range of 368 bytes at 95:F160 is used as BG3
    characters (2 bpp). 49 fill transfers (fixed source byte, 81:AC8C and
    others) stay raw. No ROM tilemaps and no 4 bpp BG characters come
    straight from ROM; those go through WRAM or the unpacker.
  - Overlap: the CGRAM transfer 95:F140 (48 bytes) shares its last 16 bytes
    with the first 2 bpp character at 95:F160. Those stay with the palette;
    the BG range starts at 95:F170 (22 characters).
  - Way back: each range keeps its address; a byte already present is
    refused (`vram_layout_changed`), a pixel above the format's range too
    (`vram_pixel_range_required`). The builder checks byte equality with the
    ROM through the product's loader.
- **Packed streams (delivered 2026-10-31):** all 50 streams that the live
  tests unpack through 9F49/9F4D (into bank 7E) and 9F6D (portraits, into
  bank 7F), 45.293 bytes in banks 80 to 8B. `assets/vm-lz.json` holds per
  stream address, format, the original packing and the output; characters
  are in `assets/vm-lz-bg2.bmp`, `-bg4.bmp` and `-obj4.bmp`. Generator
  `extract:vm-lz`, code [src/data/lz-streams.mjs](../src/data/lz-streams.mjs).
  - Entry (src/task/native-unpack.mjs, native-dialog-portrait.mjs): A source
    offset, Y source bank, X destination; the stream begins with the output
    length as a word, the packed data follow.
  - Probe: the same run as for the VRAM characters. The module hook
    `tools/rom-unpack-loader.mjs` wraps the unpacker entries; the stream
    owns its output in WRAM, and a DMA from WRAM passes the ownership on to
    VRAM only for bytes that still equal the output. Result per source in
    `analysis/rom-vram.json` (`streams`); 20/20 live tests, 19 minutes.
  - Formats: 15 BG tilemaps (`map`, words in hex), 5 BG 4 bpp, 3 BG 2 bpp,
    9 OBJ 4 bpp, 18 as plain bytes. A stream takes the kind whose phase-0
    uses hold at least 95 % of its marked bytes; the rest are bytes equal
    to the output by chance (87:D71A 2.3 %, 84:D8DD 0.06 %). The 18 byte
    streams are not seen in VRAM directly: 14 streams through 9F6D into
    7F:DA14, 81:FF40 into 7E:23A0, 8B:FBD2 into 7E:2E00, 81:F5CE into
    7E:62A8 and 81:F803 into 7E:56A8 or 7E:46A8; their meaning is still
    open.
  - Scene records (2026-10-31): the 14 byte streams into 7F:DA14 are scene
    records. 81:A117 (src/task/main-scene-load.mjs) takes offset and bank of
    scene n from the table 8B:F9E3 + 3 n and unpacks the record. The table
    has 165 entries: it ends where the stream 8B:FBD2 begins, entry 165 is
    no ROM pointer, all 165 records unpack and no two share an address. All
    165 records are now streams in `assets/vm-lz.json` (151 more than the
    live tests reach, 44.058 bytes), and the table (class `scene_table`,
    495 bytes) is written from `scenes`, the record address per scene.
    Together 201 streams; the raw part has 567.930 bytes.
  - Scene record format (2026-10-31): readable in `assets/vm-scenes.json`
    (code [src/data/scenes.mjs](../src/data/scenes.mjs)), one entry per
    scene in table order; the streams of format `scene` in
    `assets/vm-lz.json` keep only address and packing. Evidence from the
    reader 81:A117 and its helpers (src/task/main-scene-load.mjs,
    main-scene-layers.mjs):
    - backdrop word: to 7E:0D12, which the NMI writes as colour 0 to CGRAM
      (80:99DC/99E2, src/task/main-game-nmi.mjs); 162 scenes use 0000.
    - tileset byte (0 to 5): index into 8D:F1A0 and 8D:F1AC (block and
      attribute pointers).
    - shapes (81:8DE2): count byte, then a position word (grid 7F:CA14) and
      a line (value, length; bit 14 selects step 82 instead of 7E) or, with
      bit 15, a rectangle (value, width, height; bit 14 draws the border
      8D3D first).
    - two object lists (81:903E) for the layers 7E:76A8 and 7E:46A8: count
      byte, then per object a word (type bits 0-12 into 8A:C36A, flip bit
      15, high bytes of x and y in bits 13 and 14) and z (signed), x, y.
      The layout reads all 165 records exactly to their end, and decode plus
      encode gives the same bytes for all. Names for x, y and z follow the
      reader's use (DP 35, 38, 3B); what value, type and tileset mean in the
      game is not named yet.
  - Tilesets (2026-10-31): `assets/vm-tilesets.json` (code
    [src/data/tilesets.mjs](../src/data/tilesets.mjs)). The tileset byte n
    of a scene selects 8D:F1A0 + 2 n (blocks) and 8D:F1AC + 2 n
    (attributes); 81:8EDF writes per grid cell the eight words of a block
    (two columns of four rows) with the palette bits from its attribute
    byte (8CE0). The six tilesets lie back to back from 8D:D0B0, blocks
    then attributes; the counts (attributes - blocks) / 16 equal the
    attribute bytes up to the next tileset (128, 80, 80, 24, 80, 104 blocks),
    the last ends at the pointer tables and those end at the palette table
    8D:F1B8. Class `tileset`, 8.456 bytes.
  - Object types (2026-10-31): `assets/vm-objects.json` (code
    [src/data/object-types.mjs](../src/data/object-types.mjs)). The type
    of a scene object indexes the table 8A:C36A. A definition has an 8-byte
    header (part count, three offset words for 903E, box count at byte 7),
    parts of 5 bytes (903E: graphic index into 96:C3FA with flip bit,
    column, row, depth) and collision boxes of 6 bytes (81:84DE: signed
    start and size for three axes). All 548 definitions lie back to back
    from 8A:883E in type order and end exactly at the table; the table has
    one ascending pointer per type and ends at 8A:C7B2, where a packed
    stream begins. Class `object_type`, 16.244 bytes; the raw part has
    543.230 bytes. Names column, row and depth follow the reader's use.
  - Part graphics (2026-10-31): `assets/vm-object-graphics.json` (code
    [src/data/object-graphics.mjs](../src/data/object-graphics.mjs)). A part
    selects graphic g; 903E reads the long pointer at 96:C3FA + 3 g. A
    graphic has a byte with rows - 1 (low nibble) and cells per row - 1
    (high nibble), a byte with the depth mode (bit 7: a depth byte only in
    the first cell of each row, else in every cell) and the attribute (bits
    0-6, palette bits through 8CE0), then per cell the optional depth byte
    and the tile stack word (0000 empty). The table has 658 entries and ends
    at 96:CBB0, where the graphics continue; all 658 graphics lie back to
    back in nine runs (bank ends of 81, 85, 88, 8B, 8C, 8D and 95, then
    96:8000 to the table and 96:CBB0 to 96:FD19). Graphic 656 is used by no
    object type. The 64 bytes at 8D:FD78 inside graphic 70 are also sent to
    VRAM as OBJ characters; they stay `vram_tile` and must be equal in both
    files. Class `object_graphic`, 35.689 bytes; the raw part has 507.541
    bytes.
  - Texts and character maps (2026-10-31): five streams the live tests do
    not reach or do not see in VRAM, listed with their reader in
    FIXED_SOURCES (src/data/lz-streams.mjs). 81:F5CE is the intro text
    (format `text`: lines ended by 00, an empty line ends; drawn centred by
    81:DE93), 81:F2BD the credits (format `credits`: a count byte and that
    many lines, count 0 ends; 81:D1F0), and their character maps 81:F803
    (128 words) and 85:FD38 (160 words) give the tilemap word for character
    c at 7E:56A8 + 2 (c - 20). 81:FF40 is a 32 by 29 tilemap to which
    81:A9B2 adds 2017 per word (format `map`). The credits end at 81:F48D,
    where the table read by 81:CE2D begins. The raw part has 506.951 bytes.
  - Scene command lists (2026-10-31): 81:EC16 runs lists of commands; 03
    unpacks a stream through 80:F2A0 and sends it by DMA to a VRAM word
    address. [src/data/scene-lists.mjs](../src/data/scene-lists.mjs) reads
    the lists whose register state is proven (81:EBE9 defaults, then the
    ports of the list; CDF8 with its six lists of 81:F48D, D60F/DFE7 with
    F6EF and F79F, DDDB with F768, C3CA with CDB2) and takes the format
    from the registers at the end of the list (BG map ranges, character
    bases, OBJ base; Book I PDF 115-119, docs/PPU-BROWSER.md; TM 212C
    decides between layers with the same base). 26 streams: the 10 the
    probe saw get the same format, 16 are new (mostly the ending scenes of
    CDF8: OBJ 88:8000, BG characters and maps). Together 219 streams; the
    raw part has 491.520 bytes. Lists without a proven state (8A:8000,
    89:EC26, 81:F7B5) are left to the probe.
  - Matrix maps (2026-10-31): 81:C3CA unpacks through 80:F2A4 (9F6D) into
    bank 7F: 89:EC1B (one 32 by 32 map of source words, 81:B4D3 converts
    each by B4B9 and sends it to VRAM 2400), 89:E14E (16 such maps, map
    n = 7E:1D8F to VRAM 2000) and 89:EB4B (one map of the same layout into
    7F:8216, reader not named yet). Format `map`; they lie back to back
    from the palette 89:E04E to the list 89:EC26. 222 streams; the raw part
    has 486.463 bytes.
  - New-game state (2026-10-31): 8B:FBD2 unpacks to 7E:2E00 (80:98E9),
    703 records of 5 bytes, format `states` in vm-lz.json: only the 186
    records that differ from state 0000, count 0, holder FFFF, with their
    WRAM address. No script and no indexed access with a base near 2E00
    reads them; the code takes the full record address in X (actor table
    8D:B01F + 1 in 80:A3B6, 7E:13A8 per object) and reads 7E:0002 + X
    (count: 81:CECB, D079, 9DC8) and 7E:0003 + X (holder: FFFF = none,
    A3B6 creates the actor only then; 9CE4/9D15 set it, EA6E lists the
    records of holder 1F5A). Byte 0 is 00 everywhere; the reader of bytes 0
    and 1 is not named yet.
  - The command lists themselves (2026-10-31): `assets/vm-scene-lists.json`
    (readSceneLists, placeSceneLists). Five runs, each ending where other
    proven data begins: 81:F48D (the six pointers of CDF8, then its lists)
    to the text 81:F5CE, 81:F6DF to the map 81:F803, 81:CDB2 to the code
    81:CDF8, 8A:8000 and 89:EC26 to their palettes. 14 lists; 81:F529 has no
    00 and continues into 81:F53E. Commands as objects (pointer, unpack,
    palette, port, nop). A list must keep its length, otherwise the next
    list would move (`scene_list_layout_changed`). Class `scene_list`,
    771 bytes; the raw part has 489.239 bytes.
  - Way back: all streams repack byte for byte from their stored packing;
    an edit packs greedily (src/data/lz.mjs), and a stream that no longer
    fits its place is refused (`lz_layout_changed`).
- **More graphics (closed 2026-11-04):** this earlier open point is
  covered by the later deliveries below: the OBJ characters of all pictures
  and the C06B sources (`vram_tile`), the font, the palettes and every LZ
  stream. No data byte is left in the class `unknown` except the three
  unread ranges in `assets/vm-raw.json`.
- **Rooms (delivered 2026-10-31):** `assets/vm-rooms.json` (generator
  `extract:vm-rooms`, code [src/data/rooms.mjs](../src/data/rooms.mjs)).
  80:A4BF takes entry 7E:2DE2 of the room table 8D:929D (9 bytes: header
  word, byte to DP 11, words to DP 14, 17, 1A). A44D sets DP 88 = 99 + bit
  15 of the word and A4BF sets bit 15 of DP 86 by TSB, so a header lies at
  (99 + bit 15):(word | 8000). A2FA hands DP 11 to 80:AAAF (direction) and
  DP 14, 17, 1A to A835 (start x, y, z).
  - Table: 498 entries, it ends at 8D:A41F where the tile table begins; two
    entries hold the word FFFF and point nowhere.
  - Header: scene number (81:A117), music (FF none), a word pointer to the
    camera box (A4BF stores it minus 1 to 0CDA; the "byte not yet read" of
    the earlier finding is its high byte), then the actors (80:A3B6: count
    byte, 6 bytes each: x and y in bits 0-10, the high five bits of both
    give DP 06, offset into the actor table 8D:B01F), then five lists.
    81:8756 reads three with 81:8701 into the collision boxes (12 bytes,
    the second and third with a data word) and leaves DP 9D at the second;
    80:8000 tests the second (script) and third (target room). A4BF (80:A58C
    on) steps over these two to DP F3, the fourth list (points of 6 bytes,
    80:C6C7, D105, D2E7, 8D4E), and to DP FC, the fifth (12 bytes, the sight
    boxes of 81:A25F). The camera box follows: 81:8A05 reads 4 words unless
    the first is FFFF; a word FFFF ends the header, no code reads it.
  - Check: for all 192 headers the camera pointer equals the end of the
    fifth list, and the headers lie back to back from 99:8000 to 99:C5D8 and
    from 9A:8000 to 9A:AD64 (three of them have no table entry). Only A44D
    (80:A450, LDA #99) points into these banks among the executed code, and
    only 81:8A05 and 8BD9 read 0CDA/0CDB.
  - Way back: rooms are laid back to back per bank, the table words and box
    pointers come from the layout, so a room may change its size; a run that
    no longer fits is refused (`room_layout_changed`), a shorter one is
    filled with 00. Classes `room_table` (4.482 bytes) and `room` (29.500
    bytes); the raw part has 452.123 bytes.
  - Names x, y, z, direction, flags follow the readers; what the actor
    flags and the camera words mean in the game is not named yet.
  - Actor table (2026-10-31): `assets/vm-actors.json` (generator
    `extract:vm-actors`, code [src/data/actors.mjs](../src/data/actors.mjs)).
    Every room actor offset is a multiple of 7, and the 1191 offsets used
    cover the table without a gap from 8D:B01F to the tilesets at 8D:D0B0;
    the rooms now store the entry index. An entry: flags byte (80:A3FB
    skips the actor when flags ORA 7E:2DE4 is 0, 80:E5A1 lists it when
    flags AND 2DE4 AND 7F is not 0; bits 6 and 7 to 1400), the WRAM address
    of its new-game state record or 0 (each of the 703 records belongs to
    exactly one actor), the kind for A835 (3F28, index into 8C:EFB0) and the
    script A835 appends through C34A (all below 937). Offsets stay fixed
    (`actor_layout_changed`). Class `actor`, 8.337 bytes; the raw part has
    443.786 bytes.
  - Kind table (2026-10-31): `assets/vm-kinds.json` (generator
    `extract:vm-kinds`, code [src/data/kinds.mjs](../src/data/kinds.mjs)).
    The readers index 8C:EFB0 + 6 k (A835 reads +4 at 8C:EFB4): a name
    (text pointer for the name windows of BE6D, 9BC6, E9A8 and the lists of
    EA6E; FFFF none), a value returned to scripts by C9F1 and CAF2, and
    flags that A835 copies to 1458 (EA6E compares bits 0 and 1 with 1F66).
    The actors use kinds up to 274; 275 records end exactly at the palette
    table 8C:F622. All 227 names are text starts in vm-texts.json, 48 kinds
    have none. Class `kind`, 1.650 bytes; the raw part has 442.136 bytes.
  - Action lists (2026-10-31): `assets/vm-actions.json` (generator
    `extract:vm-actions`, code [src/data/actions.mjs](../src/data/actions.mjs)).
    80:D15C and 80:8371 read the word at 8C:ED8A + 2 k for slot kind k, a
    list of record pointers per action number. A record has 8 header bytes
    (to 4088, 10E8 XOR 80, 1248, 4240 to 4348 signed, 43A0); R + 8 goes to
    1090: eight bytes, one per direction (1198), give the offset of its
    first frame word (11F0). 80:AC2F steps 2 per frame and hands the word to
    ACD0, a picture at 9B:(word | 8000) or with bit 15 at 9C:word. Byte 0 is
    the speed (added to 4030), byte 1 the frame count with bit 7 for a loop
    (10E8 = byte XOR 80; without the bit the action ends after one pass with
    event 8). All 673 records are exactly the direction table and their
    frame runs (offsets even, 0 for a direction without frames, 3066 times);
    the JSON names speed, count, loop, directions and frames. The 275 table
    words end at the kind table 8C:EFB0; kind 274 points at the table
    itself. The other 253 lists and 673 records fill 8C:8000 to the table
    without a gap, every list word is a record start. Only these readers
    point into the range, so blocks are laid out again from the JSON and may
    change size (`action_layout_changed` past the table, 00 fill otherwise).
    Class `action`, 28.592 bytes; the raw part has 413.544 bytes. The older
    raw copy `assets/slot-action-data.json` of the earlier `src/state` path
    is unchanged.
  - Object pictures (2026-10-31): `assets/vm-pictures.json` (generator
    `extract:vm-pictures`, code [src/data/pictures.mjs](../src/data/pictures.mjs)).
    80:ACD0 reads the tile count n, then n pairs of words: 64-byte OBJ
    character sources that the NMI 81:A964 sends (4312 = word & FFC0, 4314
    = 8E + bits 0-5, 4315 = 40), all in banks 8E to 95. The layout behind
    them (7E:3F80) is read by 80:B20A: width, height, rows and columns as
    nibbles, one byte per cell (bit 5 empty, bits 6-7 flip). Bits 0-2 of
    the first cell go to F88; when set, ACD0 also reads the byte before the
    picture (signed times 4 to FE0). In all 2329 pictures the frames name,
    the empty cells match the tile count, and the pictures with these 100
    leading bytes fill 9B:8001 to 9B:C256 and 9C:8000 to 9C:D066 without a
    gap up to the scripts. Pictures keep address and size
    (`picture_layout_changed`). Class `picture`, 37.563 bytes; the raw part
    has 375.981 bytes.
  - OBJ characters of the pictures (2026-10-31): the 4037 distinct 64-byte
    sources the pictures name join the probe ranges in `vm-vram.json`
    (mergeVramRanges in src/data/vram-tiles.mjs, pictureSources in
    src/data/pictures.mjs). Banks 8E to 94 and 95:8000 to 95:F140 are now
    whole OBJ ranges (8106 characters in `vm-vram-obj4.bmp`, 11 ranges); in
    these banks only 95:F2D0 to 95:F740 (1.136 bytes) stay unknown. Class
    `vram_tile`, 259.040 bytes; the raw part has 193.645 bytes.
  - C06B sources (2026-10-31): C06B (proof/render/object-c06b.mjs) sends 2 x
    40 bytes of OBJ characters from 8D:FB78, FBF8 or FC78 by the gate
    7E:01E8; the probe saw only the first two. C06B_SOURCES in
    src/data/vram-tiles.mjs adds all three to vm-vram.json and the ROM map
    (8D:FB78 now 12 characters). Class `vram_tile` 259.168 bytes; the raw
    part has 23.019 bytes, `unknown` 1.798.
- **Cartridge header (delivered 2026-10-31):** `assets/vm-header.json`
  (generator `extract:vm-header`, code [src/data/header.mjs](../src/data/header.mjs)),
  80:FFC0 to FFFF. Source contract: Book I, "ROM Registration Data" (PDF
  32 to 35, printed 1-2-14 to 1-2-20) gives the fields title FFC0 (21 ASCII
  bytes, 20 for unused), map mode FFD5, cartridge type FFD6, ROM size FFD7,
  RAM size FFD8, destination FFD9, version FFDB, complement FFDC and
  checksum FFDE. Shadowrun uses the older form: FFDA holds the maker code
  6B instead of 33, and 80:FFB5 to FFBF do not follow the extended fields
  (FFB6 to FFBC are not 00), so those 11 bytes stay raw. The vectors
  FFE0 to FFFF are written as 16 named words; SnesDevManualCPU.pdf (PDF 5)
  names the ABORT, IRQ and NMI addresses, COP, BRK and RESET follow the
  65816 standard (the port proves BRK FFE6 to F2B3 and RESET E382). The
  generator checks the checksum against the sum of all ROM bytes. Class
  `header`, 64 bytes; the raw part has 23.147 bytes, `unknown` 1.926.
- **Text font (delivered 2026-10-31):** `assets/vm-font.bmp` (generator
  `extract:vm-font`, code [src/data/font.mjs](../src/data/font.mjs)).
  95:F2D0 to F740 are 142 characters of 8 x 8 pixels at one bit each, eight
  row bytes per character code (bit 7 left), read by the text composition
  FB2A (proof/render/text-compose.mjs) at 95:F2D0 + 8 * code; the characters
  sit at the right edge of their cell, their widths are `glyph_widths`
  81:AC0C. The BMP (user rule: lossless and raw) holds 16 characters per
  row, 128 x 72, pixel 15 set and 0 clear; any other pixel is
  `font_pixel_required`, ink in the two cells after the last character or
  another size `font_layout_changed`. Class `font`, 1.136 bytes, the last
  unknown range beside the OBJ characters; the raw part has 25.097 bytes,
  `unknown` 3.876.
- **Matrix texts (delivered 2026-10-31):** `assets/vm-matrix-texts.json`
  (generator `extract:vm-matrix-texts`, code
  [src/data/matrix-texts.mjs](../src/data/matrix-texts.mjs)), 81:C515 to
  CDB2:
  - 81:C515 six list pointers, taken by C39F for the matrix screen 1D90;
    the lists C521 to C538 are a count byte and long text pointers (all six
    hold one text), handed to the matrix text queue 81:B282.
  - 81:C539 to CDB2: 22 texts in a row, each ending with 00, printed by
    B2D1. Bytes from 20 on are characters (tile map 7E:FFC0); 01 to 1F are
    commands through the table 81:B370, which has real targets only for
    01 to 06: 01 to 03 palette (cmd - 1) << 10 (B37E), 04 new line (B389),
    05 n wait n (B3BC), 06 one character back (B3C8). In the JSON they are
    `{palette n}`, `\n`, `{wait n}`, `{back}`, any other byte `{xHH}`.
  - Text starts are confirmed by the port: the setup prints C62E, the
    matrix control prints C642, C658, C66F, C681, C696, C6B1, C6C3 and
    C6D8 by address. The 16 bytes the setup copies from 81:C60D to
    7F:0140 are the start of the text "FOUND X IC!" (an earlier note
    called them eight colour words).
  - Way back: every text keeps its address (`matrix_layout_changed`), a
    text that does not encode is `matrix_text_required`. Class
    `matrix_text`, 2.205 bytes; the raw part has 27.083 bytes, `unknown`
    5.862.
- **Lookup tables (delivered 2026-10-31):** `assets/vm-tables.json`
  (generator `extract:vm-tables`, code
  [src/data/tables.mjs](../src/data/tables.mjs)). Eight tables between code
  in banks 80 and 81 that the port reads by index, each as a list of
  values (words little-endian):
  - `lz_bit_lengths` 80:A033 (256): bit length of n, the back reference
    width of the unpacker 9F49 (src/data/lz.mjs),
  - `random_masks` 80:C540 (16 words FFFF >> k, C51F) and `random_bytes`
    80:C58D (256, C560),
  - `motion_offsets` 80:AEB4 (136 words 20 k, read from the bases AEB4 and
    AEC4 by the tile queue of AC2F),
  - `color_ramp` 80:D3D1 (512, 8877, D2E7, main loop upkeep),
  - `bit_reverse` 81:A017 (256, mirrored graphics and the unpacker body),
  - `glyph_widths` 81:AC0C (129, character codes 00 to 80; FADD, FB2A) and
    `text_masks` 81:AC8D (34; AEC8 from AC8D, the text composition from
    AC9D).
    The generator checks the rules of the four computed tables (bit length,
    mask, step 20, bit reversal). The loader places the tables first,
    because the tile and stream encoders read 80:A033 from the address view.
  - `text_numbers` 80:D9B8 (611 words, added the same day): the text
    pointer of each text number (bit 15 selects bank 9E), read by the
    selection 933A, the spell list E1CF (numbers from 7E:3C1C) and the
    notices FEC1 (DP0A) and passed to FE69. All 611 point at distinct text
    starts of vm-texts.json and are written as text addresses; number 0 is
    "Too far away.". Code follows at 80:DE7E (LDA #$FFFF).
  - Opcode handlers and matrix control tables (added 2026-10-31): two new
    kinds, signed words (`s2`) and pointers within the bank of the table
    (written as addresses, a zero word stays 0). `opcode_handlers` 80:F2B4
    (98 pointers, JMP ($F2B4,X) at 80:F390 with the even opcode byte; the
    generator checks every ported handler of src/script/opcodes.mjs). The
    matrix control of proof/matrix-reference/main-matrix-control.mjs and main-matrix-movement.mjs reads 25 tables in
    bank 81 by the direction 7E:141C (0 up, 4 right, 8 down, 12 left):
    damage ranges 81:BA3E, the push back BA50/BA60, the dispatch tables
    BB56 (pad direction), BC1B (track) and BD56 (state 7E:173E, the
    generator checks that the port has every target), tile and map steps
    BB76/BB86, speeds BB96 to BBC6, the animation pointers BBD6/BBE6 into
    81:BE69, the track values BC73 to BCB3, one tile ahead C23C/C24C, the
    bits C2D4 and the amounts C330/C396 of C25C. 580 bytes; the raw part
    has 26.503 bytes, `unknown` 5.282.
  - Matrix animation lists and object tables (added 2026-10-31, format
    `shadowrun-tables-v2`): `animations` holds the lists 81:BE69 to BEC2,
    picture words (OBJ name and attributes, hex) that BD99 takes one per
    step into 7E:13DA, each ending with FFFF (`loop`) or FFFE (`stop`, the
    list BEB1 that B8C8 sets for a new object). The generator checks that
    every picture pointer and BEB1 names a list start. Eleven more tables:
    the text commands 81:B372 (checked against the port), the cell steps
    B5F9/B601 of B56F, the side tables B642 to B662 of B609/B56F, the object
    marks B94F of B90F, the eight neighbours B9C0 of B959 and the OAM high
    table bits BE65 of BD99. 188 bytes; the raw part has 26.315 bytes,
    `unknown` 5.094.
  - Five small tables of bank 81 (added 2026-10-31): the bar tiles 81:B026
    of AF1F (31 words 2C08 to 2C15 by remainder, docs/reference/render-routines.md#af1f), the
    save slot offsets 81:B124 of B11A (0, 0FFE, 1FFC, 2FFA), the matrix
    blink colours 81:BFD4 (0000, 01E0 for CGRAM 9 and 13), the HDMA table
    81:C101 of C029 for 2109 (the generator checks the count and value
    pairs, Book I chapter 17.2, PDF 87 and 149-152) and the fixed DMA
    source byte 81:B258 of B228 (00). 82 bytes; the raw part has 26.233
    bytes, `unknown` 5.012.
  - Intro sprites and intro scenes (added 2026-10-31): the sprite grid
    81:E991 to EB7A of E83A (first OBJ name, columns, rows and signed
    offsets of 49 pictures), the frame lists 81:DADD (D9D5) and 81:DF77
    (DF0E; -1 stops, -2 loops back) with the event lists DB8B (E900) and
    DBE1 (E971) of three words each, and the six scene words of CDF8 at
    81:D3BF to D436 (audio mode, sound, wait target and steps, frame counts,
    sprite bases, the dispatch D41F of CF76 and the channel 7 HDMA window
    pointer) with the three HDMA tables D437/D44D/D463 (mode 1, 2126/2127).
    The generator checks the frame and event layout, the ported animation
    targets and the HDMA entries. 1.146 bytes; the raw part has 23.951
    bytes, `unknown` 2.730.
  - OAM masks, sound words and karma lists of bank 80 (added 2026-10-31,
    new kind `hex`, a word as four hex digits): the 128 size clear masks
    80:B18A and X bit 8 masks 80:B85E per OBJ slot (generator checks the
    rule), the 54 sound words 80:C4B3 of C46E (low byte the effect for F007
    command 5, bit 15 loads the set through F130 first) and the karma lists
    80:EFB2 to F005 of CE6D: WRAM byte, name text and maximum for the four
    attributes, four skills and six spells (checked against KARMA_LISTS;
    every text pointer of the file must now name a text start). 448 bytes;
    the raw part has 23.503 bytes, `unknown` 2.282.
  - Spell menu, walk steps and frontend lists (added 2026-10-31): the spell
    tables 80:E7C8 to E833 of E693 (36 level names, two script number
    columns, six spell names), the walk steps 80:DF27/DF39 of E014 and the
    pad directions 80:DF4B of DEC7, the motion steps 80:C7CC to C80B (the
    generator checks them against assets/slot-motion-direction-data.json),
    the intro spawns 81:DC78 of DC43 and the frontend VRAM copies 81:DC92.
    292 bytes; the raw part has 23.211 bytes, `unknown` 1.990.
  - Status screen, shots and frontend tables (added 2026-10-31, new kind 4,
    a long word; a text pointer 0 now stands for none, 9D:8000 is no text):
    the shot and hit objects 80:8A13 (8AB5) and 80:8840 (8691), the
    selection steps 80:BBFA (933A/BBA0), the status screen tables 80:ED0E
    to ED3B of EA6E (attribute rows and names, menu items ending with 0,
    submenu calls checked against SUBMENU_SEQUENCES), the decimal powers
    80:FE45, and in bank 81 the intro sound words E949/E951, unpacks D85C,
    E900 positions E12A/E13A, frontend VRAM uploads DD8B, text VRAM rows
    E7A0, sound words E7B4, fade steps D90F and E60B, the OAM entries E5CB
    and the scene list commands EC2F (checked against SCENE_VIDEO_COMMANDS).
    446 bytes; the raw part has 22.573 bytes, `unknown` 1.352.
  - Menus, window HDMA and small tables (added 2026-10-31, new kind
    `long`, a 24 bit address): the window HDMA tables 80:8F87 (8F3A),
    80:E480 (F254) and 81:D687, the A6C7 item lists 80:920D, CD91, CE65,
    CEC3 and EF78 (checked to end with 0), the depth compare dispatch
    80:B0E3/B126 (checked against COMPARE), formation offsets 80:BB88, swarm
    values 80:D2DD/D704, skill names 80:E8BC, upkeep sound arguments
    80:FF73, the AA9C stream pointers 80:FFAD, the fill bytes 81:A7FB and
    81:EE4E, the displacement bytes 81:D022/D0FD, sprite parts 81:D529 and
    the OAM bits 81:E8E1. 80:B933 is code (the unrolled STA $3D09 + 4 k that
    the sprite code of src/task/native-scene-sprites.mjs jumps into) and
    stays. 198 bytes; the raw part has 22.375 bytes,
    `unknown` 1.154.
    Class `lookup_table`, 2.969 bytes; the raw part has 29.288 bytes,
    `unknown` 8.067 (the matrix texts above took the rest of the large
    ranges in banks 80/81).
- **SPC700 sound driver (delivered 2026-10-31):** `assets/vm-spc-driver.json`
  (generator `extract:vm-spc-driver`, code
  [src/data/spc-driver.mjs](../src/data/spc-driver.mjs), instruction text
  [src/data/spc700.mjs](../src/data/spc700.mjs), Book I appendix C, PDF
  227-236). F07F sends the 0C55 bytes of 97:8000 to ARAM $0200
  (docs/SOUND-DRIVER.md). The native driver in src/apu runs instead of the
  code, but reads the tables from ARAM, and the APU accepts only these exact
  bytes (FNV check, `apu_program_unknown`); so the file is the readable form
  of exactly the original program:
  - `commands`: the 26 dispatch targets ($02C8 low, $02E2 high bytes),
  - `echo_registers`: the DSP list $03B5 of the echo header $0366 (EVOL L/R,
    EFB, ESA, EDL, C0 to C7, FLG; Book I PDF 168/176/177), zero-terminated,
  - `voice_bits` ($0471) and `vibrato_sine` ($0E14, 64 signed steps, read by
    the vibrato $0DBF),
  - `code`: the other 3.018 bytes as 1.522 lines "address instruction"; 1.513
    lines are the instructions the recursive decoding reaches, 9 lines the
    port poll $0348 that no path reaches.
    The assembler is the inverse of the decoder text for all 256 opcodes; a
    line no opcode gives is `spc_driver_line_unknown`, a gap or overlap
    `spc_driver_layout_changed`. The generator checks the way back to the ROM
    bytes and a line start at every reached instruction. Class `spc_driver`,
    3.157 bytes; the raw part has 32.257 bytes, `unknown` 13.712.
- **Runner table (delivered 2026-10-31):** `assets/vm-runners.json`
  (generator `extract:vm-runners`, code [src/data/runners.mjs](../src/data/runners.mjs)).
  80:9700 to 98E9, 13 rows (Jake and twelve runners; the readers search
  9700 from X = 18 down): object number (9700), member record pointer
  (971A word, 9734 bank; Jake 7E:3BFB, the others 18 bytes each filling
  80:9811 to 98E9), portrait dialog (974E, Jake 4E), the datajack word
  for 1F56 (9768, only EA6E), the name (9782, text pointer: Jake, Spatter, Jetboy,
  Norbert, Frogtongue, Anders, Akimi, Kitsune, Steelflight, Jangadance,
  Hamfist, Orifice, Dances), then the new-game blocks 80:98E9 copies by
  MVN: 13 counters for 7E:3C96 (979C) and 13 entries of 8 bytes for
  7E:3C2E (97A9; armour and weapon, see below). Class
  `runner`, 489 bytes; `unknown` 16.869, raw part 35.414 bytes.
  - Member records named (2026-10-31, format `shadowrun-runners-v2`): the
    status screen 80:EA6E labels bytes 0, 1, 2, 4 Body, Magic, Strength,
    Charisma (80:ED16) and shows byte 5 as the maximum of the state count
    1F5E (CECB caps, D079 sets; 10 x Body in all twelve) and 10 x Magic as
    the maximum of the magic points 7E:3C96 (the new-game bytes 979C are
    10 x Magic too, now `magic_points`). Bytes 6 to 11 are the skills of
    80:E834 (names 80:E8BC: Firearms, Unarmed combat, Armed combat,
    Computer, Leadership, Negotiation; 8860 rolls hits with 6 to 8, E30F
    takes 9), bytes 12 to 17 the spell levels of 80:E693 (names 80:E7BC:
    Powerball, Heal, Invisibility, Armour, Summon spirit, Freeze). Byte 3 is
    skipped by EA6E and has no known reader (`byte3`).
  - Equipment and datajack named (2026-10-31, format
    `shadowrun-runners-v3`): each 97A9 entry is the new-game armour and
    weapon. Word 0 (3C2E) is the armour object number (FFFF none), byte 2
    (3C30) its rating: A1E6/A2FA copy it to the object's 7E:43F8 (+2 for
    the leader with dermal armour 7E:3C18, text 7497) and 8691 subtracts
    43F8 from the damage roll; 8B16 sets both. Word 3 (3C31) is the weapon
    object number, bytes 5 to 7 its kind, damage and signed range (8860);
    8B9F sets all four, and E014 shows "You are not armed yet!" (753E)
    while 3C31 is negative. The window 80:E9C5 prints the weapon name, the
    rating and the armour name. The word 9768 (to 1F56) is the datajack:
    the notes window 80:E8C8 lists text 05B9 "Datajack" when it is not
    zero (FFFF or 0000 in all rows, now a boolean `datajack`).
  - The other unknown ranges in banks 80 and 81 (81:C515, 80:D9B8,
    81:B94F, 81:D93E, ...) are named in the port mostly as instruction
    addresses of ported routines (matrix, intro, frontend), so they are
    likely code Mesen never ran in the coverage scenarios. They stay in the
    package either way.
  - Jump table seeds (2026-10-31, tools/rom-map.mjs `JUMP_TABLES`): the
    static trace stopped at indirect jumps. It now goes on at the targets
    the port has ported for each one, with the traced state at the jump:
    80:B0AC/B0EF (depth compares, `COMPARE`), 80:ECEA (status submenus),
    81:B307 (matrix text commands), 81:BA93/BC09/BD52 (matrix control),
    81:CF76 (scene animation), 81:EC28 (scene command lists), and for the
    NMI's JML [$006E] at 80:C14F the ten proven callback roots of
    src/task/observed-nmi.mjs. Each table target must be one of the
    table's first 64 words in the ROM. `unknown` falls from 13.712 to
    11.036 bytes, `code_static` grows from 18.260 to 20.936; the package
    is unchanged (static code stays in it). One new conflict: 81:D9D5 is
    entered with 16-bit X from 81:DAD6 and with 8-bit X by JMP from 81:D949
    (frontend NMI), a real double entry. Left without targets: 80:B930
    JMP ($000E), 80:F390 (opcode table, seeded on its own), 80:F52F (native
    dispatch, seeded from the native table). The large unknown ranges left
    in banks 80/81 are tables by the port and the docs (80:D9B8 names,
    80:D3D1 for 8877, 80:AEB4 for AC2F, 81:C60D matrix data), not code.
- **Dialog portraits (delivered 2026-10-31):** `assets/vm-portraits.json`
  (generator `extract:vm-portraits`, code
  [src/data/portraits.mjs](../src/data/portraits.mjs)); the streams join
  `assets/vm-lz.json` as `obj4`.
  - Path: 80:936C takes the word at 80:94F7 + 2 n for dialog n, a dialog
    record in bank 8D; its first three bytes are the long pointer [F6] of a
    portrait record (also 80:F254 through 1F54 and Jake's dialogs 4E/4F).
    80:9F6D unpacks the stream named by the record's first three bytes to
    7F:5250 (64 characters, 2048 bytes; 8F20 spreads the rows, 8FF5 sends
    them to VRAM 0 or 0800), and the NMI 80:8FBA sends 0x1E bytes from
    [F6] + 3 to CGRAM from colour [$142] (91 or A1). A record is 33 bytes:
    stream pointer and 15 colours.
  - The table at 80:94F7 has 139 words up to the code at 80:960D (no code
    bound known); they name 139 distinct dialog records in 8D:80C0 to 9298,
    whose portrait records are distinct as well. The records lie back to
    back in reverse dialog order in five runs: 81:FF7F (3), 84:FF0E (7),
    85:FDB6 (17), 87:FFB4 (2) and 89:C1AA (110) up to the stream 89:CFD8.
  - 37 distinct streams, 29 of them new (the live tests had seen 8, as
    `obj4`): they fill 88:85D8, 88:A51F, 89:8000, 89:9E56 and 89:B410 back to
    back and end at 87:FFB4 and 89:C1AA where the records begin. The six
    colour sets the CGRAM probe had seen left `vm-palettes.json` (now 18
    ranges).
  - Class `portrait`, 4.587 bytes; `unknown` drops from 68.000 to 22.209
    bytes, the raw part from 86.545 to 40.754 bytes. In the BMP sheet a
    portrait is four rows of 16 characters, two portrait rows side by side.
  - Dialog records (2026-10-31): `assets/vm-dialogs.json` (generator
    `extract:vm-dialogs`, code [src/data/dialogs.mjs](../src/data/dialogs.mjs)).
    A record: portrait pointer, flag byte to $01BA (bits 0-6 music through
    80:94E8, 0 keeps; bit 7 mirrors the second portrait in 80:905E), then
    entries up to F8 as 80:9178 reads them: key (FF greeting, FE talk, FD
    fallback, else topic number), length byte, flag (bits 0-3 count of
    topic numbers for 80:908C, bit 7 action), topic numbers, with bit 7 the
    script word of the action (80:91CA through C34A), text word. The 139
    records fill 8D:80C0 to the room table 8D:929D without a gap; all 727
    length bytes equal the entry size, all texts are text starts, topic
    numbers stay below 64 and scripts below 937. Only the table 80:94F7
    names the records, so the loader lays them out again and writes the
    table (`dialog_layout_changed` past 929D, 00 fill otherwise; there is no
    spare byte today). Class `dialog`, 4.851 bytes (table and records);
    `unknown` has 17.358 bytes left, the raw part 35.903.
  - 8D:8080 to 80BF (64 bytes, values 00 to 3F, one per topic?) has no
    reader in the port and stays unknown.
- **Dialog topics (delivered 2026-10-31):** `assets/vm-topics.json`
  (generator `extract:vm-topics`, code [src/data/topics.mjs](../src/data/topics.mjs)).
  80:9215 copies for each topic t of 7E:3CA3 with flag 0 in 7E:3CD6 the
  word at 8D:8000 + 2 t to 0154, the text pointers of the topic menu. The
  64 words from 8D:8000 are all text starts (Akimi, Anders, Aneki, ...), the
  word at 8D:8080 is none; no code bound for t is known, so the count rests
  on the data. Class `topic`, 128 bytes. The rest up to the room table
  (8D:8080 to 929D, 4.637 bytes) has no direct reader in the executed code.
- **Sound data catalog (delivered 2026-10-31):** `assets/vm-sound.json`
  and, since 2026-11-01, one WAV per sample in `assets/vm-samples/`
  (formerly `vm-sound.bin`; generator `extract:vm-sound`, code
  [src/data/sound.mjs](../src/data/sound.mjs); data path in
  [SOUND-DRIVER.md](SOUND-DRIVER.md)). 81:F092 takes directory X (0 or 3)
  from the long pointer at 98:FFFA + X and sends the block list at
  directory + 2 with driver command 01; F130 sends the entries from
  directory + 5 (number, long pointer, up to FF) with command 10. The word
  at directory + 0 equals the directory length (94 and 14); no reader is
  known. The JSON holds the two directories (9F:FEAC with 22 entries,
  99:FFC8 with 2), the 24 block lists (destination, chunks as data address
  or fill) and the 69 data chunks; their 106.264 bytes are in the bin file
  in address order.
  - Roles: the driver reads a base list at ARAM 0EFE as sections with a
    length word each (0x04E1: sample directory, BRR samples, header, sounds,
    vibrato table and bytes, sequence table and bytes, song table, songs).
    The length words are fill chunks of count 1, so every raw chunk lies in
    one section: samples 67.131 bytes, songs 36.571, sounds 1.648, vibrato
    and note tables 606, directory 224, the rest tables. The item lists 2F to 38 and 0A land
    in the free sample space (B58D, C058, 71C0), F3 to FE behind the base at
    D083 (all twelve song pointers of directory 0 are D083); entry FC of
    directory 3 lands at 807D, one of its three song pointers.
  - The two streams that seemed to begin at 99:C5E1 and 9A:AD6D (open
    finding of the topic delivery) are sound chunks: 99:C5D8 (7CE bytes,
    samples, starting with a zero BRR block) and 9A:AD64 (66F bytes) right
    behind the room headers.
  - The vibrato table of directory 3 is the two bytes 80:FFB3 (word 75C0) in
    the cartridge header area.
  - Way back: chunks are named by address and shared by lists (99:F13A in
    both bases, 98:B169 in items 2F and 30), so each keeps address and
    length (`sound_layout_changed`, `sound_bytes_required`). Class `sound`,
    106.972 bytes; the raw part has 86.545 bytes. Still raw in banks 96 to
    98: seven single bytes (the SPC driver 97:8000 has its own file since
    2026-10-31, see below).
  - Samples (2026-10-31, format `shadowrun-sound-v2`): the two sample
    directories (DSP DIR at 0F00, Book I PDF 176/178; 41 and 15 entries) are
    readable in the JSON as start and loop address per sample number and
    left the bin file (now 106.040 bytes). Every samples chunk is exactly one
    BRR sample (Book I PDF 178/179): length a multiple of 9, the end bit
    only in the last block, the loop bit there set exactly when the entry's
    loop differs from its start; the loop of every entry with a fixed
    sample lies on one of its block boundaries. The 43
    samples stay BRR in the bin file; reader and loader refuse a sample
    that breaks the block rule (`sound_brr_required`). Entries 11 to 18 of
    directory 0 point at the shared places B58D and C058, whose sample
    depends on the loaded item set (2F to 38), with one loop per entry.
  - Sound tables (2026-10-31, format `shadowrun-sound-v3`): all table
    chunks are readable in the JSON and left the bin file (now 103.702
    bytes, only samples and songs). Codecs in `CODECS` of sound.mjs, each
    checked to give the original bytes:
    - header ($12, 0x0366): echo factors left and right ($22/$23), then the
      registers of the list at ARAM 03B7 in the driver: EFB, ESA, EDL, FIR
      C0 to C7, FLG.
    - sounds ($14, 81 and 22 records of 16 bytes, play0776/start07A0):
      vibrato number, volume, pitch, sample (SRCN), ADSR1, ADSR2, GAIN,
      release, duration, flags (noise, echo, rank rules, fixed pitch, glide
      mode), rank, note table. Byte 13 has no reader and is 00 in all.
    - section 5 (role `vibrato_pitch`, formerly `vibrato`): the vibrato
      records 6 bytes apart (phase word, rate word, depth for 0x0DBF; byte 5
      has no reader, 00 in all), then the note tables of 12 pitch words; 12
      records and 15 tables in directory 0, 1 and 7 in directory 3, ending
      exactly at the section end. The vibrato pointers ($16) equal the
      record addresses and every note word of a sound names a table
      (checked by the test).
    - pointer tables $16 and $18 as ARAM words.
  - Songs (2026-10-31, format `shadowrun-sound-v4`): the 14 song chunks
    (16 songs: twelve at D083 in directory 0, 767C, 7E90 and 807D in
    directory 3) are readable pieces in address order: song header
    (song06A3: tempo, eight track list pointers, tempo list pointer, voice
    masks, volumes left and right, instrument sounds), track lists of
    pattern pointers (list0A9A), tempo lists (tempoList0A1C) and patterns
    (events0B1E) with events as short strings (`w`, `n`, `o`, `b`; `w`,
    `t`, `v`, `r`; meaning in sound.mjs). Evidence:
    - parseSongs follows every song of the table with the base and each
      item loaded; the pieces cover every byte of all 14 chunks without gap
      or overlap. Song 807D uses 21 patterns of 98:C666 (other chunk).
    - In every song the instrument map ends right behind the last
      instrument its patterns use, and the next piece begins there;
      song06A3 copies those bytes into the unused slots (checked by the
      test).
    - Seen: notes 80 to 8F only, note offs A0 to AF, no bends, FF as the
      only pattern end; tempo lists set (81, 82, 84) and ramp (8A, 8C).
      The decoder refuses other forms (90 to 9F, E0 to FE) until a song
      needs them.
    - Way back byte for byte; a pointer into the chunk's own ARAM range
      must name a piece start of its kind, so a length change without new
      pointers is refused (`sound_song_layout_changed`).
      `vm-sound.bin` then held only the 43 BRR samples (67.131 bytes).
  - Samples as WAV (2026-11-01, format `shadowrun-sound-v6`): the bin file
    is gone. Each sample is a 16-bit mono WAV `vm-samples/<address>.wav`
    at a nominal 32 kHz (the sounds set the pitch): the BRR decoding of
    Dsp.decodeBrr (src/apu/dsp.mjs, Book I PDF 178/179) from silence,
    without pitch, envelope or interpolation, loop part once. Code:
    [src/data/brr.mjs](../src/data/brr.mjs). The PCM does not name the block
    headers, so each sample keeps them as a hex string (`blocks`, one byte
    per block). Given header and the two previous values, a nibble mostly is
    the only one giving its value. Where several give the same value (shift
    0 drops a nibble's lowest bit; shifts 13 to 15 and clipping merge more),
    the block keeps its 16 nibbles (`nibbles`, by block index). In the
    original only the 145 shift 0 blocks of 7.459 need this; no clipping or
    high-shift ambiguity occurs.
    - Way back: for every value the encoder takes the one nibble that gives
      it, or the kept nibble, which must give it. A value without such a
      nibble is refused (`sound_value_not_brr`), an ambiguous one without
      kept nibbles too (`sound_nibbles_required`), as are a changed length
      (`sound_layout_changed`) and a WAV other than 16-bit mono 32 kHz
      (`sound_wav_format_required`; other chunks such as LIST are skipped).
    - Evidence (tools/sound-samples.test.mjs): every WAV equals the port's
      DSP decoder run on the ROM bytes, keeps bit 0 clear and encodes back
      to the original bytes; tools/build-cartridge.mjs checks the whole
      package through the loader.
    - Limit: an edit must stay BRR-exact for the stored headers. Changing
      one value changes the prediction of the following ones, so they must
      be adjusted too; there is no lossy encoder that chooses new shifts
      and filters for freely edited audio.
- **Filler bytes (delivered 2026-10-31):** `assets/vm-fillers.json`
  (generator `extract:vm-fillers`, code
  [src/data/fillers.mjs](../src/data/fillers.mjs)). After every other class,
  `tools/rom-map.mjs` gives the class `filler` to whole unknown runs of one
  repeated byte (split at bank boundaries) with a structural reason; no
  reader is claimed for them:
  - `script_end` (97 runs): the single byte 56, script opcode `end`, right
    behind a script whose last decoded instruction is the unconditional
    jump 48. The interpreter never reaches it; decode-scripts.mjs keeps only
    reachable bytecode, so these bytes were part of the 105 gaps between
    scripts.
  - `bank_end` (16 runs): FF up to the end of a bank, 1 to 42 bytes.
  - `zero_run` (3 runs): only 00, among them 8A:8071 (192 bytes) between
    the palette and the stream behind it.
  - Other single bytes and mixed runs stay unknown (for example 6B between
    static code). The loader checks value and kind per run
    (`filler_value_required`) and refuses overlaps (`filler_layout_changed`).
    Class `filler`, 373 bytes in 116 runs; `unknown` falls from 1.154 to 781
    bytes in 29 ranges, the raw part from 22.375 to 22.002 bytes.
- **Unreferenced scripts (delivered 2026-10-31):**
  `assets/vm-orphan-scripts.json` (generator `extract:vm-orphan-scripts`,
  code [src/data/orphan-scripts.mjs](../src/data/orphan-scripts.mjs)). Eight
  of the nine script-like unknown blocks in banks 82, 9B, 9C, 9E and 9F
  decode with the script codec as complete scripts with a two-byte header
  (locals, stack header): 82:F281, 82:F28A, 82:FA25, 9B:D79F, 9E:B0B7,
  9F:8624, 9F:89AD and 9F:D7AF (278 bytes with headers; their call_script
  and call_native IDs are all inside the tables). Each one is fully covered,
  ends exactly with end or the jump 48 at the edge of the block, and no
  entry of the script tables names it; call_script takes a table ID, so no
  script can reach them. The word values of their addresses occur elsewhere
  in the ROM only by chance (no hit in the pointer table 82:DED1). They look
  like scripts removed from the tables. No reader is claimed.
  - 9C:E720 (71 bytes) is a dead tail behind script 33D (9C:E717, header 07
    0C, bytecode `2C00 3401 3403 56`). Decoded in the frame of 33D from PC 7
    it uses the locals 3 to 6 that the header of 33D provides, and its loop
    jump (`jump_if_zero 0013`) lands on an instruction start only in that
    frame. The decoder takes a start PC for this (`decodeScript(code,
entry)`).
  - The single bytes 56 at 9B:D79E and 9B:D7D1 are now `script_end` filler:
    the first follows the final jump of script 0BA, the second the final jump
    of the unreferenced script 9B:D79F.
  - The loader checks coverage, IDs and round trip per script and the frame
    of the owner per tail (`orphan_script_required`) and refuses overlaps
    (`orphan_layout_changed`).
    Class `orphan_script`, 349 bytes; filler 375 bytes in 118 runs; `unknown`
    falls from 781 bytes in 29 ranges to 430 bytes in 21 ranges, the raw part
    from 22.002 to 21.651 bytes. Still unknown: the code remnants in banks 80
    and 81 (for example the `JMP $F389` tails at 80:F777, 81:ED2E with 93
    bytes), 8D:8080 (64 bytes between the topic table and the dialog records),
    the small pointer table 8B:FD61 (five words to the zero pairs FD6B to
    FD74), 80:FFB5 and 9F:FF0A.
- **Dead code (delivered 2026-10-31):** class `code_dead` in
  [tools/rom-map.mjs](../tools/rom-map.mjs) (list `DEAD_CODE`, report field
  `dead_code`). 19 instruction runs in banks 80 and 81, 322 bytes, that no
  traced instruction, jump table or script table reaches. Rules per run:
  it decodes within unknown bytes from a given M/X state, sits directly
  behind an instruction without fallthrough (RTS, RTL, RTI, JMP, JML, BRA,
  BRL; traced, or the return of the dead routine before it), ends with such
  an instruction or runs into a traced instruction start of the same state,
  and its branch and call targets are traced starts or lie inside the run.
  PLP is accepted only right before a return; XCE and indirect jumps are
  refused. A word search for the 19 addresses finds no jump-table or
  pointer hit in code; the hits lie in texts, actions and other data.
  - Whole routines: 80:CA76/CA8C and 80:CB6F/CB87 (pairs that set or clear
    bits of a 7E byte through an index table, ORA and AND), 80:D190 (stores
    $00 to 0CC2), 81:ECD1 (walks a list of three words and calls 81:ECF2),
    81:ED2E (93 bytes, VRAM DMA list through channel 3), 81:F28F/F2A6 (read
    213F bit 4 and call 81:F007), 81:CFCB (a lone RTL behind an RTS).
  - Tails behind unconditional transfers: the four `JMP $F389` behind
    `JMP $F927` in the script comparison handlers (80:F777, F7B9, F7FB,
    F840), 80:BBF1 `LDA #$0000` behind `BRA`, 80:B933 behind `JMP`, 81:88A2
    and 81:88E1 `LDA $1FDC` behind `BRA`, 81:9389 (27 bytes) behind `BRA`.
    The bytes stay in the raw part like all kept code (no decoded form);
    `unknown` falls from 430 bytes in 21 ranges to 108 bytes in 5 ranges:
    80:94EA (4), 80:FFB5 (11), 8B:FD61 (20), 8D:8080 (64) and 9F:FF0A (9).
    8D:8080 directly follows the 64 topic pointers; its 64 values all lie in
    00 to 3F, but no code reads it, so it stays unknown.
- **Runner byte 3 checked (2026-10-31):** no reader. The karma list
  80:EFB2 names the WRAM bytes 3BFB, 3BFC, 3BFD and 3BFF (record bytes 0, 1,
  2, 4); the new game 80:991D sets every byte of Jake's record 7E:3BFB
  except 3BFE; no code reads a record with Y = 3 (the three `LDY #$0003`
  before `LDA [$11],Y` read object words); the live tests read only bytes
  1 and 5 of the ROM records. The values 1 to 7 stay as data (`byte3`).
- **Palettes copied through WRAM (closed 2026-10-31):** the raw part now
  holds only code classes (`code_static`, `code_kept`, `code_dead`) and the
  108 `unknown` bytes; every other ROM byte has a decoded class, so no
  palette source is left outside the decoded files.
- **More Mesen coverage (2026-10-31):** tools/rom-code-coverage.mjs has four
  more scenarios with the oracle plans: `select` (group overview), `items`
  (item list), `bed` (bed menu with save game and karma) and `badge` (from
  the save game apartment to the business man's offer). 2.785 new
  instruction starts, 15.247 in total. `code` grows from 30.897 to 34.209
  bytes, `code_static` falls from 20.936 to 17.621; the raw part falls from
  21.651 to 18.339 bytes. All dead code rules still hold.
- **Intro and karma coverage (2026-10-31):** two more scenarios. `intro`
  runs 15.000 frames without input from power on: the attract sequence with
  its scenes (81:D927 and others) repeats before frame 15.000, so 30.000
  frames add nothing. `karma` opens the karma menu 80:EE57 from the bed
  menu; the coverage-only explore command `poke` sets the karma word
  7E:3C11 to 0400 (128 shown), buys in the Attribute and Skills lists, sets
  karma 0 for the "Not enough Karma" notice of 80:F006 and opens the empty
  Magic list. `newgame` (new game without skipping the opening) adds only
  2 starts. 1.146 new instruction starts, 16.393 in total. `code` grows
  from 34.209 to 36.786 bytes, `code_static` falls from 17.621 to 15.050;
  the raw part falls from 18.339 to 15.762 bytes. The largest remaining
  `code_static` ranges belong to the matrix (81:B1B5 to 81:C3CA), the
  credits and cutscene code (81:D10D, 81:CDF8, 81:DFE7), script opcodes
  not used so far (80:F546) and status windows for spells and notes
  (80:E68E, 80:E8C8).
- **Status screen coverage (2026-10-31):** scenario `status` opens the
  status screen 80:EA6E after the morgue, shows the Skills (80:E834) and
  Cyber (80:E8C8, "Head computer", "Datajack") windows, pokes spells into
  Jake's record (Magic 3 at 7E:3BFC, levels at 7E:3C07 to 3C0C, magic points
  7E:3C96) and chooses each of the six spells in the Magic list 80:E693 as
  X spell, then casts it with X at the target "Me". 256 new instruction
  starts, 16.649 in total. `code` grows from 36.786 to 37.372 bytes,
  `code_static` falls from 15.050 to 14.456; the raw part falls from
  15.762 to 15.176 bytes. Weapon and Armour stay empty lists for Jake
  without equipment.
- **Unused natives (2026-10-31):** class `code_unused_native` in
  tools/rom-map.mjs. The native pointer table 82:D7B8 has one reader,
  80:F500 in the call_native handler 80:F4CB (opcode 58, reached only
  through the opcode table), and the index is the u8 operand of the
  bytecode. 37 of 220 native IDs are named by no table script, unreferenced
  script or tail; their entries are traced last, and the 408 bytes only that
  pass reaches get the new class (for example native 82 at 80:D5D1, a
  COLDATA fade from the sine table D3D1, 51 bytes). `code_static` falls
  from 14.456 to 14.048; the bytes stay in the package. Limit: bytecode
  built in WRAM is not known and not assumed.
- **Caller search (2026-10-31):** 80:D2E7 is native AA, named only by
  script 00B (called by 188, 1F0, 1F5, 1FA); natives 18, 8D and AD near
  80:D5D1 are named by scripts 070 and 19E (actors 420 and 421 in rooms 63
  and 182). 80:877D and 80:E278 are branch paths inside live routines (the
  counter 1FD4 reaching 4; native C4 at 80:E262, script 1D9 through 02F
  and 026); they need those game situations in Mesen.
- **Attempt on the branch paths (2026-10-31, no coverage gained):** 80:877D
  counts attacks on harmless targets: 80:8691 jumps to 80:8778 when the
  target flags 1458,X lack bit 13 (2000); with bit 15 (8000) set, 1FD4
  counts up, at 4 the text 9D:F4BA ("Jake, do not attack those who mean you
  no harm.") appears, at 8 the text 9D:F4D2 and karma 7E:3C11 drops by 8
  (one point). The only such target in the alley is the dog (slot 54,
  flags 8004); its dialog starts before a shot lands, so the counter stays 0.
  80:D2E7 (scripts 188, 1F0, 1F5, 1FA: actors 283 to 287 in rooms 167 to 169
  and 185, scene 78) and 80:E278 (script 1D9: actor 318 in room 75, scene 89) were not executed in any scenario (native AA and the C4 branch stay
  code_static), so no current route reaches these situations. They need a
  later save game.
- **Room tours (2026-11-01):** two coverage-only explore commands:
  `redirect` replaces A at the next room change 80:A4BF (the entry of the
  room table 8D:929D), `tour` saves the state at that point and visits a
  list of entries for 300 frames each, loading the state again before each
  (from the main loop exec callback at 80:96C0, because Mesen loads states
  only from exec callbacks; A is set right after the load). Scenarios
  `tour1` to `tour5` visit all 496 entries with a room from the morgue
  exit (about 200 s each, `node tools/rom-code-coverage.mjs tour1 tour2
tour3 tour4 tour5`). The story state stays that of the morgue, so the
  tours are guarded: new instruction starts are merged only when each lies
  in `code`, `code_kept` or `code_static`; all five passed. 17.975
  instruction starts in total. `code` grows from 37.372 to 40.286 bytes,
  `code_static` falls from 14.048 to 11.156; the raw part falls from
  15.176 to 12.262 bytes. Conflicts stay 8, `code_unused_native` stays
  408 bytes. 80:D2E7 (native AA) is now executed. Left: the matrix
  (81:B1B5 to 81:C3CA), credits and cutscenes (81:D10D, 81:CDF8, 81:DFE7)
  and script opcodes not used so far (80:F5CC).
- **Sequences, credits and matrix (2026-11-01):** 80:CC4B polls the request
  word 1CE9 in the main loop: FFFE calls the matrix 81:C3CA, any other
  value the sequence 81:CDF8 with A = 1CE9 and X = 1CEB, and afterwards the
  room entry 7E:2DE2 is loaded again (FFFF none, 7FFF only the room).
  Scripts set it through native 54 (80:CC33: 1CE9, 1CEB, 2DE2) and native
  7D (80:E30F: 1CE9 = FFFE, 2DE2, 1D8D = 40, system 1D8F, 1D8E, level
  1D90, the decker's Computer byte 9 to 1D8C and his state record to
  1D93/1D8B). New coverage-only explore commands: `poke` with a byte
  form, `matrix` (the writes of native 7D for Jake) and `mark`/`rewind`
  (save and load the state at the next main loop round). Guarded scenarios
  from the street: `cutscenes` (values 0, 1, 2, 3 with X 5, 8000, 8001,
  8002 from native 54 calls; 0 and 2 are car rides), `credits` (5 and 14,
  15.000 frames each) and `matrix` (the 39 distinct argument sets of
  script 2E8, each entered, moved and rewound; the run ends at its frame
  limit). All passed the guard. 19.861 instruction starts. `code` grows
  from 40.286 to 44.644 bytes, `code_static` falls from 11.156 to 6.756;
  the raw part falls from 12.262 to 7.904 bytes. Conflicts fall from 8 to 7. Largest ranges left: matrix parts (81:B6A6, 81:C171, 81:BAAA), script
  opcodes 80:F5CC, 80:8C8D, and the branch paths 80:877D and 80:E278.
- **Unused opcodes (2026-11-01):** class `code_unused_opcode` in
  tools/rom-map.mjs. The dispatcher 80:F390 (`LDA ($00),Y`, `AND #$FF`,
  `JMP ($F2B4,X)`) is the only reader of the opcode table 80:F2B4, so a
  handler of opcodes that no table script, unreferenced script or tail
  contains is unreachable. 48 opcodes have no user (among them all
  divisions and remainders, xor and several compares); their handlers are
  traced after the unused natives, 341 bytes get the new class. Native 2D
  shares its entry 80:F927 with the trap handler of 24 unused opcodes, so
  `code_unused_native` grows from 408 to 452 bytes. `code_static` falls
  from 6.756 to 6.371; the bytes stay in the package; conflicts stay 7.
- **Matrix input (2026-11-01, no coverage merged):** moving up in system
  10/level 3 meets IC ("ATTACKED BY IC"), Jake is jacked out and dies
  (game over), also with Computer 12 poked; the combat and node actions
  need a cyberdeck and further exploration. (Corrected 2026-11-01 under
  "Matrix combat live": the matrix writes the health back correctly; the
  guards of the return room entry 484 shoot Jake after he jacks out.)
- **Script tours (2026-11-01):** the explore command `scripts` saves the
  state at the first task creation 80:C2C8 after the morgue door (frame 3895) and replaces X (the script ID) there for each script in turn, 200
  frames each, loading the state before each. The arguments stay those of
  the original task, so many scripts run with foreign values; a run that
  halts the CPU is reset after three frames, because Mesen loads states
  only from exec callbacks (also served from WRAM execution and the
  coverage callback). Scenarios `scripts1` to `scripts5` cover all 937
  scripts. The guard is per script (explore.lua prints "XT entry offset ps
  e" for starts first seen during an entry) and stricter for all guarded
  scenarios: a new start must be an instruction start of the ROM map's
  trace (`traced_starts` in vm-rom-map.json) with the same E, M and X, and
  not in `code_unused_native`, `code_unused_opcode` or `code_dead`.
  The first two tries showed why: runs with only a class check executed
  graphics and room data, and a misaligned or wrong-width run raised the
  conflicts from 7 to 41; a script returning through a foreign stack
  reached the trap handler 80:F927. With the final guard 20 of 937 scripts
  are dropped. 20.174 instruction starts. `code` grows from 44.644 to
  45.345 bytes, `code_static` falls from 6.371 to 5.672; the raw part
  falls from 7.904 to 7.203 bytes. Conflicts fall from 7 to 4; the unused
  and dead classes are unchanged.
- **Matrix with input (2026-11-01):** the matrix intro counts down for
  about 650 frames; then up moves the persona, IC is found and attacks, X
  jacks out, A and B start further actions. Scenarios `matrixplay1` and
  `matrixplay2` poke Jake's Computer byte 7E:3C04 to 12 and play a fixed
  pseudo-random run of directions and A, B, Y (900 frames) in each of the
  39 systems, with rewind. The guard now also accepts a traced start seen
  with another state when the instruction has the same length in both (the
  first run was refused for 80:86EA `REP #$20` with M 0 instead of 1).
  20.805 instruction starts. `code` grows from 45.345 to 46.853 bytes,
  `code_static` falls from 5.672 to 4.172; the raw part falls from 7.203
  to 5.695 bytes. Conflicts stay 4.
- **Room tours with input (2026-11-01):** the explore command `tourplay`
  is `tour` with a fixed pseudo-random input per entry (directions, A, B,
  Y, R, Start, seeded by the entry). Scenarios `tourplay1` to
  `tourplay5`, 600 frames per entry, about 420 s each, all guarded per
  entry; none dropped. 20.939 instruction starts. `code` grows from
  46.853 to 47.183 bytes, `code_static` falls from 4.172 to 3.862; the
  raw part falls from 5.695 to 5.365 bytes. Conflicts stay 4.
- **VRAM writes when leaving the status screen (2026-11-01, closed):** the
  native run counts 128 data writes outside blank (live-mouse.test.mjs),
  because LiveGame has no raster position and counts every PPU data write
  outside the NMI with the display on. The explore command `vramwatch`
  (VRAM data writes 2118/2119 per frame with scanline and PC) shows that
  the original writes every VRAM word around the status screen at
  scanlines 226 to 229, inside VBlank (Book I PDF 121: VRAM only in VBlank
  or forced blank): the 64 words on leaving come from the main program at
  80:9303 at scanline 229 right after the NMI (frame 5605 of the morgue
  exit plan). No write lies in active display. The port applies them
  before the next rendered frame like the original, so nothing differs.
- **No binary part (2026-11-01):** `assets/vm-cartridge.bin` is gone. The
  code of every class (`code`, `code_static`, `code_kept`, `code_dead`,
  `code_unused_native`, `code_unused_opcode`) is left out: the port runs
  its own routines and reads the ROM only for data, so whether a range
  was executed in Mesen no longer decides. Only the code bytes a data reader
  touches stay: the first code byte behind every data range (a word read
  at the end of data, such as the menu text reader 81:D531 at 81:D59E,
  81:E3DA, 81:E446 and 81:E50C) and every code byte the live runs read,
  285 bytes in 284 runs. Two unknown ranges got a decoded home:
  - 80:94EA (4 bytes) is the dialog music table `dialog_music`: 936C
    reads the word at 80:94E8 + 2 n for the music number n of a dialog
    record (1 and 2 occur, 0 reads nothing; src/data/tables.mjs),
  - 9F:FF0A (9 bytes) is the mode list of sound directory 0: the word at
    a directory start is its length and the offset of the list right
    behind it; 81:F1FA walks byte pairs (mode, item) up to 00 and loads
    each item whose mode equals 7E:1CE5 through F130. Directory 0 has
    the pairs 02/38, 05/37, 06/39, 0C/38, directory 3 an empty list
    (99:FFD6). `vm-sound.json` (format v5) holds them as `modes`.
    Three ranges of 95 bytes have no known reader and stay `unknown`, kept in
    original form with a note each: 80:FFB5 (11 bytes before the header
    title), 8B:FD61 (five words pointing to zero words before the palette
    cycle table) and 8D:8080 (64 bytes with values 00 to 3F behind the topic words).
    The code bytes and the unread ranges are in `assets/vm-raw.json`
    (`src/data/raw.mjs`, 380 bytes); the manifest (format v2) names it
    instead of a binary file. 52.155 code bytes are absent. Every live
    test runs on this package; a read of an absent byte stays the fault
    `rom_byte_absent`, and a session recording (docs/RECORDING.md) shows
    where.
- **Matrix combat live (2026-11-01):** tools/live-matrix.test.mjs plays seven
  matrix sessions from the apartment save game, natively and in Mesen
  (extended the same day by data and CPU nodes, the datajack path and
  death).
  - Jack-in script $2E8: native 57 (80:CC07) reads script word $0C (the
    decker, compared with 08B2) and $16 (cyberdeck, set to 1 by scripts
    $0C4 and $11D). Decker 08B2 without a cyberdeck gets native 7D with
    system 2 and level 0 (the "DATAJACK MALFUNCTION" screen of list
    81:C539); otherwise native 7D gets the terminal's arguments and the
    decker from word $0C. The test makes the native 7D writes of both
    paths for Jake. The natives the datajack path calls before native 7D
    (4F, 50, 51, A9, 4C, 9F) are not part of the test.
  - Matrix rules seen: a direction turns the persona to an absolute
    heading (141C: 0 up, 4 right, 8 down, 12 left) and then moves it; on
    paths (01, 02) it runs on to the next node. B runs COMBAT.EXE on the
    node ahead (81:C111): an IC (codes 08 to 0F) falls when a draw of
    0 to 6 lies below the Computer skill 1D8C, otherwise it strikes back
    (81:B1B5); B on a node 07 costs 1 health; walking onto an IC node
    starts its attack. X jacks out; 81:C4FA copies the health 1754 to
    1D8B, and the main loop 80:CC4B writes it to the decker's record.
    A on a data node (81:C28C, codes 18 to 1F) sets its bit in 175A,
    costs memory (1750) and turns the node into 42; codes 20 to 27 cost
    10 memory. B on a CPU node 20 opens its gates 3F into paths 02
    (81:B609); B on 21 only prints the text 81:C6C3 while its bit in
    1756 is clear. A on a data
    node 10 to 17 sets its bit in 1758, costs memory (C330 table: 8 for 17) and turns it into 40; B on 40 makes 41 and clears the IC around
    it (81:B71F). The argument 1D8E (2 for some terminals) adds nodes:
    system 3 with 1D8E = 2 has node 17 at (29, 10). At health 0 the matrix ends by itself (1752 counts down to
    0), the record gets 0 and the main loop returns to the menu owner
    (Game Over). The map of system s lies at 7F:0216 + 800 s, 32 by 32
    words.
    Sessions: 1 (Computer 12) defeats the IC type 0B and loses 1 health
    on the cleared node; 2 (Computer 0) fails twice and takes 19 and 5
    damage; 3 (system 1, level 1) downloads the data node 18 at (12, 11);
    4 (system 2) uses and opens the CPU node 20; 5 (system 3, 1D8E = 2)
    tries node 21, then walks around the IC to node 17, downloads it and
    clears the IC; 6 is the datajack path; 7 (Computer 0) dies at the
    first strike.
  - Same random draws in both: the random 80:C560 mixes the counter bytes
    213C/213D (Book I PDF 136, 2-27-22: H/V counter latched by reading
    2137), its last result 1CE8 and the frame counter 1C76/1C77. At
    each matrix start both sides set 1CE8 and 1C76 and switch to the same
    xorshift32 sequence; the new explore.lua command `counter` returns
    these bytes from a Mesen read callback, `until` waits for a WRAM
    word. Mesen applies writes at the joypad auto-read, before the NMI
    handler increments 1C76; the native pad read 80:9E13 follows that
    increment, so the native side writes 1C76 one higher.
  - Result: every 4th original frame with the persona on the grid
    equals the native frame at the same distance from the counter
    switch (13 matrix words including 1CE8 and 1C76). After "JACKED
    OUT" (1524 = 8000) the rooms reuse these words, and their room
    state differs as before the matrix; they are not compared.
- **Step 2 complete (2026-11-04):** palettes, graphics, maps, rooms,
  objects, music, samples and tables are delivered as decoded files (see
  the items above). Of the 1.048.576 ROM bytes, 996.041 are decoded,
  52.147 are absent code bytes and 388 stay in original form in
  `assets/vm-raw.json` (code bytes a data reader touches and the three
  unread ranges). Reducing `code_static` would change only the ROM map,
  not the package. Remaining risk: a path no scenario takes may read an
  absent code byte; the browser then stops with the fault
  `rom_byte_absent` and its address, and the session recording replays it.
- **Alley bus check and four missing code bytes (2026-11-01):**
  tools/live-alley-bus.test.mjs replays the input of the mouse layer of
  2026-10-30 (shot, then B in the crosshair) after the route of
  BADGE_BUY_LIVE_PLAN, natively and in Mesen with the same random draws.
  - The B makes the player control read through A985/D15C the words
    80:9906 (97 A0, at 80:A98C) and 80:9A66 (1F A9, at 80:A9BD), code
    bytes read as data, and 8C:6A56 (80:A9AF) and 8D:35B3 (80:A9BF), where
    nothing is mapped. Mesen reads 8C at both: the open bus keeps the
    bank byte of the pointer 8C:8C94, as src/task/native-object-turn.mjs returns.
    This closes the open issue D15C.
  - The four code bytes were missing in the package: the native run ended
    with `rom_byte_absent at $809906`. The path vanished from the live
    tests with the mouse layer change ff40402d (found by bisecting), before
    the read record was taken. Recorded now (tools/rom-reads-hook.mjs with
    the full ROM); `assets/vm-raw.json` has 286 code byte runs, 289 code
    bytes and 384 bytes in all.
  - Random sync in a room with lag: the frame counter 1C76 also counts the
    original's lag frames. The new explore.lua command `clock` makes the
    random 80:C560 read it as the count of NMIs in blocking wait loops, the
    NMIs of the lag-free port; `press` and `wait` take an optional round
    count like tools/live-plan-driver.mjs. The status screen waits in a loop
    outside that list, so the test syncs again after it. Shared native
    driver for explore plans: tools/explore-live.mjs (also used by
    tools/live-matrix.test.mjs).
  - tools/mesen-explore.mjs now prints explore.lua's "RD" lines; before,
    a read watch printed nothing, which is why an earlier check that day
    saw no reads.
- **Original reads in the code banks (2026-11-04):** the coverage scenarios
  now also record the original's data reads in banks 80/81 (explore.lua
  "XR offset pc", all four LoROM mirrors), so that a code byte only a rare
  path reads is no longer found first as `rom_byte_absent` in the product.
  - Mesen reports no opcode or operand fetch as a read. The one read at the
    PC itself, the dummy fetch at interrupt entry, is skipped. The read
    callbacks double the run time (intro 167 s instead of 84 s); one
    callback per code range (about 200) was slower still (228 s), so four
    wide callbacks stay and every time limit has the factor 3.
  - `analysis/rom-code-observed.json` keeps `reads` (ROM offset to the CPU
    address of the first reading instruction) from the 28 scenarios with
    regular game paths: 10.313 bytes. The script tours run scripts with
    foreign arguments; a first run with them gave 10.791 read code bytes,
    whole routines read through stray pointers. Their reads go to
    `script_tour_reads` and are never kept (the second run left them out).
  - tools/rom-map.mjs keeps the read bytes of every code class as
    `code_kept`. New in the package: the words 80:98FE (read by 80:A98C)
    and 80:9A5E (80:A9BD), the player control path of the alley bus case
    with other index values. A readwatch finds both in tourplay2 (room
    entries 6D at frame 10988 and C3 at frame 62300, morgue story state
    with the entry's pseudo-random input). A985 compares with CMP $1038,Y
    (80:A989) and later loads LDY $1198,X at 80:A9BA while the data bank
    is 80. An index reaching the ROM half therefore reads code as data:
    Y 88C6 gives 80:98FE and, after TYX, 80:9A5E; Y 88CE gives 80:9906
    and 80:9A66. The callback PCs A98C and A9BD name the following
    instructions. The port reads the same addresses in native-object-turn.mjs.
    A native replay of that tour entry would need redirect and the tour
    input in tools/explore-live.mjs and is not done; the cartridge test
    below guards the bytes. 81:CDF8, 81:D02A, 81:D10D and 81:E446 were
    already kept as the first code byte behind data. `assets/vm-raw.json`
    has 288 code byte runs, 293 code bytes and 388 bytes in all; 52.147
    code bytes are absent.
  - Left out as a read only the hardware makes: 81:D479 to 81:D577, the
    NMI callback code right behind the terminator 00 at 81:D478 of the
    channel 7 window HDMA table 81:D463. In tourplay4 Mesen reads it in
    ascending order within one frame, a few bytes per scan line, while the
    CPU waits in the sound command loop 81:F00E (a readwatch shows reading
    PCs 81:EF61 and 81:F00C to F013, none of which reads ROM). A channel
    enabled during the field continues from its A2 address. Book I PDF 144
    (420C) has the initial settings made automatically for every field,
    PDF 152 (43x8/43x9) the A2 table address counting up; the text layer
    of both pages has no printed page number. The continuation inside a
    field is Mesen's behaviour and not stated there.
    src/video/hdma.mjs starts every table at its A1 address for each frame
    and never reads past a terminator, so the product never reads these
    bytes. The original may show a few wrong window lines in that frame;
    the port does not model HDMA enabled during a field.
  - Guard: tools/vm-cartridge.test.mjs checks that every byte in `reads`
    except that HDMA range is in the package.
  - Limit: only paths the scenarios reach are covered. A byte that becomes
    `code` later is checked only after the scenarios run again.
