# Text languages

The page menu entry **Language** switches the game texts between English and
German. The German texts come from the German cartridge
`Shadowrun (G).sfc`; the game itself keeps running on the English data.

Since 2026-11-08 the options panel and the [handbook](MANUAL.md) also follow
the selected language. Language is the first menu option; English remains
the default. Menu labels, changing states, tooltips and hints switch together.

## User decisions

- 2026-11-05: read the German texts like the English ones and offer them as
  an alternative; keep saved games compatible where possible.
- 2026-11-05: step 1 covers the Huffman texts (dialogues, topics, names,
  notices, menus of bank 80). The option sits only in the page menu for now.
  Step 2 (menu texts of bank 81, matrix texts) and an optional step 3 (texts
  inside graphics) follow later.
- 2026-11-05: step 2 covers the menu texts of bank 81, the matrix texts and
  the intro text scroller (after the user's German test run in the morgue
  and on the street).
- 2026-11-06: step 3 (texts inside graphics) is set aside after the survey
  below; the German original translated no graphic with text.

## How it works

Editable Huffman content is maintained separately in
[vm-text-edits.json](../assets/vm-text-edits.json). Its
[format and precedence](EDITABLE-TEXT.md) cover both languages and port
labels while retaining original text identities. The descriptions below
refer to the delivered wording unless edits are installed.

The German ROM is a rebuilt version, not a patch of the English one: code,
scripts, tables, graphics and texts lie at other addresses, and the text and
dialog numbers are renumbered. Porting it a second time is not realistic.
The port therefore replaces only the decoded text:

- 80:FE69 decodes a text into the buffer 7E:21A0 as before. In German mode
  the buffer then gets the German characters, and the text composition FB39
  measures, wraps and draws them unchanged
  ([native-text-compose.mjs](../src/task/native-text-compose.mjs)).
- The German FE69 (80:FDD4) uses the same buffer and has stored texts of up
  to 294 characters there; the longest English text has 218.
- The English font has no umlauts. The German FE69 stores each character
  through 80:FE2A, which turns `^` and a letter into the code letter + 1F;
  the German font 8C:F8EA holds the umlaut glyphs there. The port uses the
  English codes 13 to 19 instead: blank glyphs of width 0 in the English font
  that no English text contains. The seven German glyphs and widths are
  written into the game's own copy of the ROM when German is chosen
  ([language.mjs](../src/data/language.mjs)).
- Notice windows (80:FEC1, allocated by 80:F963 from DP 00 x, 02 y,
  04 width, 06 height) hold height - 2 lines of (width - 2) * 8 pixels; FB39
  wraps a word as wide as the rest of the line or wider (DP A8). Every English
  notice text fits that rule. The German original widened or heightened its
  windows for the longer texts: 47 script calls carry other sizes in the
  German ROM (asset field `notices`, keyed by all seven English argument
  words), and a Mesen recording of the German intro (2026-11-05) shows Jake's
  first thoughts in single-line windows wider than the English ones. In
  German mode FEC1 therefore takes the German size of a known call; any other
  notice whose German text does not fit grows wider up to 30 tiles, then
  higher. F963 keeps the window on screen.
- The name window under the glove (80:BE6D) takes its width from 80:FADD,
  which sums the glyph widths of the English name. In German mode FADD
  returns the width of the German name instead; otherwise "Kühlfach" in the <!-- language-ok -->
  window sized for "Slab" ran past the window, left the window empty and
  wrote glyphs into other video memory (user report 2026-11-05).
- As a safeguard, FB39 leaves out a translated glyph that no longer fits its
  line (DP A8), so a window that is still too narrow cuts its text instead of
  drawing into foreign tiles. English mode without edits is unchanged.
