# Title cycle lift

The title cycle 80:A18C, the attract game 80:A168 and its demo owner 80:96F3
are the third frontend delivery group lifted from register-level 65816
equations to plain code, after the title ([TITLE-LIFT.md](TITLE-LIFT.md)) and
the start menu ([START-MENU-LIFT.md](START-MENU-LIFT.md)); method in
[MATRIX-LIFT.md](MATRIX-LIFT.md). The attract game is the demo the original
plays when the start menu times out: the game runs by itself in room AB until
the demo ends, then the menu returns. The register-level versions stay as
reference in
[proof/frontend-reference/title-cycle.mjs](../proof/frontend-reference/title-cycle.mjs);
`withFrontendReference` puts them into the ROM proof tests and recorded replays.

## Modules

| Module                                                 | Content                                                                                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [title-cycle.mjs](../src/frontend/title-cycle.mjs)     | The cycle 80:A18C with the port's credits from the start menu, the attract game 80:A168 and the demo owner 80:96F3 (generators).               |
| [game-owner.mjs](../src/frontend/game-owner.mjs)       | The outer game owner 80:A139/A157 (see "Outer game owner" below).                                                                              |
| [main-frontend.mjs](../proof/replay/main-frontend.mjs) | The demo's rounds 80:9699 (its own continuation; room start lifted, [GAME-START-LIFT.md](GAME-START-LIFT.md)) and the driver's owner dispatch. |

The audio and screen routines the cycle called (81:F229, 81:F092, 81:DDB1,
81:EF63, 81:EB97, 81:EF47) are the lifted functions of src/apu, src/intro and
src/system. The title, the start menu, the credits cutscene, the music stop
81:EF94, the new game set-up 80:960D and the room start 80:9699 are still
called through their original frames, so the reference can replace them.

## Boundaries

- The cycle is called by JSR from the outer owner (80:A141). A is zero after a
  game (the cycle starts with the title song and the menu) and nonzero at power
  on (the title first). It returns the menu's choice in A (a save slot, or FFFF
  for a new game), X as the menu leaves it, data bank 80 and the entry status.
  Y and other leftovers of the original's audio routines are not produced;
  after the cycle the new game set-up or the save load sets them.
- After the whole title (the title returns A = 0) the menu gets A = 1, the
  shorter timeout; after a button in the title it gets A = 0.
- A cancelled menu shows the attract game and the title in turn, each followed
  by the menu again. The port's Credits row plays the credits (with the
  attract game's call frame, as before) and shows the menu again. It always
  loads the game's sound directory and starts the ending room's music, then
  stops the music and restores the title directory afterwards.
- The attract game A168 is a JSR, its demo owner 96F3 a JSL, and 96F3 calls
  9699 with JSR, as in the original; the demo's main loop returns through
  those frames. 9699 pauses at the main loop's waits as before
  (`NestedRoundContinuation`, [NATIVE-CONTINUATION.md](NATIVE-CONTINUATION.md)).
- The data bank follows the original where register-level code reads it: 80
  for the demo owner and 81 after the title's audio set-up (81:DDB1).
- The cycle no longer pushes the status byte (PHP) that A18C keeps on the
  stack, so the demo's stack is one byte higher; the scheduler's saved stack
  pointer 7E:01F2 differs by that byte and is ignored in the comparison.

## What is compared

[tools/title-cycle-lift.test.mjs](../tools/title-cycle-lift.test.mjs) runs the
five sessions of
[tools/live-title-cycle-plan.mjs](../tools/live-title-cycle-plan.mjs) from power
on: about 14600 frames without input (title, menu, attract game, menu, title,
menu, attract game, menu), the Credits row followed by the title and a new
game, a new game and a saved game after Start in the title, and a new game
from the menu behind the attract game. Every NMI must be equal; a planted
difference (no title audio set-up after the attract game) fails it.

[tools/title-cycle-lift-functions.test.mjs](../tools/title-cycle-lift-functions.test.mjs)
runs the three routines against the reference on random states with recorded
stub callees, including the path after a game, which the live sessions do not
reach: random orders of cancelled menus, credits requests and choices, with
and without a stopped room music marker. The calls (target, return address, data bank and
arguments), WRAM, device writes and the live registers must be equal.

## Menu credits audio correction (2026-11-15)

The user recording `Shadowrun-recording-2026-11-15T18-11-39-098Z` replayed
through NMI 6254 with every recorded WRAM check equal before the correction.
It reaches the first menu after the complete title, wheels to Credits, exits
them and moves through the menu again. The original recording remains a local
user file; the regression test retains its seed and initial wheel timings.

The former credits adapter treated room music word `7E:1CDE = FFFF` as the
condition for setting up game audio. On the first menu visit it was zero,
although the APU held the title directory and menu song. Setup was skipped,
so the menu fade left the credits silent. On exit CDF8 sends sound `2E`
(command call at 81:CF43, lifted in `cutsceneSequence`). That is a game-directory
sound; interpreted through the title sound table it left voice 0 at rank 122
indefinitely. Subsequent menu move sounds (rank 24, voice mask 1) were refused.

The adapter now always sets up and restores the sound directories. This is
a correction to the port's menu credits addition, independent of the optional
original-game bug fixes. Both retained frontend references receive the same
intentional adapter change; the sound driver and original ending stay unchanged.
[tools/credits.test.mjs](../tools/credits.test.mjs) checks audible credits PCM,
the ending song in the game directory, restoration of the title directory,
and actual acceptance of all three wheel sounds before and after credits.
The separate report about menu sounds after game over is not covered by this
recording and remains open.

With the correction, the supplied recording still reaches NMI 6254 without
leaving its input path. The credits PCM peak is 9234; all nine menu move
commands start (three before and six after credits). The first old WRAM hash
differs at NMI 6000 because the audio state is deliberately corrected. The
new regression passes and fails when the old conditional setup is restored.

## Outer game owner

The outer owner 80:A139 (entered after the start-up) and its resume point
80:A157 (reached when the game's main loop returns after a game) run as plain
code in [game-owner.mjs](../src/frontend/game-owner.mjs); the register-level
version and the no-countdown marker 80:E24E it called are in
[proof/frontend-reference/game-owner.mjs](../proof/frontend-reference/game-owner.mjs)
and join `withFrontendReference`.

- The owner is the routine table's entry 80:A139, so the reference can replace
  it; the main driver enters it through `runMainOwnerStart` and
  `mainOwnerContinuation` (proof/replay/main-frontend.mjs), which pick the table's
  owner and its continuation.
- It stores the cycle's music options, calls the title cycle 80:A18C through
  its JSR frame (A141), stores the choice in direct page word 0 for the main
  start, copies the saved music setting 70:1FFE to 7E:1FD6, sets up the game's
  audio and stops the countdown directly (no JSL 81:EF63 or JSR 80:E24E frames),
  and enters the main start 80:9688 with the original return word A156.
- Not produced: the return address the JSL to 81:EF63 leaves in the free stack
  below the owner's frame, and A and the flags after E24E (the main start loads
  A from direct page 0 first).
- [tools/game-owner-lift.test.mjs](../tools/game-owner-lift.test.mjs) compares
  every NMI of the new game and saved game sessions of the title cycle plan;
  [tools/game-owner-lift-functions.test.mjs](../tools/game-owner-lift-functions.test.mjs)
  compares both entries on random states with a stubbed title cycle. Planted
  differences (the countdown word) fail both.
- The driver tests (tools/main-driver.test.mjs) stub the audio set-up 81:EF63
  and therefore run the reference owner.
