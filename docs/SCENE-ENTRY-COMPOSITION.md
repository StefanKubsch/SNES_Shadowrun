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