- Menu rows are positioned separately by 80:A617; they cannot wrap into
  the next choice. Since 2026-11-08 the shared
  [menu layout helper](../src/data/menu-layout.mjs) measures translated
  entries before F963 allocates the window, with room for the selection
  arrow and numeric suffixes. This covers object and inventory actions,
  the bed and its two/four-slot save lists, Karma categories and upgrades,
  Yes/No, topics, spell choices and cyberware labels, in addition to the
  existing status and inventory sizing. German Karma details sit below the
  category list so both remain readable. The window frame, cursor stride,
  tile allocation and upload size therefore agree; resizing only the border
  would not fix text writes. The four save labels consistently use the
  German original's wording, with the corresponding slot number.
- Texts 9D:F074/F077/F07A are selection/previous/next font symbols used by
  the English menu renderer. The German original has empty strings for the
  last two; the extractor preserves the English symbols instead of treating
  them as translated words. The single genuinely empty dialogue text stays
  empty. A direct ROM comparison on 2026-11-08 confirmed that all 128 common
  font glyphs (English 95:F2D0, German 8C:F8EA) and their widths (81:AC0C)
  are identical; the preserved menu symbols use those unchanged glyphs.
  Translated direct notices about missing weapons/spells, harmless
  attacks, blocked saving and insufficient Karma also fit before allocation.
- Menu texts of bank 81 (title menu, saved games, options): 81:D531 draws
  the text at DBR:Y to the tilemap offset X. The German version has its own
  texts and calls with X 10 bytes (5 columns) further left, the copyright
  line excepted, and draws the arrow before the chosen entry (81:E32F) at
  0406 instead of 0410. In German mode D531 draws the German text at the
  German position, E32F moves the arrow, and the four-slot option puts the
  slot digit of rows 3 and 4 after "SPIEL " instead of at the 12th character.
- Intro text scroller (81:DDFB, list 81:F768) and credits (81:CE64, list
  81:F529): the German version brings its own packed text, character map and
  font, with extra tiles for umlauts (two in the intro font, two in the
  credits). The licence screen at power-on (boot list 8A:8000, German
  89:DB2C) draws its English text with the intro font through the tilemap
  81:FB0A; the German version has its own tilemap 81:FBAD for its font,
  and the start menu list (81:F7B5, German 80:FF46) loads the German font
  and map as well. The asset keeps the seven German streams as packed bytes; in
  German mode they lie in bank A1:8000 (src/vm/memory.mjs) and the unpacker
  80:9F49, both forms (native-unpack.mjs, native-unpack-body.mjs), reads a
  translated stream there instead of the English one. The shared credits font
  and character map require the active credits snapshot, as described below.
  The bit length table
  of the unpacker is the same in both ROMs (80:A033, German 80:A03F).
  The unpacker fetches its bits a word at a time and so reads one byte past
  the end of a stream (in the ROM simply the next byte); the bank therefore
  ends with two padding bytes behind its last stream (85:FC15, used by the
  credits). The decoded output does not depend on them. Since 2026-11-09 the
  credits are available as the fourth in-game start-menu entry,
  **Credits** / **Mitwirkende**, after **Options** / **Optionen** ([credits.test.mjs](../tools/credits.test.mjs)). The credits
  sequence starts no music of its own; in the ending the music of the ending
  room 5 keeps playing. Since the start menu plays none and holds the
  title's sound directory, the option loads the game's sounds as the attract
  game does (81:EF63), starts that room's music (81:EF47 with its header's
  music byte 5), and afterwards stops it (81:EF94) and loads the title's
  directory again (81:F092 with 3), in both languages
  ([credits.mjs](../src/game/credits.mjs)).
- Saved games do not change: the language is not part of the SRAM, so the
  same `.srm` works in both languages, also when the language changes during
  a game.
- A switch applies at the next pad read. The session recording stores the
  start language and each switch as an event, so a replay decodes the same
  texts ([recording.mjs](../src/browser/recording.mjs)).

## Shared credits graphics and Matrix gauges

The Matrix and credits share font `85:FC15` and character map `85:FD38`.
The Matrix command list `81:CDB2` loads the font through `80:F2A0` into
`7E:46A8`, then transfers it to VRAM. `81:C3CA`, at call `81:C3F2`, unpacks
the character map through `80:F2A4` / `80:9F6D` into `7F:0000`.
`81:B3D3` uses its words at `7F:00C0..00D3` as full, partial, empty and cap
tiles for both gauges. These are graphic indices, not translated text.

