# Audit of the unidentified ROM data

Checked on 2026-11-09 against the European English ROM with SHA-256
`91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690`.
This completes the bounded investigation of the three `unread` ranges in
[vm-raw.json](../assets/vm-raw.json), not a proof that every possible reader
is absent. All 95 bytes remain unchanged and retain their unknown class.
At this audit's initial snapshot the product retained 293 additional code
bytes. The subsequent [retained-code audit](ROM-CODE-AUDIT.md) removes 200
unnecessary margins between code classes, leaving 93 code/read-margin bytes.
That correction leaves all findings about these 95 unknown bytes unchanged.

## Reproduce the evidence

From the repository root, with the existing generated artifacts available:

```powershell
node tools/rom-unread-audit.mjs > .cache/logs/rom-unread-audit.json
node --test tools/rom-unread-audit.test.mjs
```

[The audit tool](../tools/rom-unread-audit.mjs) is read-only. It compares the
three raw ranges with the original and with the product's reconstructed
cartridge. It searches the ROM map's traced instruction starts and every
recorded E/M/X variant for memory operands naming the ranges, including a
word beginning one byte before them. Absolute operands retain an unresolved
data bank; indexed operands retain an unresolved index. Immediate values
and `PEA` operands are reported separately, not treated as data reads.

Inputs are `analysis/vm-rom-map.json`, `analysis/rom-code-observed.json`,
`analysis/rom-reads.json`, the original ROM and the product assets. The
existing map supplies 23,001 instruction starts; including alternative
observed modes gives 23,002 decoded states. It contains four trace conflicts.
This audit does not resolve them
or replace the map with a complete control-flow proof.

The native read recording contains no reads of these 95 bytes. The original
read recording covers only banks 80/81: it can support the header-area
finding but says nothing about reads in banks 8B/8D. No new Mesen route was
run for this audit. Absence from the existing recordings is bounded by their
scenarios, not evidence of global non-use.

## Findings by range

| Range, inclusive       | Size | Proven structure and disposition                                                                                                                                      |
| ---------------------- | ---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `80:FFB5` to `80:FFBF` |   11 | Mixed bytes between a sound word and the title; not a valid extended header. Preserve without a semantic decoder.                                                     |
| `8B:FD61` to `8B:FD74` |   20 | Five consecutive little-endian pointers to five zero words. No owning reader established; preserve the whole block.                                                   |
| `8D:8080` to `8D:80BF` |   64 | Values from 0 to 63 immediately after the topic pointer table. No meaning or owning reader established; preserve without assigning topic flags or graphics semantics. |

### Bytes before the cartridge title

The exact bytes are `FF FF FF 7E 00 03 00 B9 06 0E 00`.
[sound.mjs](../src/data/sound.mjs) and `assets/vm-sound.json` place a single
vibrato pointer word `75C0` at `80:FFB3` to `80:FFB4`, used by sound block
list `9F:FE13`. Its two-byte source ends before the unidentified range. The
decoded title begins at `80:FFC0`; neither neighboring structure owns the
11 bytes between them.

Hardware source: [Nintendo Book I](../Ressources/book1_text.pdf),
"ROM Registration Data Specification" and its description, PDF pages 32 to
34, printed pages 1-2-14 to 1-2-16. The specified extended registration area
starts at `00:FFB0`; the game code is ASCII at FFB2 to FFB5 and FFB6 to FFBC
must be zero. Shadowrun's bytes violate those fixed fields and FFDA is `6B`
rather than the specified extended-header marker `33`. The bytes must not be
assigned the extended field names solely because of their location. The
manual establishes the format, not the provenance of this game's residue.

The known decoded instructions contain no memory operand naming this range
or its preceding byte. `81:8FBA AND #$FFBF` is an immediate mask, not a read
of FFBF. No existing native or original code-bank read recording touches
the range. Computed pointers or a later unrecorded path remain a limit.

### Five pointers before the palette cycles

The words at `8B:FD61`, FD63, FD65, FD67 and FD69 are FD6B, FD6D, FD6F,
FD71 and FD73. Under a bank-8B interpretation each points to a different
zero word in the remaining ten bytes. This establishes the local structure,
not its use or an intended object type.

