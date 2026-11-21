# Scene entry composition

## Phase 4 direct scene graph

The normal scene request composes `playMatrix` and `playCutscene` directly.
Cutscene 14 uses `playIntro`, whose ending calls the mirrored credits directly.
This complete playback graph creates no CPU return frames. Matrix playback writes
back decker state before returning as an ordinary generator. The request retains
its post-wait reread, health-record update, screen restoration and room entry.

The original entry adapters remain for register-level and recorded callers. In
particular, `matrixSceneSequence` consumes only its caller's outer RTL frame.
Existing intro/cutscene compatibility adapters retain their recorded call graph;
ordinary playback does not enter them. The sections below describe that retained
comparison interface, not the normal scene request.

Twenty-six direct graph cases reject stack helper calls, preserve the caller's
stack and compare all game bytes, device writes and serviced waits against the
existing entries at budgets one and seven, including intro/credits and mirrors.
Only CPU stack bytes and return metadata are excluded from that direct comparison.

## Cutscene intro tail

Cutscene 14 transfers its existing long caller frame directly to the intro body.
It sets the original target bank and PC without selecting a table entry or
creating another return frame. The former orchestration remains independently
in `proof/caller/cutscene-scene.mjs`; recorded original comparisons retain it.

[Caller comparisons](../tools/scene-entry-caller.test.mjs) run the real intro,
its nested mirrored credits and their graphics/audio setup at budgets one and
seven, including narrow incoming registers restored by the intro. They compare
complete memory, device writes, serviced waits, registers and final long return.
The fixture services frame counters, brightness and held input explicitly; it
adds no original route, elapsed-time or hardware evidence.

## Intro credits call

The intro calls the mirrored credits body directly inside its original long call
frame at 81:E120. It restores its saved status and data bank after the credits
return and the game sound directory is reinstalled. The former intro remains in
`proof/caller/intro-scene.mjs`; replay binds it independently with the former
cutscene. The caller cases now compare both complete entry directions with that
retained chain, including actual packed data, graphics and sound commands.

## Cutscene observed waits and input

The cutscene's recorded frame wait and long input refresh compose their fixed
callees directly through the original frames. Interrupt records are consumed by
the established observed continuations. Non-interrupt recordings retain explicit
counter/input records, missing-record frontiers, input filtering and soft reset.
The live lag-free path keeps its existing frame and pad equations. Shared fixed
call bodies live in `proof/system/scene-observed-calls.mjs`.

## Intro observed waits and input

The intro uses those fixed bodies at its own 81:E07E and 81:E082 long call sites,
including waits during both fades. Tests compare physical frame bytes and return
PCs for both sites with recorded interrupts and explicit observations at both
budgets. Actual intro/credits fixture comparisons continue through the complete
live body. No dependency is selected from a caller table in either scene.

## Matrix observed frame waits

The matrix entry composes its fixed recorded frame wait directly, including
setup, fades, login, grid and exit phases. Its API no longer receives a routine
table. The former matrix orchestration remains independently in
`proof/caller/matrix-scene.mjs` for replay. Full fixture cases compare actual
matrix setup, packed maps, login text and return; the shared observed-call
comparisons also pin its original bridge frame at 81:C3CA.

## Complete live entries

All three game entries and their continuation factories receive only the game
accessor and events. The scene request directly invokes their bodies without
importing a shared scene routine table. Former scene requests bind former scene
entries explicitly. Hostile legacy-table fixtures check synchronous and pausing
entries, every ordinary scene and its mirror, and nested intro/credits returns.

The established cutscene, intro and matrix frame comparisons now install the
actual game entries in all replay caller tables before running their existing
plans against the independently retained register-level originals. Their NMI
fingerprints still compare game WRAM, PPU state, write counts and sound RAM;
the original scratch masks and route limits stay unchanged. Replacement tables
are restored after each comparison, including failures. Shared release results
belong in HANDOFF.md.
