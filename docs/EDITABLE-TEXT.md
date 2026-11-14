# Editable text content

Edit [vm-text-edits.json](../assets/vm-text-edits.json) and reload the page.
The file starts empty, so the delivered wording stays unchanged. It is a
maintained content file, not an extraction output. Original Huffman content
in `vm-texts.json` and ASCII menus in `vm-menu-texts.json` keep their lossless
reconstruction and layout protection. Matrix streams in `vm-matrix-texts.json`
use the same edit file with their own controls and font rules.

```json
{
  "format": "shadowrun-text-edits-v1",
  "en": [
    { "address": "9D:F411", "text": "Save the current game" },
    { "address": "port:0100", "text": "Save in slot three" }
  ],
  "de": []
}
```

An `address` is an identity, not a destination for new bytes. Use the
uppercase address of an existing entry in `vm-texts.json` or
`vm-menu-texts.json`, or `port:0100` and `port:0101` for the extra bed save
labels. Unknown addresses and duplicate
identities within a language fail loading. Empty strings intentionally hide
their text. Removing an entry restores the fallback. No scripts, tables,
runtime text words or saved-game identities are renumbered.

## Resolution and integration

Precedence, from highest to lowest:

1. An edit for the selected language.
2. The existing German translation when German is selected.
3. An English edit when the selected language has no translation.
4. Original English content, including ASCII menus and the port bank's default text.

An English edit therefore leaves an existing German translation intact.
Put a separate entry in `de` to change that translation. Port labels follow
the same rule; they appear only when their gameplay option is enabled.

[loadCartridge](../src/data/cartridge.mjs) validates edits against the
original text catalogues and returns their character maps with the original
address view. The browser transfers both maps to the worker using structured
clone. [LiveGame](../src/video/live-game.mjs) installs them in each game's
memory; switching language rebuilds the effective map without changing the
shared data package or a different game instance.

The existing [language helpers](../src/data/language.mjs) provide one
effective text to FE69 display, FADD name measurement, notice sizing and
menu fitting. FE69 still decodes the original stream before replacing its
buffer, and FADD still reads it before returning the effective width.
FADD now also redirects port identities to their existing port-bank streams.
Edited content itself is never compressed or fetched by AF04, so it creates
no new bank placement or WORD read-ahead. Original streams remain unchanged;
the existing port extension keeps its two-byte read-ahead padding.

## Huffman characters, buffers and windows

The decoded buffer begins at WRAM `7E:21A0`; the next window workspace
begins at `7E:23A0` ([wram.mjs](../src/task/wram.mjs)). Each edit may contain
at most **511 encoded characters**, leaving one byte for the terminating
zero. This is a storage limit for Huffman edits, not a promise that a window can show 511
characters at once.

Accepted content is ASCII `20..7F`, the original font glyph codes
`01..08`, `0E..11`, `1E..1F`, and the seven Unicode umlauts in German
entries. The latter use the existing installed German glyphs. NUL, newline,
carriage return, tab, the Huffman end code, internal style placeholders and
other Unicode characters are rejected before a game starts. JSON escapes
such as `\u0001` retain an original special font glyph. These are glyphs,
not new commands or interpolation syntax.

`|` retains FB39's existing bold-word behavior. Width measurement includes
the styled placeholder that FB39 inserts for the marker, and bold ends at
the next space. Normal word wrapping stays in FB39. Explicit line-break
commands are outside this format.

Notice windows first widen to 30 tiles, then grow up to 26 rows. Known
German dimensions apply only to their unchanged translated text; an edited
notice is measured again. Menu fitting also operates in English when edits
are present. Status and skill layouts keep their screen bounds, and the
glove name window is limited to 29 columns to retain its original right
edge at column 30 with a left margin. Text beyond available screen space
uses the existing composition and clipping behavior. Oversized labels can
lose visible characters; they are not automatically shortened or split into
new menu choices. Authors should keep single-row labels within their fitted
window and check the resulting wording in the game.

