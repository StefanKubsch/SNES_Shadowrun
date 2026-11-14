# Original Huffman text references

European English ROM, SHA-256
`91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690`.
Inventory completed on 2026-11-09. No product code, asset, pointer or text
content is changed by this block.

## Coverage and evidence

All **1,603 original Huffman text starts** have at least one established
incoming reference. The inventory contains **1,786 references**:

| Source                | References | Meaning and source contract                                                                                                                                     |
| --------------------- | ---------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vm-tables.json`      |        699 | Only tables declared with type `text` in [tables.mjs](../src/data/tables.mjs), including the 611 numbered texts. Zero terminators are excluded and validated.   |
| `vm-dialogs.json`     |        727 | Text word at the end of each dialog entry; topics and optional action script determine its exact position. [dialogs.mjs](../src/data/dialogs.mjs).              |
| `vm-kinds.json`       |        227 | Name word at offset zero of a six-byte kind record; FFFF means no name. [kinds.mjs](../src/data/kinds.mjs).                                                     |
| `vm-topics.json`      |         64 | One text word per topic. [topics.mjs](../src/data/topics.mjs).                                                                                                  |
| `vm-runners.json`     |         13 | Name column at `80:9782`, two bytes per runner. [runners.mjs](../src/data/runners.mjs).                                                                         |
| Native text constants |         56 | Reviewed `LDA #text_id` sites, supplying notices, action names, status labels and menu control texts. [Source registry](../tools/text-reference-contracts.mjs). |

The five asset categories reference 1,571 distinct texts; the native sites
cover the other 32 and reuse nine already covered texts. Every data reference
has its JSON path, original two-byte storage address, decoded target and
reader/category recorded. Its encoded word is compared with the ROM.
Changing a field to another valid text or hiding it behind a false null/zero
sentinel is rejected. Dialog record pointers and final layout are checked.

The native registry records the original instruction and operand location
and the product module implementing its use. The original code operand is
not generally present in the product: changing it alone would not change
the JavaScript constant. The 56 sites are grouped by reviewed source module:
fight removal, object-hit warnings, actions, list prerequisites, main menu,
player control, spell choice, upkeep, member spell menu and status screen.

Examples of texts covered only by native constants include the Cortex-bomb
save refusal (`80:CE56`, text `9D:F058`), spell-selection refusal
(`80:E0FB`, `9D:F479`), action labels and the hour/countdown suffixes.

## Reproduce and inspect

```powershell
node tools/text-reference-inventory.mjs > analysis/text-references.json
node --test tools/text-reference-inventory.test.mjs
```

[The tool](../tools/text-reference-inventory.mjs) reads sources and writes
only its JSON report to stdout. The generated report is not versioned;
regenerate it when needed. It includes:

- `references`: every established data field and native constant, including
  source paths and original slots;
- `text_ids`: an index from each text start and encoded ID to incoming slots;
- `script_candidates` and `script_coverage`: control-flow-decoded word
  operands of all 937 table scripts, eight unreferenced scripts and one
  owner-relative tail, with gaps explicitly reported;
- `native_operand_candidates`: matching immediates in all 23,002 known
  instruction states, including alternate observed E/M/X modes;
- `javascript_numeric_candidates`: parsed numeric literal sites across all
  product modules, with file, line and column (363 modules at inventory time);
- `raw_numeric_matches`: all matching adjacent ROM words and mirrored long
  addresses, including unaligned occurrences and their ROM-map class;
- `language_identity_bindings`: the 1,591 German text entries keyed by the
  original English text address. These are identity keys, not ROM pointers.

## Numeric equality does not establish a text reference

The original inventory report includes 41 decoded script operands, 100 native
immediates and 107 JavaScript numeric literals whose values equal valid text
IDs. Only the 56 native sites in the source registry are promoted to
established references. The remaining native sites, all script matches and
the JavaScript candidates retain their review status. Comments and string
contents do not create JavaScript numeric candidates.

There are 26,948 raw numeric occurrences: 26,840 two-byte text-word matches
and 108 long-address matches. Of these, 1,786 correspond to the established
reference slots. The other **25,162 occurrences are not a pointer patch
list**. They include compressed content, graphics, opcode/operand byte
coincidences, object IDs, coordinates, state addresses and masks. Long
addresses are compared with the 1D/1E and 9D/9E bank mirrors; that comparison
alone does not prove a reader.

For example, script `$092` pushes object `$07B6` before native `$4B` or
`$BB`; the same word happens to encode the empty text at `9D:87B6`.
`80:8778 BIT #$8000` tests a flag, even though 8000 is also the encoded text
ID of `9E:8000`. These remain numeric candidates. The inventory does not
infer stack argument types across script calls or manufacture text pointers
from those equalities.

Seven table scripts retain eight control-flow gaps (14 bytes in total).
They remain covered by the raw numeric scan, not by invented instruction
decodes. The orphan tail is decoded in its owner's PC frame: its skipped
owner prefix is not counted as an uncovered tail range. No unreferenced
script or text is removed.

## Consequences for variable-length editing

The existing loader still requires the original text layout and raises
`text_layout_changed` when encoded lengths move the next text. This block
does not relax that protection. Target coverage is not proof that every
possible incoming use has been assigned a semantic type, so the report
explicitly says `relocation_ready: false`.

The subsequent [editable text layer](EDITABLE-TEXT.md) uses **stable
original IDs**, following the existing language and port-text mechanisms.
An original text word remains an identity key while its displayed text
comes from independently stored content. This avoids rewriting unrelated
script values and preserves the original data package and oracle fixtures.

Both consumers of the compressed text must agree:

- `80:FE69` decodes and composes the displayed text in
  [native-text-compose.mjs](../src/task/native-text-compose.mjs).
- `80:FADD` reads the stream independently to size name windows in
  [native-glove-target-support.mjs](../src/task/native-glove-target-support.mjs).
- Both use the bit reader `81:AF04`, which fetches WORDs; any relocated
  compressed stream needs a proved read-ahead and bank-boundary contract.
- Existing language-based menu/window fitting and glyph measurements in
  [language.mjs](../src/data/language.mjs) must use the same effective text.

The editable layer defines precedence between edited English, German and
port-created texts, validates character/control codes and buffer limits,
and tests longer names and notices at window boundaries. Runtime WRAM and
saved state can hold text identities; renumbering or physical pointer
rewriting needs a separate migration contract. Stable IDs avoid that change.

Scope limits: runtime-computed pointers, arbitrary modified scripts and
unreached control flow are not globally proved by this static inventory.
ASCII menu texts, matrix command text, packed intro/credits content, browser
UI and tool/proof fixtures are separate text domains; this inventory does
not authorize moving their addresses. No hardware behavior, frame timing,
game logic or original comparison result changes.
