# Packed character source and editing contract

The read-only [consumer audit](../tools/character-stream-audit.mjs) joins the
58 length-prefixed character identities in `assets/vm-lz.json` with their
original [packed slots](PACKED-ASSET-EDITING.md), BMP sheet positions, scene
commands, portrait records and German replacement identities. It reconstructs
the cartridge from native assets without opening a ROM. Run:

```powershell
node tools/character-stream-audit.mjs > .cache/logs/character-stream-audit.json
```

The JSON contains one row per identity, including output size, source budget,
word-read margin, sheet pixel origin and every matching scene command and
portrait record. It also includes historical unpack observations from
`analysis/rom-vram.json`; these are route evidence, not an exhaustive list of
consumers. Missing generated inputs require `npm run rebuild:artifacts`.
An edited cartridge or baseline can invalidate this audit: its computed slot
sizes are descriptive, not an independently trusted edit capacity manifest.

## Consumer findings (2026-11-09)

| Kind      | Sources | Output bytes | Encoded bytes with length word |
| --------- | ------: | -----------: | -----------------------------: |
| BG 2 bpp  |       4 |        3,328 |                          1,437 |
| BG 4 bpp  |      11 |       49,216 |                         26,978 |
| OBJ 4 bpp |      43 |      163,840 |                         61,987 |

All 58 have static consumers. Seventeen also have historical route
observations. The static groups overlap:

- Eighteen sources appear in scene command lists. Command 03 of `81:EC16`
  sets a DMA length from the list, unpacks through `80:F2A0` into `7E:46A8`,
  then transfers from that buffer to the command's VRAM word address.
  [scene-lists.mjs](../src/data/scene-lists.mjs) records the list/register
  contracts; [main-scene-video.mjs](../src/task/main-scene-video.mjs),
  `81:EC68` through `81:ECB2`, implements the reader. Continuations retain
  the existing list ordering, including `81:F529` continuing into `81:F53E`.
- Thirty-seven OBJ sources serve 139 portrait records. Each unpacks 64
  characters (2,048 bytes) through `80:9F6D` into `7F:5250`; `80:8F20`
  spreads the rows and `80:8FF5` sends the characters to VRAM. A pixel edit
  to one source affects every portrait record naming it. Palettes belong
  to each record separately. See [portraits.mjs](../src/data/portraits.mjs)
  and [native-dialog-portrait.mjs](../src/task/native-dialog-portrait.mjs).
- `80:FF98` supplies the window style characters. `81:AA9C` reads the
  pointer table `80:FFAD`, unpacks through `80:9F49` into `7E:23A0` and
  uses the unpacked length for DMA; see
  [main-initialize.mjs](../src/task/main-initialize.mjs).
- `87:D71A` and `84:F9E8` supply large and small frontend frames. Calls
  `81:E1A3` and `81:E1B0` unpack them through `80:F2A4` into `7F:0018`
  and `7F:8018`. `84:DAF2` also has a direct frontend font consumer in
  `81:D60F`, besides its scene-list use. See
  [main-frontend-menu.mjs](../src/task/main-frontend-menu.mjs).

Twenty-three scene commands across fifteen sources transfer more bytes than
their stream produces. For example, `81:FF08` produces 64 bytes while
`81:F586` transfers `4000` hexadecimal bytes. Those additional bytes are
existing WRAM contents, not additional characters owned by this identity.
Keeping output sizes fixed preserves this distinction. A test or editor
must not zero, extend or replace that transfer tail as part of a pixel edit.
VRAM addresses are contextual and reused by other scenes; matching a VRAM
address does not establish an asset identity or a global replacement scope.

## Language and font boundary

Fifty-six sources have no German packed replacement and remain shared when
the language changes. Two BG 2 bpp identities are replaced:

| Identity  | Use          | English output bytes | German output bytes |
| --------- | ------------ | -------------------: | ------------------: |
| `81:F8B8` | Intro font   |                1,312 |               1,344 |
| `85:FC15` | Credits font |                  864 |                 896 |