## ASCII frontend menus

The same `en` and `de` arrays accept the 15 bank-81 identities from
[vm-menu-texts.json](../assets/vm-menu-texts.json). Their precedence matches
Huffman edits. For example:

```json
{
  "format": "shadowrun-text-edits-v1",
  "en": [
    { "address": "81:E3B2", "text": "BEGIN A NEW ADVENTURE" },
    { "address": "81:E425", "text": "RESTORE SLOT {slot}" },
    { "address": "81:E433", "text": "RESTORE SLOT {slot}" }
  ],
  "de": []
}
```

Accepted characters are printable ASCII `20..7E`, excluding braces except
for the `{slot}` token. This domain uses its own tile font, without the
Huffman font's umlauts, bold markers or special glyphs. Characters keep the
existing font's appearance (`#`, for example, is the selection arrow).
Use uppercase letters for menu labels, following the delivered wording.

Each rendered text may contain **30 characters**, including spaces. This
is a screen bound, independent of the Huffman buffer limit. Longer entries
fail loading instead of spilling into another tilemap row. Empty edits
hide their label while keeping the menu choice and its game behavior.

The nonempty save labels `81:E425` and `81:E433` must contain exactly one
`{slot}` token. It renders as `1` or `2`; the four-slot option reuses
`81:E425` for slots `3` and `4`. The rendered digit counts as one character
toward the limit. Other digits remain literal. An empty save label also
hides its digit. Tokens are rejected in other ASCII entries and have no
special meaning in Huffman entries.

All selectable labels share a column determined from the longest effective
label, including inactive alternatives of each option. The start is the
usual English column 10 or German column 5, moved left as needed to column
2 at most. The arrow stays two columns before the labels, leaving a blank
column between them; a 30-character label ends at column 31. The copyright
line remains independently at column 2. Positions and shifts are byte
offsets internally, with two bytes per tile.

The source contract comes from the pinned bank-81 routines in
[main-frontend-source.mjs](../tools/main-frontend-source.mjs) and their
[native implementation](../src/frontend/start-menu.mjs) (register-level reference
[start-menu-text.mjs](../proof/frontend-reference/start-menu-text.mjs)):

| Original routine                | Established behavior and edit constraint                                                                                                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `81:D531`                       | Writes one tile word per character from `MENU_FONT_TILES`, advances X by two and Y by one; no wrapping or row bound in the original. An effective edit replaces its character source, without fetching new ROM bytes. Callers reset Y for each label. |
| `81:D555`                       | Clears the 32 by 32 tilemap at `7E:86A9`, draws copyright at byte offset `0684` (row 26, column 2), and clears disabled-row attributes. It captures the arrow column for this displayed menu.                                                         |
| `81:E38D`, `81:E3DA`, `81:E446` | Draw the main, saved-game and option labels from byte offset `0414` (row 16, column 10), with row steps of `0080`. The four-slot extension puts exit in row 24, before copyright in row 26.                                                           |
| `81:E32F`, `81:E343`            | Draw and erase the cursor before the selected row; the original arrow offset is `0410` (column 8). Arrow and labels use the same shift.                                                                                                               |
| `81:E371`                       | Highlights all 32 columns of the selected row, so shifting within a row does not change selection or highlighting.                                                                                                                                    |

[frontend-text-edits.mjs](../src/data/frontend-text-edits.mjs) resolves the
effective labels once when installing a language. D555 captures the arrow
column when rebuilding a menu. A language switch while a menu is open
keeps that displayed menu's arrow aligned; the next menu rebuild adopts
the new language and positions. Existing label tiles are not immediately
redrawn by language switching. Save availability, row indices, selection,
settings and SRAM layout stay unchanged. Without menu edits, original
English and German label positions remain as delivered.

## Matrix messages and login screens

All 22 addresses from [vm-matrix-texts.json](../assets/vm-matrix-texts.json)
are accepted in the same `en` and `de` arrays. For example:

