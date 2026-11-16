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

Phases 1 to 3 each had a release check, handoff, commit and push. After phase 3,
the user changed the cadence: five blocks, each checked and committed, then one
shared release check and push. Phase 4 starts that batch. Register/NMI
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

## Phase 2: number printing (2026-11-16)

[window-text.mjs](../src/game/window-text.mjs) now gives number printing the
same renderer sequence interface, defaulting to live text-buffer drawing.
Decimal conversion, divider traffic, digit relocation and the bank/return
contract are unchanged. The former caller and cursor remain in
[proof/caller/window-text.mjs](../proof/caller/window-text.mjs).

The cooperative comparisons add zero, digit-count boundaries and the maximum
unsigned word, at both budgets. They assert the actual decimal buffer as well
as matching device traffic, renderer arguments, final memory and returns. The
existing 600 random number comparisons against the register-level original
remain. At this phase, menu lists and register entries adapted their tables at
the producer boundary, before the menu migration below.

## Phase 3: menu lists (2026-11-16)

[menu-list.mjs](../src/game/menu-list.mjs) passes a renderer sequence through
row text, optional numbers, selection marks and page indicators. It no longer
reads or adapts a routine table. Menus and dialog menus receive the same
sequence, and main-upkeep supplies the live renderer directly; the former
one-entry menu text table is removed.

The former [menu list](../proof/caller/menu-list.mjs) imports the retained text
and number producers. The retained menu choice imports this list, so recorded
comparisons cannot silently adopt the new list or producers. The existing 24
menu caller comparisons now supply a sequence on the direct side and a table
on the retained side. They keep navigation, repeat, paging, confirmation,
cancellation and hotkey coverage at both budgets. The random list/mark tests
against the register-level original retain their renderer stand-in via the
explicit compatibility adapter.

## Phase 4 / batch block 1: dialog texts (2026-11-16)

[dialog-text.mjs](../src/game/dialog-text.mjs) passes an explicit renderer through
matching and fallback dialog texts and the two script text natives. Main-upkeep
supplies live drawing directly. Custom dialog service objects and topic actions
retain their existing interface; this block does not change task scheduling.
The former [dialog text caller](../proof/caller/dialog-text.mjs) imports the
retained text and cursor producers.

[dialog-text-caller.test.mjs](../tools/dialog-text-caller.test.mjs) compares
matching greeting/talk, sorted topic insertion with duplicates, restored action
position, fallback and missing text, plus clearing and non-clearing script text.
Both budgets retain zero-budget stability and cooperative renderer pauses.
The shared [fixture](../tools/text-window-caller-harness.mjs) supplies deterministic
arithmetic and services upload branches; real NMI/device coverage remains in
the existing integrations. Eighteen new comparisons passed; the combined focused
text/menu/dialog suite passed 80 tests.

## Five-block batch after the cadence change

1. Dialog and script text renderer interfaces (phase 4 above).
2. Separate live glyph drawing and upload waits from recorded rendering.
3. Compose notice window opening and text directly.
4. Compose the Cortex bomb timer's notice, cursor, number and text directly.
5. Use live menu composition for standard dialog menus, retaining the former
   caller and recorded replacements independently.

Each block gets focused checks and a commit. The shared release follows block
five; its result and the count since the preceding release belong in HANDOFF.md.
