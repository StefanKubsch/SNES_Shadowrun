# Optional corrections to original game bugs

User decision, 2026-11-02: work on the known bugs linked in TODO.MD. Enable
confirmed bug fixes by default in Options and retain the original behaviour
when disabled. Balance changes and exploit prevention remain separate.

## Session settings

**Options → Game** (German: **Spiel**) groups bug fixes, vampire farming
prevention and object highlighting in a compact modal overlay. Four save slots
is in Save/load game. The browser defaults to `bugfixes: true` and `preventExploits: false`.
The second switch is labelled "Prevent vampire farming" because that is its
only current effect. Both preferences persist in `shadowrun.gameplay.1`.
Choose them before starting; they stay fixed while the session runs. Reload
the page to change a running session. An imported save can start a new session
with different choices. Disabling a fix does not undo items already acquired
or rewrite saved story progress.

The configuration has `version: 1`. The worker records the exact configuration;
replay uses it rather than the browser preference. Recordings without this
field use the original behaviour for both switches. Unknown versions or
non-boolean choices are rejected. The retained recording format is
`shadowrun-recording-1`, with the optional `gameplay` field added.
Changing correction behaviour requires a new version; old recordings must
not silently adopt different corrections under the same version number.

`LiveGame` and `Recorder` default to `ORIGINAL_GAMEPLAY` for existing oracle
and tool callers. The browser worker explicitly supplies the product settings.
The original data package is unchanged. Corrections operate on each session's
WRAM through the native routines; the code does not import an IPS patch or
change the generic opcode handlers. Existing source comparisons therefore
still exercise the original equations with corrections disabled.

Implementation: [bugfixes.mjs](../src/game/bugfixes.mjs),
[start.mjs](../src/browser/start.mjs),
[game-worker.mjs](../src/browser/game-worker.mjs),
[recording.mjs](../src/browser/recording.mjs).

## Sources and boundaries