```json
{
  "format": "shadowrun-text-edits-v1",
  "en": [
    { "address": "81:C5C0", "text": "{palette 1}\nIC ATTACK DETECTED!\n" },
    { "address": "81:C60D", "text": "{palette 1}\nDETECTED {count} IC!\n" }
  ],
  "de": [{ "address": "81:C60D", "text": "{palette 1}\n{count} IC ENTDECKT!\n" }]
}
```

Matrix edits use their own tile font: spaces, letters, digits and `!`, `-`,
`.`, `:` and `?`. Lowercase letters have the same displayed glyphs as uppercase.
Other punctuation, umlauts and the Huffman bold marker are rejected. Controls
are newline (`\n`), `{palette 0}`, `{palette 1}`, `{palette 2}`,
`{wait n}` with n from 1 through 255, and `{back}`. There are no raw byte
escapes. A wait counts matrix writer calls, including the original delay
behavior; it is not milliseconds.

Each logical line may use **29 columns**. A nonempty edit must establish a
newline before its first character and return to the left margin before
ending; starting and ending with `\n` is the usual form. A back command
moves one column left for later overwriting and may not cross that margin.
Palette changes do not reset line width. These rules keep adjacent queued
messages within the same layout bounds; there is no automatic word wrapping.
The complete stream is limited to **1,024 encoded bytes including its end
marker**. Controls count by their encoded size: a wait uses two bytes, the
other controls one. One extra zero byte supplies internal word read-ahead.

The nonempty `81:C60D` message requires exactly one `{count}` token. It
displays the actual count from the original IC routine, takes one column,
and is rejected in other messages. Empty edits hide any matrix text,
including the count message. They keep the original queue entry and game
behavior. Removing an edit restores its fallback.

Resolution is selected-language edit, English edit, original English matrix
content; the delivered German language asset has no matrix translations.
Content and the count digit are captured when a message is queued. Changing
language leaves active and pending messages in their original language;
new messages adopt the new selection. Longer login text and waits can change
how long the login lasts before player control resumes.

The [source and runtime contract](MATRIX-TEXT-EDITING.md) records the original
readers, layout and publication boundaries, font mappings and ring behavior.
Edits do not relocate original bytes or overwrite the count template's WRAM
workspace. No new graphics or characters are installed by this feature.

## Packed intro and credits

The scrolling prologue uses identity `81:F5CE` with a `lines` array. The
credits use `81:F2BD` with a `groups` array of page arrays. These entries
contain exactly `address` and their array field; they do not use `text`.

- A nonempty intro has exactly 28 English or 29 German lines. Each line
  has 1 through 32 characters. Use `" "` for spacing; an empty line would
  terminate the original stream and is rejected.
- Nonempty credits have exactly 14 pages. Each has one through four lines,
  each with zero through 31 characters. Empty lines are allowed within a
  page. A 32-character credits line changes the original row stride and
  is rejected.
- An empty `lines` or `groups` array hides the whole domain. The original
  intro/credits duration remains unchanged.

Intro characters are spaces, ASCII letters, digits and `!`, `"`, `#`, `&`,
`'`, `(`, `)`, `,`, `-`, `.`, `:`, `;`. German intro edits additionally
accept `ä` and `ß`. Credits accept spaces, letters, digits and `!`, `-`,
`.`, `:`, `?`; ordinary letters render uppercase. German credits also
accept `ä`, `Ä`, `ü`, `Ü`, rendered as uppercase umlauts. Other umlauts and
sharp s are absent from that font. Raw `$`/`%` aliases, backslash escapes,
inline controls and unsupported characters fail loading.

For example, hide both English streams with valid entries:

```json
{
  "format": "shadowrun-text-edits-v1",
  "en": [
    { "address": "81:F5CE", "lines": [] },
    { "address": "81:F2BD", "groups": [] }
  ],
  "de": []
}
```

