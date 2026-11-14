# Matrix text editing contract

Established on 2026-11-09 against the local European ROM, then implemented
in the shared [vm-text-edits.json](../assets/vm-text-edits.json) layer.
The product retains the lossless [matrix catalogue](../assets/vm-matrix-texts.json).
All 22 matrix identities accept variable-length edits under the rules below;
see [EDITABLE-TEXT.md](EDITABLE-TEXT.md) for authoring examples.
Current work is maintained in [PROJECT-STATUS.json](PROJECT-STATUS.json).

## Source and identities

[matrix-texts.mjs](../src/data/matrix-texts.mjs) reconstructs the six lists
at `81:C515` and all 22 zero-terminated streams at `81:C539..CDB1`.
The complete region is 2,205 bytes: 36 list/pointer bytes and 2,169 text bytes.
The list entries are long pointers; immediate callers pass X = low word,
Y = bank to `81:B282`. An original start address is a stable identity;
an interior byte or a numeric match elsewhere is not a new text identity.

The pinned original instructions are in
[main-scene-matrix-source.mjs](../tools/main-scene-matrix-source.mjs),
[main-matrix-control-source.mjs](../tools/main-matrix-control-source.mjs)
and [main-scene-source.mjs](../tools/main-scene-source.mjs).
The native readers are [main-scene-matrix.mjs](../proof/matrix-reference/main-scene-matrix.mjs),
[main-matrix-control.mjs](../proof/matrix-reference/main-matrix-control.mjs) and
[main-scene.mjs](../src/task/main-scene.mjs).

| Identity  | Original purpose         | Established reference                               |
| --------- | ------------------------ | --------------------------------------------------- |
| `81:C539` | Datajack malfunction     | List 0, read by `81:C39F`                           |
| `81:C5C0` | Attacked by IC           | X immediate at `81:BA2E`                            |
| `81:C5D2` | Execute combat           | X immediate at `81:C108`, tail jump to B282         |
| `81:C5E6` | Combat successful        | X immediate at `81:C1C8`                            |
| `81:C5FB` | Combat failed            | X immediate at `81:C1EA`                            |
| `81:C60D` | Found IC count           | Long indexed load at `81:C0E7`, copied to `7F:0140` |
| `81:C61C` | Jacked out               | X immediate at `81:C4D0`                            |
| `81:C62E` | Condition OK             | X immediate at `81:C0DB`                            |
| `81:C642` | Execute transfer         | X immediate at `81:C280`                            |
| `81:C658` | Phonebook received       | X immediate at `81:C2CA`                            |
| `81:C66F` | Data received            | X immediate at `81:C38C`                            |
| `81:C681` | Program modified         | X immediate at `81:C326`                            |
| `81:C696` | Guard IC destroyed       | X immediate at `81:C232`                            |
| `81:C6B1` | Lines opened             | X immediates at `81:C179` and `81:C365`             |
| `81:C6C3` | Password needed          | X immediate at `81:C167`                            |
| `81:C6D8` | Out of storage           | X immediate at `81:C271`                            |
| `81:C6F5` | ERR2912 / Alpha sign-off | No reference in these reviewed source groups        |
| `81:C72B` | Allegiance Alpha login   | List 1                                              |
| `81:C863` | Drake headquarters login | List 2                                              |
| `81:C959` | Drake volcano login      | List 4                                              |
| `81:CB60` | Aneki login              | List 3                                              |
| `81:CC33` | Matrix Systems login     | List 5                                              |

That is six list references, 15 immediate references and one template read,
covering 21 distinct identities. C6F5 remains preserved. The absence of a
caller in this graph does not prove global unreachability and does not
authorize deleting it. No physical relocation or pointer rewriting follows
from this inventory.

## Byte stream, font and renderer

`81:B2D1` reads through the long pointer in DP34/DP36, in 16-bit accumulator
mode, then masks the loaded word to a byte. Incrementing the pointer changes
only DP34, wrapping the low word without carrying into its bank. A wait
operand is also fetched as a word and masked. Keep the original read-ahead
bytes and bank behavior on the unedited path.

