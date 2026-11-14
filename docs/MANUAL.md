# In-game handbook

The fourth in-game start-menu entry, **Credits** / **Mitwirkende**, follows
**Options** / **Optionen**. It plays the staff credits with music; B or Start
returns to the start menu. Credits is no longer in the browser burger menu.
The handbook explains this addition in both languages.

The handbook opens from **Options → Handbook** (or **Optionen → Handbuch**). It follows
the existing English/German game-language setting, including its stored value
and a failed German asset load falling back to English. Its search checks both
languages and the original English item and spell names.

The guide covers every gameplay topic of the numbered US SNES manual in
English and German. Its thirteen chapters cover getting started, controls,
exploration and actions, character, inventory, weapons and armor, combat and
companions, magic, skills, rest and saving, Karma, dialogue and Vidphone, and
the Matrix. The overview introduces the guide. Its contents are editorial
paraphrases, with separate additions for browser controls and saving.
This guide is a reference and never supplies gameplay data.

## Source and content boundary

Source: [Shadowrun.pdf](../Ressources/Shadowrun.pdf), 40 scanned PDF pages.
Content was checked visually against the embedded original page images:

| Topic                           | PDF pages (one-based) | Printed manual pages |
| ------------------------------- | --------------------- | -------------------- |
| Controls                        | 6                     | 4                    |
| Setting, title and game options | 3, 5, 7–8             | 1, 3, 5–6            |
| Exploration and actions         | 9–12                  | 7–10                 |
| Character and inventory         | 13–17                 | 11–15                |
| Equipping and equipment table   | 18–19                 | 16–17                |
| Combat and companions           | 20–24                 | 18–22                |
| Casting and all six spells      | 25–26                 | 23–24                |
| Skills                          | 27–28                 | 25–26                |
| Rest, saving and Karma          | 29–30                 | 27–28                |
| Dialogue, keywords and Vidphone | 31–33                 | 29–31                |
| Matrix                          | 34–38                 | 32–36                |

The [pilot source transcription](manual-source-pilot.md) and
[remaining source notes](manual-source-content.md) stay separate from the
[bilingual editorial data](../src/browser/manual-data.mjs) and
[additional chapter text](../src/browser/manual-content.mjs). Each manual entry
retains its PDF and printed page numbers internally. At the user's request,
the handbook displays no original-manual references or page numbers.
The PDF and its extracted images are not shipped. Original names are retained
in both languages. No original illustrations or full-page reproductions are
included. The contents page is represented by chapter navigation. Physical
console setup, warranty and historical advertising are excluded from the
browser guide.

The printed equipment table includes a separate `Pistol` row and the unusual
label `AS& Assault Cannon`. Those spellings are retained rather than silently
corrected to a guessed game item. Its numbers are **required Strength**, not
weapon damage or armor ratings. The source's claims, including spell limits,
have not been independently checked against the European game routines.
The general skill range and Firearms' specific limit of 16 are kept distinct.
An inconsistent starting Strength and a truncated Move To button instruction
are not filled in from guesses; the source notes record these limits.

Original-page viewing and help links from individual game screens are outside
this delivery. Language follows the player's menu choice;
the guide does not infer a chapter from the current game state.

## Browser integration

[manual.mjs](../src/browser/manual.mjs) uses the same native modal shell as
every settings overlay, inside the fullscreen `#frame`. The options panel is also inside that frame, and
the burger button stays accessible at the upper right in fullscreen. The
scrollable options panel starts below the button, leaving its header, Close
and first option unobstructed at wide and narrow widths. The fullscreen
button can both enter and leave fullscreen. Chapter navigation is
a vertical sidebar to the left of the independently scrolling contents,
including on narrow screens. Navigation buttons jump to their section in the
complete guide. Scrolling updates the active button in either direction
without moving keyboard focus. Search tracks the visible result chapter;
an empty result has no active chapter. Returning to a chapter clears search.
The sidebar scrolls independently and keeps the active chapter visible as
the reader reaches later sections.

Language is the first menu option, with English as the default. The complete
options panel follows the saved choice: buttons and their changing states,
hints, tooltips, accessible names, current bindings,
save messages and soundtrack status. [ui-language.mjs](../src/browser/ui-language.mjs)
holds the shared English/German menu text and binding labels. Language changes
preserve the disabled gameplay controls of a running session.

