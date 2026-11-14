# Packed scene consumer audit and authoring boundaries

Established on 2026-11-10. The read-only
[scene-stream-audit.mjs](../tools/scene-stream-audit.mjs) joins all original
scene identities with their [packed slots](PACKED-ASSET-EDITING.md), room
headers and entry aliases, tilesets, object definitions, graphics dependencies
and historical unpack observations. It assembles the cartridge from assets
without opening a ROM. Run:

```powershell
node tools/scene-stream-audit.mjs > .cache/logs/scene-stream-audit.json
```

The report is descriptive, not a trusted capacity manifest for edited inputs.
Missing generated inputs require `npm run rebuild:artifacts`. The separate
[regression tests](../tools/scene-stream-audit.test.mjs) compare every scene's
decoded bytes and packed slot, the scene pointer table, and all room headers
and entries with the original European ROM. They also run the actual native
scene construction for every original scene.

## Inventory and aliases

| Item                                             |  Count |
| ------------------------------------------------ | -----: |
| Distinct packed scene sources                    |    165 |
| Decoded bytes                                    | 69,854 |
| Packed bytes including length headers            | 47,331 |
| Borrowed one-byte compressed-source read margins |     83 |
| Room headers                                     |    192 |
| Room table entries naming headers                |    496 |
| Null room entries                                |      2 |
| Scene sources with historical route observations |     14 |

Every scene has at least one room header and at least one room entry.
Seventeen scenes have multiple room headers; 132 have multiple room entries.
Header indices 75, 154 and 177 have no room-table entry, but their scene
identities also have consumers through other headers. A header index is the
position in `vm-rooms.json.rooms`; it is not a room-table entry number.
The report enumerates both kinds of alias per scene. Static references do
not establish that every entry or header occurs on a gameplay route.

The table at `8B:F9E3` contains 165 distinct long source pointers. Table order
is the scene number used by room headers; the original packed address is a
stable source identity. `80:A4BF` takes the scene byte from the selected room
header and calls `81:A117` at `80:A518`. The loader unpacks through
`80:9F69` and `80:9F6D` into `7F:DA14`. An edit to one identity affects every
room header and entry selecting that scene.

Sources: [lz-streams.mjs](../src/data/lz-streams.mjs),
[rooms.mjs](../src/data/rooms.mjs),
[main-transition.mjs](../src/task/main-transition.mjs), and
[main-scene-load.mjs](../src/task/main-scene-load.mjs).

## Record structure and downstream ownership

The existing [scene codec](../src/data/scenes.mjs) already stores readable
records in `assets/vm-scenes.json`. `placeLzStreams` encodes these records
back into their original address view. Editing that baseline directly is
not an independently checked fixed-slot authoring layer; a record with the
same decoded size can have a different packed size or unsafe downstream
references. The separate backdrop edit loader below validates its original slot before
applying a colour change.

Each record contains, in order:

1. A backdrop word, a tileset byte and a shape count byte.
2. The shape records: four bytes for each line and five for each rectangle.
3. A count byte and five bytes per object for `objects_76a8`.
4. A count byte and five bytes per object for `objects_46a8`.

All records consume exactly their decoded output. The report records both
object-list count offsets and their type multiplicities, preserving list
order and each list's separate interpretation.

The backdrop is copied to `7E:0D12`; the game NMI writes its two bytes as
CGRAM colour zero at `80:99DC` and `80:99E2`. Three original backdrops are
nonzero (`0025`, `0026`, `0022`); the other 162 are `0000`. This field has an
independent colour output. It does not select a scene palette or create a
new palette identity. See [main-game-nmi.mjs](../src/task/main-game-nmi.mjs).

The tileset byte selects one of six block/attribute pointer pairs at
`8D:F1A0` and `8D:F1AC`. `81:8DE2` clears the shape grid at `7F:CA14`
and draws the scene's shapes. `81:8EDF` translates drawn grid cells through
the selected blocks and their palette attributes into tile layers. The
209 original shapes comprise 51 lines and 158 rectangles, 94 with borders.
Twenty-four shapes have at least one zero counter operand. Native loops
use decrement-to-negative counters; zero is not an empty-shape shortcut.
The line position is masked with `3FFE`, including clearing its low bit;
the rectangle border also writes corner values derived from its base value.
A field's byte range alone does not prove a valid shape footprint or block
selection. See [tilesets.mjs](../src/data/tilesets.mjs) and the native loader.

The 13,574 static scene objects reference all 548 object definitions, which
in turn reference 657 of the 658 graphics identities. `81:903E` reads both
lists for the tile layers at `7E:76A8` and `7E:46A8`, retaining their depth,
flip, signed coordinate and priority treatment. Definitions select graphic
parts, which select palettes and depth modes; generated tile stacks and
wall maps have their own capacity and clipping behavior. The report provides
one dependency row per used type with its graphic indices and attributes.
Matching graphics or type numbers do not make two placed objects identical.
See [object-types.mjs](../src/data/object-types.mjs),
[object-graphics.mjs](../src/data/object-graphics.mjs), and
[main-scene-layers.mjs](../src/task/main-scene-layers.mjs).

