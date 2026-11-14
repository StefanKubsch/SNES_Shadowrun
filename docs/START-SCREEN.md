# Monitor startup screen

User direction, 2026-11-02: centre the project identity, Start Game button and
loading/start status inside the virtual monitor, already processed by the CRT
filter. Use the supplied Shadowrun logo with a small "Enhanced" subtitle.
This is browser interface artwork, not a claim about the original SNES title.

## Presentation

[start-screen.mjs](../src/browser/start-screen.mjs) draws an event-driven
256 by 224 RGBA interface. The supplied logo, subtitle, Start Game rectangle
and wrapped status text form a centred block within the active game picture.
The logo is contained proportionally, with compensation for the PAL model's
nonsquare pixels while CRT is enabled. Plain output redraws it for square
pixels. The monitor's existing bezel crop, underscan, cylindrical projection,
scanlines, grille, wires, colour and brightness/contrast all apply to this UI.
The first real game frame removes the startup block. Later pause messages and
refused debug room requests appear in a small bottom-centred filtered panel;
a successful debug room request clears that panel. The return-exit hint stays
in the menu button's tooltip, so it cannot cover gameplay after leaving the
room. Errors restore the startup screen and its usable start button. A missing
logo falls back to text.

While data loads, the status and percentage sit inside a green progress track
in the same filtered raster. Progress counts the 30 completed data placement
stages, including their supporting downloads and reconstruction, plus final
readiness with the selected language. Stages have equal weight; this is not a
byte or time estimate. The track disappears when Start Game becomes available
or loading fails, leaving the ready or error message. A semantic HTML progress
element shares the live status label and stays visually clipped with the other
accessible controls. No timer simulates progress.

The original H1, button and live status remain semantic HTML, visually clipped
to avoid duplicate unfiltered content. Keyboard focus is shown on the raster
button. Its native Enter/Space activation is preserved, and pointer activation
uses the same exact inverse CRT projection as game input. A background click
or drag into the button does not activate it. Startup clicks never set the
game's mouse buttons. The menu and cross-origin-isolation warning remain
ordinary browser UI outside the tube.

## In-game start menu

The game menu opened after the title has four entries: New Game, Saved Game,
Options, and Credits (German: Mitwirkende). Credits uses the original menu
font, arrow, highlight and input navigation; it is absent from the browser
burger menu. Up and Down wrap across all four rows. Selecting Credits plays
the existing ending sequence with the ending room's music. B or Start ends
it and returns to the start menu. Options and the saved-game submenu keep
their existing rows and behaviour.

The live game enables this port addition explicitly. Source equation checks
without that setting continue to compare the original three-row menu. The
cold-start pixel comparison also disables the extra row explicitly; the
separate live credits checks exercise the default four-row menu in both
languages.
Recorded pad inputs reproduce the new selection; the legacy credits event
remains readable for older recordings.

## Signal composition and retained source

[createCrt](../src/crt/crt.mjs) accepts `setOverlay(pixels)` for straight-alpha
RGBA at source resolution, or `setOverlay(null)` to clear it. Encoded channel
values blend over the opaque source before the normal input upload, DAC model
and CRT passes. For alpha byte `a`, each channel is rounded as
`floor((overlay*a + source*(255-a) + 127)/255)`. The alpha channel of the
display signal is opaque. Overlays follow the existing input quantization;
they do not get a separate high-resolution output or an extra GPU pass.

`source()` still returns the submitted raw frame, without UI or mutation.
Snapshots show the final displayed composition. New game frames are combined
with the current overlay when one is active. Invalid overlay lengths fail
before changing it. WebGL and 2D fallback use the same composition; clearing
the overlay restores the original plain pixels exactly.

The UI raster and overlay are updated only when state, logo, focus or hover
changes. Ordinary gameplay uploads the original frame directly, with no UI
copy or extra frame queue. A source-sized composite buffer (229,376 bytes) is
allocated lazily and reused; active live status panels require a copy/blend
when the underlying game frame changes. The offscreen Canvas2D raster and
its readback are also source-sized. Browser image caches are implementation
dependent. No input or simulation timing is changed.

## Logo provenance

- User source: [ShadowrunLogo.png](../Ressources/ShadowrunLogo.png).
- Runtime copy: [shadowrun-logo.png](../src/browser/shadowrun-logo.png).
- Both are unchanged, byte-identical PNGs: 1500 by 729, 1,682,260 bytes.
- SHA-256: `BB15215918BE7552D3437C7F71D4D2D0FB45140D3A28CCC09BF5430BFA9C3B8C`.

The browser server exposes only the named runtime image, not the Ressources
directory. Source artwork remains lossless and untouched; raster downsampling
occurs only during presentation. No image generation was used for this logo.

## Verification

[start-screen-browser.test.mjs](../tools/start-screen-browser.test.mjs) checks
loading progress with deliberately held downloads, the rasterized track and
its label, successful readiness and a failed download without false completion;
all four UI regions, semantic content, full CRT/reference agreement, exact
curved pointer activation, background rejection, plain output, keyboard start,
error recovery and the transition to the first game frame. A refused debug
room request followed by a successful request clears the overlay and restores
the underlying picture, including subsequent frames. Source bytes, the cleared
overlay, image dimensions, alpha and plain-output pixels are checked exactly.
For the filtered flat-colour fixture only, each RGB channel may differ by at
most one code between redraws. Independent alpha
cases exercise WebGL and 2D, fresh frames under a retained overlay, invalid
length rejection, source immutability and exact clearing. The existing live
browser comparison still consumes the unchanged native frame, including while
paused. Screenshot: `monitor-start-screen.png` in the focused browser log folder.

### GPU comparison diagnosis, 2026-11-07

The former bit-for-bit filtered redraw assertion failed in two release groups.
An isolated five-page GPU probe reproduced the same 2,199 differing RGB
channels twice, with a maximum difference of one code, unchanged source bytes,
no WebGL errors, and an exactly cleared overlay. Float readback located the
large difference in SPOT: identical LIGHT samples could produce adjacent
RGBA16F results, for example green 0.03631591796875 versus 0.036285400390625.
The browser/driver mechanism behind that arithmetic variation is not proved.

Disabling dithering, selecting a high-precision SPOT sampler and declaring its
output invariant did not remove the discrepancy. Diagnostic shader variants
with precomputed Gaussian weights or accumulation around the centre value
reduced the output differences but still left up to 24 one-code differences.
They are not product changes. The existing filtered pipeline retains its
equations, targets and performance. GLSL precision and invariance have distinct
contracts ([GLSL ES 3.00, sections 4.5 and 4.6](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf));
the probe does not establish bitwise repeatability for this browser/driver.

The test now exercises both plain and filtered output. Its exact state and
source checks establish overlay removal; the one-code filtered RGB limit
rejects larger differences without requiring bitwise equality of float-filtered
redraws. This is a regression limit for this fixture, not a global error bound
for CRT profiles or arbitrary images. Diagnostic logs are retained under
`.cache/logs/overlay-diagnosis*.log`.
