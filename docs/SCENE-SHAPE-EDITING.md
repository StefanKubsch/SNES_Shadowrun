# Scene shape footprints and a bounded editing contract

Established on 2026-11-10. This is a read-only audit and a contract for a
possible first shape editor. It does not enable shape edits in the product.
The existing [backdrop edit loader](SCENE-STREAM-EDITING.md) still accepts only
an address and backdrop colour.

Run the [audit](../tools/scene-shape-audit.mjs) with:

```powershell
node tools/scene-shape-audit.mjs > .cache/logs/scene-shape-audit.json
```

The tool checks that the supplied records, scene pointers and six tilesets
match the assembled cartridge, then observes actual native drawing and full
scene construction. It does not open a ROM. Its report describes the current
assets; it is not a trusted capacity manifest for future edits. Checksums are
diagnostic comparisons, not authentication.

## Shape coordinates and writes

Sources are the original loader `81:8DE2`, diagonals `81:8D09` and `81:8D23`,
rectangle border `81:8D3D`, rectangle fill `81:8DC0`, and block placement
`81:8EDF`. Their native equations are in
[main-scene-load.mjs](../src/task/main-scene-load.mjs); the pinned source windows
and existing original-instruction comparisons are in
[main-scene-load-source.mjs](../tools/main-scene-load-source.mjs) and
[main-scene-load.test.mjs](../tools/main-scene-load.test.mjs).

The grid occupies `7F:CA14` through `7F:DA13`: 4,096 bytes, 32 rows of
64 words. A shape's readable column is a byte offset, not a word-cell number.
The loader computes the initial offset with mask `3FFE`, clearing the low
bit as well as the flags. Diagonal steps are 126 or 130 bytes. These are
linear offsets; there is no independent rectangular clipping at each row's
left and right edges.

Block placement consumes only rows 8 through 31 and the first 32 word cells
of each row. The other half of each row and the first eight rows do not feed
this block-placement pass. The consumed 32 by 24 blocks become a 64 by 96
layer of tile words, with each block supplying two columns of four words.
Overlapping shapes are drawn in record order; later writes replace earlier
values, including writing zero.

A line counter of zero draws one cell, subject to clipping. Before clipping,
a rectangle without a border writes `(height + 1) * (width + 1) + height * width`
cells: alternating diagonals use counters `width` and `width - 1`. Both width
and height zero still draw one cell. Decrement-to-negative termination and
16-bit index arithmetic must be retained; byte-field validation does not
establish a safe footprint.

A border adds edge values `v + 1` through `v + 4` and corner values `v + 5`
through `v + 8`. These are word operations: base value 255 can emit 263.
Most stores test the current offset against `0FFF`. The first upper corner
only tests the lower bound of one row. A synthetic bordered rectangle at
row 33, column 0, width 0 and height 0 writes at grid offset `1000`, which
aliases the decoded scene's backdrop word. This is a demonstrated invalid
candidate, not an original scene defect. Row/column byte ranges are therefore
insufficient admission rules, even for a rectangle whose other edges clip.

## Block and palette ownership

`81:A117` selects the block and attribute pointers for the original tileset.
For each nonzero consumed grid value `b`, `81:8EDF` reads its attribute at
`attributes + b` and eight tile words at `blocks + 16 * b`. Zero skips placement.
[tilesets.mjs](../src/data/tilesets.mjs) establishes contiguous ownership of
128, 80, 80, 24, 80 and 104 blocks in the six original sets. A present byte
beyond a set is another owner's data, not a valid extra block. Border-derived
values and final overwritten-grid values require their own bounds checks.

`81:8CE0` assigns palette slots in first-use order. Scene BG palettes use
slots 1 through 7; zero is reserved. The palette list begins at `7E:0CFE`,
with the first allocated entry at `0D00` and slot seven at `0D0C`. An eighth
entry aliases the upload flag at `0D0E`. The NMI uploader `80:999A` and tile
palette bits also consume these slots. The scene's 74-entry palette lookup
is a lookup by identity, not permission for 74 simultaneous BG palettes.
Sources: [main-initialize.mjs](../src/task/main-initialize.mjs),
[main-game-nmi.mjs](../src/task/main-game-nmi.mjs), and
[wram.mjs](../src/task/wram.mjs).

## Shared tile stacks and walls

