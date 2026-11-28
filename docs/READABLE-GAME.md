# Readable, system-agnostic game

User decisions of 2026-11-27. This plan follows the state model rebuild
([STATE-MODEL-REBUILD.md](STATE-MODEL-REBUILD.md)) and the removal of the register-level
code ([REGISTER-COMPAT-BOUNDARY.md](REGISTER-COMPAT-BOUNDARY.md)).

## Goal

The product code (`src/`) knows nothing about the SNES: no WRAM or ROM addresses, no
banks, direct page words or data bank, no hardware registers and no SNES concepts such
as DMA, HDMA channels, OBJSEL or VRAM word addresses. All game data and content are
readable records, tables and arrays, addressed by name or index. The code is plain game
logic that a person can follow and that ports to simpler systems (for example Amiga or
C).

Knowledge of the original layout stays in `tools/` only: the extractors that turn the
ROM into assets, and the projection that maps the game state back to the original
layout for the golden traces.

## Starting point (measured 2026-11-27)

- 453 modules, 55,220 lines in `src/`.
- 1,253 ROM address literals in code (comments excluded) in 127 files; the largest are
  the lookup tables, the native target tables (146 entries each), line of sight and the
  game NMI.
- 158 files import the 707 WRAM address constants of `src/data/wram.mjs`; 389
  direct page constants (`DP_…`).
- 27 files use hardware registers.
- The content is decoded in `assets/` (60 files: rooms, objects, kinds, texts,
  palettes, pictures, portraits, sound, …), but `src/data/cartridge.mjs` writes it back
  into a ROM address image, and the code reads it through addresses.
- The 937 scripts run as bytecode on an interpreter; natives are found by their ROM
  entry address.

## Decisions (2026-11-27)

1. **Reference: golden traces only.** The golden traces (tools/golden/) stay binding
   through a projection in `tools/` that maps the new state to the original layout. The
   frozen lift and caller vectors (tools/lift-vectors/) and the register forms that serve
   them are given up; paths the traces do not reach are no longer compared.
2. **Save files stay `.srm`-compatible**, through one serializer between named fields
   and the file's bytes. No other code knows the save format.
3. **The scripts are decompiled now** into readable code; the bytecode interpreter,
   task frames and native tables by address go.
4. **Pilot: the dialog** with portraits and windows, as the pattern for every later
   subsystem.
5. **No references to WRAM, ROM or hardware** in `src/` (user, 2026-11-27).
6. **Platform boundary** (user, 2026-11-27): game logic and data in `src/` are
   agnostic; the platform layer (renderer, audio player, input) implements the drawing,
   sound output and input for its system. The browser renderer keeps reproducing the
   original picture from tiles and palettes, so the golden pictures stay pixel-identical;
   another system (Amiga) would bring its own platform layer. The SNES presentation
   layer lives in `src/platform/`: the game calls it in neutral terms (show these
   portraits, open the portrait window this far), and it turns them into the original's
   video memory, HDMA tables and register writes. tools/agnostic-counts.mjs counts it
   apart and the ratchet does not limit it.
7. **Audio is sample-identical** (user, 2026-11-27): music and effects become note
   sequences, instruments and samples played by a neutral mixer that reproduces the
   original filters, envelopes, pitch interpolation and echo; the golden audio check
   compares the mixed samples.

## Golden traces during the rebuild

- Binding: the picture (rendered pixels), the game state through the projection, and
  the save data.
- The video memory hash becomes diagnostic once the presentation no longer has video
  memory (phase 5); the audio hash stays binding until the audio phase decides its
  replacement (see open decisions).
- Pokes of the test plans (WRAM writes) go through the projection's named fields.
- A deliberate difference is recorded in [BUGFIXES.md](BUGFIXES.md) and the trace is
  recorded again in the same block, with the reason in the commit.

A ratchet test counts the remaining address literals, WRAM constant imports, `DP_`
names and hardware register imports in `src/`; the counts may only fall.

## Phases

0. **Clear the old references.** Delete the frozen vector tests, tools/lift-vectors/,
   the register forms and the harnesses only they use. Add the ratchet test.
