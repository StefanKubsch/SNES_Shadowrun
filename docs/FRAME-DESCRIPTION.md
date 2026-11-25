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
- proof/video/ppu-frame.mjs is now the SNES back end: `describeMode1Frame` reads the
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

## Step 5: register-free picture back end for live play (2026-11-25)

- src/video/picture-video.mjs implements every VideoPort method on a typed picture
  state: display, BG mode and layers (map base and size, character base, scroll),
  main and sub screens, window areas and edges, colour math and fixed colour, OBJ
  settings, a 256-colour palette, VRAM and OAM bytes, and the DMA channel set-ups the
  game makes in parts. `describe()` builds the frame description from that state,
  with the same rejections as the SNES back end (mode 1 only, no mosaic, interlace,
  direct colour or two-window logic, no OBJ rotation).
- Register numbers remain only for register data: `writeRegister` decodes the
  power-on reset, the scene list's register command and the window tile
  multiplication (M7A/M7B, `readProduct`), and H-DMA tables, which name their
  per-line target register, are decoded into row changes.
- Routing: `LiveGame` takes `video: PICTURE_VIDEO` (the default since step 6). The
  picture back end is then the device bus; `DeviceAccess.video`, the hardware port's
  `video` field, `videoOf` and `sceneRuntime` hand it to the lifted code, so its
  calls skip the registers. The scene default's CPU register writes go back to the
  devices through the hardware path. The browser worker, the recording replay and the
  golden trace replay use it; the register-level tests keep the SNES back end and its
  raster write counts (null with the picture back end).
- Both back ends hold the same VRAM, OAM and palette bytes, so the golden video
  memory hash stays binding as well.
- Evidence: tools/picture-video.test.mjs (both back ends from the same calls give
  equal descriptions, pixels, memories, product and read-back); block check
  4966/4966 in 584 seconds with all five golden traces replayed through the picture
  back end unchanged; tools/recording.test.mjs 2/2.

## Step 6: the picture back end is the default (2026-11-25)

- `LiveGame` now defaults to `PICTURE_VIDEO`. Back-end-neutral accessors replace
  direct PPU reads: `game.screen` (vram, cgram bytes, oam of either back end) and
  `game.render()` (the current pixels). `dataOutsideBlank` counts the picture back
  end's VRAM, CGRAM and OAM data bytes outside VBlank and forced blank, as the SNES
  back end counts its data port writes; raster write counts remain SNES only.
- Tests that compare PPU registers, scroll latches or PPU write counts against a
  register-level reference choose `video: SNES_VIDEO` explicitly (boot service flow,
  main owner and startup callers, transition caller, tools/lift-compare.mjs);
  tools/explore-live.mjs passes the option on. The proof room replays
  (proof/video/room-observed.mjs) keep their own PPU bus.
- Evidence: block check 449/449 in 509 seconds; the slow live tests (cold start, save
  anywhere, alley bus, matrix) 9/9 on the picture back end.

## Step 7: the sprite list as typed state (2026-11-25)

- src/state/sprites.mjs is the first producer: the OAM buffer 7E:3D08-3F27 becomes
  typed fields per sprite (x, y, name, attributes) and the size bytes of the high
  table. Live play detaches it like the other subsystems; byte writers of the object
  pass (src/game/object-sprites.mjs, sprite-list.mjs) reach the fields through the
  shared byte boundary, and proof/state/to-wram.mjs projects them back, so the game
  state hash keeps its layout.
- The game NMI's OAM job (81:A98E) hands the table to the video interface. The
  picture back end, whose own sprites are now the same typed fields, copies them
  without a byte transfer; the SNES back end ignores the table and transfers the same
  bytes from memory. Scene code OAM transfers (81:ED8B) keep the byte path.
- Evidence: tools/sprite-state.test.mjs (single owner, byte aliases, projection, and
  table versus byte transfer on both back ends); block check 5059/5059 in 583 seconds,
  golden traces unchanged.

## Step 8: the PPU register model moves to proof (2026-11-25)

- ppu-state.mjs, ppu-frame.mjs and hdma.mjs moved from src/video to proof/video
  (decision 3 of [STATE-MODEL-REBUILD.md](STATE-MODEL-REBUILD.md)). src/ imports
  no PPU model.
- proof/video/snes-video.mjs is the SNES back end object for LiveGame: `bus`,
  `screen`, `render` and `watch` (raster write and data write counts, the text
  read-back's WRAM write). Register-level comparisons pass `video: SNES_VIDEO` from
  there; LiveGame's own default stays the picture back end.
- The register-writing VideoPort (src/video/video-port.mjs) stays in src as
  compatibility code for the recorded comparisons, like the phase 4 boundary.
- Evidence: block check 1796/1796 in 602 seconds; boundary and core tests 33/33.

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
- Character and map memory are still VRAM bytes (in the PPU model or the picture
  state).
- The picture back end does not prove that every value a frame reads was written
  (the SNES back end's known flags); its memories start at zero.
