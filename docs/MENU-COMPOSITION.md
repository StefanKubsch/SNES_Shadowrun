# Menu and confirmation composition

This phase 4 subsystem block removes internal CPU call frames from the menu
graph. It follows [DIALOG-DEVICE-COMPOSITION.md](DIALOG-DEVICE-COMPOSITION.md).
The existing selection, text, window, input and audio equations remain binding.
No hardware interpretation, frozen proof module or golden trace changes.

## Direct graph

[menu-choice.mjs](../src/game/menu-choice.mjs) exposes `chooseFromMenu`, which
returns the selected row, or FFFF on cancel. It also retains the result in the
existing DP 00 state boundary. All four original entry forms remain: hotkeys,
numbers, numbers with a preselected row, and plain lists. Drawing, marking,
unmarking, page clearing and counter waits compose directly with `yield*`.
The confirmation sound calls the ordinary audio operation without changing
the caller's data bank. Its arguments and command order are unchanged.

[menu-list.mjs](../src/game/menu-list.mjs) provides direct `drawList` and
`markRow` operations. Token pointers, the data bank for numeric lists and
hotkeys, visible rows, repeated navigation, page arithmetic with chained
carry/borrow, and word wrapping keep their established equations.

[confirm-key.mjs](../src/game/confirm-key.mjs) exposes `waitForConfirmKey`.
It composes each counter wait and pad refresh directly and returns the newly
pressed confirming buttons. Held buttons and unrelated presses still wait.

Action, dialog, spell, item, member, status, karma, save and yes/no menus use
the direct operations. Notice pages, hit notices, party status and player
notices likewise compose confirmation without synthetic JSR/JSL frames.
The thirty preceding hit-notice waits remain a separate compatibility boundary.

The original `*Sequence` exports remain outer adapters for frozen callers:
they delegate the work and consume only the caller's actual RTS frame.
The menu adapter retains the original sound entry's final code bank on
confirmation. Instruction-level waits and injected register-level renderers
also keep their existing adapters. CPU workspace and data-bank addressing
remain explicit boundaries; this block does not complete phase 4.

## Verification

[menu-flow.test.mjs](../tools/menu-flow.test.mjs) executes real text rendering
with every CPU call/return helper forbidden. At each single-step pause it
compares the entire CPU context and caller stack. Its sixteen cases cover all
four entries, navigation, paging, repeat, cancel, hotkeys, all five confirming
buttons, zero budgets, repeated completion and failure/replay rejection.

Existing caller and original-source comparisons retain their complete state,
text payload, device, audio and input checks. Test helpers classify portrait
opening from transfer chronology, dialog opening/greeting from its established
frame count and status closing from the completed input script. They no longer
depend on the removed menu/confirmation return addresses. Every frame snapshot
and final comparison remains, including exact whole-result status equality.