The neighboring compressed stream ends at FD61, exclusively, in the ROM
map. The six-entry palette cycle table starts at FD75. The actual lookup
`81:801A` sets DBR to 8B and X to zero, checks X against 18, and advances it
by three. The compare at `81:802B` reads the palette byte at FD75 + X; after
a hit the load at `81:8038` reads its pointer at FD76 + X. These bounded
table accesses cannot run backward into FD61 to FD74. The selected cycle
records begin at FD87 and fill the region to FE15, exclusively. Sources:
[palette-cycles.mjs](../src/data/palette-cycles.mjs) and
[main-scene-load.mjs](../src/task/main-scene-load.mjs).

No known decoded memory operand or immediate pointer names the unidentified
block. The native read recording does not touch it. An independent indirect
reader is not ruled out, and original read callbacks did not cover bank 8B.
The nearby object-part graphics start at FE15; their proximity supplies no
evidence that these twenty bytes describe an unused sprite.

### Values after the dialog topic pointers

The preceding 128 bytes contain 64 text-pointer words, and dialog records
start immediately after the unidentified range at `8D:80C0`. The 64 raw
bytes have minimum 0 and maximum 63. Their count matching the topic count
is a structural observation only.

The established nearby reader is `80:9241 LDA $8D8000,X`, inside topic menu
routine `80:9215`. It doubles the topic ID: IDs 0 to 63 read only the
preceding pointer table. ID 64 would read the first raw word `3C3C`, and
IDs 64 to 95 could read across the unidentified range. This is a concrete
indirect/indexed access possibility, not a valid text-pointer extension:
the first raw word is not one of the decoded text starts.

There is no range check at that load. Native `71` (`80:90EB`) inserts a byte
topic ID without validating it against 64. Therefore the table boundary is
not a universal runtime invariant for modified scripts or damaged state.
The dialog catalog's topic IDs are below 64; this does not prove every
possible script argument or saved-state value. Sources:
[topics.mjs](../src/data/topics.mjs),
[native-dialog-text.mjs](../src/task/native-dialog-text.mjs),
[native-topic-add.mjs](../src/task/native-topic-add.mjs) and
[the dialog catalog checks](../tools/vm-cartridge.test.mjs).

No known decoded memory operand or immediate pointer names the raw range
itself. Repeated `PEA $8080` instructions set the data bank to 80 through
`PLB` operations; they do not establish a pointer to `8D:8080`. Existing
native read recordings have no hit here; original callbacks did not cover
bank 8D. A historical topic mask or chapter filter remains a hypothesis,
not a decoded format.

## Unused graphics are preserved content

Local supplied sources:

- [Shadowrun (SNES) - The Cutting Room Floor](<../Ressources/Shadowrun (SNES) – The Cutting Room Floor.pdf>), PDF page 4, "Unused Graphics" and "Unused Characters".
- [Notes: Shadowrun (SNES)](<../Ressources/Notes_Shadowrun (SNES) – The Cutting Room Floor 2.pdf>), PDF page 6, "Sprite list"; its preceding pages identify the location notes as North American.

The main PDF describes walking graphics for the stationary yo-yo boy, an
apparently unused car palette, and four unused named characters. The notes
give a sprite-kind substitution method and IDs 0 to 15; that short list
does not identify the four named characters or any of the three raw ranges.
The PDFs provide no ROM addresses connecting their unused graphics to these
95 bytes. Their regional and non-use claims are not automatically European
source evidence.

The four character names do have concrete European asset chains:

| Name       | Kind index | Name text | Distinct pictures through its action list |
| ---------- | ---------: | --------- | ----------------------------------------: |
| Gorgax     |         94 | `9D:EC51` |                                        64 |
| Heavy Orc  |         96 | `9D:EC57` |                                        64 |
| Slick Dude |         46 | `9D:EB57` |                                         2 |
| Wolf       |        117 | `9D:ECD5` |                                        46 |

The audit follows `vm-kinds.json` to `vm-actions.json`, then every named
picture in `vm-pictures.json` and every 64-byte tile source. It verifies that
the product retains those tile bytes identically to the European ROM. The
existing cartridge checks cover lossless reconstruction of kinds, actions,
pictures and graphics. The exporters follow the full tables, not just the
animations observed during live play. Thus unused content can already be
decoded and retained; `unread` and "unused sprite" are different properties.

Not established here: visual identification of all frames, the yo-yo boy's
walking sequences, which of the car palettes the PDF illustrates, or global
non-use of those assets on every European story route. No unused graphics,
raw bytes or unobserved animation entries are removed.
