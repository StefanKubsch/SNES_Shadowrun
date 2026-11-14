# PVM bezel

User decision, 2026-11-02: use the supplied Sony PVM-20M2E photograph as an
optional monitor surround, with its own switch, enabled by default. It is
visible only while the CRT filter is available and enabled.

User decision, 2026-11-05: replace the photographic overlay with the
supplied pixel-style version of the same front (11 KB instead of 530 KB,
closer to the game's look). Canvas, front view and screen opening are
unchanged; see [Artwork and provenance](#artwork-and-provenance).

Later user direction on the same date: preserve the complete front fascia,
including its HR marking, indicator and Sony logo, while clearing the upper
lid, lower speaker/control deck and residual inner grey glass strips. Preserve
the approved front proportions and remove unused transparent space from its
displayed view.

The logo, small Enhanced subtitle, Start Game and startup status are now
centred in the screen opening and processed by the CRT rather than placed
above/below the monitor. See [START-SCREEN.md](START-SCREEN.md).

## Controls and rendering

The **Options → Graphics** overlay's **Monitor bezel** button toggles the bezel independently.
Its preference is stored as `shadowrun.crt.bezel.1`. Turning CRT off with F9
or **CRT picture** hides the frame and disables its button without losing
that preference. Switching CRT back on restores the selected frame state.
If the PNG cannot load, the page retains the normal canvas layout and the
game remains usable.

The same overlay's **Window zoom** button switches between **100%** (default)
and **200%**, saved as `shadowrun.window.zoom.1`. It scales the complete front
and game picture together, including the start screen. At 100% the front is
640 CSS pixels wide, or 90% of the viewport on smaller windows; 200% doubles
that width. Large views remain reachable by scrolling. The same zoom applies
with the frame or CRT disabled. Fullscreen retains its viewport fit and
restores the selected window zoom on exit.

The Options button sits immediately outside the front's upper right corner,
with its top edge aligned to the bezel. It follows both window zoom levels;
when the enlarged view exceeds the window, scroll right to reach it.

The bezel is a static, decorative image above the game canvas, with transparent
background and screen opening. It ignores pointer events. The existing CRT
passes, source frames, audio, recordings and frame queue remain unchanged.
Browser compositing displays the PNG separately; no additional CRT pass is
introduced. The 1254 by 1254 RGBA image occupies about 6 MiB when decoded;
browser image caches and compositor storage are implementation-dependent.

The PNG retains its original 1254 by 1254 square canvas. The browser displays
only the tightly enclosing front view: source-pixel rectangle `(48,152)` with
width 1162 and height 920, leaving about two to four pixels of exterior padding
at its straight edges. Its aspect is 1162/920. The artwork is offset inside this
view and scaled uniformly, never stretched to the container. The cleared lid
and control deck therefore occupy no layout space. Fullscreen contains this
front view within both viewport dimensions: width is the smaller of viewport
width and `100vh * 1162/920`; height follows the aspect ratio.

The enlarged glass opening uses source-pixel rectangle `(142,261)` with width
972 and height 706. Its normalized position is derived relative to the front
view, rather than the square image. The controller fits the active game
picture's projected bounds into 98% of that opening, preserving its aspect
ratio and centring it. With the assumed cylinder, the enclosing bounds include
the top/bottom extrema at the centre between the corners; the controller uses
`layout.bounds`, falling back to `layout.picture` for planar profiles. The
larger 4:3 canvas crops the surrounding PAL/underscan padding behind the
cabinet; the complete active 256 by 224 picture remains visible. The remaining
narrow vertical border follows the projected picture's aspect ratio.
These positions fit this artwork; they are not hardware calibration values.
CSS clipping keeps hidden canvas padding under the cabinet from receiving
pointer input. The pixel-style matte is binary (alpha 0 or 255); the test's
one-alpha-unit edge tolerance remains for antialiased artwork. Opaque cabinet
pixels cannot cover the active picture.

On a landscape display the canvas occupies part of the display height with
the complete front visible. Scanlines and grille therefore have fewer output
pixels than in the frame-free view. Turning the frame off restores the larger
picture. No source aspect-ratio or monitor-profile change compensates for this.
Mouse coordinates use the canvas's fractional CSS content bounds and the same
inverse cylinder projection as the shader, avoiding clientWidth/Height rounding
in percentage layouts. Cylinder assumptions and footprint limits are documented
in [CRT-FILTER.md](CRT-FILTER.md#curved-surface). These CSS offsets crop the
already edited artwork; they do not reshape its photographed front.

## Artwork and provenance

Current artwork (2026-11-05):

- Supplied pixel-style front:
  [pvm-20m2e-bezel.png](../Ressources/pvm-20m2e-bezel.png), copied unchanged
  to the runtime overlay
  [pvm-20m2e-bezel.png](../src/browser/pvm-20m2e-bezel.png): 1254 by 1254
  RGBA, 8 bit, binary alpha, 11,645 bytes. At the user's request the
  supplied 17,415-byte file lost its 5,770-byte `caBX` provenance chunk
  (2026-11-05); only IHDR, IDAT and IEND remain, and the decoded pixels are
  byte-identical.
- SHA-256 (both copies):
  `D152503101EDB8707AF2CF4AB198BB7D846843FBE1E80933F95B1EA6856E8946`.

Geometry check against the photographic overlay (alpha at least 128):

| Measure                     | Photographic overlay        | Pixel-style overlay   |
| --------------------------- | --------------------------- | --------------------- |
| Canvas                      | 1254 by 1254                | 1254 by 1254          |
| Opaque front bounds         | (50,156), 1155 by 912       | (51,156), 1154 by 911 |
| Glass opening, rows 300-940 | x 141 to 1114               | x 141 to 1114         |
| Opening edge, 5 columns     | top 255-260, bottom 951-970 | each within 1 pixel   |
| Visible only in this one    | 850 pixels                  | 1,935 pixels          |
| Faint matte residue         | 35,963 pixels, alpha 1-127  | none                  |

Both fit the unchanged `FRONT` view `(48,152)` 1162 by 920 and `GLASS`
opening `(142,261)` 972 by 706 in
[bezel.mjs](../src/browser/bezel.mjs), so no layout constant changed. The
user deleted the earlier source photograph from `Ressources/`.

Previous photographic overlay (2026-11-02 to 2026-11-05), kept in git history:

- Supplied original: `Ressources/PVM-20M2E-1-1000x1000w.webp`, 1000 by 1000,
  18,462 bytes, SHA-256
  `1D441FB86E947D8E52D437B08045FDBE704A77FC47D0B0B777C8B0FB16CDB15A`.
- Overlay: 1254 by 1254 RGBA, 542,277 bytes, SHA-256
  `71F1ADD2F261DE9FEDE9F8F4847F0CBB21B063E557A5DF44FC397ACCD28EABE5`.

The first full-cabinet overlay was edited with the built-in imagegen tool in
two passes: extraction and alpha cleanup. The current asset adds two accepted
edits: clearing lid/deck on the original square canvas, then clearing the inner
left/right/bottom glass strips. The user approved the preserved front shape.
It is AI-derived decorative artwork, not a pixel-identical
copy of the photograph or evidence for the monitor's physical geometry.
The original photograph remains the source reference. The static PNG lives
with the browser interface, outside the generated analysis/assets directories,
so `rebuild:artifacts --clean` preserves it. The browser server exposes this
named PNG only; it does not expose the Ressources directory.

## Verification

[bezel-browser.test.mjs](../tools/bezel-browser.test.mjs) checks default and
stored preferences, CRT gating, reload, missing-image fallback, unavailable
CRT, transparent aperture, active-picture coverage, fractional mouse mapping,
the tight front aspect, uniform image scaling, transparent removed regions,
fullscreen fitting and plain-picture restoration in real Edge. Coverage checks
intersect the matte with the actual inverse-projected active picture, excluding
the unused corners of its enclosing box. It preserves
`bezel-fullscreen.png` in its browser log directory. The existing CRT browser
comparison still checks reference light, controls, plain-output identity and
fullscreen input.

The same browser test file checks both window zoom sizes, proportional canvas
and artwork scaling, source-coordinate mapping, actual CRT output resolution,
stored selection after reload, fullscreen entry and exit, plain output and
scroll access in a narrow window.

The compact-front focused check passes with about 98.05% aperture-width
coverage and the same one-alpha-unit matte tolerance. In the 800 by 600
fullscreen fixture the front is about 757.81 by 599.98 CSS pixels and the
4:3 canvas height is 541.5 pixels, versus 392.61 before the compact crop with
the same curvature: about 38% larger linear picture dimensions. The complete
active picture and mouse mapping remain checked. Logs:
`.cache/logs/crt-compact-focused.log`; screenshot:
`%TEMP%/snes-browser-frame-BdfbLA/bezel-fullscreen.png`. The separate grid
preview is `.cache/crt-curvature-bezel.png`.

## Image prompts

Built-in imagegen, transparent background enabled. Current accepted front edit
used the earlier full-cabinet PNG; the strip cleanup used that accepted output.
Both kept the original square canvas and normalized positions. Runtime crop is
performed by CSS as described above. Final saved project image:
`src/browser/pvm-20m2e-bezel.png`.

Current front edit:

```text
Use case: background-extraction. Edit the supplied image as an ALPHA MASK EDIT ONLY. CRITICAL: keep the EXACT SAME SQUARE CANVAS, same object scale, same object pixel placement and ORIGINAL 4:3-era monitor proportions. DO NOT CROP, DO NOT RESIZE, DO NOT STRETCH, DO NOT RECOMPOSE, DO NOT REDRAW. Keep all retained RGB pixels visually identical. The user's last generated edit was rejected because it stretched the monitor into a widescreen shape. This edit must preserve the original original monitor shape. Change ONLY alpha: make the light grey top lid above the dark front fascia fully transparent; make the speaker/control deck below the SONY-bearing front fascia fully transparent; clear the thin residual grey glass strip immediately INSIDE the real black recessed screen bevel so the whole glass aperture is transparent. Preserve the complete dark front fascia, HR Trinitron marking, indicator window, SONY logo, entire black recessed bevel, front corners, original screen opening proportions and lighting at their EXACT existing locations. Removed top/bottom areas must stay as EMPTY TRANSPARENT SPACE on the SAME ORIGINAL SQUARE CANVAS. It is essential NOT to crop to landscape and NOT to enlarge the remaining front. The application will crop the transparent outer margins itself later. Output genuine RGBA transparency inside and outside the bezel, no checkerboard pixels, no grey screen fill, no replacement scene. The original source canvas is 1254 by 1254; retain a square canvas and preserve every retained element's normalized original geometry.
```

Current inner-strip cleanup:

```text
Use case: background-extraction. Edit target: the supplied approved 1254x1254 square transparent PVM FRONT PANEL cutout. ONE VERY LOCAL ALPHA CLEANUP ONLY: remove the narrow, flat grey strips bordering the transparent screen hole on the LEFT, RIGHT and BOTTOM, by making these strips fully transparent. These residual strips are NOT the real black recessed bevel: they lie immediately inside it, on the glass plane. On this source the left strip is approximately x=136..151 from y=263 to 937, the right strip approximately x=1105..1121, and the bottom strip follows the shallow curved band around y=937..959. Widen the transparent hole through those narrow strips until it meets the true inner edge of the angled black bevel. The dark sloping side bevels (roughly x=77..136 and x=1121..1178) and bottom sloping bevel (roughly y=960..993) MUST remain intact. Follow their original actual contours; do not cut a new rectangular aperture or erase the black bevel. Preserve every other part of the approved front panel: the complete grey front fascia, HR Trinitron marking, upper indicator and SONY logo, original 1254x1254 square canvas, exact position, scale, screen shape and proportions. Top lid and bottom control deck are already removed: preserve that alpha. Do not crop, resize, stretch, redraw, recolour or recompose anything. The user explicitly approved this geometry and requests ONLY those remaining inner grey strips to become transparent. Output real alpha zero for the newly cleared strips and existing hole/exterior, clean antialiased edge pixels, no checkerboard painted as content.
```

### Initial full-cabinet artwork (historical)

Built-in imagegen, transparent background enabled. Pass one used the supplied
WEBP as its edit target; pass two used the first generated PNG. Final saved
project image: `src/browser/pvm-20m2e-bezel.png`.

Pass one:

```text
Use case: background-extraction. Asset type: transparent photographic CRT monitor bezel overlay for a native browser game's CRT view. Edit target: the supplied original photograph of the Sony PVM-20M2E; this is the exact object to preserve, not a style reference. Primary request: make ONLY the white/near-white background outside the monitor, the floor shadow outside the monitor, and the entire grey glass screen interior fully transparent alpha. Keep the monitor cabinet, top surface, inner black plastic screen surround, Sony logo, speaker, every button and dial, all small original labels, texture, proportions, perspective and lighting as unchanged as possible. The screen opening should be a clean transparent hole following the actual gently curved glass boundary, with only subtle antialiased edge pixels. No grey glass, reflections, replacement image or tint should remain inside that opening. The overlay must work over a live game canvas. Keep the complete original framing and centred square composition with the monitor entirely visible, retaining the original screen and cabinet geometry rather than redesigning or straightening the device. Preserve the exact original Sony lettering; do not invent text or controls. Do not add any objects, scenery, border or drop shadow. Output an actual RGBA transparent cutout, with fully transparent outside AND screen hole, NOT a checkerboard drawn as content.
```

Pass two:

```text
Use case: background-extraction. Edit the supplied transparent CRT bezel cutout. One targeted repair ONLY: clean its alpha matte. Remove every stray white/yellow/grey fragment floating outside the monitor cabinet, especially all the specks above its top surface. All space outside the cabinet and the complete large screen opening must be exactly transparent. Keep the complete photographed cabinet, controls, Sony logo, dimensions, placement, perspective and colours unchanged. Keep a clean antialiased silhouette with no white fringes. Do not crop, resize, redesign or redraw the monitor. No opaque black fill and no drawn checkerboard: output real alpha transparency both outside and in the screen hole.
```