To start from the original English wording, copy the `lines` and `groups`
of these addresses from [vm-lz.json](../assets/vm-lz.json). This Node
example preserves all other edits and changes two existing lines:

```js
import { readFileSync, writeFileSync } from 'node:fs';
const original = JSON.parse(readFileSync('assets/vm-lz.json', 'utf8'));
const file = 'assets/vm-text-edits.json';
const edits = JSON.parse(readFileSync(file, 'utf8'));
for (const [address, field, change] of [
  [
    '81:F5CE',
    'lines',
    (lines) => {
      lines[5] = 'A different introduction.';
    },
  ],
  [
    '81:F2BD',
    'groups',
    (groups) => {
      groups[0][0] = 'SYSTEM PROGRAMMING';
    },
  ],
]) {
  const content = structuredClone(original.streams.find((s) => s.address === address)[field]);
  change(content);
  edits.en = edits.en.filter((entry) => entry.address !== address);
  edits.en.push({ address, [field]: content });
}
writeFileSync(file, JSON.stringify(edits, null, 2) + '\n');
```

The same language precedence applies: selected-language edit, existing
translation, English edit, original content. English edits leave existing
German translations intact. Text, character map and font are captured
together when a sequence starts loading. A language switch during its
setup or display applies on its next rebuild. A missing translation falls
back to the complete English set.

The replacement streams occupy a temporary read-only source bank. They
do not need to fit their original compressed slots. Original scene lists,
timing, controls and data pointers remain intact. The
[packed text contract](PACKED-TEXT-EDITING.md) records the source equations,
font aliases, storage limits and verification scope.

## Verification and boundaries

[text-edits.test.mjs](../tools/text-edits.test.mjs) checks loader byte
identity, worker-compatible cloning, precedence, language switching, empty
and port edits, invalid identities and characters, and both sides of the
buffer limit. It executes FE69's initial segment and the actual FADD decoder,
checks notice and menu sizing, and opens oversized edited status labels in
both languages and an oversized glove name in a live game. The live checks
verify screen bounds and unchanged scene glyph tiles at VRAM `E000..EFFF`.
The glove check establishes the hovered name window, not every target route.

[frontend-text-edits.test.mjs](../tools/frontend-text-edits.test.mjs) checks
ASCII loader byte identity, worker cloning, precedence, switching, invalid
identities/characters/tokens, empty edits and both sides of the row limit.
It executes the actual menu, arrow and highlight writers with a synthetic
font to check 30-column labels, disabled rows, row tails, slot substitution
and tilemap margins. Live title runs in both languages check the installed
font, shifted menu, four-slot digits and navigation past two empty slots.
These edited-content cases are native checks, not new Mesen comparisons.
Existing original-source comparisons remain applicable without edits.

[matrix-text-edits.test.mjs](../tools/matrix-text-edits.test.mjs) checks matrix
loader identity and cloning, validation, line/stream limits, controls, ring
wrap, empty overrides, resets and enqueue-time language/count snapshots.
Native live runs in both languages observe edited login and actual IC-count
messages in VRAM through the real matrix NMI and installed glyph map.

Existing recordings store language choices, not a copy of edited content.
Replay therefore requires the same edit file and language assets; changing
wording can change WRAM hashes and invalidate a comparison. SRAM format and
text identities stay compatible.

This format covers the 1,603 original Huffman identities, two existing
port labels, 15 ASCII frontend identities and 22 matrix identities. The
[matrix editing contract](MATRIX-TEXT-EDITING.md) establishes that domain's
identities, commands, font, queue and layout boundaries. The
[packed intro/credits contract](PACKED-TEXT-EDITING.md) establishes those
streams' identities, language-specific glyph maps, line/page limits and
placement boundaries. Both packed identities now accept structured edits.
Browser UI and arbitrary new text identities remain separate domains.
The [reference inventory](TEXT-REFERENCES.md) still does not authorize
physical relocation or automatic pointer rewriting. No hardware behavior
or timing contract changes.
