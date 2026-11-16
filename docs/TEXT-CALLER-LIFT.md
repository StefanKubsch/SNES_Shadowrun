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

## Batch block 2: live glyph drawing (2026-11-16)

[text-draw.mjs](../src/game/text-draw.mjs) always uses live upload waits and no
longer selects startup observations or dispatches recorded polling routines.
The independent [former renderer](../proof/caller/text-draw.mjs) retains both
recorded modes. The existing random glyph, list and menu comparisons now use
that former renderer explicitly for recorded polls; real live integrations
continue through the product renderer.

[text-draw-caller.test.mjs](../tools/text-draw-caller.test.mjs) compares both
renderers on live requests, with empty/plain/wrapping texts, eight styles,
budgets one and seven, and request counters zero, FFFE and FFFF. Each serviced
request payload, arithmetic device write and final game state is compared.
A read-back request wrapping from FFFF to zero does not wait; later requests
still wait normally. Glyph equations, hardware contracts and frame policy are
unchanged. The fixture services uploads rather than emulating NMI hardware.

## Batch block 3: notice composition (2026-11-16)

[notice-show.mjs](../src/game/notice-show.mjs) opens its window and prints its
text directly, passing a renderer sequence. The native entry and script notice
no longer supply an opening/text routine table. Slot allocation, equal-time
replacement order, effect duration, minimum tracking and release are unchanged.
The [former notice caller](../proof/caller/notice-show.mjs) retains dispatch and
imports the retained release. Existing random stand-in comparisons use it.

[notice-caller.test.mjs](../tools/notice-caller.test.mjs) compares the direct
notice against the former caller with retained opening and text producers.
Free, mixed and full slots cover ties and replacement of the last notice,
with and without the effect, at budgets one and seven. Actual window uploads,
renderer input, effect duration, selected slot and final game state must match.

The shared fixture writes tables through WRAM bank 7E and asserts initialized
field contents. During block 3 this corrected an initially incorrect low-bank
fixture write; all 82 affected notice/glyph/dialog comparisons were rerun and
passed. The product arithmetic and window code did not require a correction.

## Batch block 4: Cortex bomb timer composition (2026-11-16)

[time-limit.mjs](../src/game/time-limit.mjs) composes its notice, cursor, number
and suffix directly with the same renderer sequence. The main-loop entry no
longer forwards an upkeep table to the timer. Warning sounds, countdown,
hour reload and script timer APIs are unchanged. The [former timer caller](../proof/caller/time-limit.mjs)
retains dispatch for the independent original/random comparisons.

The notice caller suite adds disabled and expired timers, ordinary countdown,
hour changes and both warning intervals, at both budgets. The former side uses
retained notice, opening, cursor and text/number producers; expected hour and
frame counts, decimal payload and number of rendered texts are also asserted.

## Batch block 5: live dialog menus (2026-11-16)

[dialog-menus.mjs](../src/game/dialog-menus.mjs) always composes live menus for
standard dialog services. Its default renderer is live glyph drawing; it no
longer selects register-level menu composition when no renderer was passed.
Custom service objects keep their existing interface. The [former caller](../proof/caller/dialog-menus.mjs)
retains the previous table interface and recorded register-level path, importing
independent retained menus, opening and release. Existing recorded random
comparisons import it explicitly.

[dialog-menu-caller.test.mjs](../tools/dialog-menu-caller.test.mjs) compares main
and topic choices, confirmation/cancellation and empty/all-flagged topic lists,
including consumed input, window uploads, end marker and result. Four additional
cases omit the renderer on the live side and compare real glyph composition
against the former renderer. Both budgets include zero-budget stability.

The first five-block batch passed its shared release and was pushed.
Actual verification results are recorded in HANDOFF.md. Shared register/NMI interfaces
and other caller tables remain; no save or frame policy changed.


## Modal menus and portraits: action menu (2026-11-16)

The next five blocks cover action menus, Yes/No questions, confirming input,
portrait windows and portrait uploads. They simplify established caller
composition without changing the original arithmetic, hardware setup or frame
policy. The remaining dialog orchestration and other caller tables stay separate.

[action-menu.mjs](../src/game/action-menu.mjs) opens its window and runs the
hotkey menu directly, passing a renderer sequence. Both the glove entry and
the script native use this composition; main-upkeep no longer forwards a
helper table. The [former caller](../proof/caller/action-menu.mjs) retains
independent window release and the injected opening/menu interface. Existing
600 random original comparisons explicitly use that retained caller.

[modal-menu-caller.test.mjs](../tools/modal-menu-caller.test.mjs) compares both
compositions with real window opening, list decoding, input, sound and release.
It covers no actions, Exit, hotkeys, override, cancellation, combined cast flags,
separate open/close flags and the script override reset at budgets one and seven.
The test checks selected flags, script result, uploads, consumed input and final
game state, with zero-budget stability. Drawing and NMI upload service are
stand-ins; existing script-native integrations retain actual devices and NMIs.