| Byte     | Meaning             | Scheduling and rendering effect                                                                                          |
| -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `00`     | End                 | Clears busy and returns according to queue occupancy, before publishing any pending characters from this call            |
| `01..03` | `{palette 0..2}`    | Sets palette bits to `0000`, `0400`, `0800`; continues in the same batch                                                 |
| `04`     | Newline (`\n`)      | Advances to column 2 of the next cursor-derived row, scrolls at the configured line limit, yields for three writer calls |
| `05 n`   | `{wait n}`          | Loads a byte into the word delay and yields; zero takes 65,536 subsequent calls to reach zero again                      |
| `06`     | `{back}`            | Decrements the cursor one tile and yields for one call; does not erase or check a left edge                              |
| `07..1F` | Unsupported command | Stops at `matrix_text_command_frontier`; not an authoring escape                                                         |
| `20..FF` | Character lookup    | Reads a tile word at `7E:FFC0 + 2 * code`, adds priority and current palette, advances the cursor one tile               |

The JSON reconstruction syntax additionally supports `{xHH}`. It is a raw
byte escape for lossless extraction, **not a safe editing language**: it can
inject a terminator, unsupported command or malformed wait operand. Do not
reuse `encodeMatrixText` alone as the edit validator.

`81:C3CA`, call at `81:C3F2`, unpacks `85:FD38` to `7F:0000`.
Its 160 tile words are kept as the map stream in
[vm-lz.json](../assets/vm-lz.json). ASCII space maps to tile 0; `!`, `-`,
`.`, digits, `:`, `?` and letters have individual mappings. Lowercase letters
map to the same tile numbers as uppercase. Many printable ASCII characters,
including quotes, brackets, `{`, `|`, `}`, `~` and DEL, map to tile 2, also
used as the matrix cursor. Backslash maps to tile 2B;
the table alone does not establish that tile's visual meaning. Bytes `80..89`
map to additional tiles and are not Unicode character assignments.