**Options → Audio** groups Original/Tribute soundtrack selection, Tribute volume,
the analog filter switch and five explained audio profiles. **Options → Graphics**
(**Grafik** in German) groups the CRT switch, bezel, window zoom, brightness and
contrast. **Controls**, **Game**, **Cheats**, **Save/load game** and **Recording**
also open overlays; there are no expandable sections in the main menu. Game
groups bug fixes, vampire farming prevention, instant menus and dialogs
([INSTANT-TEXT.md](INSTANT-TEXT.md)) and object highlighting. Four save
slots belongs to Save/load game. Fullscreen remains a direct main-menu action.
The order is language, handbook, graphics, audio, controls, game, cheats,
save/load, recording, fullscreen.

[overlay-dialog.mjs](../src/browser/overlay-dialog.mjs) supplies the common
modal shell for all eight overlays, including the handbook: title, localized
Close button, Escape handling, fullscreen ownership and focus return. The
handbook supplies its search and chapter navigation through the shell's content
slot; it no longer creates a separate dialog or header.

[overlays.css](../src/browser/overlays.css) is the single stylesheet for every
overlay. Shared variables set text sizes, spacing and responsive insets. All
categories use the same font family, weight, title and body sizes, buttons,
cards, border, backdrop, width and height limits. Frames fit their content,
with scrolling only where needed. Settings use two columns where space permits;
the handbook retains its chapter sidebar and independently scrolling reader
within the same body padding. Search fields, tables and settings-specific
layouts also live in this stylesheet. The local server serves this exact CSS
path as text/css, and static builds copy it unchanged.

Controls initially shows a compact binding table; **Explanations**
reveals the per-function usage text, also available as function-name tooltips.
Rebinding keeps focus in the modal, consumes the captured key or mouse input
and cancels capture when it closes.

All overlays remain inside the fullscreen frame. Opening one clears game input and suspends gameplay and audio;
closing with its button or Escape restores the previous P pause and focuses
the burger button. Their existing preferences remain compatible.
Save now closes its overlay before the worker applies the requested action
at its next pad read. Debug room is directly in the burger menu after Cheats.
It stays visible before starting and during unavailable game states, dimmed
with a tooltip explicitly stating that Jake must be playable and controllable. Its availability follows the displayed game
frame; the worker still checks the actual state before applying the warp. Export and import
retain their existing behavior. [settings-browser.test.mjs](../tools/settings-browser.test.mjs)
checks all eight overlays, comparing computed typography, header, frame,
body padding and card styles at wide, narrow and fullscreen sizes. It also
checks focus, input isolation, profile storage and keyboard rebinding.
[overlay-serving.test.mjs](../tools/overlay-serving.test.mjs) checks stylesheet
serving, MIME type and static-build inclusion without permitting unrelated CSS.

Opening the guide clears held keyboard/mouse input and publishes neutral
input. Keyboard input and gamepad polling cannot send actions into the game
while it is open. The frame display/worker-consumption loop waits and audio
is suspended. Closing the guide, by its button or Escape, restores the
player's previous P-pause state and focuses the burger button. A worker
that becomes ready while the guide is open also waits. The native modal
provides focus containment; the guide and options panel each declare their
selected language. Existing browser fullscreen Escape behavior
still applies where Keyboard Lock is unavailable.

Instructions show the current keyboard or mouse input directly, without SNES
button names. Explicit tokens in the editorial text are resolved from the same
in-memory settings used by gameplay on every opening and search. Multiple
inputs are joined by “or”; empty assignments say “Not bound”. Search includes
the resolved instructions in both languages.

The controls table starts with functions and their situations, followed by
the current assignment. Settings use the same function descriptions, with
names such as “Aim / Shoot” and “Cast spells”, accessible change-button labels,
and visible menu and Matrix explanations. Storage keys and controller mapping
stay unchanged. [control-help.mjs](../src/browser/control-help.mjs) holds the
shared descriptions and input formatting. Fixed menu and aiming mouse clicks
are explained separately because rebinding does not change them. Reopening
the handbook reads changed bindings without a page reload.

Content is held in statically imported modules so the existing local server
and static build include it without new service paths or network dependencies.
No framework, backend or build-time search dependency is needed.

Tests: [manual.test.mjs](../tools/manual.test.mjs) checks the bilingual data,
chapter coverage, referenced gameplay pages and search boundaries;
[manual-browser.test.mjs](../tools/manual-browser.test.mjs)
checks the real page, language persistence, fullscreen accessibility, narrow
layout, focus, input isolation and pause/resume.
