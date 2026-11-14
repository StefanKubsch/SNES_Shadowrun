# Retained code bytes and data read margins

Source: European English ROM, SHA-256
`91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690`.
Checked on 2026-11-09. This follows the
[unidentified-data audit](ROM-UNREAD-AUDIT.md); its 95 unknown data bytes and
all decoded graphics, including unused content, remain unchanged.

## Result

The previous package kept 293 code bytes in 288 runs. Of these, 200 were
unneeded margins between two code classes, caused by an older classification
rule. The corrected package keeps **93 code bytes in 89 runs**:

| Evidence category                                                  | Bytes |
| ------------------------------------------------------------------ | ----: |
| CPU data reads recorded natively or in the original                |    15 |
| Original hardware-only HDMA reads, also at genuine data boundaries |     2 |
| Genuine data-boundary margins not seen in the read recordings      |    76 |
| Total retained code bytes                                          |    93 |

These categories are exclusive. The recordings overlap: eight bytes have a
native read, eleven have an original CPU read and four occur in both. The
76 unobserved margins are not proven unread; for example, the menu reader's
word at the options terminator has a known high-byte read without a hit in
the recordings. They remain retained.

The package now contains 996,041 bytes reconstructed from decoded sources,
188 raw bytes (93 retained code bytes plus 95 unidentified data bytes) and
52,347 absent code bytes. No decoded asset byte is removed or changed.

## Why 200 bytes could be removed

The old ROM map created a margin when an executed-code byte followed any
class other than executed code or `code_kept`. Thus a byte following
statically traced, unused or dead code was treated as if it followed data.
The builder then retained it simply because its class was `code_kept`.

All six code classes are excluded from the product's code execution path:
the product runs native JavaScript. A transition between those classes does
not establish a data reader or a word crossing the end of data. The removed
bytes had neither native nor original read evidence and no data predecessor:

| Preceding code class | Removed bytes |
| -------------------- | ------------: |
| `code_static`        |           166 |
| `code_unused_native` |            17 |
| `code_dead`          |            12 |
| `code_unused_opcode` |             5 |

[rom-code-retention.mjs](../tools/rom-code-retention.mjs) now supplies the
same data-to-code boundary rule to the ROM map, builder and audit. The map
includes every code class when deciding whether the predecessor is data.
Read evidence still takes precedence; it is not removed by this correction.

## Established CPU readers

| Retained code bytes                      | Actual original reader  | Why the bytes are read                                                                                      |
| ---------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `80:98FE` to `98FF`, `80:9906` to `9907` | `80:A989 CMP $1038,Y`   | A985 compares the selection word with an index reaching bank-80 ROM instead of the WRAM mirror.             |
| `80:9A5E` to `9A5F`, `80:9A66` to `9A67` | `80:A9BA LDY $1198,X`   | The same object index later reads the direction-table pointer from the ROM region.                          |
| `81:CDF8`                                | `81:EC1E LDA [$28],Y`   | WORD read of the scene-command terminator at CDF7, then AND with 00FF.                                      |
| `81:D02A`                                | `81:D008 LDA $D022,Y`   | WORD read of the last of eight BYTE displacement entries, then AND with 0003.                               |
| `81:D10D`                                | `81:D0D4 LDA $D0FD,Y`   | WORD read of the last of sixteen BYTE displacement entries, then AND with 0007.                             |
| `81:D59E`, `81:E3DA`, `81:E446`          | `81:D531 LDA $0000,Y`   | WORD read of a menu-text terminator, then AND with 00FF.                                                    |
| `81:D694`                                | `81:D64E LDA $81D687,X` | A BYTE copy loop copies fourteen bytes, including this first byte after the thirteen-byte intro HDMA table. |

The first four words have complementary recordings: the 9906/9A66 words
occur in the native alley-bus regression, while 98FE/9A5E occur in the
original room tours. Sources: [native-object-turn.mjs](../src/task/native-object-turn.mjs),
[live-alley-bus.test.mjs](../tools/live-alley-bus.test.mjs) and the original
read records in `analysis/rom-code-observed.json`.

The remaining readers are implemented in
[main-scene-video.mjs](../src/task/main-scene-video.mjs),
[cutscene-animation.mjs](../proof/cutscene-reference/cutscene-animation.mjs),
[start-menu-text.mjs](../proof/frontend-reference/start-menu-text.mjs) (with its lifted form
[start-menu.mjs](../src/frontend/start-menu.mjs)) and
[intro-setup.mjs](../proof/intro-reference/intro-setup.mjs) (with its lifted form
[intro-scene.mjs](../src/intro/intro-scene.mjs)). In addition,
`81:E50C` is retained after the final options text: the same menu WORD
reader must fetch it as the high byte of the terminator at E50B, although
neither read recording contains a hit there.

The read callback labels in the original recording can name the following
instruction, not the load itself. For example, A98C is BNE after the CMP,
A9BD is the instruction after LDY, and D652 is STA after the BYTE LDA.
The audit reports these as `original_recorded_next_pc`; source interpretation
must not assume that the callback label itself performs the read.

## Hardware-only reads remain separate

`81:D479` and `81:D531` lie in the already documented hardware-only range
D479 to D577, inclusive. Mesen's HDMA channel can continue into it after the
terminator at D478 when enabled during a field. The recorded CPU labels
F00C and EED3 do not identify CPU reads of those ROM addresses.

Both bytes remain for the independent reason that they immediately follow
decoded data. The product still starts HDMA tables at A1 for each frame and
stops at a terminator. The shared retention helper reuses the existing
hardware-only exclusion; it introduces no new timing behavior or hardware
assumption. The manual evidence and its limit remain in
[ROM-FREE.md](ROM-FREE.md): Nintendo Book I, PDF pages 144 and 152 for
HDMA initialization and table-address registers; within-field continuation
is observed Mesen behavior, not stated by those pages.

## Reproduce and verify

```powershell
node tools/rom-code-audit.mjs > .cache/logs/rom-code-audit.json
node --test tools/rom-code-audit.test.mjs tools/vm-cartridge.test.mjs
```

The read-only audit lists every retained byte with its class, predecessor,
native read flag, original callback label and hardware exclusion. It also
lists every omitted code-class transition and checks the reconstructed
product bytes against the original. Regression tests cover every pair of
code classes, genuine data boundaries, alternate numeric class IDs,
overlapping read evidence and the inclusive hardware-only interval.
The cartridge suite retains the byte-for-byte data reconstruction and read
coverage checks. The earlier unused-character audit remains applicable.

Limit: classifications and recordings establish the present retention
policy, not global unreachability of every omitted byte. An unrecorded path
can still read absent code; it must report `rom_byte_absent` with the address
and remain reproducible through a recording. The correction changes no
runtime reader, scene logic, random source or input timing.
