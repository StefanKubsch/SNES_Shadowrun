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
