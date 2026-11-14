# Instant menus and dialogs

User decision, 2026-11-10: window and dialog text may appear at once instead
of at the original transfer speed. The option is a quality-of-life departure
from the original, on by default in the browser and off for oracle and tool
callers.

## Original behaviour

Every text row of a window, menu or dialog is drawn into WRAM and handed to
the game NMI handler 80:C152. The window code raises one of four request words
and polls it until the handler clears it:

| Wait    | Request word | Transfer in 81:A9E1                               |
| ------- | ------------ | ------------------------------------------------- |
| 81:ACAF | 01F8         | window map to the BG3 map (DMA channel 7)         |
| 81:ACBD | 01F6         | clear text tiles in chunks (DMA channel 6)        |
| 81:ACC3 | 01FA         | text buffer from WRAM to VRAM (DMA channel 7)     |
| 81:ACC9 | 01FC         | text tiles from VRAM back to WRAM (DMA channel 5) |

The callback 81:A9E1 (JSL at 80:C15F) services all four requests. VRAM data
may be written only in VBlank or forced blank (Book I, PDF page 121, VRAM
data registers 2118/2119); the handler sets forced blank at 80:C156 first.
The original therefore needs one NMI per request: a text row costs two frames
(read back, then upload). Opening the status menu in the morgue took about 80
frames in the native port, about 70 of them in these four waits.

## Port behaviour with the option

The lag-free frame model (src/vm/frame-events.mjs) delivers an NMI only at the
back branch of a blocking wait. With `instantText` on, the interrupt step
([main-wait-interrupt.mjs](../src/task/main-wait-interrupt.mjs)) first asks
[instant-text.mjs](../src/game/instant-text.mjs) whether the wait is one of
the four text waits and the current NMI callback is 80:C152. If so, it calls
the unchanged A9E1 routine with the register state the handler has at 80:C15F
(native mode, 16-bit registers, D = 0, DB = 0, NMI stack), restores the
interrupted registers and lets the loop read the cleared request word without
a frame.

The PPU picture is rendered only at real NMIs, so no partly drawn state is
visible; the transfer is counted as VBlank access. Picture output, audio time,
pad reads and the frame counter 1C76 (RANDOM_STATE) do not advance for these
transfers. All other NMI services stay at their original frames.

Unchanged on purpose: the counter waits 81:B0A1 and 81:EEBB and the fade
wait 80:901F. They pace portraits, fades and menu rounds, not the transfer of
text.

Measured in the morgue (scratch probe, counter seed 0x1234567): the status
menu is ready after 3 frames instead of about 80. The settled picture, VRAM
and CGRAM of the status menu, a submenu and the closed menu are identical
with and without the option.

## Consequences

- Fewer frames pass, so the frame counter and the random state after a menu
  can differ from the original timing. Game logic itself is unchanged.
- Gameplay key `instantText`. Recordings without the key keep the original
  timing; browser settings stored without it receive the default (on). Like
  all gameplay choices it is fixed for a running session
  ([BUGFIXES.md](BUGFIXES.md), [RECORDING.md](RECORDING.md)).
- Original comparisons and tools use `ORIGINAL_GAMEPLAY` and keep the
  original frames.
- Other NMI handlers (frontend, intro, matrix) do not call A9E1 and are not
  affected.