1. **Pilot: dialog.** The dialog records, portraits and topics as readable data; the
   dialog state (current record, portraits, windows, topic list) as a state object; the
   portrait window and its opening animation as a neutral presentation element (a
   rectangle that opens and closes) instead of HDMA tables and window registers. The
   module `src/system/native-dialog-portrait.mjs` disappears.
2. **Scripts.** A decompiler in `tools/` turns the 937 scripts into readable code with
   named variables and calls of named game functions; the interpreter, opcodes, task
   frames and native tables go. The scheduler runs the decompiled scripts as
   coroutines.
3. **Game state.** The remaining WRAM state moves into named state modules (objects,
   party and runners, rooms and camera, windows and text, combat, matrix, front end,
   timers and flags). The save serializer maps the saved fields to the `.srm` format.
4. **Data.** The code reads the decoded records directly (rooms, objects, kinds,
   actions, pictures, palettes, texts, tables); the cartridge address image goes.
5. **Presentation.** The frame description uses neutral terms: tile layers, sprites,
   palettes, screen rectangles (windows), fades and colour effects. SNES modes, VRAM
   addresses and register writes go.
6. **Input.** Pad bits become named buttons.
7. **Audio.** See the open decision.

Each phase is split into subsystem blocks with `npm run test:block` and the golden
traces; release and push as in [WORKFLOW.md](WORKFLOW.md).

## Open decisions

- None.

## Progress

- 2026-11-27: plan and decisions recorded.
- 2026-11-27, phase 0: the 92 frozen vector tests (14,400 lines) and tools/lift-vectors/
  (1.2 MB) are gone, with 40 register-form modules that only they used; the harness keeps
  the side and outcome helpers. The fast suite has 957 tests, among them the ten golden
  traces. tools/agnostic-counts.mjs measures the remaining references, and
  tools/agnostic-ratchet.test.mjs keeps them from growing: 1,253 ROM address literals,
  158 WRAM layout imports, 27 hardware register imports, 2,416 direct page names and
  2,946 addresses in comments.
- 2026-11-27, phase 1 step 1 (dialog flow): the dialog reads its records from a content
  layer (`src/content/dialogs.mjs`, `src/content/texts.mjs`: portrait, music, mirror,
  entries with key, topics, script and text, the menu and topic names) and keeps its
  state in `src/state/dialog.mjs` (end word, record flags, windows, partner, topics).
  `talk` takes the partner and dialog number as arguments; windows, text and menus go
  through named entries (`openWindowAt`, `releaseWindowAt`, `setWindowTextArea`,
  `printTextIn`, `chooseFromList`). The portrait and screen work sits in
  `src/game/dialog-screen.mjs` for the next steps. The scratch mask gained the direct
  page long pointer 41 to 43 (a local of several routines; traces re-recorded with the
  old code first). Ratchet: 1,248 ROM literals, 157 WRAM imports, 2,326 direct page
  names, 2,888 address comments.
- 2026-11-27, phase 1 step 2 (portraits and portrait window): the presentation layer
  `src/platform/` begins with the portrait tiles (unpack, row shift, VRAM uploads, the
  dialog's `showDialogPortraits`), the portrait window (`beginPortraitWindow`,
  `setPortraitWindowOpening`, `endPortraitWindow`) and the dialog's screen effects
  (`clearColourEffect`, `hidePortraits`, `restoreFont`).
  `src/system/native-dialog-portrait.mjs` is gone. The game side keeps only the window's
  opening (2 to 32 in steps of 3, closing from 31) and the order of the dialog's screen
  steps. Ratchet: 1,212 ROM literals, 153 WRAM imports, 26 hardware imports, 2,319 direct
  page names, 2,850 address comments.
- 2026-11-27, member portrait: the status and spell menus' portrait goes through
  `showMemberPortrait` and the member window of the presentation layer.
