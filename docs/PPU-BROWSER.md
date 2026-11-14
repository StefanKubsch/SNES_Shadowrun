# First native browser picture

Progress and the next block are only in the canonical project status, group
`main-loop-96ab`. Translated from the former German version (original wording
at git commit 20c7b6c9).

## Contract

The browser runs the native reset/startup equations from the observed cold
CPU/WRAM/SRAM entry up to the first real entry 81:EEF1. At that point the logo
is fully faded in and was already shown during the original wait; the normal
call frame lies freshly on the stack. The checkpoint stops before its first
instruction; no return is created.

`assets/boot-logo-observations.json` holds inputs only: cold CPU/RAM entry,
original device answers with source PC and count, and the really observed
instruction/NMI positions. It holds no later CPU/WRAM/PPU states, ROM picture
data or pre-rendered picture. The list fixes the externally observed interrupt
chronology of this bounded original; it is no general PAL clock or automatic
interrupt planning. The product path decodes no 65816 instructions.

Every CPU device write reaches the native PPU bus. DMA reads from the ROM/WRAM
state really computed at that moment and its CPU channel registers; recorded
DMA output bytes are not used. VRAM, CGRAM and OAM start fully unknown; every
byte must be determined by original writes (zeros in memory buffers are no
valid start evidence). For this logo contract the renderer computes a static
256 × 224 picture from native registers, tilemaps, 2/4-bit bitplanes, palettes,
scroll values, flips and mode 1 priorities. Fully invisible OBJ are checked;
the later [room contract](PPU-ROOM.md) adds visible OBJ and two moving room
pictures. The canvas gets the computed RGBA bytes. The selected local European
ROM is checked by SHA-256 and not transmitted.

## Nintendo sources

Primary source is the local `Ressources/book1_text.pdf`, Nintendo Development
Manual Book I. Page numbers are PDF pages; printed identifiers in parentheses.

| Subject                          | Chapter and page                                               | Finding and limit                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Forced blank and full brightness | Ch. 27, PDF 115 (2-27-1)                                       | INIDISP 80 gives black output, 0F full brightness; other visible brightness levels open (later added in [PPU-ROOM.md](PPU-ROOM.md)) |
| OAM address and port             | Ch. 27, PDF 116 (2-27-2)                                       | Low/high latch in the lower area, upper 32 bytes mirrored; data accesses here only in forced blank                                  |
| BG mode, tile size and bases     | Ch. 27, PDF 117–119 (2-27-3…5), appendix A PDF 200 (A-5)       | Mode 1, 8×8, BG1/2 with 4 bits and BG3 with 2 bits per pixel; other modes/mosaic remain open; large cells added below               |
| Scroll and VRAM ports            | Ch. 27, PDF 119–121 (2-27-5…7)                                 | Paired scroll writes, VRAM word address, selected increment port, steps 1/32/128; remapping and interleaved scroll latches open     |
| CGRAM and colour composition     | Ch. 27, PDF 125 (2-27-11), 128 (2-27-14), 130–131 (2-27-16/17) | 15-bit colour, low/high latch, main screen; window clipping and colour addition excluded here                                       |
| Picture format                   | Ch. 27, PDF 133 (2-27-19)                                      | 224 lines without interlace/overscan; other formats open                                                                            |
| Tile entries and BG lines        | Appendix A, PDF 205 (A-10)                                     | Tile index, palette, priority, H/V flip; BG lines 1…224 versus OBJ 0…223                                                            |
| Bitplanes and tilemaps           | Appendix A, PDF 207 (A-12), 209 (A-14)                         | Bit 7 left, two planes per word, four planes in 32 bytes; SC quadrants 32×32                                                        |
| Palette and priority             | Appendix A, PDF 212 (A-17), 214 (A-19)                         | BGR555, transparent colour number 0 and background CG00, BG3 priority in mode 1                                                     |
| CPU DMA                          | Ch. 28, PDF 149 (2-28-10), 151 (2-28-12)                       | Forward modes 00/01/08/09, fixed/increasing source, size zero = 65,536; HDMA and other modes open here                              |

Shadowrun's register values, data, addresses and flows are proven by the full
original cold boot comparison, not by the hardware manual.

## Original and browser comparison

