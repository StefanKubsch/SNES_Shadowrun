# State model rebuild

User decisions of 2026-11-20 (see [STRATEGY.md](STRATEGY.md)). This plan supersedes
the routine-by-routine lift as the way forward for `src/`.

## Why

Since 2026-11-14 most blocks removed one JSR frame or moved one RTS form to `proof/`.
`src/` got only a little simpler. The limit was the comparison rule: lifted code had to
leave byte-identical WRAM every frame. So `src/` had to keep the SNES memory layout:

- 707 WRAM address constants in [src/data/wram.mjs](../src/data/wram.mjs), imported by 151 files.
- Direct page scratch words such as the old coordinate at 7E:006B in
  [object-move.mjs](../src/game/object-move.mjs), bank wraparound and data bank cases.
- Program counter checks, `rts()` and a JSL frame for the NMI in the main loop.

That layout is not required by the game. A scan of all 937 scripts (opcodes
`load_state_*` and `store_state_*`) shows that the bytecode reads or writes only
**41 WRAM addresses** directly (pages 01, 0C, 1D, 1F, 2D, 3B and 3C). Everything else
goes through the natives, which are already JS
([tools/script-state-addresses.mjs](../tools/script-state-addresses.mjs) lists them; the
script language has no indirect memory opcodes). Natives that take a WRAM address as an
argument still have to be checked in phase 2. The save block 7E:2DE0-3D07 has a fixed
byte format because of `.srm` files, and the cheats name addresses.

## Decisions (2026-11-20)

1. The comparison rule changes from WRAM bytes to **game state through a projection**,
   plus **golden traces** of the current game.
2. A block is a **whole subsystem**, not a routine.
3. The **picture** also moves away from the SNES: `src/` describes layers, sprites and
   palettes; the PPU model moves to `proof/`. Audio stays on the SNES model.

## Golden traces

The current `src/` is proved equal to the original by the existing oracle and
differential tests. Its behaviour on a fixed set of scenarios is recorded once and
becomes the reference for the rebuild ([tools/golden/](../tools/golden/)):

- The inputs are layout free: the pad word per frame, the stream of random counter
  bytes, and the WRAM writes a test plan makes itself (pokes), each at its frame.
- Each frame stores five hashes: picture, game state (WRAM without the CPU stacks and
  the scratch listed in [MATRIX-LIFT.md](MATRIX-LIFT.md)), video memory (VRAM, CGRAM,
  OAM), audio (sound RAM and DSP registers) and SRAM.
- Every 1000 frames a masked WRAM snapshot lets a failure be located by address.

Binding for every block: picture, audio and SRAM always; game state through the
projection. Video memory is binding until the picture rebuild (phase 5) and then
becomes diagnostic only. A deliberate difference (a bug found, a port correction) is
recorded in [BUGFIXES.md](BUGFIXES.md) and the trace is recorded again in the same
block, with the reason in the commit.

The register-level code in `proof/` is frozen: it is no longer extended or moved. It
stays for the Mesen oracles and is deleted where a golden trace covers the same path
and nothing else imports it.

## Phases

1. **Golden traces** (this block): recorder, replay test and the first scenarios.
2. **State model and projection**: a typed game state in `src/` (objects, party, room,
   camera, windows, flags), a small named byte store for the 41 script variables and
   the save block, and `toWram(state)` in `proof/`. At first the projection is the
   identity; each subsystem moves its fields out of WRAM.
3. **Subsystems**, one block each, in this order: objects, movement and collision;
   camera and tile maps; windows, text and menus; combat; scene and room changes;
   matrix; cutscenes, intro and title.
4. **Control flow**: one plain frame loop (`update`, `endOfFrame`), script tasks as
   coroutines; no program counter checks, continuation records or stack frames.
5. **Picture**: `src/` builds a frame description (layers, tile maps, sprites,
   palettes, colour effects) and a renderer draws it; the PPU register model moves to
   `proof/` as a reference.

## Cadence