[language.mjs](../src/data/language.mjs), `buildLanguage` and
`redirectLanguageStream`, map these English identities to the German A1
bank. [packed-text-edits.mjs](../src/data/packed-text-edits.mjs) pins the
text, map and font sources together during a load, including language
switches. Editing only the English source would therefore change English
and leave German using a different font. These two sources require their
own language-aware font contract; a shared pixel edit must reject them.
The credits font and map also serve Matrix gauges. Matrix setup keeps their
original matching pair; German replacements apply only in the credits owner's
packed-text snapshot. See [the shared-source correction](LANGUAGES.md#shared-credits-graphics-and-matrix-gauges).
The variable-width dialog font at `95:F2D0` is a separate asset and is
outside this inventory.

## Bounded implementation contract

The character pixel edit loader implements the following admission contract.
The audit establishes the consumers; the loader checks each edited source
against its unedited BMP output and stored packing tokens before any write.

1. Admit only the 56 shared original source identities. Keep their format,
   character count, order, output length word, pointers and palettes fixed.
   Use character indices within each stream, never a global VRAM address.
   Explicitly reject the two language fonts even if an English edit fits.
2. Store edits separately from the baseline BMPs and packing tokens. An
   entry names `address` and changed `characters`, each with a unique
   zero-based `index` and eight strings of eight uppercase hexadecimal
   `pixels`. BG 2 bpp accepts indices 0 through 3; BG/OBJ 4 bpp accepts
   0 through F. Reject duplicate identities/indices, unsupported fields,
   invalid rows and indices outside the original character count.
3. Decode the original source before any write; prove baseline tokens and
   output length against the unedited assets. Change only the named planar
   characters, using the interleaved SNES character layout in
   [vram-tiles.mjs](../src/data/vram-tiles.mjs). Room tile plane layout is
   different and cannot be reused as the encoder for these streams.
4. Derive capacity from the original packed span, including its two-byte
   length header. Preserve that header and every byte after the new packed
   prefix. Reuse original tokens only if they still describe the output;
   otherwise recompress. Require exact decode equality, exact final token
   output and existing native word-read endpoints within the source bank.
   Borrowed margin bytes and neighboring slots never grant growth space.
5. Validate the complete edit set before publishing writes. A failure after
   a valid entry must leave ROM bytes and presence marks unchanged. Empty
   edits must preserve the cartridge byte for byte. Keep scene-list DMA
   lengths and the WRAM beyond each decompressed output unchanged.
6. Verify exact-fit, shorter, oversized and malformed edits, every format,
   shared portrait aliases, whole-cartridge byte confinement and native
   unpack destination guards. Check at least one actual frontend/portrait
   load with visible output, plus language switching and rejection of font
   identities. Do not claim whole-scene or arbitrary route coverage.

The baseline regression tests compare all original character outputs with
the European ROM and native unpacker and verify BMP stream positions.
The existing packed audit establishes source/margin accounting. This block
adds no hardware behavior; it follows the already documented native readers
and planar format. Map semantics, palette authoring, font authoring, source
relocation and larger decompressed outputs remain separate work.

## Authoring shared character edits

Edit [vm-character-edits.json](../assets/vm-character-edits.json), then restart
the page. The empty edit list retains the original artwork. Entries use the
original stream identity and zero-based character indices within that stream:

```json
{
  "format": "shadowrun-character-edits-v1",
  "edits": [
    {
      "address": "80:FF98",
      "characters": [
        {
          "index": 0,
          "pixels": [
            "00000000",
            "00000000",
            "00000000",
            "00000000",
            "00000000",
            "00000000",
            "00000000",
            "00000000"
          ]
        }
      ]
    }
  ]
}
```

Each row has eight uppercase hexadecimal palette indices: 0 to 3 for BG
2 bpp, 0 to F for BG/OBJ 4 bpp. Palettes remain unchanged. The consumer audit
names the format, character count and aliases of each source. A portrait
source edit changes every record that names it, in both languages.

[character-edits.mjs](../src/data/character-edits.mjs) pins the 58 original
identity/format/count descriptors and rejects the two language fonts, leaving
56 editable sources. It runs after all baseline cartridge data is assembled.
The complete edit set is validated before packed prefixes are replaced;
length words, unedited characters, presence marks, old packed tails and
neighboring sources remain unchanged. Original tokens are reused when they
still produce the edited output; otherwise the greedy encoder recompresses.
Therefore even a simple image is not necessarily encoded more compactly.
The compression budget is the original encoded span, with no relocation.

Oversized output reports `character_edit_slot_exceeded` with its original
address; it never consumes a neighbor or a word-read margin. Invalid entries,
duplicate identities or indices, extra fields and language font identities
also stop loading without publishing any edit. Clear or correct the edit
file to restore loading. Extraction tools do not overwrite this separate file;
the static web build includes it automatically.

The [focused regression checks](../tools/character-edits.test.mjs) exercise all
56 identities with exact-fit edits, shorter recompression, individual character
changes, malformed and oversized sets, altered baseline descriptors and data,
missing source/margin bytes and whole-cartridge confinement. Native unpack
checks cover all three formats, portrait bank 7F, destination guards and
language switching. A cold live run compares the actual start menu with its
edited frontend font and checks that VRAM and rendered pixels change while
palettes stay equal. These checks cover the named consumers, not every scene
or route. Release results are recorded in HANDOFF.md.