An unconditional German font substitution introduced a port bug: the font
grows from 864 to 896 bytes and inserts two umlaut characters before the
gauge tiles. The original Matrix table still selected full tile `2C`, now
the German credits' a-umlaut glyph. Full health therefore displayed repeated
umlauts. The original gauge words are `2C..35`; the German credits map shifts
them to `2E..37`. The Matrix's existing bank-7F unpacker uses the original map.

`redirectLanguageStream` now selects translated versions of these two shared
sources only when an active packed-text snapshot owns them. The credits owner
`81:CDF8` opens that snapshot before scene loading and closes it after the
text and map loads. German credits and their edit/language snapshots retain
their translated graphics; the Matrix keeps its matching original font/map.
This correction applies in both gameplay settings because it repairs the
port's language layer rather than an original game bug.

[matrix-gauges-language.test.mjs](../tools/matrix-gauges-language.test.mjs)
reproduces the German VRAM mismatch before the fix. After the correction, a
live system-3 run compares the installed font, gauge words, health/memory rows
and complete rendered Matrix picture against English. The language, packed
text and credits checks also verify that German credits still load correctly.
This covers the reported shared-source conflict, not every story route.

## Status menu and submenu widths

The status screen's English menu has eight tile columns. German labels such
as `Gegenstände` exceed its single-row text area. Starting another row is
not valid for these fixed-position lists: entries can disappear or draw
outside their allocated glyph tiles. The problem also occurs without cheats.
The maximum-stat and spell cheats expose additional long skill names and all
six spell rows, making the missing layout adaptation easier to encounter.

The status menu, item lists and spell lists now measure their translated
labels with the installed glyph widths and expand leftwards while preserving
the original right edge. They reserve space for the selection arrow and,
for items, the count. Skills additionally move their value column after the
longest translated name. English keeps its original dimensions and calls.

The six German level-six spell strings each measure 147 pixels, including
their embedded spacing characters. The original spell menu leaves only 120
pixels after its arrow column; its translated width grows from 18 to 22
tiles. `Streichholzschachtel` similarly needs a wider inventory row.
These are text-layout changes, with no change to the SNES hardware model.

[status-menu-language.test.mjs](../tools/status-menu-language.test.mjs)
opens all six submenus through the real native loop in both languages, with
cheats off and on. It checks actual window sizes and that glyph uploads do
not overwrite scene graphics at VRAM `E000..EFFF`. The reported spell-menu
overflow changed those bytes and left visible floor artifacts after closing.
Source equations remain covered separately by the EA6E and F254 tests.

## Extraction and pairing

`npm run extract:vm-texts-de` ([extract-texts-de.mjs](../tools/extract-texts-de.mjs))
writes `assets/vm-texts-de.json`: per English text address the German text
with umlauts as Unicode, the structure that pairs them, and the seven umlaut
glyphs. Each pair comes from a structure that exists in both ROMs:

| Source       | Pairs | How                                                                                                                                                                                                                                               |
| ------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| topics       | 64    | Topic table 8D:8000, same address in both ROMs.                                                                                                                                                                                                   |
| dialogs      | 645   | Dialog records 8D:80C0; German dialog table 80:94FB through the code of 80:9178. Records match by entry keys and topics; 37 dialog numbers come from the script arguments of native 149 (80:936C), the rest by number offset and content.         |
| text numbers | 594   | English 80:D9B8 (611), German 80:D97A (599). 305 numbers from the arguments of natives 200 (80:FEC1) and 154 (80:933A) in the 919 scripts with the same opcodes; even gaps follow, seven shorter gaps by content (the German version dropped 12). |
| kinds        | 186   | English 8C:EFB0, German 8C:F0E8; all 275 value and flag words agree.                                                                                                                                                                              |
| tables       | 70    | The 13 text tables of bank 80 and the runner names 80:9782, found by their surrounding bytes; all entries are text starts.                                                                                                                        |
| code         | 12    | Immediate text operands in banks 80 and 81, found by their instruction context.                                                                                                                                                                   |
| order        | 20    | Texts between two paired texts when the gap has the same size in both ROMs.                                                                                                                                                                       |

