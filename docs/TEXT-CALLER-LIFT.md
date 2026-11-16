# Text caller composition

The text producers keep their established decoding, arithmetic, bank and return
contracts. This work separates the text-buffer renderer from register routine
tables. It introduces no hardware effects or timing assumptions. Hardware and
glyph composition remain covered by the existing register-level, dialog, menu
and script-native comparisons described in [WINDOW-CALLER-LIFT.md](WINDOW-CALLER-LIFT.md).

## Delivery phases

1. Text printing: receive a renderer sequence directly, default to live drawing,
   and retain the former dispatched text caller independently in proof.
2. Number printing: use the same explicit renderer interface, retaining its
   former caller and the original decimal arithmetic comparisons.
3. Menu lists: pass the renderer explicitly through drawing and marking;
   resolve legacy tables at the menu entry boundary.
4. Dialog texts: pass the renderer explicitly through dialog and script text
   composition; resolve legacy tables at the register entry boundary.

Each phase has its own release check, handoff, commit and push. Register/NMI
interfaces, saves, frame policy, shape editing and S-MIX remain outside this work.

## Phase 1: text printing (2026-11-16)

[text-print.mjs](../src/game/text-print.mjs) receives a renderer sequence rather
than a dispatch table. Without an injected renderer it composes
[text-draw.mjs](../src/game/text-draw.mjs) directly. The original call frame and
bank restoration remain around the renderer, including cooperative pauses.
[text-renderer.mjs](../src/game/text-renderer.mjs) adapts callers that still
supply tables, preserving function-identity continuation lookup and the missing
helper frontier. Table lookup happens when the renderer is reached.

The former caller remains in [proof/caller/text-print.mjs](../proof/caller/text-print.mjs).
[text-caller.test.mjs](../tools/text-caller.test.mjs) compares both compositions
with a renderer that pauses across several segments, at budgets one and seven.
Cases include both source banks, terminal texts and language replacements;
zero budget has no effects. Renderer inputs, buffer bytes, final memory,
registers, bank restoration and actual return are compared. Existing random
decoder, menu and dialog comparisons continue through the compatibility adapter.
