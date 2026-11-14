# Packed graphics and map authoring boundaries

The read-only audit in [packed-asset-audit.mjs](../tools/packed-asset-audit.mjs)
establishes source spans for the decoded European assets. It reserves no
additional space. The room tile edit layer described below now supports pixel
replacement within those spans. The browser already runs without a ROM;
this work concerns the limits on changing its decoded content.

Run from the repository root:

```powershell
node tools/packed-asset-audit.mjs > .cache/logs/packed-asset-audit.json
```

The command reconstructs the current cartridge from versioned assets and reads
the generated ROM map for neighboring data classes. It never opens either ROM.
It checks matching source identities, token reconstruction, encoded bytes,
bank containment and non-overlapping source spans. Its report describes the
current input files, not an independently trusted capacity manifest for edited
files. The regression test separately compares every span and word-read margin
with the original European ROM.

## Inventory established on 2026-11-09

| Format                  | Streams | Encoded bytes including length headers | Output bytes | Additional word-read bytes |
| ----------------------- | ------: | -------------------------------------: | -----------: | -------------------------: |
| Room 4 bpp tiles        |   1,536 |                                137,090 |      196,608 |                        761 |
| BG 2 bpp characters     |       4 |                                  1,437 |        3,328 |                          1 |
| BG 4 bpp characters     |      11 |                                 26,978 |       49,216 |                          6 |
| OBJ 4 bpp characters    |      43 |                                 61,987 |      163,840 |                         21 |
| Maps and character maps |      27 |                                 10,663 |       79,680 |                         11 |
| Scene records           |     165 |                                 47,331 |       69,854 |                         83 |
| Intro text              |       1 |                                    273 |          351 |                          0 |
| Credits text            |       1 |                                    464 |          638 |                          0 |
| Initial actor states    |       1 |                                    399 |        3,515 |                          0 |

All 1,789 streams reproduce their encoded input. None of their final tokens
writes beyond its requested output length. Of these sources, 1,759 end exactly
where another audited stream starts. The other 30 end before palettes (13),
portrait records (4), scene lists (3), filler (2), object graphics (2), and one
each of lookup tables, object types, scene tables, scripts, script tables and
unidentified data. No such neighbor is available as growth space, including
filler and unidentified bytes.

There are 883 one-byte word-read margins, all present. These bytes belong to
their neighbors and are excluded from the encoded slot budget. Presence alone
does not grant permission to change or remove a byte.

## Source and reader contracts

- [tiles.mjs](../src/data/tiles.mjs), `readTiles` and `placeTiles`, and
  [main-scene-graphics.mjs](../src/task/main-scene-graphics.mjs), reader
  `81:A1E1`: table `8D:A41F` supplies 1,536 pointers, with 256 streams per
  bank `82` to `87`. Each output is 128 bytes, four 8 by 8 tiles with indices
  0 to 15. Asset addresses point at the packing offset word. The native
  `80:9E7E` pointer is two bytes earlier; those preceding bytes are not an
  owned length header. For example, the first source occupies `82:8000` to
  `82:8036` exclusive, with its next stream starting at `82:8036`.
- [lz-streams.mjs](../src/data/lz-streams.mjs), `placeLzStreams`: the other
  253 sources start with their output length word, then the packing offset
  word. They include all 165 scene records, 27 map streams and 58 character
  streams. Map words are source data: some are ordinary PPU tilemap words,
  while matrix words pass through `81:B4B9`, the character maps serve the
  intro/credits renderers, and `81:FF40` receives the `2017` adjustment in
  `81:A9B2`. A uniform map format does not imply uniform editing semantics.
- [lz.mjs](../src/data/lz.mjs), `lzDecode` and `lzEncode`: stored tokens
  preserve original bytes when they still describe the output. Changed
  content can force greedy packing and therefore change the encoded length,
  even when dimensions and output length remain identical.
- [native-unpack.mjs](../src/task/native-unpack.mjs), `80:9E65` bit helper:
  bit refill reads a word, so an odd number of consumed bitstream bytes
  borrows one byte beyond the encoded source. The decoder reports consumed
  bytes, not this additional read. The final output token is copied in full;
  a future edit must not rely on the decoder's output slicing to hide a
  native write beyond the output length. `9F6D` uses the shared unpack body
  into bank `7F`; its continuation and destination ownership remain separate
  from the source-span accounting here.

These findings follow the existing native equations and their established
source contracts. They introduce no new SNES hardware behavior or timing model.
The tests run actual native unpacking for every format and both word-margin
parities where present, checking bit counts, source endpoints and output.

## Delivered authoring contract: room tile pixels within original slots

The implementation is a separately stored pixel edit layer for the 1,536
room tile identities, retaining the extracted BMP sheets as the baseline.
The following requirements define that layer:

