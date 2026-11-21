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

- 2026-11-20, collision storage: src/state/collision.mjs owns independent arrays for
  the static and moving cell heads, node boxes and links, six box coordinates,
  owner words and static end markers in the normal LiveGame loop. Proof fixtures
  keep their byte storage. The schema splits the original table spans at their
  adjacent bases (268 boxes, 1072 nodes); these are storage spans, not new limits
  on original indices. Access beyond a span still resolves through the byte
  boundary, including an alias into another field or the remaining raw store.
- Box owners have a three-byte stride, so every second word is unaligned. Their
  unused intervening bytes remain raw. The scene tile cache overlays the static
  end markers, static heads, moving heads and boxes; its byte and word accesses
  now use the shared state boundary, including horizontally flipped tile reads.
  Unpacking already uses VmMemory writes. Raw WRAM is never refreshed on reads.
- The existing diagnostic projection and snapshot restore include all collision
  fields without changing the register-level reference implementations. Direct
  page scratch and collision algorithms remain unchanged in this storage step.
- Collision storage validation: all five golden traces remain unchanged; 3747
  non-browser block tests passed and the five final storage contracts passed.
  Two managed Edge startup checks stopped at Page.enable before product loading;
  both passed unchanged with the already authorized elevated process access.

- 2026-11-20, camera and tile maps: src/state/camera-maps.mjs owns independent
  camera positions, speeds and box pointer bytes; edge upload flags, destinations
  and buffers; both scene layers; and the tile stack fields and hash heads. The
  normal LiveGame loop detaches them once; proof fixtures remain byte-backed.
- Every camera consumer, the sound pan, marker projection, scene layer clearing
  and tile stack builder use the shared state byte boundary. It preserves reads
  across table ends and the odd three-byte camera box pointer, including the
  low-bank mirror. The diagnostic projection and restore include all these fields.
- Fonts, the odd-addressed menu tilemap, intro maps, prologue text and title
  palettes retain their aliases into the same layer arrays. Their frontend
  consumers already use the shared byte boundary. Tile cache bytes continue to
  alias the collision fields; no second cache copy is introduced. Shape grids,
  wall occlusion data and the scene record remain in the later scene subsystem.
- Eight storage contracts cover every entry and disjoint ownership, projection
  and restore, frontend and stack boundary aliases, the three-byte box pointer,
  wrapped row/column uploads in both directions, clamps and live activation.
- Camera/map validation: eight storage contracts passed; the 152-file block run
  passed 5692 tests and all five unchanged golden traces. Six old raw-layer text
  observations or fixture seeds were migrated to the projection/state boundary,
  preserving all assertions; their four files passed 26/26 tests. The isolated
  save import browser retry passed unchanged after one transient Import missing
  failure. The shared release checks the complete delivery batch before push.

- 2026-11-20, windows, text and menus: src/state/windows-text.mjs owns the window
  slots, geometry, text cursors, styles, activity and tile allocation; the text bit
  decoder, character buffer, window map, mask and DMA requests; notices; dialog
  portrait tables and requests; and menu selection, lists and member display state.
  Only the normal LiveGame loop imports them into independent typed arrays.
- Status, karma, item and spell menus share the same list names, indices, values
  and window handles. Spell sublists and action-menu overrides retain their byte
  aliases, including unaligned words and words across field ends. Portrait edges
  remain bytes of their HDMA tables. The text mask's owned span ends at 7E:2CE0;
  accesses beyond it reach the camera row buffers through the same byte boundary.
- Window, text and menu consumers, number printing, portrait uploads, the glove's
  name window release and magic point spending use the shared state boundary.
  Existing DMA and indirect native accesses already use VmMemory. Projection and
  restore include every new field; raw WRAM does not mirror live writes. Direct
  page workspace, saved topic/flag bytes, frontend layer aliases and algorithms
  retain their existing contracts. The dialog topic choice buffer is independent;
  its overflow still aliases the following fields rather than gaining a new limit.
- Window/menu validation: 5956 passing checks in the initial block selection,
  including all five unchanged golden traces. Six raw test observations were
  migrated to projection or memory reads without changing assertions; their final
  focused selection passed 826/826 tests in 491 seconds. Both browser checks
  passed with elevated process access after managed Page.enable startup timeouts.
  Nine storage contracts and all edited-file ESLint checks passed.

