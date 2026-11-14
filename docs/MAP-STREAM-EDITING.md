# Packed map consumer audit and fixed-slot word editing

Established on 2026-11-10. The read-only
[map-stream-audit.mjs](../tools/map-stream-audit.mjs) joins every `map`
identity in `assets/vm-lz.json` with its
[original packed slot](PACKED-ASSET-EDITING.md), scene commands, title unpack
table, direct readers, German replacements and historical unpack observations.
It reconstructs the cartridge from assets without opening a ROM. Run:

```powershell
node tools/map-stream-audit.mjs > .cache/logs/map-stream-audit.json
```

Missing generated inputs require `npm run rebuild:artifacts`. Computed slot
sizes describe the current inputs; they are not trusted capacities for an
edited baseline. The regression test separately compares all decoded words
and the title unpack table with the original European ROM, then checks actual
native unpack output and destination guards for all 27 sources.

## Inventory and consumers

The 27 sources contain 79,680 output bytes in 10,663 packed bytes, including
length headers. Eleven have a borrowed one-byte native word-read margin;
these bytes remain owned by their neighbors. All identities have known static
loaders. Seventeen also have historical observations. A probe's `bytes`
classification means no direct VRAM use was observed; it does not override
the static reader's word interpretation.

| Consumer group             | Sources | Contract                                                                                                              |
| -------------------------- | ------: | --------------------------------------------------------------------------------------------------------------------- |
| Scene command lists        |      18 | `81:EC68` unpacks through `80:F2A0` into `7E:46A8`, then DMA uses the list's length and VRAM word address.            |
| Title unpack table         |       5 | `81:D83E` reads six-byte records at `81:D85C`: source word, bank word, destination word; a zero source ends the list. |
| Direct specialized loaders |       6 | Intro/credits character lookup, relative window words and Matrix maps, detailed below.                                |

These groups overlap: `81:F803` has a direct loader and a scene-list use;
`84:D8DD` appears in the title table and a scene list. `87:E272` serves three
scene lists. A source edit would affect every alias, not a chosen scene or
VRAM location. The JSON enumerates all matching commands and table entries.

The title table loads `84:F202`, `84:F251`, `84:F293`, `84:F416` and
`84:D8DD` into `7E:4EA8`, `56A8`, `5EA8`, `66A8` and `76A8` respectively.
Each produces 2,048 bytes. The title's scrolling and NMI consumers retain
their buffer ordering; see
[intro-scene.mjs](../src/intro/intro-scene.mjs) (lifted from 81:D83E; reference
[intro-setup.mjs](../proof/intro-reference/intro-setup.mjs), `unpackIntroList`),
[title.mjs](../src/frontend/title.mjs) and
[main-intro-nmi.mjs](../src/task/main-intro-nmi.mjs).

Ten scene commands across eight sources transfer beyond the decompressed
output. The excess is 128 bytes for `81:FB0A`, `85:D8B1`, `87:E272`
(three commands), `89:F7CE` and `8A:879C`; 448 for `84:FD2B`; and 768
for `84:FE1E` and `86:FB31`. These tails are existing WRAM contents.
An editor must not enlarge output, clear a tail or change DMA lengths to
make them agree. Equal VRAM destinations do not establish source identity.

## Specialized word meanings

- `81:F803`: 128 intro character-map words. `81:DDEE` loads `7E:56A8`;
  `81:DE93` selects words by printable character code and masks with `C0FF`.
  The same source is sent directly to VRAM by scene list `81:F7B5`.