1. Identify each group of four tiles by its existing stream address or stable
   table index. Keep the six sheets, dimensions, tile order, 128-byte output,
   index range and pointer table unchanged. No new tiles or palette identities.
2. Derive each capacity from the unedited baseline, not from editable tokens
   or from the next unoccupied byte at loader time. Validate the complete edit
   set before changing the assembled cartridge. Reject duplicate or unknown
   identities, invalid pixels and encoded streams larger than their slots.
3. Encode with the existing codec and require decode equality and exact token
   output length. Retain the original slot tail when a stream becomes shorter.
   Check the native word-read endpoint against existing data; preserve every
   neighboring byte. No moving pointers, claiming filler or changing margins.
4. With no edits, reproduce the existing cartridge byte for byte. With edits,
   only the admitted source slots may differ. A failed edit set leaves the
   assembled data unchanged. Test exact-fit, shorter and oversized packing,
   invalid indices, multiple edits and a failure after an otherwise valid edit.
5. Check edited output through the actual room-tile unpack path and a live
   visible room. This establishes pixel replacement, not collision, object,
   map, palette or whole-scene authoring.

## Editing room pixels

Edit [vm-room-tile-edits.json](../assets/vm-room-tile-edits.json). The default
empty list preserves the assembled cartridge byte for byte. Each entry has
exactly `address` and `pixels`: use a source identity from
[vm-tiles.json](../assets/vm-tiles.json), then eight strings of 32 uppercase
hexadecimal indices. Each row contains the corresponding row of four 8 by 8
tiles placed side by side, from left to right. The values are palette indices
`0` to `F`, not RGB colors. Palettes remain in their existing assets.

For example, this replaces the first four tiles with index zero throughout:

```json
{
  "format": "shadowrun-room-tile-edits-v1",
  "edits": [
    {
      "address": "82:8000",
      "pixels": [
        "00000000000000000000000000000000",
        "00000000000000000000000000000000",
        "00000000000000000000000000000000",
        "00000000000000000000000000000000",
        "00000000000000000000000000000000",
        "00000000000000000000000000000000",
        "00000000000000000000000000000000",
        "00000000000000000000000000000000"
      ]
    }
  ]
}
```

[room-tile-edits.mjs](../src/data/room-tile-edits.mjs) runs after the baseline
cartridge has been fully assembled, so every neighboring byte is available for
validation. It derives each slot from the original source before any edits
are written, checks its stored baseline tokens, converts the pixels to planes,
packs and decodes them, and checks the entire final token output and native
word-read endpoint. Only after every entry passes does it replace the packed
prefixes; presence marks, pointers, neighbors and unused tails stay intact.

The original token decomposition is reused when it still matches the edited
pixels. Otherwise the existing greedy encoder is used. A highly repetitive
image does not necessarily get shorter if the original tokens still fit.
Compression is the admission limit: equal image dimensions alone cannot
guarantee a fit. An oversized entry reports `room_tile_edit_slot_exceeded`
with its source address and the loader stops. Invalid grids, unknown or
duplicate identities and unsupported entry fields also stop loading before
any edit is applied. Clear the edit list to restore the original artwork.

These edits are shared by English and German because they affect room tiles,
not either language's text fonts. They apply when the cartridge is loaded;
restart the game page after editing the file. The static build includes the
edit asset automatically. ROM extraction generators do not overwrite it.

The [regression checks](../tools/room-tile-edits.test.mjs) cover empty loading
and progress, exact-fit and shorter streams, untouched bytes across the entire
cartridge, overflow after a valid edit, malformed input, missing source/margin
bytes, baseline mismatch and actual native `9E7E` output with destination
guards. A cold live run observes the sources used by the first room, loads
pixel-inverted edits for them, and proves that VRAM and the rendered room
change while the collision grid and palettes remain equal.

## Remaining boundaries

The [character consumer audit](CHARACTER-STREAM-EDITING.md) now accounts for
all 58 length-prefixed graphics sources, shared portrait aliases, scene DMA
tails and the two language-specific fonts. Its separate character edit loader
now implements bounded pixel edits for 56 shared sources. The
[map consumer audit](MAP-STREAM-EDITING.md) accounts for all 27 map sources
and supports fixed-slot word edits for 20 shared screen maps. Specialized
maps and language replacements retain separate ownership. The
[scene consumer audit and backdrop edits](SCENE-STREAM-EDITING.md) cover all
165 shared scene sources, with fixed-slot colour-zero replacement. Shape,
tileset and object authoring, language-specific font editing, relocation and larger
uncompressed outputs remain separate contracts. Existing
[packed text editing](PACKED-TEXT-EDITING.md) already uses temporary source
banks for its two text identities; that mechanism does not authorize unrelated
graphics or map relocation.