`81:A117` retains a pointer to the first object-list count in DP `77`/`79`.
Later `80:A584` calls `81:8756`, which calls `81:84DE` twice to consume
these same two lists for static collision boxes. The collision reader skips
objects with negative x or y and objects with negative z; otherwise it
expands the definition's boxes, swapping the planar axes for a flipped
object. The original records have 10,615 such definition-box expansions
in total. This is a dependency count, not a guarantee of free collision
capacity, generated node count or route reachability. Room actors, script
trigger boxes, exits, points and sight lists remain separate room data.
Changing a scene object can change both appearance and collision. See
[main-scene-collision.mjs](../src/task/main-scene-collision.mjs).

All 165 identities are shared by English and German, with no packed language
replacement. That does not grant ownership of fonts, text, room actors,
palette definitions, tilesets, object types or graphic definitions.

## Two distinct read margins

The compressed-source bit/literal helper reads words. Eighty-three original
slots borrow a byte after their encoded endpoint; that byte belongs to a
neighbor and grants no growth capacity. Existing packed audit accounting
and the original-ROM comparison cover those endpoints.

Separately, the decoded record reader performs word loads for byte fields.
The final count or coordinate therefore reads one byte beyond the parsed
record before masking it. The native test runs `81:A117` for every scene,
checks the final DP `0E` pointer against the exact record end, and tracks
the final read in the remainder of bank `7F`. Each run reads that one extra
byte and preserves its sentinel value. The record bytes remain equal to
the encoded baseline after construction. A shorter decoded record must not
silently claim that byte as new owned data or assume a zero value there.
These are native-reader observations, not a new hardware or timing model.

## Fixed-slot backdrop colour edits

Implemented on 2026-11-10. Edit [vm-scene-edits.json](../assets/vm-scene-edits.json),
which is empty by default. For example:

```json
{
  "format": "shadowrun-scene-edits-v1",
  "edits": [{ "address": "8B:D9DC", "backdrop": "7C1F" }]
}
```

The address is the original packed source identity listed in the audit and
in vm-scenes.json. It affects every room header and room-table entry selecting
that scene, in English and German. A scene index, room entry number or VRAM
address is not an alternative identity. Backdrop values must contain exactly
four uppercase hexadecimal digits in BGR555 range 0000 through 7FFF. This
changes colour zero, not the scene's palette definitions. A room may cover
some or all backdrop pixels with its tile layers.

[scene-edits.mjs](../src/data/scene-edits.mjs) runs after cartridge assembly.
It pins all 165 original identities in scene-table order, decoded byte counts,
packed capacities including headers, and packed FNV checksums independently
of editable assets. FNV detects accidental changes, not cryptographic forgery.
The loader checks scene-table pointers and baseline identities. For each edit,
it also checks the present original slot bytes, length header, encoded baseline
record, exact decoded output and original tokens before preparing a replacement.
The byte count and slot checksum are checked against the pinned values;
changing a baseline record or tokens cannot grant growth space.

Only the first two decoded bytes change. The existing codec repacks the result
and checks exact decoding and final-token output. Both original and replacement
native word-read endpoints must stay in their source bank and refer to present
bytes. Oversized output reports scene_edit_slot_exceeded. In the original 165
streams the first two bytes are literals and no backreference copies them.
Consequently every legal backdrop value retains the original tokens and packed
size. Shorter and oversized results are unreachable for this field with these
baselines; those cases must not be presented as tested original edit fixtures.
The general fit and output guards remain explicit.

The complete edit set is prepared before any writes. Unknown or duplicate
identities, malformed colours, unsupported fields, changed baselines or missing
source/margin bytes reject loading without publishing any edit. Clear or correct
the edit file to restore loading. Only packed prefixes are written. Headers,
pointers, slot tails, neighbours and presence marks are preserved. Shapes,
tilesets, both object lists and their offsets, room aliases and the decoded
read-ahead byte retain their existing ownership. Extraction generators do not
overwrite the separate edit asset; the static build includes it.

[Regression checks](../tools/scene-edits.test.mjs) compare all original slots
with the European ROM, prove the literal/reference property for the full colour
range, and check exact-fit edits for every identity with whole-cartridge
confinement. Malformed sets and late baseline or source-margin failures leave
all bytes untouched. Actual native scene construction and static object
collision are compared for every scene in English and German. Empty synthetic
room-zone lists isolate the static collision consumer; this is not gameplay
route coverage. A cold live room comparison checks CGRAM colour zero, other
palette bytes, VRAM, OAM and rendered pixels.

The [shape safety audit](SCENE-SHAPE-EDITING.md) now records all native shape
footprints and shared construction budgets, and defines a conservative first
value-only contract. It adds no shape edit loader. Source relocation, larger
outputs, geometry changes, tileset switching and object placement retain their
separate downstream footprint, palette, tile-stack and collision contracts. Room actors, scripts, links, language fonts and specialized
maps remain separate. These edits add no hardware or timing model.