- `85:FD38`: 160 credits character-map words. `81:CE57` loads `7E:56A8`
  for the credits renderer `81:D351`. Matrix call `81:C3F2` loads the same
  source into `7F:0000`; text and health/memory gauges read this buffer.
  Font/map pairing is required by the
  [shared credits graphics contract](LANGUAGES.md#shared-credits-graphics-and-matrix-gauges).
- `81:FF40`: 928 relative window words. `81:A9B2` unpacks into `7E:23A0`
  and applies the native `2017` addition before the window upload.
  Preserve the routine's arithmetic, including carry behavior; these are
  not already final PPU words. A palette range also reaches the packed
  source boundary (`81:F586`), so source ownership alone does not establish
  independent palette effects; see [the packed audit](PACKED-ASSET-EDITING.md).
- `89:EC1B`: Matrix background, 1,024 words. `81:C3FF` loads `7F:0216`
  and `81:B4D3` sends converted words to VRAM `2400` before the system load
  overwrites that buffer.
- `89:E14E`: sixteen 32 by 32 Matrix maps. `81:C418` loads `7F:0216`;
  the selected system uses `0216 + 0800 * system` and VRAM `2000`.
- `89:EB4B`: another 1,024 Matrix words loaded at `7F:8216` by `81:C425`,
  immediately following the sixteen maps. This is also the arithmetic
  selection address for system 16; that observation does not prove a
  gameplay route selects it. No separate downstream owner is claimed.

Matrix words are metatile identities plus attributes. `81:B4B9` converts
their row and column into a top-left character index. `81:B4D3` records
node coordinates for identities `21` through `27`; movement, node actions
and map mutations read the selected WRAM map. Editing them can change
gameplay. See [main-scene.mjs](../src/task/main-scene.mjs),
[main-scene-matrix.mjs](../proof/matrix-reference/main-scene-matrix.mjs), and the
`main-matrix-objects`, `main-matrix-movement` and `main-matrix-control` modules.

Three map sources have German replacements: `81:F803`, `85:FD38` and
`81:FB0A`. The first two participate in the packed text/font contract;
the third is a language-specific scene map, not a packed-text snapshot.
`85:FD38` must remain original in Matrix and translated only under its
credits owner. A shared-source editor must reject all three identities.

## Delivered contract: shared PPU screen words in fixed slots

Twenty sources remain after excluding the
six specialized identities and the German scene map `81:FB0A`. They are
the admitted set for the separate screen-map edit layer:

1. Pin the original identities, word counts, baseline words/tokens and slot
   capacities independently of edits. Store unique word indices and four-digit
   uppercase hexadecimal replacement words separately from `vm-lz.json`.
   Use linear stream indices: the asset's 32-word text lines alone do not
   establish displayed geometry, especially for partial screen maps.
2. Preserve output length words, source pointers, order, scene commands,
   title buffers, DMA lengths, palettes and characters. Preserve each PPU
   word's native bit meanings; do not interpret a word as a new character or
   allocate graphics. Author-selected references can still be visually
   inappropriate for a scene. Do not promise automatic scene validation.
3. Validate the original baseline, exact token termination, compression fit,
   decode equality and native word-read endpoint before publishing any edit.
   Preserve old slot tails, neighboring bytes and presence marks. Reject
   duplicates, unknown indices, extra fields and every excluded identity.
   A failed set must leave the complete cartridge unchanged.
4. Test empty, exact-fit, shorter, oversized and malformed edits; all admitted
   identities; shared aliases; untouched DMA tails; destination guards and
   whole-cartridge confinement. Check an actual rendered consumer and language
   switching, including rejection of all three translated maps.

Collision, room structure, Matrix gameplay, character lookup editing,
language map authoring, source relocation and larger output remain separate
contracts. This audit introduces no hardware behavior or timing model.

## Authoring screen-map words

Edit [vm-map-edits.json](../assets/vm-map-edits.json), then restart the game
page. The empty edit list preserves the assembled cartridge byte for byte.
Each entry names an original source address and unique zero-based word
indices in that stream. Each replacement `value` is exactly four uppercase
hexadecimal digits. No other entry fields are accepted.

```json
{
  "format": "shadowrun-map-edits-v1",
  "edits": [
    {
      "address": "84:D8DD",
      "words": [{ "index": 0, "value": "0000" }]
    }
  ]
}
```

The editable sources and their word counts are:

| Source    | Words | Source    | Words |
| --------- | ----: | --------- | ----: |
| `81:FEF0` | 1,024 | `84:D8DD` | 1,024 |
| `84:F110` | 1,024 | `84:F1EC` | 1,024 |
| `84:F202` | 1,024 | `84:F251` | 1,024 |
| `84:F293` | 1,024 | `84:F416` | 1,024 |
| `84:F53B` | 1,024 | `84:F68C` | 1,024 |
| `84:FD2B` |   800 | `84:FE1E` |   640 |
| `85:D8B1` |   960 | `85:F7D9` | 1,024 |
| `86:DCD7` | 1,024 | `86:DE71` | 1,024 |
| `86:FB31` |   640 | `87:E272` |   960 |
| `89:F7CE` |   960 | `8A:879C` |   960 |

These are ordinary PPU screen words, retaining character reference, palette,
priority and flip fields. Choose references appropriate to the consumer's
existing graphics and palettes. Word replacement does not create characters,
change collision or adjust scene dimensions. A shared-source change affects
all listed consumers in both languages.

[map-edits.mjs](../src/data/map-edits.mjs) runs after baseline cartridge
assembly. It pins original word counts, packed capacities including length
headers, and packed FNV checksums in code. The checksums detect accidental
baseline changes; they are not cryptographic authentication. For each edited
identity, the loader checks present original slot bytes, its length header,
decoded baseline words and original tokens before creating a replacement.
Capacities cannot grow by changing editable baseline words or tokens.

Original tokens are retained when they still reproduce the changed words;
otherwise the existing greedy encoder recompresses. Equal word counts do
not guarantee that an edit fits. Oversized packing reports
`map_edit_slot_exceeded` with the source address and stops loading. The
loader rejects the three translated maps with `map_edit_language_map` and
the four remaining specialized maps with `map_edit_specialized_map`.
Unknown or duplicate identities, duplicate/out-of-range indices, malformed
values and unsupported fields also stop loading. Clear or correct the edit
file to restore loading.

Only after every edit passes does the loader publish packed prefixes.
Headers, unnamed words, old slot tails, neighboring sources and presence
marks remain intact. Both original and replacement native word-read
endpoints must stay in their source bank and refer to existing bytes.
Scene DMA lengths and WRAM tails remain unchanged. Extraction generators
do not overwrite the separate edit asset; the static build includes it.

The [regression checks](../tools/map-edits.test.mjs) cover all twenty
identities with exact-fit edits, shorter recompression, individual word edits,
whole-cartridge confinement, malformed data, every excluded identity, and
a late overflow after a valid edit. Baseline descriptor/data/token changes
and missing source/margin bytes fail without publishing writes. Actual
native unpacking checks destination guards and full transfer tails in
English and German. A cold live start-menu comparison proves changed VRAM
and rendered pixels while palettes stay identical. These checks cover the
named boundaries, not all scenes or arbitrary visual references.