- 2026-11-27, phase 2 step 1 (scripts decompiled and running):
  `tools/decompile-scripts.mjs` turns the 937 scripts into generator functions in
  `src/scripts/` (32 files of 32 scripts, about 31,000 lines; `index.mjs` by number,
  `natives.mjs` the native calls by name, `runtime.mjs` the word arithmetic and the
  original's comparison quirks). The operand stack becomes expressions, locals become
  variables (seven scripts that read a local at two widths keep a byte array), local
  subroutines nested functions, and jumps structured code along the dominator tree
  (N. Ramsey, "Beyond Relooper"). All scripts have reducible control flow and no stack
  value across a jump. The scheduler runs the generators (`stepTask` in
  `src/script/tasks.mjs`); the bytecode interpreter moved to
  `tools/script-interpreter.mjs` as the reference. `tools/decompile-scripts.test.mjs`
  runs every script 16 times on both, with arguments, native results and first state
  reads steered by the script's own constants, and compares calls, state writes and
  results (about 85 to 90 percent of the bytecode is reached; long AI loops stay partly
  unvisited); it also checks that `src/scripts/` matches the decompiler. All ten golden
  traces and the slow replays pass unchanged. Dropped frontiers: the interpreter's
  endless-loop guard and the operand stack and local call depth checks (no script
  reaches them). Task identity is the script number (`tasks.script`), not the bytecode
  address. Next: names for locals, arguments and state from what the scripts do; script
  calls by name; `src/script/codec.mjs` and the opcode table leave `src/` with the data
  readers that still decode bytecode.
- 2026-11-27, phase 2 step 2 (decompiler output tidied): expressions carry the variables
  they read and the calls the variables they may change, so a pending value becomes a
  temporary only when the next statement or a call before it could change it (`const t =
local1` and argument copies are gone; a word stored and tested reads back from the
  local, `x = word(x - 1); if (x === 0)`). Jumps that fall through to where they lead go
  (a break at the end of its block, a continue at the end of its loop, a plain return at
  the end of a subroutine), empty branches go and an empty then turns its condition;
  `truth(a) & truth(b)` becomes `a && b` when b has no call. The natives table lists the
  183 natives some script calls, all by name (the factory-made ones from the names in
  `src/script/native-targets.mjs`). Every state access in the scripts has a name: the
  spell effects 1D6F to 1D72, the circling leader flag and nine bytes of Jake's runner
  record joined `src/data/wram.mjs`. `src/scripts/` shrank from 31,700 to 26,400 lines.
  Next: names for the 87 scripts other scripts call and for arguments and locals.
- 2026-11-27, phase 2 step 3 (names in the scripts): 44 of the scripts that other
  scripts start have names (tools/script-names.mjs: leaveBody, waitUntilDefeated,
  walkToWaypoint, goToRoom, giveWeapon, lockedDoor, usePhone and more); scripts start
  them through the generated table `run` in `src/scripts/started.mjs`
  (`yield* run.leaveBody(object)`), the others keep their number (`run.script045`).
  Constant text numbers, topics and object kinds carry their text as a comment
  (`notice(..., 0x9b /* "This door is locked." */, ...)`, `addTopic(7 /* "Cortex Bomb" */)`,
  `createObject(0x78 /* "Jester Spirit" */, ...)`). Locals passed first to a game
  function on objects are named `object` (the one from the first argument), `created`
  (from createObject) or `object2`; counters that count down are `count`. The remaining
  unnamed scripts are mostly fight behaviours with parameters.
- 2026-11-27, phase 2 step 4 (events and parameters): a wait names the task events it
  ends on (`EVENT` in `src/scripts/runtime.mjs`: TIMER, TALK, ARRIVED, ANIMATION_END,
  the glove actions PICK_UP to MOVE_TO and DEFEATED, from the action menu, the motion
  and animation ends and the defeat, when the count of its record falls to 0), in its
  mask and in tests of its result (`wait(EVENT.DEFEATED | EVENT.TIMER, 0xc) &
EVENT.DEFEATED`). The 37 most used game functions have parameter names (PARAMETERS in the decompiler; `natives.mjs` shows them as
  signatures, `notice(left, top, columns, rows, attributes, text, frames)`), and a local
  handed to one takes its name. 61 of the 158 started scripts are named, among them the
  doors (openDoorOnRequest, closeDoorOnRequest, closedDoor, openDoor). About 3,400
  plain locals remain.
- 2026-11-27, phase 2 step 5 (bytecode out of src/): the script codec and the opcode
  table moved to `tools/script-codec.mjs` and `tools/script-opcodes.mjs`; nothing in
  `src/` decodes bytecode any more. The scans for fillers and unreferenced scripts
  (`tools/filler-scan.mjs`, `tools/orphan-script-scan.mjs`) went with them; the game
  places those bytes from the assets with bounds checks only, and
  `tools/orphan-scripts.test.mjs` checks that the asset holds complete scripts. Ratchet:
  1,194 ROM literals, 2,807 address comments.
- 2026-11-27, phase 2 step 6 (actors, defeat, more names): the task event 800 is
  DEFEATED, not a hit: object-hit sends it only when the count of the target's record
  falls to 0. Constant actor numbers (byte offsets of the seven-byte actor rows) carry
  the name of their kind as a comment (`isActorStateProperty(0x8b2 /* "Me" */, 0x15bd /*
"Detonator" */)`). A call result stored and kept is assigned directly
  (`local = yield* game.wait(...)`), and a local that only holds wait results is named
  `events`, its tests by event. 91 of the 158 started scripts are named; new are the
  ending (script variable 2C counts its 13 scenes, playEndingScene and endingScene1 to
  13), NPCs that talk or strike back, item scripts (combineTimeBomb, playPickUpSound)
  and fight rounds (shootRound, standAndShoot, chaseAndFight). Script variables other than
  2C are per-room scratch words (2A counts the active spawned fighters in their rooms and
  holds other values elsewhere). The 67 unnamed ones are longer fight behaviours.
- 2026-11-27, phase 2 step 7 (fight behaviours named): 138 of the 158 started scripts
  have names. A feature pass (karma, waypoints, chasing, shooting, created kinds, texts,
  callers) sorted the long ones into patrols (patrolAndShoot, guardRoute,
  approachUntilInRange), spawned fighters (spawnedGunman, spawnedBrawler), creatures
  (waveSwarm, orbiterAttacks, waterCreature), runners (offerToHire, hiredRunner,
  isRunnerActor) and places (rideToNextStop, passingVehicle, dataTerminal, buyFromCase,
  phoneCall). Variants of one behaviour with other constants carry a letter (B to F).
  The 20 unnamed ones are short helpers whose action and direction numbers have no
  established meaning yet.
- 2026-11-28, phase 3 step 1 (script state): all 41 direct state operands of the
  decompiled scripts use named, typed fields (`state.room.number`,
  `state.jake.spells.heal`, `state.combat.aimingWeapon`). `src/state/scripts.mjs`
  shares the existing owners' independent arrays with game functions, masks byte and
  word writes, and preserves the high byte on byte writes to word fields. The view is
  cached per game, with no field-name lookup or allocation per access. The decompiler's
  address-to-field projection lives in `tools/script-state-fields.mjs`; an unrecognized
  operand or width stops generation. Raw diagnostic fixtures temporarily use a schema
  bridge; the state owners' original schemas and other consumers remain for phase 3.
  Original-source check of the handoff's Leadership/Skillsoft question: both uses are
  real. In the European ROM, 80:E90D and 80:E971 read 7E:3C05 for the notes window's
  Skillsoft row; the six skill labels at 80:E8BC name record byte 10 Leadership.
  Jake's record begins at 7E:3BFB, so these uses alias. The new field is
  `jake.leadership`; the existing Skillsoft note keeps sharing it. No behaviour or
  recorded trace is changed, and no separate cyberware flag is invented.
- 2026-11-28, phase 3 step 2 (save serializer): `src/storage/srm.mjs` is the single
  codec for saved game fields, slot offsets, both checksums and global settings.
  Saving, title loading and the browser's slot descriptions use it. It serializes
  every byte from the scene and combat owners by field name, including odd word
  positions, interleaved equipment, actor records, script scratch words and topics.
  `src/state/saved-game.mjs` bridges the current owners; live games use independent
  arrays, raw fixtures keep a temporary schema bridge. No save operation needs the
  cartridge's slot-offset table or copies a work-memory range. The two original
  slots, optional slots 3/4, padding, global options and completed-save notifications
  keep their behaviour. Invalid slot numbers and short images fail before mutation.
  The global settings view is cached and preserves existing complete-word consumers
  during migration. Legacy, unused address declarations remain in data/wram.mjs until
  its phase 3 cleanup. Ratchet: 1,192 ROM literals, 150 WRAM imports, 26 hardware
  imports, 2,313 direct page names and 2,776 address comments.
- 2026-11-28, phase 3 step 3 (party records): membership, scene creation, targeting,
  status displays, runner recovery and matrix entry use cached named member records
  (kind, number, position and object slot). No game consumer imports the group layout
  constants. Scripts and saves share the existing independent arrays. Removal keeps
  the extra copy after the last member, including adjacent saved fields. The party
  bridge provides ordinary member indices; unmigrated callers temporarily retain a
  doubled lastIndex, which the later consumer cleanup must remove. The original state
  schemas and raw fixture bridge remain a phase 3 boundary. Ratchet: 1,192 ROM literals,
  149 WRAM imports, 26 hardware imports, 2,313 direct page names, 2,767 address comments.
- 2026-11-28, phase 3 step 4 (runner equipment): equipping, unequipping, shots,
  aiming, scene creation and the equipment display use cached runner records with
  named armour and weapon fields. New-game initialization takes named default records
  through the content boundary. Magic points share the same record and saved owner.
  The extra unequip scan row still aliases the first magic bytes, and both the original
  weapon-default bug and its optional correction retain their behaviour. The content
  reader and the selected member's legacy index remain temporary migration bridges.
- 2026-11-28, phase 3 step 5 (runner attributes and resources): Jake's attributes,
  six skills, six spell levels and three portrait/cyberware flags have a shared named
  view. New Game, cheats, armour bonuses, portraits, health bars, karma health increases
  and notes use it. Leadership still shares the Skillsoft byte. The unidentified fourth
  attribute stays untouched by New Game. Runner records provide the other runners'
  immutable named stats through the content boundary. Recovery and shot bonuses use
  them; every magic-point consumer now uses named runner resources. Word arithmetic,
  byte truncation and optional cheats retain their behaviour. Status/skill/spell menus
  and karma choices still use indirect record pointers; their migration belongs with
  the window/menu and content work. Native return metadata and raw-fixture aliases
  remain temporary boundaries, alongside the legacy state schemas.
- 2026-11-28, phase 3 step 6 (party formation): the leader's trail and followers use
  named step records, ordinary step indices and a moving flag. The frame loop records
  movement; room entry clears only the first X/Y and all heights, as before. Follower
  spacing comes from named content. Ring wrap, hits that suspend recording, the empty
  height marker, directions and walking/standing selection retain their behaviour.
  The temporary state bridge keeps unaligned and overrun aliases. It also distinguishes
  a missing party slot's low-mirror alias from the member number's long alias.
  Ratchet: 1,192 ROM literals, 147 WRAM imports, 26 hardware imports, 2,307 direct page
  names and 2,736 address comments. The original state schemas, doubled indices of
  other consumers and indirect menu records remain migration work.
- 2026-11-28, phase 3 step 7 (member status displays): a shared named menu state
  owns selection, portrait, datajack, health and window handles over the existing
  independent storage. Status attributes and party maxima read runner records; labels
  and rows come from named content. Equipment uses the same selected member, retaining
  odd-index aliases. Status no longer reads or walks a member-record pointer. A temporary
  producer supplies the old skill/spell consumers until their next blocks. The content
  boundary retains the missing runner row for raw diagnostic fixtures. Ratchet: 1,192
  ROM literals, 147 WRAM imports, 26 hardware imports, 2,276 direct page names and
  2,694 address comments.
- 2026-11-28, phase 3 step 8 (skills and notes): the skill display reads the selected
  runner's named skills and content labels; it has no member-record pointer input.
  Skills and notes open and release windows by handle, retaining the nonzero-skill
  filter, Select-to-close behaviour, datajack handling and Leadership/Skillsoft alias.
  Translated skill widths use the same named labels. The state bridge supplies the
  original compatibility cursor for the still unmigrated spell menu and golden metadata.
  Ratchet: 1,191 ROM literals, 146 WRAM imports, 26 hardware imports, 2,254 direct page
  names and 2,678 address comments.
- 2026-11-28, phase 3 step 9 (member spells): spell menus build named choices from
  runner spell levels and content definitions (name, level text and both scripts).
  The game code neither walks a member-record pointer nor reads the selected-level
  reference. A state bridge serializes the legacy choice columns and saved selection;
  casting rereads the current named level. Raw caller fixtures retain their explicit
  record argument; unusual levels and the original address carry retain content aliases.
  Jake selection, other runners' nested scripts, status-only mode, notices, portrait
  redraw and translated windows retain their behaviour. Ratchet: 1,189 ROM literals,
  145 WRAM imports, 26 hardware imports, 2,219 direct page names, 2,651 address comments.
- 2026-11-28, phase 3 step 10 (karma upgrades): named upgrade records connect labels,
  limits and Jake's attribute/skill/spell fields. The purchase checks its complete cost
  before mutation; the UI still excludes zero and capped values. Body health increases,
  health/magic refill, failed-purchase notices, translated window fitting and numbered
  choices retain their behaviour. Source table locations moved to tools/karma-source-layout.mjs
  for the extractor. The shared choice API accepts named numeric values and a selected
  row. Counts and the selected row are ordinary game values; only an actual change
  in the available row count resets the selection. Source check: DP_CURSOR_ROW is 04,
  DP_KARMA_PREVIOUS_ROW_BYTES is 1D; they are independent. Live status, skills, spells and karma no longer
  read member-record or upgrade pointers; compatibility serialization, raw fixtures,
  shared renderer workspace and the original state schemas remain migration boundaries.
  Ratchet: 1,165 ROM literals, 144 WRAM imports, 26 hardware imports, 2,158 direct page
  names and 2,610 address comments.
- 2026-11-28, phase 3 step 11 (inventory and item use): inventory reads named actor,
  kind and saved actor-record fields. Story stage, item class and holder remain separate
  filters, actors retain reverse order and single/zero counts remain unnumbered. Shared
  menu rows retain their original aliases, including rereads of class/member per actor.
  Item use creates the actor at the member's coarse position through a named creation
  entry, completes number/depth/record fields before the nested task visit and preserves
  notice/portrait/equipment cleanup. Creation workspace stays in its existing adapter;
  actor record identifiers and the data readers remain temporary migration boundaries.
  Ratchet: 1,163 ROM literals, 144 WRAM imports, 26 hardware imports, 2,146 direct page
  names and 2,591 address comments.
- 2026-11-28, phase 3 step 12 (shared menus): navigation and list drawing share named
  selection, page, repeat, input and rendering state. Caller list/number arguments and
  doubled row offsets remain in a temporary bridge. Texts and values are reread for
  every row, with the caller's current data bank. Item menus now use the shared choice
  and window APIs; their existing member row storage is read live without rewriting
  terminators after window opening. This retains long-list aliases. Window records
  provide named columns/rows for corner marks and are shared with the next window block.
  Ratchet: 1,163 ROM literals, 142 WRAM imports, 26 hardware imports, 2,073 direct page
  names and 2,560 address comments.
- 2026-11-28, phase 3 step 13 (notice lifecycle): show, replacement, expiry, release
  and game-screen reset share four named notice records and effect duration. Free-slot
  search, equal-minimum replacement order, zero-duration wrap, translated pages and
  cursor restoration retain their behaviour. Reset clears window handles without
  clearing stale durations. Text-bank validation and effect arguments live in content;
  confirmation reads named input. Caller argument fitting and serialized shown.slot
  stay explicit compatibility boundaries. Ratchet: 1,160 ROM literals, 140 WRAM imports,
  26 hardware imports, 2,049 direct page names and 2,542 address comments.
- 2026-11-28, phase 3 step 14 (window management and text cursor): allocation,
  release, notice/glove cleanup, cursor positioning and decimal digits use named window,
  manager, glove and text-buffer fields. Clamp quirks, no-free-window result, tile wrap,
  active-window holes, relative text area widths and byte/word truncation are retained.
  The existing hardware arithmetic, access sites and upload/wait protocol are unchanged;
  they remain the phase 5 presentation boundary. Legacy caller arguments, opaque handles,
  original state schemas and raw fixtures still use explicit bridges. Ratchet: 1,160 ROM
  literals, 138 WRAM imports, 26 hardware imports, 2,014 direct page names and 2,514
  address comments.

- 2026-11-28, phase 3 step 15 (window list rendering): border and text map drawing
  use named window records, map cells and drawing workspace. Active-window holes,
  the first/last range, live tile-range rereads, word-loop wrap and upload request
  waits retain their behaviour. Shared scratch and out-of-span aliases stay in a
  cached compatibility view; hardware map presentation remains phase 5 work.
  Ratchet: 1,160 ROM literals, 137 WRAM imports, 26 hardware imports, 1,986 direct
  page names and 2,508 address comments.

- 2026-11-28, phase 3 step 16 (text decoding and measurement): the decoder,
  text-buffer writes and width measurement share named state. Bit refill order,
  source-pointer/bank overlap, paired characters, translated replacements and
  the second-character width-table index's retained high byte are preserved.
  Encoded tree/glyph readers, caller arguments and compatibility scratch remain
  explicit migration boundaries. Ratchet: 1,160 ROM literals, 135 WRAM imports,
  26 hardware imports, 1,974 direct page names and 2,495 address comments.

- 2026-11-28, phase 3 step 17 (text composition and drawing): glyph composition,
  word measurement/wrap, style changes, cursor geometry, mask buffers and upload
  requests use named window and text state. Byte writes retain neighbouring scratch
  bytes; empty line breaks retain the running index's unusual window alias.
  Mask overflow, partial tiles, translated glyph fitting, arithmetic access sites
  and upload waits are unchanged. Encoded font/mask data and hardware presentation
  remain phase 4/5 boundaries. Ratchet: 1,160 ROM literals, 134 WRAM imports,
  26 hardware imports, 1,964 direct page names and 2,481 address comments.

- 2026-11-28, phase 3 step 18 (camera tracking and bounds): player targeting,
  projected position, room-axis clamping and follow speeds use named camera and
  scene state. Missing-player/no-box exits, minimum/maximum order, unsigned axis
  arithmetic, dead zone, speed caps and step rounding retain their behaviour.
  The source box bytes and projected scratch still have compatibility views.
  Encoded box limits, map scrolling/upload and other camera consumers remain
  migration boundaries. Ratchet: 1,159 ROM literals, 132 WRAM imports, 26 hardware
  imports, 1,937 direct page names and 2,475 address comments.

- 2026-11-28, phase 3 step 19 (glove motion and object search): movement, speeds,
  marked-object offsets, projection bases, camera/input reads and name-window state
  share a named glove view. Reverse draw order, restricted-kind filtering, snapping,
  name lookup, translated width and window replacement retain their behaviour.
  Draw-list bounds and shared search scratch remain compatibility bridges; encoded
  kind/runner names and object identifiers remain phase 4 migration work. Ratchet:
  1,159 ROM literals, 132 WRAM imports, 26 hardware imports, 1,905 direct page names
  and 2,462 address comments.

- 2026-11-28, phase 3 step 20 (glove selection and action dispatch): object/number,
  spell and floor choices, script-choice markers, reach notices and task actions
  use shared named glove, camera, window, notice and player state. Borrow chains,
  separate action/choice reach thresholds, late target/task rereads, spell filters
  and result/input ordering are retained. Caller result and projection scratch
  remain compatibility bridges; action-menu rows are the next shared consumer.
  Ratchet: 1,159 ROM literals, 130 WRAM imports, 26 hardware imports, 1,866 direct
  page names and 2,429 address comments.