`81:8E57` interns triples into 1,024 shared tile-stack entries. Slot zero is
the empty triple. `81:8FC2` initializes descending allocation for the low
layer. `81:8FF0` later initializes ascending allocation for the high layer,
while the low layer still references its existing entries. It does not grant
another independent 1,024 entries. The audit saves nonzero indices referenced
by the completed low layer, checks every new high-layer allocation against
them, and verifies their three stored words again at completion. It reports
both a per-pass peak and the combined peak including retained low entries.
Free-stack exhaustion and allocation overlap must be rejected by a future
preflight before any data publication.

Object drawing in [main-scene-layers.mjs](../src/task/main-scene-layers.mjs)
allocates wall records in groups of four cells of six bytes: 24 bytes per
new wall-map word. The height array starts at `7F:0C00`, the tile array at
`7F:69C0`, and the next owner, the tile-stack hash heads, at `7F:C780`.
Each wall array has 24,000 bytes before that next owner. The wall map itself
has 1,536 words; allocating every word would exceed the arrays. Its word
count is not a safe allocation budget. The audit snapshots the next wall
record offset after each construction phase, including the separate low
and high object passes and their intervening reset.

## Original observations and checks

| Observation                                                         |                 Result |
| ------------------------------------------------------------------- | ---------------------: |
| Scene identities                                                    |                    165 |
| Shapes                                                              |                    209 |
| Shapes with at least one zero counter                               |                     24 |
| Shapes writing outside the grid                                     |                      0 |
| Shapes emitting an unowned nonzero block value                      |                      0 |
| Scenes with an unowned final consumed block                         |                      0 |
| Highest tile-stack allocation within one pass                       |                    771 |
| Highest combined allocation with retained low stacks                |           973 of 1,024 |
| Scenes with low/high allocation overlap or changed retained triples |                      0 |
| Highest wall-array use                                              | 23,400 of 24,000 bytes |
| Highest simultaneous scene BG palette count                         |                 7 of 7 |

The combined stack peak occurs at `8B:A98A`, the wall peak at `8A:CB78`,
and the palette peak at `8B:F015`. These observations are not spare capacity
promises for edits. Changing block tile words can change triple sharing and
allocation order while the footprint stays identical.

[Regression tests](../tools/scene-shape-audit.test.mjs) compare the native
write sequence with actual original ROM instructions for all 209 original
shapes and seven synthetic boundary cases. They compare every original
record and all six tilesets with the European ROM. Instrumented full native
construction is checked against uninstrumented construction for all 165
scenes. Inconsistent records, identities, ordering, metadata and tilesets
are rejected. The isolated callers begin with synthetic zero WRAM; these
are source and construction checks, not route, hardware or timing observations.

## Conservative first authoring subset

A first editor can admit shape **value changes only**, retaining the original
count, order, kind, border flag, position, step and counters. A candidate must
meet every condition below; the audit does not implement this admission path.

1. Pin the original identity, record and packed capacity independently of the
   editable assets. Preserve the backdrop, tileset, both object lists, decoded
   length, list offsets, room links and all language aliases.
2. Trace every changed shape with the actual decoder. Require the original
   write-address sequence, word widths and parsed endpoint, with no store
   outside the shape grid. Preserve the zero/nonzero status of each emitted
   value. Every nonzero emitted and final consumed value must belong to the
   original tileset.
3. For each emitted old/new nonzero block pair, preserve the attribute byte
   and the zero/nonzero mask of its eight tile words. These conservative
   restrictions retain palette identities and tile-cell occupancy; they do
   not prove unchanged triple allocation or gameplay appearance.
4. Repack and prove exact final-token output inside the original slot, with
   present native word-read endpoints in the same bank. Shape value changes
   do not inherit the backdrop field's universal exact-fit property.
5. Preflight complete construction on scratch state before publishing any
   edit. Check every allocation, retained low triples, palette use, wall-array
   extent, owned reads/writes, output pointers and decoded read-ahead guard.
   A peak below 1,024 alone does not establish nonoverlapping stack indices.
6. Prepare the entire edit set atomically. Test malformed, oversized and late
   failures, both languages and shared aliases, confinement and a visible room.
   Keep static collision equal because the object lists are unchanged.

A changed floor can look different from its unchanged object collision; this
subset does not create or move collision geometry. Position, dimensions,
shape insertion/removal, tileset switching, object placement and arbitrary
palette changes remain separate contracts.
