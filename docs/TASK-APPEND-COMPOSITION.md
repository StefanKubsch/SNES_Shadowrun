# Dialog and spell task creation

This phase 4 subsystem block completes direct task creation in the dialog
and member spell graphs after [MENU-COMPOSITION.md](MENU-COMPOSITION.md).
Task allocation, arguments and nested execution retain their existing source
contracts. Frozen proof modules and golden traces remain unchanged.

[dialog-text.mjs](../src/game/dialog-text.mjs) reads the action script from
the dialog record, writes the dialog object to DP 00, appends the task and
then visits it. The missing-scheduler check still precedes any argument or
task mutation. Synchronous visit observations remain frozen arrays appended
to the existing wait/input observations; a child continuation owns its own
budget pauses and completion.

[member-spell-menu.mjs](../src/game/member-spell-menu.mjs) retains the
leader/status branches. A selected companion spell puts its level in DP 00,
appends its script, clears the portrait-redraw request and visits the task,
then handles dialog end, portrait redraw and notices in the existing order.
Menu and confirmation operations already compose directly.

Both graphs call `appendScript` in [task-api.mjs](../src/script/task-api.mjs).
Its JsTasks backend copies the argument words into the scheduler task;
compatibility fixtures retain WramTasks and the original allocation equations.
The unused `appendScriptCall` and `appendScriptReturn` CPU return adapters
have been deleted from `src/`; no product task append pushes or pulls a return
word. There is no new limit, inferred argument or replay of a paused append.

Legacy scheduler hooks still use the existing visit adapter when `valueRounds`
is absent. Normal live rounds return values directly. Register-oriented
workspace and original heap addressing remain explicit fixture boundaries.
This step completes task creation in these graphs, not all of phase 4.

## Verification

[task-append-flow.test.mjs](../tools/task-append-flow.test.mjs) checks both
backends with all CPU call/return helpers forbidden. At every single-step
pause it compares the full CPU context and caller stack. Twelve cases cover
two real script headers, argument order and exact task count, synchronous
and nested visits, observation collection, the complete member spell graph,
zero budgets, repeated completion and failure/replay rejection.

Existing dialog topic, text, orchestration, member spell, task API and
allocation comparisons retain their complete state and source assertions.
These checks establish task creation and caller ordering; they do not add
coverage of unrecorded story routes or new hardware timing evidence.