The optional PPU capture in the boot oracle reads the original VRAM, CGRAM and
OAM memory and the frame at the same checkpoint (no state injection, no new
route probe series). For RGB output Mesen's filter `None` with neutral colour
parameters is fixed; the 5-to-8-bit expansion repeats the top bits (the
oracle's digital output convention, no statement about analogue displays). The
Lua API delivers RGB24 although older API descriptions name ARGB; sources:
[LuaApi.cpp](https://github.com/SourMesen/Mesen2/blob/master/Core/Debugger/LuaApi.cpp)
and [ColorUtilities.h](https://github.com/SourMesen/Mesen2/blob/master/Core/Shared/ColorUtilities.h).
Mesen's 239-line buffer has seven black lines on top and eight below for a
224-line picture; these borders are checked separately and only the proven
224-line content is compared (no matching section is searched). The test
compares all CPU registers and the whole WRAM/SRAM, all 65,536 VRAM, 512 CGRAM
and 544 OAM bytes and all 57,344 pixels; emulator raw data and logs stay in the
temporary evidence folder; expected pictures never enter the product path.

Since 2026-10-30 the browser no longer shows this observed logo but starts the
game live from reset ([NATIVE-CONTINUATION.md](NATIVE-CONTINUATION.md), "Cold
start live"); there [live-game-browser.test.mjs](../tools/live-game-browser.test.mjs)
checks the real Edge against the native live run, whose pictures up to the
title are compared with Mesen. Until then a real Edge loaded the ROM via the
file field and produced the same 229,376 RGBA bytes in the canvas as this
contract.

## Limits

The original checkpoint above delivers the first static visible original picture. The
[room contract](PPU-ROOM.md) now proves the first room with visible OBJ, blank
write windows and two complete pictures of the first movement. Free running
control, raster-dependent register changes and audible output remained open
at that checkpoint. Later live work added these features, brightness, windows
and colour math (see PPU-ROOM.md and NATIVE-CONTINUATION.md); the Matrix
extension below adds large map cells and per-row map base changes.
The full M3 proof up to 80:96AB stays its own CPU/memory/device contract
([BOOT-ORACLE.md](BOOT-ORACLE.md)).

## Matrix rendering correction (2026-11-09)

The user's cyberdeck recording stopped with `ppu_mode1_8x8_required` when
the Matrix introduction faded in. All eight recorded WRAM checks matched;
the first rendering failure was NMI 7245, after the last successful picture
at 7244. The save's cyberdeck ownership was accepted and the game logic
continued when drawing was disabled. This was a renderer coverage gap.

The Matrix list `81:CDB2` sets BGMODE to `39`: BG1/BG2 use 16x16 map
cells, while BG3 still uses 8x8 characters. The introduction initially
enables BG3 and OBJ (`TM=14`); the grid then enables BG1/BG2. After adding
large cells, the same replay exposed channel 6's previously unsupported
BG3SC target at NMI 7904. `81:C029` configures that channel from `81:C101`
and channel 5's BG3 vertical scroll from `7F:0150`; these are original
equations in [main-scene-matrix.mjs](../proof/matrix-reference/main-scene-matrix.mjs).

Hardware sources, checked separately from the game's register values:

- `Ressources/book1_text.pdf`, chapter 27, PDF 117 (2-27-3): BGMODE
  independently selects 8x8 or 16x16 cells for each BG. A large cell
  names four 8x8 characters, N/N+1 above N+16/N+17.
- Appendix A, PDF 205 (A-10): map words carry the name, palette, priority
  and horizontal/vertical flips. Flips cover the whole cell. PDF 216
  (A-21) gives doubled map extents and scrolling ranges for 16x16 cells.
- Chapter 27, PDF 118 (2-27-4): BG1SC through BG4SC select map base and
  32/64-cell dimensions. Chapter 17.2, PDF 87 (2-17-4), defines HDMA
  register transfers by horizontal line.
- The [Mesen PPU implementation](https://github.com/SourMesen/Mesen2/blob/master/Core/SNES/SnesPpu.cpp),
  `GetChrData`, independently confirms that adding quadrant offsets wraps
  the complete ten-bit character name, including row and name boundaries.

[ppu-frame.mjs](../src/video/ppu-frame.mjs) now decodes both cell sizes,
including quadrant selection, complete-cell flips, map quadrants, scrolling,
name wrap, palettes and priority. The existing 8x8 path retains its equations.
[hdma.mjs](../src/video/hdma.mjs) admits the four map base/size ports; the
renderer applies their changes before each row and retains them until the
next row update, without changing the stored PPU state. Unsupported video
modes remain explicit boundaries (`ppu_mode1_required`); this adds no
mosaic, interlace, indirect HDMA or timing model.

Regression tests are [ppu-large-bg.test.mjs](../tools/ppu-large-bg.test.mjs)
and [live-matrix-render.test.mjs](../tools/live-matrix-render.test.mjs).
The live case renders the original Matrix setup, introduction, grid and
jack-out, using the existing apartment save and bounded system-3 plan.
The user's recording is retained locally; no save or recording is a product
dependency, and the correction does not change gameplay or SRAM.

Local verification: the reported recording
`Shadowrun-recording-2026-11-09T17-37-00-291Z.json` now renders from before
the failing transition through NMI 9254, including the grid with HDMA.
All eight recorded WRAM checks remain equal and the recorded input path
matches. Two independent Mesen PPU captures of system 3, before and after
enabling the BG3 map/scroll HDMA channels, each match all 57,344 pixels
exactly. Those captures compare rendering from the original's own PPU
state; they do not establish a new frame-by-frame comparison of the user's
complete route. Raw captures and local scripts remain in `.cache/logs/`:
`matrix-ppu-oracle.log`, `matrix-ppu-hdma-oracle-fixed.log` and
`cyberdeck-crash-fixed.log`.