- 2026-11-21, combat storage: src/state/combat.mjs owns fight lists and counters,
  aiming and glove state, group membership and formation trails, selected spells,
  runner equipment and magic points. The normal live loop imports independent
  typed arrays; proof fixtures retain bytes. Shared byte access preserves fight
  list overflow into the music word, equipment's odd weapon words and each row's
  byte fields, group aliases and words crossing the end of a table.
- SRAM save checksums and copies read the shared state boundary; loading and new
  game setup write through it. Saved party, equipment and magic therefore retain
  the original .srm format without a WRAM mirror. Projection and restore include
  every field. Mouse aiming and marker readers use the same live byte boundary.
- Eight combat storage contracts cover ownership and restore, equipment/row/glove
  aliases, fight overflow, hit countdowns and exact save/load SRAM equality.
- Combat validation: the initial block run passed 5824 checks and all five golden
  traces; twelve route checks stopped because their shared driver still observed
  raw glove bytes. Its two coordinate reads now use the shared boundary. The
  affected selection passed 55/55 tests across sixteen files in 431 seconds.
  Eight storage contracts, edited-file ESLint and formatting passed.

- 2026-11-21, scenes and rooms: src/state/scene-room.mjs owns the shape grid,
  unpacked scene record, wall map/heights/tiles, occlusion buffers, scene and object
  palette caches and cycles, tile composition, room requests, room/story state,
  timers and loop exit/reload requests. Storage spans end at their adjacent original
  owners (wall tiles at tile-stack heads, grid at scene record, record at collision
  owner words). These are ownership boundaries, without new index limits.
- The shared saved store is now fully independent: actor records, script variables,
  the leader record and flags, funds, karma, learned spells, topics and topic flags.
  Combat already owns saved party, equipment, magic and spell selection fields.
  Together they cover every byte of 7E:2DE0-3D07. The save checksum/copy/load bridge
  retains the original format; no live saved bytes are mirrored into raw WRAM.
- Remaining game/native/VM helpers use the shared byte boundary, including generic
  record and list access, unpacking, debug warps and main-loop exit checks. Wall
  clearing and new-game script clearing use state fills. Direct page workspace,
  algorithms, hardware jobs and the frozen register reference remain unchanged.
- Frontend random/stripe data and matrix fonts, maps and gauges keep their aliases
  into the scene wall storage. Topic overflow into flags and OAM, spell overflow
  into equipment, and odd grid/record/collision boundary words remain explicit.
- Eight storage contracts cover disjoint ownership, projection/restore, aliases,
  debug-room writes, full saved-byte serialization and new-game unpack/clearing.
- The shared byte boundary now precomputes the owning reader/writer of every
  migrated byte. Raw workspace avoids all subsystem WeakMaps; detached fields
  dispatch directly to one owner. A local host microbenchmark of two million
  workspace reads changed from 137.6 ms to 14.7 ms (raw array reads: 2.1 ms).
  These are access timings, not a bound on whole-frame performance.
- Diagnostic projection copies cached contiguous field byte views on little-endian
  hosts; the explicit little-endian loop remains for other hosts and strided
  fields. All 47 storage contracts across the six state modules passed, including
  odd collision owners and projection/restore of every migrated entry.
- The paired owner test now injects loop exit/reload through VmMemory. Its old raw
  poke never reached detached flags, retaining unmatched full-frame snapshots and
  eventually causing allocation failures in other parallel workers. The paired
  driver also waits for the slower side instead of accumulating frame history;
  every frame and state comparison and each work budget is retained. The corrected
  owner comparison passed all ten scenarios/budgets in 155 seconds.
- Scene/room final block validation passed 6245/6245 tests without failures or
  skips in 767 seconds, including all five unchanged golden traces. Edited-file
  ESLint and formatting passed. The initial allocation failures and corrected raw
  fixture/observation reads are retained in the local handoff archive.
- The shared release exposed two further raw observations in the slow tier:
  seven-session matrix health write-back and save-anywhere serialized bytes.
  They now read shared bytes or the projection, preserving every health, picture,
  SRAM and state assertion. Both files passed 4/4 slow tests in 226 seconds.

