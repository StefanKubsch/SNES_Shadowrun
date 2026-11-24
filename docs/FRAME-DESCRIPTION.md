# Frame description

Phase 5 of the state model rebuild ([STATE-MODEL-REBUILD.md](STATE-MODEL-REBUILD.md))
moves the picture away from the SNES: `src/` describes layers, sprites and palettes,
and a renderer draws that description. The PPU register model becomes one producer
of descriptions instead of the picture's only path.

## Step 1: renderer and SNES back end (2026-11-24)

- src/video/frame-renderer.mjs draws one frame from a frame description. It
  imports only bit and screen constants: no PPU registers, no PPU model. Its
  header defines the format: brightness, main and sub screen layers, window
  areas and edges, clip and colour math, a 256-colour palette, character and map
  memory, BG layers (map and character addresses, size, scroll, composition
  levels), sprites with decoded attributes, and per-row changes (window edges,
  main screen layers, map base and size, scroll).
- src/video/ppu-frame.mjs is now the SNES back end: `describeMode1Frame` reads the
  PPU registers, VRAM, CGRAM, OAM and the H-DMA row writes into a description and
  performs every source check of the former renderer, in the same order and with
  the same reasons (including the per-row window edge check).
  `renderMode1Frame(ppu, options)` keeps its interface as
  `renderFrame(describeMode1Frame(ppu, options))`, so all callers are unchanged.
- Evidence: all five golden traces pass unchanged (picture hash per frame);
  PPU window, H-DMA, large BG, OBJ time-over, room and boot logo tests pass 24/24;
  tools/frame-description.test.mjs pins the format and the renderer's import list.
  The live benchmark measures the picture at 2.29 ms per NMI before and after.

## Plan for the next steps

1. Producers: game code builds the parts of the description it owns (palettes,
   sprite list, BG layer settings, scroll, colour effects) as typed state, and the
   description is assembled from that state instead of from PPU registers. The
   golden picture hash stays binding; the video memory hash becomes diagnostic for
   the converted parts, as decided on 2026-11-20.
2. Character and map memory remain a byte store for now: the text code reads its
   rendered rows back from video memory (81:A9E1, channel 5), so tile data stays
   readable game state.
3. The register-writing upload functions (src/game/game-nmi.mjs and others) are
   called directly by frozen proof modules. As with the phase 4 boundary
   ([REGISTER-COMPAT-BOUNDARY.md](REGISTER-COMPAT-BOUNDARY.md)) they stay as
   compatibility code for recorded comparisons, while live play takes the new
   path; they leave src only together with the proof modules that call them.

## Limits

- The description covers what the mode 1 renderer covered: other video modes,
  mosaic, interlace, direct colour and two-window logic remain rejected by the
  SNES back end.
- Character and map memory are still the PPU model's VRAM bytes.
