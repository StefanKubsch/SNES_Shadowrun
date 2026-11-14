# Controls in the browser

As of 2026-10-30. Code: [controls.mjs](../src/browser/controls.mjs) (bindings),
[mouse-control.mjs](../src/browser/mouse-control.mjs) (mouse, back key,
glove), [start.mjs](../src/browser/start.mjs) and
[game-worker.mjs](../src/browser/game-worker.mjs). Tests:
[browser-controls.test.mjs](../tools/browser-controls.test.mjs),
[live-mouse.test.mjs](../tools/live-mouse.test.mjs),
[live-aim.test.mjs](../tools/live-aim.test.mjs),
[live-talk.test.mjs](../tools/live-talk.test.mjs),
[live-game-browser.test.mjs](../tools/live-game-browser.test.mjs),
[live-alley-bus.test.mjs](../tools/live-alley-bus.test.mjs).

## User requirements (2026-10-30)

| SNES           | Default                   | Note                                                                               |
| -------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| D-pad          | WASD, also the arrow keys | by the position of the key                                                         |
| Show the glove | move the mouse            | replaces the B that opens it                                                       |
| B              | B, middle mouse button    | over an object the action list (for example Talk)                                  |
| L              | left mouse button, Q      | examine                                                                            |
| R              | right mouse button        | over an object by context: Use where it has an effect, otherwise the action list   |
| A              | F                         | crosshair in combat; on the open hand F switches directly                          |
| X / Y          | X / Y                     | by the label (the QWERTZ Y is code KeyZ); X on the open hand switches to the spell |
| Start / Select | E / G                     |                                                                                    |
| Back           | Esc                       | Select in menus, closes the glove in the game                                      |

In menus (title, dialogs, lists, status screen): the mouse wheel moves the
cursor, the left mouse button chooses (B), the right mouse button goes back
like Esc (Select). The right click as back is an addition of the model.
Before the player controls Jake for the first time (opening, title menu, save
game choice), Esc and the right mouse button give nothing: in the title menu
81:E14A Select means "down", and there is no back there (user finding
2026-10-30).

**Options → Controls** opens the compact modal binding table (German:
**Steuerung**). **Explanations** reveals the longer function descriptions;
the same text is available by hovering the function name. Capturing a new
binding consumes that input inside the modal. Closing cancels capture and
restores the player's previous P pause. Storage and default bindings are unchanged.

All keys including back can be rebound on the page (localStorage
`shadowrun.bindings.4`; P stays pause, F9 toggles the tube picture; in full
screen only a held Esc ends full screen, a short Esc goes to the game). A
gamepad with the standard mapping works without setup, with the buttons by
their position as on the SNES pad. Opposite directions at the same time are
both dropped, because the D-pad cannot press them.

Decisions on the glove questions:

- Option B: the mouse sets the glove position directly instead of steering
  it with the D-pad (no input delay).
- Glove actions with as few steps in between as possible (user finding
  2026-10-30: a click on the club patron did nothing; decision afterwards):
  left examines (L), right acts by context. In the original, B over an object
  opens the action list (Exit and Talk at the guest); L ("Examine") and R
  ("Use") only close the hand at persons. The right mouse button therefore
  checks before sending whether R has an event at the object under the hand
  (open a door, take an item, use a device) and otherwise gives B (the action
  list, for example at persons). The middle button is B. Storage key
  `shadowrun.bindings.4`; bindings from `shadowrun.bindings.2` still apply
  (same mouse bindings).
- Option A: a direction from the keyboard closes an open glove, then Jake
  walks. The gamepad's D-pad moves the glove as in the original.
- Crosshair and spell (user finding 2026-10-30: after F the crosshair jumped
  into the glove when the mouse moved). Cause: in the original, A on the open
  hand only closes it (E18D), and the mouse keeps the hand open almost all the
  time. Decision: F or X from the keyboard switch directly from the open hand
  to the crosshair or the spell; in the crosshair the mouse only moves it, the
  left button fires, the right one ends it. The hand behaves as before, the
  gamepad as in the original.

## Evidence from the ROM

