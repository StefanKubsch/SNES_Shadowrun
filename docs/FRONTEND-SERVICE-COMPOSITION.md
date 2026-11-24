# Frontend service composition

Live frontend scenes take game services only (`h.a`): the title and prologue
(src/frontend/title.mjs), the start menu (src/frontend/start-menu.mjs), the
title cycle with menu credits and the attract game (src/frontend/title-cycle.mjs),
the intro (src/intro/intro-scene.mjs), ordinary cutscene playback
(src/cutscene/cutscene-scene.mjs) and the game owner's final step
(src/frontend/game-owner.mjs). With frame jobs they read and write no CPU
context: no status width changes, no data bank and no PLP restoration.

The status passed to a polling branch (music beat, music cue and the cutscene's
brightness poll) is built by `waitStatus` (src/system/wait-status.mjs) from the
condition the original instruction sets: N and Z from the loaded value, carry
from the cue comparison and the 8-bit width the loop runs with. The start menu's
NMI reads that carry as the interrupted carry, as before. The menu arrow uses data
bank 81, the bank every row choice runs in.

Recorded comparisons run without frame jobs. They keep the original status
changes, data banks and restorations on the caller's context, so the frozen
register-level callers and the scene-entry comparisons retain their context
assertions. Compatibility entries (`titleSequence`, `startMenuSequence`,
`cutsceneSequence`) keep their RTL frames.

Contracts (tools/frontend-values.test.mjs): title skip, new game, the title
cycle to a new game, menu timeout, cutscene and both intro entries run at budgets
one and seven with every access to the caller beyond `h.a` rejected, the CPU
context frozen and all frame helpers failing. The title, intro and scene-entry
comparisons and the five golden traces, including attract and new game, remain
binding.

The scene entry metadata of game start and the outer GameLoop accessor still
carry a compatibility context; phase 4 remains unfinished.
