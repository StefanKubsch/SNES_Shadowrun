# Marking usable objects

As of 2026-11-05. Quality-of-life option from the user's TODO list: usable
objects are hard to see, and the screen must be searched with the glove.
Code: [object-markers.mjs](../src/video/object-markers.mjs),
[game-worker.mjs](../src/browser/game-worker.mjs),
[start.mjs](../src/browser/start.mjs). Test:
[object-markers.test.mjs](../tools/object-markers.test.mjs).

The switch is in **Options → Game** (German: **Spiel**), alongside bug fixes
and vampire farming prevention. It keeps its independent live preference.

## User decisions (2026-11-04)

- Optional page option, off by default. Named "Flash usable objects" at
  first, renamed to "Highlight objects" on 2026-11-05.
- A periodic pulse, no input needed: every 200 pictures (4 s) a pulse of
  40 pictures (0.8 s).
- Items, doors and devices only, no people or creatures (doors were removed
  on 2026-11-05, see below).

## User decisions (2026-11-05)

- The first version drew corner brackets around the whole hit rectangle;
  they covered too much of the picture and were distracting. They are
  replaced by a small pulsating ring at the centre of each object: during
  the pulse its radius grows from 1.5 to 3.5 pixels while a sine envelope
  fades it in and out. The ring is 1 pixel wide with an anti-aliased edge,
  in the same warm light colour; the object centre itself stays uncovered.
- Doors are no longer highlighted. Confirmed afterwards: the gates (Broken
  Gate, Bronze Gate) stay highlighted, the Fridge Door counts as a door.

## Which objects

- The glove check 80:BCBE (see
  [native-glove.mjs](../src/task/native-glove.mjs)) offers an object of the
  draw list 14B2 (last word index 14B0) that has a picture (1090) and whose
  kind has a name in the kind table 8C:EFB0 (word +0 not FFFF,
  [kinds.mjs](../src/data/kinds.mjs)). The markers use the same rule.
- People and creatures are left out by the kind flags (+4): every person or
  creature kind has bit 15 or bit 13 set (for example Mortician 8000, Orc
  A300, Naga 2300, Sentry Gun 2301, Giant Rat 2360, Jake's "Me" A368); no
  item, door or device kind has either bit (doors and devices 0000 or 0300,
  items such as Scalpel 0004, weapons 0001, armour 0002, Iced Tea 4000).
  This split is read from assets/vm-kinds.json; the game itself uses the
  flags for other purposes (1458, EA6E).
- Doors share their flags with devices, so they are left out by an explicit
  list of kinds whose name ends in "Door" or "doors" (DOOR_KINDS in
  [object-markers.mjs](../src/video/object-markers.mjs)): Wooden Door,
  Automatic Door, Crypt Door, Fridge Door, Glass doors, Door, Elevator
  Doors, Elevator Door and Glass Door. A test checks the list against the
  names in assets/vm-kinds.json and assets/vm-texts.json. The Door Key and
  the gates (Broken Gate, Bronze Gate) stay highlighted.
- Markers appear only while Jake moves freely (the player control 80:E014
  ran in the last picture) or the action glove is open (01D8 = FFFF), so
  never in menus, dialogues, sequences or the matrix.

## Where

BCBE tests the glove pixel (high bytes of 01D4/01D6) with four linear
conditions per object, from its position (0E28, 0E80, 0ED8, 0F30), the
camera (0CC4/0CC6), its box fields (7E:4240, 4298, 42F0, 4348, 43A0) and the
action glove limits 01E4 = 0600, 01E6 = 0C00. The hit area is therefore a
screen rectangle; the markers compute it with the same 16-bit equations,
including the sign-keeping ROR pair for a negative horizontal distance, and
centre the ring on it.

## Display only

The worker draws into the finished picture after the recording's WRAM
check and before it goes to the page, so the CRT filter applies to the
markers as well. Game state, saves and recordings are unchanged; the option
changes at once, also in a running game, and is stored as a page setting
(`shadowrun.markers.1`), not as a gameplay setting.

## Evidence

- The kind split for known kinds (devices, items, weapons, Door Key and a
  gate against people, creatures, Jake, doors and an unnamed kind), and the
  door list against the kind names.
- The pulse timing and a small ring around the box centre that leaves the
  centre and the box corners untouched.
- From the Mesen save game `apartment`: four markers (Bed, Filing Cabinet,
  Ripped Note, Video Phone), not Jake and not the Wooden Door. For each, the action
  glove moved to the centre of the marker makes the game name exactly that
  object (01DA not negative, 01DE = the object slot).

## Limits

- Checked in the apartment and against the kind table; other rooms were not
  rendered one by one.
- The ring sits at the centre of the glove's hit area, which can differ
  from the centre of the visible sprite; that is intended, it shows where
  the glove works.
- An object hidden behind scenery is still marked if the glove can name it.