Pad word: bit assignment after Book I PDF 148 (registers 4218/4219). 9E0B
writes the word to 7E:01CA at the NMI, 9E1A forms the newly pressed buttons in
01CE ([reference/render-routines.md#9e1a](reference/render-routines.md#9e1a)). Exactly 3030 (L+R+Start+Select)
resets the original; that also holds with the mouse, E and G.

Glove (read statically, confirmed live in the native run):

- 7E:01D8 is zero with the glove closed. BC67 sets FFFF (hand), BC80 FFFE
  (crosshair, flag 1D5D), BC99 FFFD (spell, flag 1D5F). BCB2 closes it.
- 7E:01D4/01D6: position as 8.8, the screen pixel in the high byte. BC36 sets
  it at Jake when the glove opens.
- 80:BE6D moves it while 01D8 is not zero: the speed 01D0/01D2 changes by 0x30
  per frame and direction up to 0x300, without a direction it is zero; the
  position stays between 0300 and EF00 in X and between 0300 and CE00 in Y.
- 80:E014 (player control, every frame while the player controls freely):
  Select, Start, Y first. With the glove closed a new button from 80F0 opens:
  A the crosshair (E079), X the spell (E0D9), B, L, R the hand (E072 → BC67).
  With the hand open, A or X close it without an action (E18D → BCB2). B, L, R
  close it only without an object under the hand (01DA negative); with an
  object 80:BF3B acts ([reference/render-routines.md#bf3b](reference/render-routines.md#bf3b)). With the crosshair,
  a held A or X shoots, B, L or R close it (E19A).
- 80:BCBE (hit test): runs after BE6D only when no direction is held (BF25;
  with a direction BE5B releases a remembered object). A newly hit object is
  remembered in 01DA (object), 01DE and the offset 01E0/01E2 (object minus
  glove, in pixels). For the same object BE38 sets the position every frame to
  object minus offset; so the glove follows a moving object.

Menus:

- Lists 80:A6A5/A6AD/A6B8/A6C7 (src/task/native-menu-compose.mjs): a newly
  pressed Select (2000) cancels, B, Y, Start, A or X (D0C0) confirm, up/down
  (0C00) move with repetition after 20 frames, L/R page. Cursor 7E:1D97
  (entry times two).
- Title menu 81:E14A (from 80:A1C7): confirms with B or Start (9000), up
  0800, down 0400 or Select (2400). A does not confirm there.
- Text wait 80:F953: B, Y, Select, A, X (E0C0). Status screen 80:EA6E: Select
  ends it after F953.
- Target choice with the glove 80:9C40 (9BC6): BE6D every frame until A, B, X
  or Y (C0C0) are newly pressed; with an object under the glove it is chosen,
  otherwise cancelled (FFFF).

## Implementation

`LiveGame.controlNmi` counts when the native player control 80:E014 was last
called. `MouseControl.pad` runs in the worker at the pad read 9E13 and tells
three situations apart: game (E014 in the last six frames; E014 skips single
frames in free play, for example when the glove opens), target choice
(otherwise, with the glove open and `LiveGame.choosing`: a target choice
native 9BC6, 9BB9, 9BD3, 9C33 or 8D0B was called and E014 has not run since)
and menu (otherwise; this includes the action list 99EB with the hand open and
still: the mouse wheel, click and back work there, mouse moves lapse; user
finding 2026-10-30). The meaning of a mouse button or of the back key is fixed
when it is pressed and holds until it is released.

| Input                     | Game                                   | Crosshair / spell        | Menu                                            | Target choice  |
| ------------------------- | -------------------------------------- | ------------------------ | ----------------------------------------------- | -------------- |
| Mouse move                | opens and sets the glove               | sets the crosshair       | –                                               | sets the glove |
| Left / right mouse button | binding (L / R, over an object R or B) | A (fire) / end           | B / Select                                      | B / –          |
| F / X (keyboard)          | on the hand: switch                    | A / X as in the original | A / X                                           | A / X          |
| Mouse wheel               | –                                      | –                        | up/down, each step 2 frames pressed, 2 released | –              |
| Back (Esc)                | closes the glove                       | end                      | Select                                          | –              |
| Keyboard direction        | closes the glove                       | end                      | D-pad                                           | D-pad          |

Before the first player control (title menu), back and the right mouse button
give nothing.

The glove in the game:

1. A new mouse move, the glove closed, E014 ran in the last frame, no
   keyboard direction: B is fed in until 01D8 reports open (at most four
   frames).
2. The glove open: the last mouse move writes 01D4/01D6 (limited like BE6D)
   and clears the speed 01D0/01D2. If an object is remembered, it shifts the
   offset 01E0/01E2 by the same distance. Without that, BE38 would set the
   glove back as long as the mouse stays in the same object (user finding
   "snaps in"); this way following an object is kept.
3. A keyboard direction or back with the glove open, in the crosshair also
   the right mouse button: A (hand) or B (crosshair, spell) is fed in until it
   is closed. Ending is kept until E014 runs again: after a shot E014 pauses
   for 10 to 30 frames, and a short press would be lost otherwise.
4. F or X from the keyboard (the worker gets A/X of the keyboard apart from the
   pad word) newly pressed with the hand open and E014 in the last frame: the
   button is fed in until the hand is closed, then one frame released, then
   until the crosshair (FFFE) or the spell (FFFD) is open. The held button
   counts again only after it is released, otherwise a shot would follow.
5. Mouse moves without player control (title, dialog, menu) lapse; so do mouse
   wheel steps outside menus.

The page hides the mouse pointer over the open glove.

Checked (live-aim, native run from the save game apartment, the Beretta picked
up in the alley and equipped): one F switches from the hand to the crosshair
(two A edges, no shot), the mouse sets it at three places, left fires, B
straight after the shot and a short right click during the shot pause end it,
A from the gamepad closes the hand as in the original.

Found on the way (2026-10-30): with the mouse layer of that day, the B after
the shot made D15C (through E014, A985) read the record pointer from the open
bus (8C:6A56), and Y carried the counter read to 8D:35B3, into the register
area (Book I PDF 93) outside the registers; there too the native port now reads
the open bus (src/task/native-object-turn.mjs). Since the mouse layer change ff40402d
the live-aim run takes another path. Checked against the original
(2026-11-01, [live-alley-bus.test.mjs](../tools/live-alley-bus.test.mjs)):
with that input replayed and the same random draws, Mesen reads 8C at 8C:6A56
and at 8D:35B3, the bank byte of the pointer, as the native port does. The
same B also reads the code words 80:9906 and 80:9A66 as data; they were missing
in the data package until then ([ROM-FREE.md](ROM-FREE.md)).

Checked (live-mouse, native run from the reset): in the title menu the mouse
wheel moves the cursor, the click starts a new game. In the status screen
(Start) the cursor 1D97 moves one entry per wheel step, Esc returns to the
game. In the game the mouse wheel adds nothing; the glove opens with exactly
one B, stands under the mouse, is limited, follows the mouse within an object
(object 21) and releases it outside, closes with exactly one A (D) and with
Esc. A grid over the whole morgue (8 pixels) showed no difference between
mouse and glove. In the trial run Y opened the item list, the mouse wheel
chose "Matchbox", Esc returned.

## Fluid controls (2026-11-13)

User direction: the controls aim for fluid, as lag-free as possible handling rather
than the original's behaviour; changes stay visible as a gameplay option, on by
default. Gameplay key `fluidControls`
([bugfixes.mjs](../src/game/bugfixes.mjs)); recordings without the key keep the
original handling, stored browser settings without it get the default.

- Crosshair and spell pointer after a shot: the player control 80:E014 pauses for 10
  to 30 frames after a shot. The mouse control took more than six frames without it
  for an action list and dropped mouse moves, so the crosshair stood still (user
  recording 2026-11-13: runs of 12 to 29 frames after shots). With the key an open
  crosshair or spell pointer (01D8 FFFE or FFFD) is never treated as a menu or a target
  choice, and the mouse keeps moving it. The open hand without player control stays an
  action list. Replaying that recording with the key left only one six-frame run,
  where the original pulls the crosshair along with its marked target while the mouse
  rests. Test: [fluid-controls.test.mjs](../tools/fluid-controls.test.mjs).

## Limits

- Spell (X on the open hand) not checked natively: Jake has no spell in the
  test saves; the same logic as for the crosshair.
- The title menu is recognised by the player control 80:E014 never having
  run. If the end of a game leads back to the title menu, Esc would be Select
  there again (not checked).
- The target choice has no cancel key of its own; as in the original, a click
  into empty space cancels.
- Besides the pad word, a recording must record the writes to 01D0 to 01D6
  and 01E0/01E2, otherwise a run with the mouse cannot be repeated.
- A left click without a mouse move before it opens the hand at Jake (L as in
  the original), not under the mouse.
- The right mouse button decides by the flags of the object as 80:BF3B does
  (`useEvent`): slot 01DE, task 1350+Y, chain 0BA2/0372, event flags&0610
  (0600 counts as none). Checked at the Beretta (R) and the club patron (B);
  doors and devices follow the same rule but are not checked one by one.
- If a dialog starts in the frame after the last E014 call, a B already fed
  in hits it (a window of one frame). Not observed, not guarded against.
- Not every menu is checked on its own (dialog menu 936C, weapons F254,
  spells E1CF, main menu CE6D). They use the A6A5 lists or the same masks;
  differences would show in the game.