User decision of 2026-11-20: a block is a complete subsystem or phase step with its
own commit after `npm run test:block` and the golden trace test. One shared
`npm run verify:release` and push after every two to three subsystem blocks.

## Known risks

- Original behaviour that depends on the layout, such as the keyword overflow that
  overwrites flags ([BUGFIXES.md](BUGFIXES.md)) or reads of uninitialized memory, is
  modelled on purpose or documented as a port correction.
- Cheats, the debug room warp and `.srm` saves address WRAM; they go through the
  projection's named fields.
- Scenario coverage is finite. A path no trace reaches keeps its existing
  differential test until a trace covers it.

## Progress

- 2026-11-20, phase 1: golden traces recorded (tools/golden/, five scenarios).
- 2026-11-20, phase 2 started: [src/state/objects.mjs](../src/state/objects.mjs) names
  the object fields (position, velocity, height, diagonal, flags, collision box, motion
  target) as arrays indexed by entry; for now they are views onto the original WRAM
  arrays. The move ([object-move.mjs](../src/game/object-move.mjs)) and the collision
  tests ([object-collision.mjs](../src/game/object-collision.mjs)) use them and keep
  their box, result and old coordinate in locals instead of direct page words.
- Finding: direct page 7E:006B-006C is a local word of several routines (the move, the
  sprites, palette slots, scene objects), each writing it before reading it; it joined
  the golden SCRATCH list. Poisoning the whole direct page every frame is not possible:
  it also holds state across frames (the NMI callback pointer) and locals live across
  blocking waits, so scratch is decided per routine, with the golden traces as the
  check.
- record.mjs keeps inputs, picture, video, audio and SRAM of an existing trace unless
  `--accept` is given, so a longer SCRATCH list is recorded again without risk.
- 2026-11-20, object fields: every word-aligned object array is named in
  src/state/objects.mjs; about 45 modules use its accessors, which keep the original's
  access for values that are no slot.
- 2026-11-20, object field migration completed: animation, glove search, markers,
  screen initialization, object creation and release, swarm movement and every object
  number consumer use the named table. The number is a word at 7E:150A, aligned like
  the other fields. Invalid slots retain the caller's original access family
  (low mirror, raw WRAM, data bank or long address). Storage is still backed by WRAM;
  detaching it and defining the projection, including the matrix overlays and indirect
  address consumers, is the next phase step.

- 2026-11-20, detached object storage: the normal LiveGame loop imports the initial
  bytes once into independent Uint16Array fields. Raw proof fixtures and the injected
  reference loop keep WRAM views. The product does not maintain a byte mirror of the
  object arrays. [to-wram.mjs](../proof/state/to-wram.mjs) produces a separate,
  side-effect-free projection for diagnostics and the golden state hashes.
- A shared byte boundary in src/state/objects.mjs resolves the original aliases into
  the detached fields. VmMemory, intro/title/OAM and matrix consumers use it; byte
  writes retain their expression value, and odd words resolve each byte separately.
  The matrix still uses its named legacy offsets through this boundary; its own
  subsystem migration remains later in phase 3.
- Two observed alias cases: formation-trail's FFFF slot reads the previous field's
  bytes through its wrapped low address, and scene-load's resetScenePalettes writes
  DMA setup to 7E:4340/4341 with data bank 7E, temporarily changing a collision field.
  Both remain original behaviour. Nine focused storage tests cover isolation,
  projection and restore, mirrors, odd words, FFFF, assignment chaining, these
  overlays and activation in the shipped live loop.
- Browser recording hashes and live plan drivers read the compatibility boundary.
  Golden snapshots, HDMA cache keys and recorded pokes use the projection; replay
  pokes use memory writes. Existing trace files stay unchanged.

- Storage validation: all five golden traces unchanged; corrected comparison tests
  30/30 and storage contracts 9/9. Both actual-browser checks passed with elevated
  process access after managed-environment Page.enable timeouts before product
  loading. No GPU setting or browser helper was changed. The exact startup
  restriction remains undiagnosed.