- 2026-11-21, matrix storage: src/state/matrix.mjs owns the remaining matrix
  speeds/positions, animations, text ring, node/scroll/state/combat/memory fields
  and decker bytes. The speed/position spans split at existing object owners;
  persona X ends in the ordinary NMI job words. Matrix records share the ordinary
  draw list, VRAM bank/source/address queues and object-backed DMA records.
- Object-backed type/flag/picture/direction/text prefixes retain their owners.
  Scene wall storage retains the matrix font, system maps, message row, map edit
  ring and gauges. No second matrix copy is introduced. Only normal LiveGame
  detaches; fixtures retain bytes. Projection and restore include every new field.
- Seven storage contracts cover every entry and disjoint ownership, odd fragment
  boundaries, ordinary-room queue overlays, ordered DMA and NMI reset, the text
  ring's bank words/wrap, decker byte/word aliases and normal-loop activation.
- Matrix block validation passed 4711/4711 tests across 136 selected files in
  622 seconds, including all five unchanged golden traces. Seven new storage
  contracts, edited-file ESLint and formatting passed.

- 2026-11-21, cutscene/intro/title shared storage: src/state/frontend.mjs owns
  pad edges, display shadows and fades, options, shared random state, the odd
  path/wave/circle workspace and four opaque script bytes at 1D6F-1D72. Intro
  and title objects, scene counters/arguments, palettes/maps/fonts/HDMA and
  frontend random data retain their existing object/camera/window/scene owners.
  No second frontend state copy is introduced; existing consumers use shared bytes.
- Twelve storage contracts cover every entry and restore, frontend aliases,
  pad transitions, four fade limits with high bytes retained, scripted-motion
  aliases and odd cross-owner words, and normal-loop activation. An audit over
  all 937 script bodies proves all 41 direct script addresses (including both
  bytes of word operands), and every byte of the fixed save block, have owners.
- Storage remains a bounded phase step: direct page locals, CPU/task continuation
  bookkeeping, audio and video staging are not reinterpreted. Phase 4 is the
  plain frame loop and script coroutine work; phase 5 replaces the PPU-facing
  picture interface. Existing register references remain frozen.
- Frontend block validation passed 4723/4723 tests across 137 selected files in 624 seconds, with no failures or skips. All five golden traces are unchanged; edited-file ESLint and formatting passed.

- 2026-11-21, phase 4, frame orchestration: src/game/frame-loop.mjs provides
  update and endOfFrame sequences for both the main game and attract demo.
  Scene shortcuts and exit/reload decisions are values, not program counters.
  Live frame waits no longer create the main loop's synthetic JSL frame.
- The main driver calls these phases directly and closes the device interval on
  exits as well as ordinary rounds. The boot/owner and script-native bridges
  still retain their compatibility contexts; this is not all of phase 4.
- The former main-loop entry adapter is tools/main-frame-adapter.mjs, outside
  shipped src. Frozen register-level proof equations remain unchanged. Owner
  comparisons report the first differing array value rather than formatting an
  entire nested state diff; every state, video, sound and context check remains.
- Frame orchestration block passed 475/475 selected tests across 51 files in
  377 seconds, including all five unchanged golden traces. Edited-file ESLint
  and formatting passed. Historical links now name the test-only adapter.

- 2026-11-21, phase 4, script coroutines: each task retains one generator across
  script-child calls, counter/event waits and native budget pauses. Resumption
  supplies the result directly to the suspended yield. A WeakMap keyed by the
  task makes slot reuse, reset and replacement by proof imports independent.
- Continuation labels remain diagnostic metadata for frozen proof adapters and
  flow statistics; existing coroutines do not use them to select a resume path.
  Imported tasks already suspended in the original still receive their result.
  List order, child completion, readiness counters, event masks and reentry guards
  retain their existing contracts. Bytecode PC and local call stack describe the
  script language; the native bridge's CPU contexts remain later phase 4 work.
- Two new coroutine contracts cover wait/child results with diagnostic labels
  cleared, slot reuse, and native budget pauses without repeated calls/readiness.
  The existing randomized original-scheduler differential also passes unchanged.
- Coroutine block validation passed 748/748 tests across 44 selected files in
  282 seconds, including all five unchanged golden traces. Edited-file ESLint
  and formatting passed. No frozen register-level proof was changed.
