# Packed intro and credits text contract

Established and implemented on 2026-11-09 against the local European and
German ROMs. The [ROM-free content work](ROM-FREE.md) now accepts these two
domains in [vm-text-edits.json](../assets/vm-text-edits.json), using the
authoring rules in [EDITABLE-TEXT.md](EDITABLE-TEXT.md#packed-intro-and-credits).

## Identities, readers and assets

Use the original European **stream address** as the stable identity. A line
offset or a German source address is not an identity: both change when text
is repacked. The complete intro is one ordered line list; the complete
credits are one ordered page list. Page and line positions below identify
original content, not independent runtime pointers.

| Domain             | Stable identity | German ROM source | Output    | Reader                                                                                          |
| ------------------ | --------------- | ----------------- | --------- | ----------------------------------------------------------------------------------------------- |
| Scrolling prologue | `81:F5CE`       | `81:F680`         | `7E:62A8` | `81:DDDB`, unpack at `81:DDFB`, line renderer `81:DE93`                                         |
| Credits            | `81:F2BD`       | `81:F361`         | `7E:62A8` | `81:CDF8`, unpack at `81:CE64`, page renderer `81:D1F0`, alignment `81:D336`, drawing `81:D351` |

Both are already decoded in [vm-lz.json](../assets/vm-lz.json): `lines`
for the intro (`text`), `groups` for the credits (`credits`). They are not
Huffman texts, frontend ASCII labels or matrix messages. Neither the
Huffman glyphs nor the matrix controls apply.

| Domain   | English output / packed bytes | German output / packed bytes | Original layout                                                      |
| -------- | ----------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| Prologue | 351 / 273                     | 412 / 321                    | 28 English lines, 29 German lines, including space-only lines        |
| Credits  | 638 / 464                     | 654 / 478                    | 14 pages in each language; line counts `3,3,3,3,4,3,3,2,4,4,4,4,3,3` |

Packed sizes include the two-byte output length. The German intro size
describes the shipped language asset after its documented umlaut repair.
Other German text bytes, maps and fonts match their German ROM streams.

The original credit pages, in order, are system programming; game
programming twice; artwork; additional artwork; game design; map
construction; music; game testing four times; project management and game
design; producers. The names and wording remain original content.

## Stream grammar and controls

The outer packing is the native LZ format of `80:9F49`/`80:9F4D`, reached
through `80:F2A0`. Its word header is the decoded byte count; the packed
payload follows. [lz.mjs](../src/data/lz.mjs) records the token equations.
[lz-streams.mjs](../src/data/lz-streams.mjs) decodes and restores both text
formats, including their original packing tokens.

| Domain   | Decoded grammar                                                                         | Meaning of zero                                            |
| -------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Prologue | One or more character bytes and `00`, repeated, followed by `00`                        | Ends a line; a zero at the next line start ends the stream |
| Credits  | A nonzero count byte, that many zero-terminated lines, repeated, followed by count `00` | Ends a line; at a page boundary it ends the page list      |

A space-only prologue line is spacing. An empty prologue line stops the
stream; it cannot represent an intermediate blank row. Credits can contain
empty lines because their count still advances the reader. A zero page
count stops the list and does not advance its cursor.

There are no inline waits, newline commands, count substitutions, back
steps or bold controls here. Printable bytes select map entries. The edit
format uses structured `lines` and `groups` arrays; the encoder inserts
the structural bytes and rejects byte escapes, NUL and control syntax.

## Fonts and language-specific aliases

Each domain needs its text, character map and graphics from the same
language. Existing scene lists install the graphics; the direct unpack
calls install the character map and text.

| Domain   | European map / German source | European font / German source | Decoded size                                       |
| -------- | ---------------------------- | ----------------------------- | -------------------------------------------------- |
| Prologue | `81:F803` / `81:F897`        | `81:F8B8` / `81:F94F`         | 128 map words; 82 English or 84 German 2-bpp tiles |
| Credits  | `85:FD38` / `85:FD42`        | `85:FC15` / `85:FC15`         | 160 map words; 54 English or 56 German 2-bpp tiles |

The prologue font is loaded by scene list `81:F768` to VRAM word `2000`.
The credits font is loaded by `81:F529` to word `1000`. These are the
existing scene-list contracts, not new hardware assumptions; see
[scene-lists.mjs](../src/data/scene-lists.mjs) and
[PPU-BROWSER.md](PPU-BROWSER.md).

`81:DE93` indexes the word at `7E:56A8 + 2 * (code - 20)` and applies
`C0FF` before writing the tilemap word. The credits drawing loop runs with
an **8-bit accumulator**: its shifted character index wraps at 256, it
reads only the map entry's low byte and writes only the destination tile
word's low byte. The map clear at `81:D37D` supplies the retained high byte
`20`. The extra 32 words in the credits map are preserved data, not proof
of another 32 usable character codes. Bytes at or above `A0` can alias
earlier entries through that 8-bit shift and must not enter an edit.

Printable ASCII alone is insufficient validation:

- The prologue has separate upper- and lowercase glyphs. Its English map
  gives `$` and `%` the blank tile. Its German map uses them for `ä` and
  `ß`. The German asset corrects the original intro's CP437 byte `84` to
  `$`, because the original map leaves the `84` entry blank.
- Credits map English lowercase letters to the same tiles as uppercase.
  German lowercase `a` selects `Ä`, and lowercase `u` selects `Ü`; uppercase
  `A` and `U` retain their ordinary letters. Lowercase `o` still selects
  `O`, so an `Ö` mapping cannot be inferred. Normal German words must be
  encoded with this alias rule, not copied as arbitrary lowercase bytes.
- Many unsupported credits characters, including `$`, select tile 2: a
  solid seven-by-seven block. Space selects the blank tile 0. The English
  credits' distinct non-placeholder printable entries are `!`, `-`, `.`,
  digits, `:`, `?`, letters and backslash. Backslash is a diagonal graphic,
  not an authoring escape.
- Several other prologue map slots select graphics without established
  authoring semantics. A nonzero tile number proves neither a Unicode
  mapping nor that a glyph has the requested meaning.

[packed-text-edits.mjs](../src/data/packed-text-edits.mjs) validates a
conservative alphabet per domain, maps the established Unicode aliases
and uppercases ordinary credits letters. It rejects raw alias punctuation,
placeholder entries and unsupported glyphs. Adding glyphs is a separate
font-content change.

## Layout and timing boundaries

Both renderers use the 32-by-32 tilemap at `7E:4EA8` (2,048 bytes), ending
where the character-map workspace begins at `7E:56A8`. Neither renderer
wraps words or checks line length.

The prologue chooses the ring row at byte offset
`(8 * (scroll & FFF8) + 0780) & 07FF`. It pads a line with
`floor((32 - length) / 2)` blank tiles, draws it, then clears to the next
row boundary. Lines of **1 through 32 characters** fit. Longer lines
underflow the 16-bit padding counter and can clear outside the tilemap;
they must be rejected before drawing. Zero-length lines end the stream.

The prologue scrolls one pixel every three owner iterations and admits a
new text line every eight scroll pixels. Its owner has a fixed 980-round
budget, starts the title song after 120 rounds and accepts input to leave
early. End of text sets the scroll delay to 4,000; it does not extend the
owner budget. More lines require a separate timing decision and visible
output checks. Nonempty edits preserve each language's original line
count. Authors choose their own spacing with space-only lines. An empty
list hides the whole intro without changing the owner budget.

Credits use a page base of `0380 - 0040 * lineCount`, in bytes. Alignment
adds `(32 - length) & FE`. After drawing each line, the next base is
`(endOffset + 0080) & FFC0`.

- At up to **31 characters**, successive lines are two tile rows apart.
  Four lines occupy rows 10, 12, 14 and 16.
- At exactly **32 characters**, the draw cursor reaches the next row
  before this calculation. Four lines occupy rows 10, 13, 16 and 19.
  This is original behavior, not a general 32-column safe layout.
- Five short lines occupy rows 9, 11, 13, 15 and 17. The original TM mask
  admits BG3 in a 64-line band after 76 lines; the outer text rows cross
  that band. More than 14 lines also underflow the first map offset and
  write outside the tilemap. Storage bounds alone would miss the visible
  clipping already present at five lines.

The safe initial credits policy is therefore **one through four lines per
page, zero through 31 characters per line**, with the original 14 pages.
An empty page list hides all credit text without changing the sequence.
The page timer is set to 500, decrements to zero, then builds the next
page on the following call: 501 animation calls between page builds.
Sequence 5 has a 7,000 main counter and a 50-round ending counter, each
executed through zero. The last page and final clear extend into that
ending phase. Page count and timing must be reviewed together before
admitting additional pages or changing their duration.

## Placement, relocation and runtime ownership

The packed prologue ends at `81:F6DF`, where title scene lists start. The
packed credits end at `81:F48D`, where the six scene-list pointers start.
Neither neighbor is spare storage. Existing `placeLzStreams` repacks an
edited asset at the same address and rejects a collision or bank crossing
with `lz_layout_changed`. A smaller stream can leave a gap; a larger
stream does not gain permission to overwrite neighboring data. Direct
editing of `vm-lz.json` also does not validate glyphs, layout or timing.

The existing language layer already redirects seven packed sources into
the read-only language bank `A1:8000`: both text/map/font triples and the
license-screen map. `buildLanguage` accounts for two bytes of final
read-ahead and rejects bank overflow. `redirectLanguageStream` changes
DP `E1/E3` when unpacking starts. Effective edits use a separate temporary
read-only bank `A2:8000`, with the complete edited text and the selected
map/font streams. Their total size, including two read-ahead bytes, must
fit in 32 KiB. The largest accepted credit text is 1,807 decoded bytes;
the largest German intro is 958. Both stay below the next scene layer at
`7E:76A8`, after the text start `7E:62A8`.

The loader validates every edit. At sequence setup, `beginPackedTextEdit`
resolves selected-language edit, existing translation, English edit and
original content in that order. It packs the selected edit and verifies
the matching font/map sources before publishing any provider state. An
English fallback includes English map/font bytes even when German is
selected. The original ROM view and content assets stay unchanged.

When no effective edit applies, the snapshot retains the exact original
or translated source pointers. A translated snapshot also retains its
`A1` bank so switching to English cannot remove an in-flight source.
Redirecting an unchanged original pointer adds no DP writes.

The prologue captures its snapshot before loading the map, text and scene
list font; sequence 5 captures one before its scene setup. Both release it
in a `finally` block after their initial sources have loaded. No temporary
`A2` address remains readable after release. The loaded WRAM/VRAM content
belongs to that display until a later rebuild. Language switches during
or after setup therefore affect the next sequence, preserving its current
text/map/font combination. Timing, controls and scene choreography remain
owned by the original routines.

Font unpacking retains the full stream length. The original scene lists
still DMA 1,312 intro-font bytes and 864 credits-font bytes to VRAM in both
languages. The supported German alias glyphs lie within those spans; the
extra two German tiles do not extend the original DMA. Editing new glyphs
or DMA lengths is outside this contract.

## Verification and limits

[packed-text-contract.test.mjs](../tools/packed-text-contract.test.mjs)
checks original and translated stream sizes and structure, byte-identical
restoration from the stored tokens, occupied placement neighbors, German
ROM correspondence and the one documented intro repair. It checks the
font/map sizes and alias boundaries, including the credits placeholder.

The layout cases compare the actual European instructions with native
`81:DE93` and `81:D1F0`: intro termination and widths through 32, empty
credit lines, normal four-line pages, the 32-column stride, five-line
placement and first-offset underflow. Synthetic maps make character reads,
the prologue mask and credits low-byte stores visible. Language switching
checks future stream redirection and preservation of loaded WRAM.

Existing [frontend source specs](../tools/main-frontend-source.mjs),
[scene animation specs](../tools/main-scene-animation-source.mjs),
[language tests](../tools/language.test.mjs) and the
[live credits test](../tools/credits.test.mjs) retain their established
source, timing and original-content checks.

[packed-text-edits.test.mjs](../tools/packed-text-edits.test.mjs) covers
authoring limits, unsupported glyphs, empty lists/lines, original-byte
preservation, worker cloning, fallback order, bounded placement, read-only
and expired banks, missing sources and stale snapshot release. Native live
runs in both languages observe edited intro and credits tiles through the
real NMI/DMA path and compare the installed font bytes. Each run switches
language during both source loads and verifies coherent output. Original
translated snapshots also survive removal of the active language bank.

These are native edited-content checks, not new Mesen routes or browser
picture comparisons. Arbitrary line/page counts, new glyphs, changed
timing and mid-sequence rebuilds remain outside the delivered behavior.
