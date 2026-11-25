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

## Step 2: NMI picture jobs through the video interface (2026-11-24)

ROM scene register lists and the font upload set up DMA channels 1, 2 and 4 to 7 as
register data, so a register decoder remains part of the SNES back end. Game code,
however, no longer needs to name registers:

- The game NMI's picture jobs (src/game/game-nmi.mjs: scene and object palettes,
  palette cycle step, VRAM records, OAM buffer, portrait characters and colours, the
  glove picture and sprite, text tile clears, window map, text mask and its read
  back, blanking and the screen shadows) state each transfer in full through
  src/video/video-port.mjs: source, size and destination, with the original
  instruction sites. The module imports no hardware register.
- The SNES back end of each new VideoPort method writes exactly the registers the
  original writes, in its order; the channel modes and targets set earlier are
  named in each method's comment. Register-level callers keep passing a hardware
  port, which `videoOf` wraps, so frozen proof callers are unchanged. The portrait
  channel setup (src/game/portrait-upload.mjs) uses the same interface.
- Evidence: game NMI lift comparisons, DMA read-back, window text and instant text
  tests and all five golden traces pass (32/32), so the register writes, video
  memory and pictures are unchanged.

## Step 3: portrait, dialog and game screen writers (2026-11-24)

- The portrait window and the member portrait's colour window (window select and
  logic, H-DMA channel 0 table), the portrait and dialog-close OBJSEL stores, the
  dialog's fixed colour and colour math reset, the dialog-close font transfers and
  the game screen's H-DMA stop go through new VideoPort methods with their sites.
  No module in src/game now writes a picture register through the hardware port;
  the remaining port writes there are the multiplier, divider and M7A/M7B product
  (arithmetic hardware).
- The scene runtime's video interface now forwards sites and reads.
- Evidence: block check 5606/5606 in 433 seconds; golden traces unchanged.

## Step 4: scene code (2026-11-25)

- The 230 raw `video.write` register calls of the scene code are gone: game screen,
  camera scroll, fixed colour, scene tiles, title, start menu, cutscene animation and
  scene, intro, scene lists and scene screen use VideoPort methods. Only
  src/video/video-port.mjs writes registers.
- DMA and H-DMA transfers are described by their parts:
  `transfer(channel, {to, fixed, source, bytes, address, increment}, order)` and
  `setUpDma([[channel, t], ...], order)`. `to` names the destination (VRAM, VRAM
  read-back, CGRAM, OAM) or the per-line H-DMA target (main layers, BG2 scroll,
  window edges). `order` lists the parts in the order the original sets them, so the
  SNES back end writes the same registers in the same order; a back end without
  channel registers can perform the transfer at its start and ignore the rest. A
  part not listed keeps the channel's earlier set-up, as on the hardware.
- New setters cover the BG mode, OBJ select byte, map and character bases, single
  scroll offsets, window areas and logic bytes, the 16-bit H-DMA enable store, VRAM
  address, increment, words and bytes, and colour bytes. Layer numbers are
  `BG_1` to `BG_4` (src/constants/ppu.mjs).
- Register data from ROM stays register data: the scene list's register command
  and the text read-back's latching RDVRAMH read go through the hardware port.
- Evidence: block checks 2028/2028 (game), 127/127 (title and start menu), 622/622
  (cutscenes) and 526/526 (intro, scene lists, scene screen, final back end); all
  five golden traces unchanged throughout.

## Plan for the next steps

1. A second video back end writes the picture state (palette, sprites, layer
   settings, character and map bytes) directly, without registers, for live play.
2. Producers: game code builds the parts of the description it owns (palettes,
   sprite list, BG layer settings, scroll, colour effects) as typed state, and the
   description is assembled from that state instead of from PPU registers. The
   golden picture hash stays binding; the video memory hash becomes diagnostic for
   the converted parts, as decided on 2026-11-20.
3. Character and map memory remain a byte store for now: the text code reads its
   rendered rows back from video memory (81:A9E1, channel 5), so tile data stays
   readable game state.
4. The register-writing upload functions (src/game/game-nmi.mjs and others) are
   called directly by frozen proof modules. As with the phase 4 boundary
   ([REGISTER-COMPAT-BOUNDARY.md](REGISTER-COMPAT-BOUNDARY.md)) they stay as
   compatibility code for recorded comparisons, while live play takes the new
   path; they leave src only together with the proof modules that call them.

## Limits

- The description covers what the mode 1 renderer covered: other video modes,
  mosaic, interlace, direct colour and two-window logic remain rejected by the
  SNES back end.
- Character and map memory are still the PPU model's VRAM bytes.
