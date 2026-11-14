# Visible first room and original movement

Progress and the next block are in the project status, group
`main-loop-96ab`. This contract extends the
[cold task owner](BOOT-ORACLE.md#cold-owner-task-rounds-and-native-nmi) by two
complete room pictures. The [first logo output](PPU-BROWSER.md) stays an own,
earlier checkpoint. Translated from the former German version (original
wording at git commit 20c7b6c9).

## Owner and inputs

`proof/video/room-observed.mjs` runs the same cold reset 00:E382 via
MainLoopDriver, TaskScheduler, ScriptInterpreter and real native bindings.
Memory is initialised only with the original cold CPU/WRAM/SRAM entry; later
states and expected pictures stay in the oracle.
`assets/room-observations.json.gz` holds inputs only: cold entry, device
answers, instruction/NMI positions, original ownership segments, PPU write
windows and the two observed picture boundaries. The deterministically
compressed bundle has 270,100 bytes; repeated counter pairs are stored
losslessly and only the next ownership set is expanded. The product path
decodes no CPU instructions and reads no Mesen interface. Input follows the
proven new-game route; after the first real E014 return right is held. The
original takes input via inputPolled and its NMI; the native owner runs the same
NMI equations with the original device answers. No player positions, speeds,
task lists or readiness words are set.

## Write windows and PPU memory

The recorder records the original frame number, line and forced-blank state
before every real CPU or DMA write byte to 2100…2133. Connected equal
frame/blank/line ranges are merged into W records with a gap-free PPU write
byte position, keeping minimum and maximum of the observed lines; a range is
split at the line-225 boundary and at every picture capture. The PPU bus
consumes these ranges against its really produced write bytes; the blank bit
must match the INIDISP it wrote itself; without forced blank memory accesses are
allowed only at an explicitly observed VBlank position. The recording has 5,247
ranges and 2,077,216 PPU write bytes; on this route all PPU write bytes happen in
VBlank or forced blank (no visible raster change is generalised); the original
routines blank during their NMI transfers and unblank afterwards.

DMA uses the live CPU channel registers and reads its sources freshly from
native ROM/WRAM. VRAM, CGRAM and OAM must be fully determined by original writes
first. The eight bounded channel 5 readbacks are additionally computed from the
live VRAM read buffer (dummy read at 213A, alternating 2139/213A, increment after
the high port); all 128 result bytes must match the original immediate DMA
observations. The NMI contract still takes its checked observations into WRAM;
no later memory image is used. Other readback modes and unknown PPU start values
stay locked.

## Complete pictures and OBJ

The original endFrame callback gives two J records at line 225: frame 2472
after the first E014 return and frame 2474 after at least three returns; they
mark 2,074,805 and 2,076,591 PPU write bytes. At exactly these positions the
oracle compares VRAM, CGRAM, OAM and the whole picture (no choice of a matching
frame or section). The fixed digital RGB convention and the separately checked
black borders follow the [logo contract](PPU-BROWSER.md).

The renderer adds visible square OBJ with 9-bit X positions, Y wrap, size bits,
name bases, 4-bit bitplanes, palettes, tile rows and flips. OAM order decides
the visible OBJ pixel first; only then its priority against the BGs;
transparency lets the next OBJ through. Priority rotation stays a rejected
limit. Line limits follow chapter 20 (below). Mode 1 and BG3 high priority use
the original priority order. Visible register/memory mutations are rejected for
the output frames; no general raster renderer is claimed.

## Windows, HDMA and OBJ line limits (menus)

Since 2026-10-20 the Y item list and the Start status screen run live with
picture output until closing, with three hardware parts:

- **HDMA** ([hdma.mjs](../src/video/hdma.mjs)): `PpuBus` remembers 420C
  instead of aborting. For every live picture `hdmaRows` computes from channel
  registers 43x0–43x4 and the table in memory the B-bus writes before each of
  the 224 output lines: header byte with C bit and line count, C=0 one record
  for all lines, C=1 one record per line, 0 ends the channel. The first table
  line acts on output line 0 (original comparison: window lines 26–89 of table
  80:E480). Only absolute tables A→B in documented modes 0–4 with targets
  2126–2129 are allowed (since 2026-11-06 also TM 212C and the BG scroll words
  210D–2114, see below); indirect tables, B→A, header byte 80 and other targets
  are limits; general DMA on an HDMA channel is `ppu_hdma_channel_conflict`.
  When 420C switches a channel off its target registers become unknown (the
  picture model does not keep a picture's last HDMA value). Writes to 420C and
  to 43x0–43x4 of active channels outside the NMI count like PPU writes as
  unknown raster.
- **Windows** ([ppu-frame.mjs](../src/video/ppu-frame.mjs)): TMW (212E) masks
  BG1–4 and OBJ in their window area (2123–2125). Window 1 or 2 covers [left,
  right] including both edges; left > right is empty; IN/OUT inverts. Both
  windows on one layer (logic 212A/212B), TSW, colour math and the other 212E
  bits stay limits (colour math was added later, below).
- **OBJ line limits**: per line the 32 OBJ with the smallest numbers stay
  (33's Range Over); of these at most 34 visible 8×8 tiles are loaded, starting
  at the largest OBJ number (35's Time Over); OBJ with smaller numbers drop. The
  manual does not say which tiles of a partly loaded OBJ stay. Accepted model
  (user decision 2026-11-10): the OBJ keeps its leftmost on-screen tiles, in
  screen order whatever the H flip. Evidence is Mesen2 2.2.1, not Nintendo
  hardware documentation: a synthetic LoROM in
  [mesen-obj-time-over.test.mjs](../tools/mesen-obj-time-over.test.mjs) puts a
  16×16 OBJ after 33 tiles; Mesen shows only its left tile, the flipped copy
  only its flipped left tile, and the native picture matches. Before this, the
  renderer stopped with `ppu_obj_time_over_partial_source_required` whenever the
  picture depended on the choice; a user recording reached that stop in play
  (lines 155–158, 35 tiles, OBJ 0 partly loaded). In the menu build (pictures
  81–83) partial OBJ are the parked 64×64 OBJ at x=0, y=240 and a flipped 64×64
  OBJ under high-priority BG3 text.

Original comparison (`tools/mesen-live-room.test.mjs`; Mesen also captures
pictures at chosen live NMIs): Y opens the list, B closes it. HDMA is active
from live NMI 84. The resting pictures 150 and 160 with open window are
pixel-equal. The opening pictures 90 and 95 (window stripes 53–62 and 29–86,
steps of E41F) occur in the native sequence; the original opens more slowly
because it has lag frames from NMI 81. After closing, registers, SRAM, VRAM,
CGRAM, OAM and the picture are equal; in WRAM only the NMI counters
1C76/1C78/1CBA differ by the two lag NMIs, plus old interrupt bytes below S. The
Start status screen is checked the same way (resting picture 150, end state).
The time-over pictures 81–83 contain writes in working code (raster counters 3,
1, 4); their original picture varied between recordings while run and memory
stayed equal, so they are not compared pixel-exactly; synthetic cases in
`tools/room-observed.test.mjs` check the line limits, `tools/ppu-window-hdma.test.mjs`
windows and HDMA. Cost: one room picture 3.2 ms instead of 3.0 ms.

## Brightness and room change (2026-10-21)

With `MORGUE_EXIT_PLAN` ([live-plan-driver.mjs](../tools/live-plan-driver.mjs)
turns plan commands into pad words per live NMI, with the glove in a control
loop via the native position) the live mode leaves the morgue: forced blank
while the corridor loads, then the corridor fades in with 2100 brightness 1–14.
Book I (PDF 115) only names 16 levels without a digital formula; the renderer
scales each 5-bit component c to `floor(c·b/15)` before the 8-bit output; the
original's fade-in pictures confirm this for every level 1–14. The original has
19 more lag NMIs on this route, so the plan's open hold commands move Jake a bit
differently and the game states diverge; therefore only the renderer is checked
here: Mesen also supplies its PPU state for chosen pictures (`shotPpu`: all
`ppu.*` fields, VRAM, CGRAM, OAM), and [mesen-ppu-state.mjs](../tools/mesen-ppu-state.mjs)
builds a `PpuState` with the same register bytes. Room pictures (live NMI 30 and 500) and the corridor picture (2300) are pixel-equal. Mesen's end-of-frame
picture during the fade is sometimes still the previous one; the test requires
per picture the rendering of its own or the previous state and an own picture
for at least ten of the fourteen levels.

## Colour math (title, 2026-10-21)

Title D694 after the menu flow (see [NATIVE-CONTINUATION.md](NATIVE-CONTINUATION.md),
"Game Over and menu owner live") blends BG1 with BG2 on the subscreen in D87C
(212C=1, 212D=2, 2130=2, 2131=0x41: add, halved). `renderMode1Frame` computes
per pixel main and subscreen (212D with window mask 212F), the fixed colour 2132
(per component via bits 5/6/7, `PpuState.fixedColor`) and the colour window
(2125 bits 4–7) for the areas of 2130 bits 7–6 (main black: never, outside,
inside, always) and 5–4 (math: always, inside, outside, never). 2131 selects
BG1–4, OBJ (palettes 4–7 only) and backdrop; bit 6 halves, bit 7 subtracts;
results are clamped to 0–31. An empty subscreen pixel takes the fixed colour
without halving (Book I PDF 70, 131). Limits: halving in fixed colour mode or
with blackened main (not described by the manual), direct colour (2130 bit 0),
colour window with both windows. Mesen's state has neither 2130 bits 7–4 nor
212A/212B, so [trace-live-room.lua](../tools/mesen/trace-live-room.lua) appends
the last CPU write values as `w212A`, `w212B`, `w2130`. The renderer oracle does
not suit the title (brightness, colours and scrolls change per line via HDMA;
Mesen's end-of-frame state has only the last value), so it is checked directly:
all 36 original title pictures 13750–15500 (skyline with HDMA, cross-fades with
colour math) occur pixel-equal and in order in the native sequence (offset 1242
NMIs, [live-game-over.test.mjs](../tools/live-game-over.test.mjs)).

## HDMA to TM and BG scroll (credits, 2026-11-06)

The credits sequence 81:CDF8 (value 5; the ending and the page option
**Credits** from the start menu) runs three
HDMA channels: 5 writes TM 212C per line (mode 0), 6 writes BG2HOFS 210F per
line (mode 2, the skyline's parallax), 7 window 1's edges. `hdmaRows` now
admits TM and the scroll registers 210D–2114 as targets. The renderer prepares
every BG layer and OBJ that any TM value of the field enables and applies the
writes before each row: TM selects that row's main screen; a scroll register
takes a low/high pair within one row (Book I PDF 119, 2-27-5: written twice,
low then high), and a pair split across rows is `ppu_scroll_pair_required`.
For two consecutive writes to one port the shared scroll latch yields exactly
high·256 + low, so no further latch state is assumed. When 420C switches off a
channel with a scroll target, that scroll word becomes unknown, as the window
edges do. Checks: synthetic case in `tools/ppu-window-hdma.test.mjs`; German
credits from the start menu with picture output in `tools/credits.test.mjs`; a
probe rendered the full sequence (7073 pictures in game, all pages).
No original picture comparison yet: Mesen's end-of-frame state has only the last
HDMA value, as with the title.

## Nintendo sources

Primary source: [Nintendo Development Manual Book I](../Ressources/book1_text.pdf).
PDF pages count from one; printed identifiers in parentheses. Diagrams A-4 and
A-19 were also checked as page images.

| Subject                       | Chapter and page                                                                                  | Finding and limit                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OBJ size, base and OAM port   | Ch. 27, PDF 115–116 (2-27-1/2)                                                                    | Six square size pairs, low/high write order; OAM in VBlank or forced blank                                                                                                                    |
| VRAM/CGRAM access             | Ch. 27, PDF 120–121, 125, 135 (2-27-6/7/11/21)                                                    | Increment port, blank limits, buffered VRAM read sequence with dummy read; no raster or remapping generalisation                                                                              |
| OBJ data and character layout | Appendix A, PDF 196–199 (A-1…4)                                                                   | Name range, OAM bits, signed X, palette, H/V flip and tile rows                                                                                                                               |
| Lines and bitplanes           | Appendix A, PDF 205, 207 (A-10/12)                                                                | BG lines 1…224 versus OBJ 0…223; 4-bit tile layout                                                                                                                                            |
| Priority and overflow         | Ch. 20, PDF 91–92 (2-20-1/2); appendix A, PDF 214 (A-19)                                          | OBJ selection before BG priority; 32 OBJ by smallest number, 34 tiles from the largest number; tile choice of a partial OBJ from Mesen2 (model); rotation a limit                             |
| Windows                       | Ch. 6, PDF 68 (2-6-1); PDF 126–129 (2-27-12/13/15)                                                | 2123–2125 W1/W2 EN and IN/OUT, 2126–2129 edges 0–255 inclusive, left > right empty, 212E/212F mask choice; logic combination 212A/212B still a limit                                          |
| Colour math                   | Ch. 7, PDF 69–73 (2-7-1…5); PDF 130–132 (2-27-16…18)                                              | Main/subscreen 212C/212D, addition/subtraction, halving, fixed colour for empty subscreen pixels without halving, clamp 0–31, colour window; halving with fixed colour or blackened main open |
| Brightness                    | Ch. 27, PDF 115 (2-27-1)                                                                          | 2100 bits 0–3, 16 levels, bit 7 forced blank; digital conversion c·b/15 from the original comparison                                                                                          |
| HDMA                          | Ch. 17.2, PDF 87 (2-17-4); PDF 143–144, 149–152 (2-28-8/9/10/12); appendix B, PDF 219–220 (B-1/2) | 420C channels, 43x0 mode and direction, table format with C bit and line count, 0 as end; HDMA channels not for general DMA; exact line position from the original comparison                 |
| BG scroll and TM per line     | Ch. 27, PDF 119 (2-27-5), PDF 128 (2-27-14)                                                       | 210D–2114 written twice, low then high, 10 bits; 212C selects the main screen layers; per-line changes through HDMA mode 0 (TM) and mode 2 (scroll pair)                                      |
| Picture format and DMA        | Ch. 27/28, PDF 133, 149, 151 (2-27-19, 2-28-10/12)                                                | 224 lines without interlace and CPU DMA; no clock invented from transfer lengths                                                                                                              |

The Shadowrun-specific register values, data, inputs and picture positions are
proven by the cold original recording. Mesen's
[EndFrame event](https://github.com/SourMesen/Mesen2/blob/master/Core/SNES/SnesPpu.cpp)
and [RGB output](https://github.com/SourMesen/Mesen2/blob/master/Core/Debugger/LuaApi.cpp)
name the oracle interface; they replace no Nintendo hardware source.

## Browser and checks

After `npm start` and local ROM selection, "show first room" displayed the
first picture and "show first movement" the following moved picture; a module
worker kept the same native owner between both outputs; expected picture bytes
never reach the worker. This was a bounded original sequence; the worker uses
the [native continuation](NATIVE-CONTINUATION.md) with finite main loop and
opcode budgets (they only bound work pieces; picture and NMI positions still
come from the same observation bundle). `tools/mesen-cold-rounds.test.mjs`
extends the original recording to the first 96C3 return after both full
pictures, so it ends after 1,587 rounds with four returned E014; it compares all
registers including E, whole WRAM/SRAM, the whole CPU/DMA sequence, both PPU
memory states and all 114,688 picture pixels. A real Edge browser must
reproduce both canvas pictures with 458,752 RGBA bytes in total; the movement
changes exactly 242 visible pixels. The recording covers 144,274 script opcodes,
13,554 native calls, 2,273 NMIs, 19,582,782 instruction observations, 1,136,813
CPU device bytes from 217,676 write instructions and 2,000,880 DMA bytes from
7,177 jobs. Supplementary synthetic tests check sprite selection,
transparency, flips, negative X, name range, tile carries, overflow limits,
VRAM dummy reads and damaged write/picture limits.

The earlier M3/M4 results stay historical standalone proofs. M5 stays open
until running output and free control. Dynamic PAL time, later nested native
owners, more scenes and audible output need their own source and original
contracts. After the full recording `ObservedRoom.live` can continue the same
owner with lag-free frame events and live pad (contract in
[NATIVE-CONTINUATION.md](NATIVE-CONTINUATION.md), section lag-free frame
events); those pictures are not original-compared. Since 2026-10-30 the
browser starts the game live from reset (`LiveGame`, NATIVE-CONTINUATION.md,
"Cold start live") and no longer uses the room recording, which stays the basis
of the original comparisons above and of the M5 live comparison.