The Matrix also loads the original credits font `85:FC15` through command
list `81:CDB2`. Font and map must remain paired: the words at `7F:00C0..00D3`
select its health and memory gauge tiles. The German credits font inserts two
umlaut glyphs before those tiles. Language redirection therefore replaces
these shared graphics only inside the credits owner's packed-text snapshot;
Matrix setup keeps both original sources. See the
[shared-source correction](LANGUAGES.md#shared-credits-graphics-and-matrix-gauges)
and its [live regression](../tools/matrix-gauges-language.test.mjs).

The admitted authoring alphabet uses space, letters, digits
and the original punctuation `!-. :?` (space shown in the list). Umlauts,
the Huffman bold marker and arbitrary printable ASCII need separate font
evidence. The Huffman font and its installed German glyphs do not establish
matrix glyph support. No new graphics or hardware effect is inferred here.

## Layout and publication boundaries

The cursor starts at tile word `0802`: row 0, column 2 of a 32-column map.
The intro setting of 16 columns and gameplay setting of 32 columns are
**batch sizes**, not wrapping widths. The writer does not test the row edge.
Intro scrolling starts at its 24-line setting; gameplay uses nine lines.
Scrolling keeps the tilemap ring and the existing NMI/HDMA presentation.
These are existing software contracts, not a new hardware timing claim.

From column 2, 29 characters occupy columns 2 through 30 and keep column 31
as a right margin. A 30th occupies column 31 but advances the cursor to the
next row's column 0. A following newline then advances again, skipping a row.
A 31st character spills into the next row. All three cases have the same
cursor behavior with intro and gameplay batch sizes. The edit limit
is **29 columns per logical line**, checking the cursor path including
back commands rather than merely counting characters between newlines.
A back command that crosses the line's column-2 start is rejected.
Because streams share the cursor, each nonempty edit must establish a newline
before its first glyph and return to the left margin before ending. Usually
it starts and ends with `\n`. This additional composition rule prevents two
individually valid messages from overflowing when queued together. Palette
or wait controls may surround those newlines. Returning with back commands
is also allowed when it neither crosses the margin nor leaves an unpublished
character batch.

Characters accumulate in the row scratch buffer at `7F:015A`. A newline,
wait, back or exhausted batch reaches the DMA-record publication code;
palette changes alone do not. A terminator returns before this code, so a
short final fragment such as `AB` can update scratch and cursor without
creating a transfer. Every nonempty edited stream must finish with an
explicit yielding control after its last character, independent of batch
alignment. Empty edits must finish cleanly. Preserve the original unedited
behavior, including the original streams' explicit trailing controls.

## Queue, dynamic count and language contract

`81:B282` stores a pointer in an eight-entry ring, four bytes per entry.
`81:B259` dequeues it, installs DP34/DP36 and sets a one-call delay. The
ring has no full check: eight pending writes can make start equal end, so
capacity cannot be increased by adding a separate content queue. B2A0
clears the indices and busy state; host-side edit state must reset there too.

The special count template is **15 bytes including its terminator**. C029
copies 16 bytes into `7F:0140`, so the last copied byte is the palette command
at the start of C61C. B959 counts the eight neighboring positions, then
writes a word at `7F:0148`: its low byte replaces `X` at byte offset 8 with
the count digit, and its high byte writes the following space. It queues
`7F:0140`, not the ROM identity C60D. Replacing only ROM-pointer reads would
miss this message; inserting a longer template into this WRAM area would
overwrite the scroll table at `7F:0150`.

The implementation in [matrix-text-edits.mjs](../src/data/matrix-text-edits.mjs)
and [matrix-text-stream.mjs](../proof/matrix-reference/matrix-text-stream.mjs) follows these
contracts:

- The existing `en`/`de` edit arrays accept exactly the 22 stable matrix
  identities. Preserve the lossless catalogue and the address view.
- Parsing admits only the established controls and glyph alphabet; it rejects raw escapes,
  NUL, malformed tokens and unsupported commands before a game starts.
  Wait operands are 1 through 255. Each stream has at most **1,024 encoded
  bytes including its terminator**, plus one zero byte for word read-ahead.
  This is an implementation bound on parsing, palette-only writer batches
  and queue retention; the Huffman 511-byte workspace is unrelated.
- A nonempty C60D edit requires exactly one `{count}` token. It resolves
  from the completed original count at B282, mapping this specific WRAM
  source to C60D. Count only the substituted digit toward line width. Empty
  edits hide the message; no other WRAM pointer becomes an edit identity.
- Effective content and the count are captured when B282 enqueues that ring slot.
  A language switch affects newly queued messages; active and pending
  messages finish with their original language. Keep ring occupancy, order
  and existing overwrite behavior. Use German edit, English edit, original
  English fallback; the current German asset supplies no matrix translations.
- Edited bytes use one per-message stream position shared by
  B2D1 and B3BC, including the wait operand. Never follow a longer edited
  stream into neighboring ROM data, repoint scripts or write it over WRAM
  workspaces. Completion parks DP34 at the known original terminator and
  releases the active stream, so idle calls and a reset cannot replay the
  original message. The no-edit path retains original reads and equations.
- B2A0 discards all active and queued edit state. At most eight pending
  streams and one active stream retain content; count substitution copies
  its bytes per occurrence. Ordinary content arrays are shared read-only.
  All state uses plain objects and typed arrays compatible with structured
  clone. The game has no general runtime save-state API; SRAM stores game
  progress, not this message queue. Recording replay rebuilds the queue and
  requires the same edit content, as for the other editable text domains.

Longer messages can intentionally change the time before control
continues; no equal-duration promise follows from stable identities.

## Verification

[matrix-text-contract.test.mjs](../tools/matrix-text-contract.test.mjs)
checks byte reconstruction, all reviewed references, the font lookup and
the fixed count write. Its synthetic writer cases compare registers, WRAM
and traces against the pinned original B2D1 instructions for row boundaries,
missing final publication, palette changes, waits, back commands and zero
delay. External B259 runs through its existing native contract on both sides.
These cases queue DMA records without running an NMI or displaying a picture;
they establish writer behavior, not browser presentation or a new Mesen route.
Existing source, live-matrix and unedited display comparisons keep their
documented scope.

[matrix-text-edits.test.mjs](../tools/matrix-text-edits.test.mjs) checks loader
byte identity, worker-compatible cloning, precedence and both language
directions, invalid input, count tokens and both sides of row/stream limits.
It drives the actual queue and writer with synthetic glyphs, covering wait
operands, palettes, backtracking, final publication, idle behavior, empty
messages, repeated identities, enqueue-time language/count snapshots, ring
wrap, unedited overwrites and B2A0 reset. A copied WRAM plus cloned stream
state resumes identically in that writer-only fixture; it is not a general
LiveGame snapshot feature.

The live case cold-starts from the apartment SRAM in each language, requests
the matrix through the native-7D entry writes, then moves toward IC using
the established up-input route. Both edited login content and the count
message produced by the real B959 routine appear in VRAM through the normal
matrix NMI using the installed glyph map. The original FOUND template
remains in WRAM. These are native live checks, not new Mesen or browser
comparisons. Arbitrary stories, edited fonts and packed intro/credits remain
outside this group.