The research started with [Bugs and fixes](https://gamefaqs.gamespot.com/boards/588651-shadowrun/55871355).
Pages 1 and 4 were accessible; the user confirmed page 5 contains no further
material. The thread mixes defects, balance proposals and regional differences.
The [later patch regression report](https://gamefaqs.gamespot.com/boards/588651-shadowrun/62014131)
also documents a spell crash introduced by an old fan patch.
The [Akimi report preserved by Glitch Gamer](https://www.glitchgamer.com/shadowrun-snes)
provided an arrival scenario, not proof of our runtime's state layout.

The implementation evidence below is the decoded European data and the
existing source-proved native equations, for ROM SHA-256
`91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690`.
No North American, beta or Japanese ROM offsets are transplanted.
These are game-state corrections; no new hardware or timing premise is needed.

### Returning a borrowed weapon

- Original entries: native 75 at `80:9D15`, native BC at `80:9CE4`, the latter
  calling `80:9D50`. Implementations:
  [native-9d15.mjs](../src/script/native-object-record-property-equip.mjs) and
  [native-9ce4.mjs](../src/script/native-record-property-equip.mjs).
- The defaults have 13 rows of eight bytes at `80:97A9`, decoded in
  [vm-runners.json](../assets/vm-runners.json) and described in
  [runners.mjs](../src/data/runners.mjs). Bytes 3-4 are the weapon object,
  5 its kind, 6 its damage and 7 its signed range.
- Both removal paths read the default object from `97AC+X`, but then store
  to `97AE+X` and `97B0+X`, instead of loading those fields. Those stores
  have no effect on ROM, as already established by the native source proofs.
  The stale object word instead reaches the runtime kind/damage pair at
  `7E:3C33+X`, and its low byte becomes the range at `7E:3C35+X`.
- For Norbert, object `0196` consequently becomes kind `96`, damage `01`
  and signed range `96` instead of kind 1, damage 6 and range 3.
  The consumer `80:8860` in
  [native-8ab5.mjs](../proof/replay/native-object-shoot.mjs) reads these runtime fields.
- With fixes enabled both paths restore all five weapon bytes from their
  own default row. Armour and other runners are unchanged. Empty defaults
  remain empty; equipment values are not rebalanced.
- Existing already-damaged equipment is corrected when a borrowed weapon
  is next removed; loading a save does not guess which other values to repair.

### Akimi's delayed arrival

- Script `020` hires Akimi through shared script `162`. Script `162` checks
  Charisma against `7E:2DE6` at payment time. Native CBB3 sets bit 80 of
  actor `1B6D` (record `7E:3404`) for the paid reservation.
- The arrival proxy is script `38C`, bytecode at `9E:F44B`. It checks bits
  80 and 40, plays the arrival, sets bit 40, releases the proxy, then calls
  native `80:A1E6` to append Akimi. It does not recheck party capacity.
- `2DE6` is the last WORD index including Jake. The parallel columns at
  `2DE8`, `2DF0` and `2DF8` contain four entries each. A full party has
  index 6. Appending at index 8 overwrites the next column. The physical
  limit is four total party members, including Jake.
- With fixes enabled, the native CB2B flag read suppresses the reservation
  bit only for this arrival proxy while no place is available. The original
  harmless exit releases the proxy. The stored reservation, money and roster
  remain unchanged. Revisiting Daley Station with space retries the arrival.
- The capacity check uses the original Charisma thresholds: one follower
  through Charisma 3, two at 4-5, three at 6, plus the physical bound.
  The current task frame identifies the script by its three-byte pointer;
  other reads, especially the video phone menu, still see the reservation.
  No recurring input polling or per-frame retry is added.

### Pushkin's required keyword

- Dialog 67 in [vm-dialogs.json](../assets/vm-dialogs.json) requires topic
  20, Head Computer, for action script `393`. It already has another path:
  the response to topic 38, Raitsov, teaches topic 20. Therefore missing
  Head Computer alone does not prove that a particular European save is stuck.
- With fixes enabled, entering this dialog ensures topic 20 is available.
  It inserts into the sorted list at `7E:3CA3` and moves the parallel flags
  at `7E:3CD6`; an existing hidden topic is reactivated. The correction is
  scoped to the actual dialog entry in
  [native-936c.mjs](../proof/replay/native-dialog.mjs), not the start of the game.
  The normal dialog actions, including the Raitsov route, stay intact.
- An unterminated or full topic list is rejected before any write. Other topic
  flags stay attached to their own topics. Reentering the dialog does not
  duplicate the keyword.

### Bulletproof Vest availability

- Actor `18A3` is the Dark Blade shop vest, record `7E:381E`. Script `0C9`
  offers it through generic purchase script `28D`, for 8,000 nuyen.
- The new-game state stream at `8B:FBD2` in
  [vm-lz.json](../assets/vm-lz.json) initializes this record with state
  `0100`, count 0 and holder `FFFF`. Script `28D` sees the unavailable bit
  in the high state byte and refuses the sale.
- The correction clears that byte only for this exact unavailable, unowned
  record. It runs after new-game decompression and after an SRAM load in
  [main-start.mjs](../proof/replay/main-start.mjs). The price, requirements and
  purchase sequence are unchanged. Buying moves the holder through CBF7;
  a held, removed or otherwise changed record is not restocked.
- The SRAM bytes and their validity checks are untouched. The correction
  applies to the loaded WRAM state and is retained on the next ordinary save.

### Ending an aim in the frame of a turn

- User report 2026-11-17: `rom_byte_absent at $80990C` after B (with Down)
  ended a weapon aim; the session recording reproduced it on the next frame.
- With a glove, `80:E12B` first turns the leader to it (`80:DF6B`, `80:AAAF`
  with the leader in DP `00`). A changed direction with a finished animation
  reselects the leader's action through `80:A985`, whose action entry pointer
  overwrites DP `00` (here `88D4`). B, L or R then end the aim at `80:E1A2`;
  `80:E1AA` calls `80:A985` with the idle action without reloading DP `00`.
- The European original therefore indexes the object tables with that
  pointer: `80:A989` and `80:A9BA` read code bytes in bank 80
  (`80:1038 + 88D4 = 80:990C`), some writes reach WRAM through long tables,
  and the leader keeps the aim action until the next one. A Mesen comparison
  (mesen-live-room.test.mjs (removed)) pins this
  original result.
- The ROM-free package held only the code words of the pointers `88C6` and
  `88CE`. It now keeps those of all nine actions of Jake's list (`80:98FE` to
  `990F`, `80:9A5E` to `9A6F`; [ROM-CODE-AUDIT.md](ROM-CODE-AUDIT.md)), so the
  original handling no longer stops.
- The correction reloads the leader into DP `00` first, so ending the aim
  returns the leader to the idle action as intended
  ([player-control.mjs](../src/game/player-control.mjs)).
- Compatibility: the correction needs the gameplay key `aimReleaseFix` besides
  `bugfixes`. Like `instantText` and `fluidControls`, new browser settings get
  it, while recordings without it keep the earlier handling. Earlier sessions
  with corrections could pass this case at the pointers `88C6` and `88CE`
  with the original result, so their replays stay unchanged.
- [player-control-caller.test.mjs](../tools/player-control-caller.test.mjs)
  covers both results and reads every pointer from the package.

### Vampire farming (separate option, default off)

- Actor `0188`, record `7E:36C5`, runs script `386`. After defeat that script
  sets bit 40 through CAB4, completes its death sequence and awards 5,000
  nuyen. That flag is a specific defeat marker, not merely a zero HP guess.
- Jester script `06C`, offsets `06C-071`, executes `push_zero`,
  `push_u16 0188`, `call_native 60` (CB9F), unconditionally clearing this
  state byte. This erases the persistent defeat information.
- With exploit prevention enabled, only a zero reset of this actor with
  bit 40 already set preserves the state and assigns holder `1538`, the
  original removed-object sentinel used by `80:9D7A`. The room initializer
  `80:A3B6` excludes records whose holder is not `FFFF`, preventing another
  instance and payout after the portal. Other actors and nonzero updates use
  the original setter. There is no change to the portal or ordinary respawns.
- A save whose defeat marker was already erased cannot be diagnosed from
  that lost marker; the correction does not infer a past victory from money.

## Investigated without a gameplay change

**Keyword-list overflow (2026-11-17):** the European implementation has 51
bytes between `TOPIC_LIST` (`7E:3CA3`) and `TOPIC_FLAGS` (`7E:3CD6`). The
terminating `FF` leaves space for 50 topics. Neither the script insertion
`80:90EB` ([topic-list.mjs](../src/game/topic-list.mjs)) nor dialog insertion
`80:908C` ([dialog-text.mjs](../src/game/dialog-text.mjs)) checks that bound.
A synthetic list with topics 0 through 49 followed by insertion of topic 50
moves the terminator into the first flag, hiding topic 0. The test
[topic-list-lift-functions.test.mjs](../tools/topic-list-lift-functions.test.mjs)
reproduces that write in the lifted and retained register-level script paths.
This demonstrates memory overlap, not an oldest-first eviction policy.

Marking a topic through `80:913C` sets its parallel flag to `FF`; it does not
delete the stored topic or free space. The topic menu filters marked flags.
The test also checks this distinction. No regular story route reaching 51
distinct retained topics, and no US or German executable comparison, has been
established here. This report therefore remains an investigated storage
boundary; there is no new gameplay correction or save-layout change.

**Examination:** the reports are inconsistent, including the
[original player report](https://gamefaqs.gamespot.com/boards/588651-shadowrun/41338311)
and the [Walkthrough](https://gamefaqs.gamespot.com/snes/588651-shadowrun/faqs/19826).
In our data topic 15 is removed by station cleanup script `158` only when
actor `1F48` has bit 1 set (record `394F`, high byte `3950`). Executing this
script with the condition clear preserves the topic, with both settings.
Dialog 25 also offers it through Datajack. This bounded check does not prove
every story route or reproduce the reported missing keyword; no broad
keyword-purge or Cortex Bomb change is justified by it.

Firearms caps, Runner stat changes and Powerball damage remain balance
questions. No cap of 6, equipment rebalance, spell change or general weapon
sale restriction is included. In particular, the Zip Gun exception must be
considered before changing a Firearms cap. No code from the fan patches is
executed, so their spell-selection changes are not inherited.

## Port corrections independent of the settings

### Portrait upload after a palette cycle step

User report, 2026-11-14: calling Glutman on the videophone stopped the session
with `ppu_dma_source_required` (recording from save slot 1, fault after NMI 38395).
The portrait code 80:8FF5 sets up DMA channel 0 (4096 bytes from 7F:5250 to
VMDATA) and then waits for the NMI, whose portrait job 80:8FBA only starts the
channel. In the same NMI the palette cycle step 81:80C4 runs earlier and
programs channel 0 for itself. The portrait job then starts channel 0 with the
cycle step's leftovers: bank 8B, a source just past the cycle data and a count
of 0, that is 65,536 bytes (Book I, PDF page 151) to CGDATA, which runs through
the I/O area 8B:2000-5FFF. The port's DMA model rejects such a source, and the
portrait would not reach VRAM in any case.

The lifted handler ([game-nmi.mjs](../src/game/game-nmi.mjs), `handleGameNmi`)
writes the portrait's channel setup again (`writePortraitTileChannel` of
[portrait-upload.mjs](../src/game/portrait-upload.mjs)) when a cycle step was
sent and a portrait waits. Without that collision its device writes stay those
of the original. The correction does not depend on `bugfixes`, because the
original outcome reads undefined bus values the port cannot reproduce.
[game-nmi-lift-functions.test.mjs](../tools/game-nmi-lift-functions.test.mjs)
compares the collision case with the register-level handler apart from the
restored setup; replaying the user's recording now continues past the fault
with the portrait's 4096 bytes in VRAM.

### Uninitialized local in script DD

User decision, 2026-11-14 ([SCRIPT-VM-LIFT.md](SCRIPT-VM-LIFT.md)): task frames of
the JS script interpreter start zeroed. The original allocates frames from the heap
without clearing them (80:C2C8). Script DD's loop 71-8D writes local 4 only when the
wait native 9F (mask 0801h, counter 5 frames) ends by event 0800h. After a timeout
it ORs the unwritten local 4 with the distance test (native 0A, `< 100`), so a
nonzero heap residue there ends the loop after five frames whatever the distance.
With zeroed frames the script waits for the event or the approach, as its code
intends. The correction does not depend on `bugfixes`: the residue depends on the
heap allocation order, which the port does not keep. It takes effect once the game
runs scripts on [interpreter.mjs](../src/script/interpreter.mjs) (phases 2 and 3 of
the lift); the fresh read guard of
[script-interpreter.test.mjs](../tools/script-interpreter.test.mjs) lists the site.

## Verification

[gameplay-bugfixes.test.mjs](../tools/gameplay-bugfixes.test.mjs) covers both
weapon-removal entries for all 13 default rows and repeated changes, armour
preservation, all Charisma/capacity boundaries and the actual arrival branch,
dialog entry with missing/hidden keywords and full-list preflight, real
new-game decompression and SRAM restore, the real Jester reset instructions,
and the existing Examination cleanup condition. Both original and corrected
behaviour are exercised.

[recording.test.mjs](../tools/recording.test.mjs) records and replays a real
cold new game with fixes enabled; using the original settings produces a
state mismatch. Legacy metadata and unsupported configurations are checked.
[gameplay-options-browser.test.mjs](../tools/gameplay-options-browser.test.mjs)
checks default and persisted choices, the actual worker, exported metadata
and the disabled controls during an active session in Edge.

These targeted state and browser cases are not a complete playthrough of
all corrected scenes. Existing source/oracle comparisons remain responsible
for unchanged original behaviour. Release results are recorded in
HANDOFF.md; current work is only in
[PROJECT-STATUS.json](PROJECT-STATUS.json).