It also writes the 15 menu texts with their position shift, the arrow
shift (`menuArrowShift`) and the seven packed streams (`streams`; German
addresses 81:F680, 81:F897, 81:F94F, 81:FBAD, 81:F361, 85:FD42, 85:FC15,
taken from the German unpack calls and scene lists).

The generator prints every choice made by content (dialogs and the seven
text number gaps) for review; all were checked on 2026-11-05.
The counts above describe address pairing before the three font-symbol
overrides; those asset entries use `source: "font symbols"`.

## Graphics survey (2026-11-06)

All graphics of the English data were compared with the German ROM after
unpacking (scratch scripts, not kept). The German unpacker reads the bit
length table at 80:A03F instead of 80:A033; the room tile table lies at
8B:EF19 instead of 8D:A41F.

- Changed in the German version: only the fonts and tilemaps of the intro
  text, licence screen, start menu (81:F8B8, 81:F803, 81:FB0A) and credits
  (85:FC15, 85:FD38). The port uses them since step 2.
- Portraits: 29 of 37 streams differ, but they show the same faces,
  repacked, reordered and partly recoloured; none contains text.
- Identical: all 1536 room tile streams (6144 tiles in banks 82 to 87),
  every other packed graphic (title, intro scenes, matrix, sprites) and
  every uncompressed OBJ and BG tile of `vm-vram.json`.
- English text inside graphics that the German original kept: the
  SHADOWRUN logo, the Data East logo with "CORPORATION" and the Beam
  Software logo. Whether room graphics show signs with English text was not
  checked; it would need rendered rooms, since the tile sheets hold single
  tiles only.

Translating any of these would mean drawing new graphics without a German
original; the user set this aside on 2026-11-06.

## Limits

- 12 English texts have no German counterpart because the German version
  dropped them (for example "Connecting...", the 28,000 nuyen rifle and the
  Black Leather Jacket offer). They stay English.
- English "Negotiation" (9D:8649) is both a topic and a skill name. German
  uses "Handeln" for the topic and "Verhandlungsgeschick" for the skill; the
  port keeps one text per English text and shows "Handeln" in both places.
- Notices, glove names and the menu families described above adapt.
  Dialogue bodies retain their English window geometry and page through
  long texts. A word too wide for its window is cut at the window edge.
  Computed notice sizes may differ from the German original's choices where
  no script call names them.
- Regression checks cover the reported apartment and inventory paths and
  shared layout contracts; this is not a complete playthrough of every
  dialogue and story state. See
  [text-layout-language.test.mjs](../tools/text-layout-language.test.mjs).
- The purchase prompt in script `28D` (decimal 653, PC 216..229) is a
  separate FEC1 notice: text number 21 (`9D:F5FE`), one text row and six
  columns before translation. Its German word needs more than the 32-pixel
  interior. The notice measurement now rejects an oversized word even when
  its line count is one, so the window grows before tile allocation and
  before the subsequent CD43 Yes/No window. The regression uses the exact
  script arguments in [language.test.mjs](../tools/language.test.mjs).
- The composition FB39 turns a to z into capitals in its capital mode; the
  umlaut codes stay as they are there.
- The matrix texts stay English: the German version did not translate them
  (all their lines are in the German ROM unchanged, no German line exists).
- Fix (user request 2026-11-05): the German intro text writes the "ä" of <!-- language-ok -->
  "mächtig" as code 84, which its character map leaves blank, so the <!-- language-ok -->
  original shows "m chtig". The generator writes "$" there (the map's "ä") <!-- language-ok -->
  and packs the stream again.
- Fix (user request 2026-11-08): the extractor corrects the missing letter
  in the workshop greeting at English address `9D:C4FB`. This is an explicit
  spelling correction to the German cartridge text; the pairing and English
  text stay unchanged.
