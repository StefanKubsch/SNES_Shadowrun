# Scene entry composition

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
call bodies live in `src/system/scene-observed-calls.mjs`.

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
