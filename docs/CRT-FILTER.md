# CRT filter

As of 2026-11-02. Code: [src/crt/](../src/crt/) ([crt.mjs](../src/crt/crt.mjs),
[geometry.mjs](../src/crt/geometry.mjs), [signal.mjs](../src/crt/signal.mjs),
[beam.mjs](../src/crt/beam.mjs), [area.mjs](../src/crt/area.mjs),
[screen.mjs](../src/crt/screen.mjs),
[colour.mjs](../src/crt/colour.mjs), [shaders.mjs](../src/crt/shaders.mjs),
[profiles.mjs](../src/crt/profiles.mjs), [controls.mjs](../src/crt/controls.mjs)),
used in [start.mjs](../src/browser/start.mjs). Tests:
[crt-geometry.test.mjs](../tools/crt-geometry.test.mjs),
[crt-controls.test.mjs](../tools/crt-controls.test.mjs),
[crt-colour.test.mjs](../tools/crt-colour.test.mjs),
[crt-screen.test.mjs](../tools/crt-screen.test.mjs),
[crt-beam.test.mjs](../tools/crt-beam.test.mjs),
[crt-area.test.mjs](../tools/crt-area.test.mjs),
[crt-curved-area.test.mjs](../tools/crt-curved-area.test.mjs),
[crt-shaders.test.mjs](../tools/crt-shaders.test.mjs),
[crt-signal.test.mjs](../tools/crt-signal.test.mjs) and
[crt-signal-boundaries.test.mjs](../tools/crt-signal-boundaries.test.mjs) (Node),
[crt-browser.test.mjs](../tools/crt-browser.test.mjs) (real Edge).

## Goal

The game picture as on a Sony PVM-20M2E, fed by a PAL Super Nintendo
SNSP-CPU-1CHIP-01 or SNSP-CPU-1CHIP-02 with C11 replaced by 470 nF, over a
PAL RGB cable. The filter models
the signal path instead of painting on a look:
scanlines come from the beam profile, colours from the phosphor, sharpness
from the bandwidth. It can be switched on and off; switched off, the page
shows the pixel picture as before.

## Structure (generic)

The module `src/crt/` knows nothing about the game. It only needs two
profiles, which are plain data with sources:

- **Source profile:** picture size, pixel clock, position in the raster,
  pixel format and the video standard (active line duration, active lines,
  aspect ratio). For us `SNES_PAL_RGB` with `PAL_625`.
  Its optional `rgbOutput` describes the source voltage and output network;
  the receiving load and reference-white voltage belong to the monitor.
- **Monitor profile:** values of the tube and electronics from the
  manufacturer's documents. For us `SONY_PVM_20M2E`.

Interface:

```js
const crt = createCrt(canvas, { source, monitor, enabled });
crt.draw(pixels); // RGBA, format per source profile
crt.setEnabled(false); // takes effect at once, redraws the last picture
crt.setControls({ brightness: 0.02, contrast: 1.2 }); // black-level bias and light gain
crt.setOverlay(uiPixels); // source-sized straight-alpha RGBA, null clears it
crt.controls; // copy of the current settings
crt.toSource(clientX, clientY); // screen point to source pixel (mouse)
crt.layout; // aspect ratio and position of the picture
crt.snapshot(); // output in device pixels (tests)
crt.source(); // retained raw input frame, without the optional UI overlay
```

The module sets the canvas aspect ratio itself and computes at full device
pixel size (ResizeObserver). The tube needs WebGL2 with float targets
(`EXT_color_buffer_float`); without them there is only the pixel picture
(`available` is then false and the button disappears), without WebGL2 with
2D. Another project only needs its own profiles.

In Shadowrun: the button "CRT picture" in **Options → Graphics** and the key F9 (not
bindable, like P). The choice stays in the browser (`shadowrun.crt.1`); the
default is on (user 2026-10-30). The mouse maps through `toSource` and
therefore hits in both modes.

The independent **Monitor bezel** switch shows a photographic PVM-20M2E bezel
only while CRT is enabled. It defaults to on and keeps its own preference.
The complete monitor fits fullscreen; switching the frame off restores the
larger canvas. Artwork, geometry and tests: [CRT-BEZEL.md](CRT-BEZEL.md).

The monitor's startup UI uses the supplied Shadowrun logo, a small Enhanced
subtitle, Start Game and status text. A source-resolution RGBA overlay is
composited before the ordinary CRT input upload. It shares all signal and
surface effects; no GPU pass or frame queue is added. `source()` retains the
unmodified game input while snapshots show the composition. Normal gameplay
with no overlay uploads that input directly. See [START-SCREEN.md](START-SCREEN.md)
for composition, accessibility, logo provenance and tests.

The **Graphics** overlay's **CRT settings** contains Brightness and Contrast sliders
and Restore defaults. They update the last picture immediately, including while
paused, and persist separately (`shadowrun.crt.controls.1`). They are disabled
when the CRT is off and hidden when it is unavailable. Defaults (0% brightness,
100% contrast) reproduce the previous output. Slider keyboard input stays with
the control instead of reaching the game's key bindings.

## Monitor controls

The model uses `L = contrast * max(V + brightness, 0)^gamma` in the LIGHT pass,
after the monitor low-pass and before beam spreading, grille, halation and output
encoding. This follows the gain and black-level terms of BT.1886 Annex 1,
retaining the existing profile gamma 2.25 rather than replacing it with 2.4.
The contrast multiplier is equivalent to a drive-voltage gain of
`contrast^(1/gamma)` before the gun characteristic. Higher contrast keeps black
at zero with neutral brightness; positive brightness lifts black, negative
brightness cuts off the darkest levels. Both alter the light that feeds halation.
Light above reference white is retained through the float passes; only output
encoding clips to the screen range, after the grille has reduced the light.

The Sony manual confirms both front-panel controls work on RGB. It does not
give their electrical range or potentiometer law. The slider mappings are thus
explicit model choices, not measured Sony knob positions:

| Slider     | Range          | Model parameter                                 | Default |
| ---------- | -------------- | ----------------------------------------------- | ------- |
| Brightness | -100% to +100% | bias -0.1 to +0.1 of normalized video amplitude | 0%      |
| Contrast   | 0% to 200%     | relative emitted-light gain 0 to 2              | 100%    |

The existing source-picture window remains the modelled unblanked region:
brightness bias is gated by that same Gaussian-filtered window, so black outside
the picture is not turned into an unbounded luminous area. Beam spread and
halation can still reach the border. This retains the earlier approximation
that the raster surrounding the 256 x 224 source picture is blanked; actual
black pedestal outside that picture and retrace behaviour are not modelled.
There is no automatic gain, frame history, extra render pass or frame delay.

## Stages

1. **Done:** WebGL2 output, switch, geometry of the PAL raster with the PVM's
   underscan, mouse mapping. With the tube, the output shows the usable
   screen area (4:3), the picture in it still without tube physics.
2. **Done, signal path** ([signal.mjs](../src/crt/signal.mjs) as the
   reference, the same computation in the shader):
   - Levels: the PPU stores the 5-bit step after the brightness (2100) per
     channel as `v<<3|v>>2`; the DAC sees `value>>3`, normalized as code / 31. A
     separate analogue brightness formula would have no source, so the
     PPU's brightness model stays authoritative and the PPU unchanged.
   - Stock PAL 1CHIP output: a separate nominal DAC/S-RGB/buffer gain, the
     documented 39 ohm series output, 47 pF shunt, an assumed 2 m coax
     cable (133.4 pF, lumped) and PAL cable/monitor loads precede the
     monitor. Nominal gain is 1.1840 relative to 0.7 Vpp; the causal RC time
     constant is 3.449 ns. Absolute gain and buffer
     idealization are assumptions. Full sources, equations and limits:
     [VIDEO-OUTPUT.md](VIDEO-OUTPUT.md).
     User-selected premise: the 470 nF C11 ghosting modification is already
     installed. Residual ghosting is assumed negligible; brightness-DAC
     settling remains omitted. C11 is separate from the 47 pF AV shunts.
   - Bandwidth: Gaussian low-pass with -3 dB at 10 MHz along the line,
     computed in time (σ about 13 ns, rise 10 to 90 % about 34 ns, roughly
     a fifth of a pixel). Each source DAC level is held over its source pixel
     interval; the combined source RC and monitor response is integrated
     over that rectangle. Outside the
     picture the signal is 0 (blanking); the picture edge is softened with it.
     This source-pixel integration is separate from output sampling: the
     beam stage averages its light over each output pixel's area (see
     Output-area review).
   - Tube: L = V^2.25 with black 0 (Raney measurement, see stage 4;
     previously the general BT.1886 with 2.4); then the sRGB transfer
     (IEC 61966-2-1) for the screen. Midtones thus become darker than in the
     pixel picture, as on a tube.
3. **Done, beam** ([beam.mjs](../src/crt/beam.mjs) as the reference):
   - Spot size from the resolution: 600 TV lines are 300 periods per picture
     height, 7.69 MHz along the line; the low-pass leaves 0.815 there. At 5 %
     residual contrast of the whole system (a model choice, not specified by
     Sony) the Gaussian spot has σ = 0.361 line
     spacings, horizontally 0.260 source pixels.
   - Order as in the tube: voltage after the low-pass, gun characteristic,
     then the spot spreads the light. Three passes: light per source line
     with 8 samples per pixel (float target), spot horizontally, spot
     vertically over every line within four spot sigmas of the output pixel.
   - Scanlines follow from this: in a white area the light between two lines
     falls to about 74 % of the line centre. The line centre of a white area
     is white (the output reference).
   - Each output pixel averages beam light times the filtered grille and wire
     transmission over its area, then adds the separately averaged halo.
     Gaussian products and the linear spot interpolant times the Fourier mask
     are integrated analytically; clipped wire overlap uses quadrature.
     This slightly reduces
     scanline modulation at 1080p (about 3.5 output pixels per raster line)
     and keeps area brightness at every output size.
   - Brightness-dependent spot size (blooming): without a source for the
     relation between beam current and spot, not modelled for now.
4. **Partly done, screen** ([screen.mjs](../src/crt/screen.mjs),
   [colour.mjs](../src/crt/colour.mjs)):
   - Aperture grille of 0.4 mm over 384 mm visible width, R, G, B each a
     third of the pitch (without black separating stripes, assumption).
     Area-true: a white area is on average a third as bright as the line
     centre, the stripe centre as bright as the beam. At 4K about 3 pixels
     per triad (stripes visible), at 1080p 1.5 (only the average effect).
   - The grille uses up to 16 Fourier harmonics with a Gaussian response of
     sigma 0.8 output pixels and an early cutoff below 1e-4. At Nyquist the
     Gaussian retains about 4.25% of a harmonic's amplitude. This suppresses
     aliasing; the finite series guarantees neither zero moiré nor positive
     light at arbitrary scaling. See Screen review for the measured limits.
   - Colour: measured P-22 primaries of a PVM-20M2U, balanced to D65
     (R=G=B is D65 as from the factory), in sRGB or, where screen and browser
     support it, in Display P3 (`output: 'auto'`). The P-22 red lies just
     outside sRGB (clipped there), inside Display P3.
   - Approximations at the user's request (2026-10-30), values in
     [profiles.mjs](../src/crt/profiles.mjs), all marked as assumptions:
     - Halation: a broad Gaussian proxy motivated by internal reflection in
       faceplate glass, with assumed σ 10 mm and an additive gain of 5%.
       This is not a derived optical point-spread function or an energy-conserving
       redistribution: the direct term is not reduced. Three small float targets: mean per source pixel,
       Gaussian horizontally, Gaussian vertically; the stray light lies
       without the grille over the picture and reaches into the black border.
     - Damper wires: two, at 27.3 % and 72.7 % of the screen height, after
       the operating instructions of the Sony GDM-20E21 (each about 8 cm from
       the edge at about 293 mm height; researched by the user), not
       documented for the 20FZ5. Shadow width 0.05 mm (assumption), treated
       as a thin obstruction with a Gaussian shadow; at 4K about a fifth darker, only
       visible on bright areas. The shadow hits only the direct light, not
       the halation.
     - Convergence: red and blue relative to green each a smooth field
       c0 + cu·u + cv·v + cuv·u·v in mm. Model of a well-adjusted set after
       the user's proposal: red-blue distance about 0.2 mm in the centre, up
       to about 0.85 mm in the corners, corners different, below the typical
       Sony figures at the centre (0.6 mm) and edge (1.0 mm). These are not
       guaranteed limits or a measured displacement field.
5. **Time and operation:**
   - Persistence: P-22 blue and green fall to 10 % in well under 100 µs,
     red in a few hundred µs up to about 0.85 ms (sources disagree, for
     example ePanorama "Phosphor decay times in computer monitors"). Against
     20 ms per picture this is invisible on a screen that holds each picture
     until the next; it only matters for stage 6. Not modelled.
   - Done: the button "Fullscreen" in the page menu. With the monitor frame
     enabled the complete cabinet fits the display; without it the game
     canvas fills the available height. Beam and grille follow the canvas's
     actual device-pixel size. Esc is the back key in the game: with the Keyboard Lock API
     (Edge, Chrome) a short Esc goes to the game and a held Esc ends
     fullscreen. Browsers without this API end it with every Esc.
   - Done: brightness and contrast as documented above, with relative ranges
     because the Sony knob characteristics are not measured. The operating
     instructions explicitly exclude aperture correction on RGB (PDF 7).
6. **Optional:** simulation of the beam scan for screens from 100 Hz.

Every stage must finish within the same picture: no additional input delay
(user rule).

## Source contract

The [2026-11-02 research](CRT-RESEARCH.md) checks analogue timing standards,
related Sony M2/M4 and medical-family models, measurement provenance and
CRT metrology. It distinguishes transferable family evidence from still
unmeasured parameters; no physical profile defaults changed in that earlier
block. The subsequent board-specific [video output review](VIDEO-OUTPUT.md)
adds the nominal PAL 1CHIP source network without changing monitor defaults.

- **Sony PVM-20M2E:** Operation and Maintenance Manual
  PVM-14M2U/14M2E/20M2U/20M2E/14M4U/14M4E/20M4U/20M4E
  ([PDF](../Ressources/SONY-PVM-20M2U-20M4U-Operation-Maintenance-Manual.pdf)),
  Specifications PDF 2 to 4 (printed -2- to -4-; PDF page equals printed
  page). For 20M2U/20M2E: 600 TV lines; RGB 10 MHz ±3 dB, 0.7 Vpp at
  75 ohms; aperture correction 0 to +6 dB; Normal 7 % overscan, Under 5 %
  underscan of the usable screen area; H and V linearity under 5 %;
  convergence centre 0.6 mm, edge 1.0 mm (typical); colour temperature
  D65/D93 switchable, USER 3200 to 10000 K, factory D65. 20M2E: P-22
  phosphor (the 20M4E has EBU phosphor; the 20M4U has SMPTE-C). The local PDF
  has no useful text layer; specifications were read from its page images.
- **Underscan:** read as a raster 5 % smaller in each direction, centred in
  the usable screen area. Interpretation, not literally documented.
- **SNES:** 224 lines with 2133 bit 2 = 0 (Book I, PDF 133, page 2-27-18).
  The manual describes the time base only for NTSC (262 lines).
- **PAL model:** a 52 µs analogue picture window, 288 active lines per field,
  progressive input and 4:3. These define the existing reference geometry;
  they do not establish the SNES's actual blanking or first active line.
  The previous attribution of 702 active samples to BT.601 was incorrect.
  [ITU-R BT.601-7](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.601-7-201103-I!!PDF-E.pdf),
  Annex 1, Part A, Table 4, PDF 10, printed 8, specifies **720** active samples
  per RGB channel at 13.5 MHz (53 1/3 µs). This digital window is distinct
  from the chosen analogue window; no geometry change follows from this
  citation correction without a source for the PAL SNES output.
- **Electronics model:** the Gaussian response with exactly -3 dB at 10 MHz
  is an approximation consistent with the stated frequency-response figure,
  not a measured transfer function of this monitor. Sony does not specify
  a Gaussian curve, the spot profile or 5% limiting contrast.
- **Tube characteristic:** the original general BT.1886 gamma 2.4 was replaced
  by the measured PVM-family gamma 2.25 below. Black is zero at neutral controls.
- **Monitor controls:** Sony Operating Instructions 3-859-663-25(1),
  [manufacturer PDF](https://pro.sony/s3/cms-static-content/operation-manual/3859663251.pdf),
  Location and Function of Parts and Controls, PDF/printed pages 6 and 7:
  CONTRAST and BRIGHT turn up clockwise; the RGB exclusions name PHASE,
  CHROMA and APERTURE, not BRIGHT or CONTRAST. No voltage range, knob law or
  calibrated light levels are specified there. This is separate from the
  game's PPU brightness register, whose output remains authoritative.
- **Control equation:** [ITU-R BT.1886 (03/2011)](https://www.itu.int/rec/R-REC-BT.1886-0-201103-I/en),
  Annex 1, PDF page 4, printed page 2: `L = a * max(V+b,0)^gamma`, with `a`
  the legacy contrast gain and `b` the legacy brightness black-level lift.
  Used here for the control roles and equation, not as a measurement of the
  PVM-20M2E's internal circuit, knob response or gamma. The normalized ranges
  and gating to the existing picture window are implementation assumptions.
- **Error function:** Abramowitz/Stegun 7.1.26 (error below 1.5e-7), the
  same in JavaScript and GLSL.
- **Result:** a pixel is about 1.388 times as wide as high on the screen;
  the picture fills 92.5 % of the active line and 77.8 % of the lines.

- **Picture tube:** spare parts list of the manual PDF 92, printed 110: PICTURE TUBE 20FZ5
  (DARK), 8-736-135-05, for 20M2U/E; deflection yoke Y20FZA.
- **Sony data sheet PVM-M Series** (filed by the user,
  [PDF](../Ressources/Sony_PVM_14M2U_Datasheet_2016218115534.pdf), Specification
  table on local PDF page 3, unpaginated) for the PVM-20M2U: AG pitch 0.4 mm,
  P-22, visible picture size 48.0 cm
  diagonal, 600 TV lines, convergence centre 0.6 mm, edge 1.0 mm. Per the
  spare parts list the 20M2E has the same tube.
- **Phosphor measured:** Keith Raney, Sony PVM-20M2U (danmons,
  colour_matrix_adaptations,
  [raw dataset](https://raw.githubusercontent.com/danmons/colour_matrix_adaptations/main/csv/inputs.csv),
  row `Raney_PVM_20M2U`; taken
  over in ChthonVII/gamutthingy as `P22_trinitron_raney1`): red
  0.630/0.345, green 0.285/0.605, blue 0.150/0.065, characteristic gamma
  2.25. The white of the row is the nominal D93 point, not a measurement;
  the CSV supplies no measuring conditions. Dan Mons's first-party account
  identifies serviced units and colourimeter profiling; raw sweeps, meter
  details and uncertainty remain absent (see CRT-RESEARCH.md). Found by the
  user, values checked in the raw file.
- **Output spaces:** sRGB after IEC 61966-2-1. Display P3 uses P3 primary
  chromaticities with D65 and the sRGB transfer curve, rather than the cinema
  white/transfer curve. Checked against [CSS Color 4, 29 October 2026 draft](https://www.w3.org/TR/2026/CRD-css-color-4-20261029/),
  sections 10.2 and 10.4; section 19's `lin_sRGB_to_XYZ` and `lin_P3_to_XYZ`
  supply independent reference coefficients for the matrix tests.
- **Earlier third-party source (2026-10-30):** crtdatabase.com names for the
  PVM-20M2U and PVM-20M2MDU the tube Sony Trinitron M49KGH11X, 49 cm
  (19 inch visible), aperture grille, 600 TVL; the tube page names P22
  (standard medium persistence), 90° deflection, inline guns, 28 kV.
  This identification is superseded for the 20M2E model by Sony's parts list
  naming 20FZ5 (DARK); do not transfer the other tube's details to this profile.

## Profile review

The historical 2026-11-01 review of [profiles.mjs](../src/crt/profiles.mjs)
preserved every then-exported value and object shape. It expanded the data into readable
fields, translates all comments into English and puts assumptions next to
the affected parameters. Profiles perform no per-frame work; adding caches,
factories or validation to this data module would not improve its hot path.
No speed or memory reduction is claimed for this step.

The Sony specifications and tube identity were rechecked on the local
manual's PDF pages 2-4 and 92 (printed 2-4 and 110). Pitch and visible
diagonal were rechecked in the data sheet's Specification table on PDF 3;
the previous PDF 2 citation pointed to feature descriptions. These sources
support the documented monitor figures, not a complete signal transfer model.

| Parameter                     | Evidence and limit                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PAL reference window          | 52 µs and 288 lines remain model geometry. BT.601's digital window is 720 samples, not 702; it does not prove PAL SNES blanking.                                     |
| RGB bandwidth                 | Sony specifies 10 MHz +/-3 dB. Gaussian shape and exactly -3 dB at 10 MHz are approximations.                                                                        |
| Source output                 | PAL 1CHIP stock output network and nominal family gain, separate from monitor bandwidth. See [VIDEO-OUTPUT.md](VIDEO-OUTPUT.md) for circuit sources and assumptions. |
| Resolution                    | Sony specifies 600 TV lines. The 5% contrast threshold, Gaussian spot and inferred vertical spot width are model choices.                                            |
| Tube and screen size          | Sony lists 20FZ5 (DARK) for 20M2U/E. The 20M2U data sheet gives 0.4 mm pitch and 480 mm visible diagonal; 384 mm width derives from 4:3.                             |
| Surface and perspective       | User-approved cylinder: 1100 mm horizontal radius, 384 mm chord and 600 mm frontal viewing distance. Radius and distance are assumptions, not Sony specifications.   |
| Phosphor and gamma            | The Raney row was rechecked against the raw dataset. Transfer from a measured 20M2U to the 20M2E remains an assumption; measurement conditions are absent.           |
| White and convergence         | D65 is Sony's factory setting and the user's choice. Sony's convergence figures are typical, not guaranteed bounds or a measured error map.                          |
| Underscan and optical effects | Per-axis underscan, grille duty cycle, halation, damper wires and convergence field remain explicitly assumed.                                                       |

GPU/reference agreement checks implementation consistency. Physical claims
also need independent source evidence; matching implementations can share
the same incorrect model. Source gaps remain documented under Model assumptions
and source limits; they are not pending hardware-measurement tasks.

## Curved surface

User-approved implementation, 2026-11-02: the PVM profile uses a convex cylinder
with a **1100 mm horizontal radius** and a **600 mm frontal viewing distance**.
The existing 384 mm screen width is interpreted as the horizontal chord. Its
centre-to-edge depth is `R - sqrt(R*R - (W/2)^2)`, about **16.886 mm**. The
vertical section is straight. The assumed viewer sits opposite the centre,
without tilt or head tracking. This gives a subtle recession of the left and
right edges and curves horizontal grid lines under perspective, while vertical
grid lines remain straight.

Sony's [CTV-25R1 training manual](https://device.report/m/4f5b6d38ab36f009736f3d44f50c70e54f0b3715d3b210f010c26dda4908505f.pdf#page=11),
"The Trinitron Screen", PDF page 11, printed page 7, describes the classic
Trinitron face as cylindrical: flat vertically, curved horizontally. It also
explains the electronic pincushion correction. This is family evidence for
the surface type, not a radius specification for the 20FZ5. The user supplied
1000-1200 mm as an experience-based estimate, without a measured tube-specific
source, and authorized the proposed 1100 mm approximation. Neither that
estimate nor the assumed 600 mm distance is a hardware calibration. Glass
refraction, faceplate thickness, reflections and tube-specific deflection
errors are outside this geometry model.

The existing raster maps linearly to horizontal chord position `X = W*(u-0.5)`
and vertical position `Y = H*(v-0.5)`. This preserves the existing profile's
spatial scaling; it does not reinterpret the raster as uniform arc-length
steps. With depth `Z = R - sqrt(R*R-X*X)`, perspective multiplies both centred
coordinates by `D/(D+Z)`. No brightness multiplier is applied: this model
reprojects surface radiance, rather than redistributing a fixed image energy.

The final BEAM pass intersects each output ray with this cylinder before
sampling light, convergence, grille, wires and halo. The CPU reference uses
the same geometric contract. Local inverse-map derivatives scale the beam
footprint, grille pitch/phase and wire width/position, keeping the existing
0.8-output-pixel mask filter. The area integrals use a **local rectangular
footprint**: horizontal-to-vertical shear and changing derivatives inside one
output pixel are omitted. At the current profile and 4:3 aspect the shear
across one output pixel is below 0.055 output pixels over the full canvas.
This geometric scale is not a global radiometric error bound; tiny canvases
and other profiles can have larger integration errors. The earlier convergence
quadrature figures below describe its planar diagnostic and do not establish
an error bound for the combined curved rendering. The Combined curved-area
review below now quantifies sampled differences for the current combined model;
it does not establish a global error bound either.

`layout.picture` remains the unprojected raster rectangle. Curved layouts also
expose `surface` and the projected picture's enclosing `bounds`, including
top/bottom extrema between the corners. The bezel fits these bounds, preserving
the complete active picture. `sourceToOutput` and `outputToSource` use the same
forward/inverse projection for mouse tests and gameplay. Border coordinates
remain outside the source. Profiles without `curvature`, or with it set to
`null`, retain the planar path; CRT off retains the exact square-pixel output.
Invalid/nonfinite dimensions and cylinder views that do not intersect the full
canvas are rejected before GPU allocation.

The projection is part of the existing final shader pass: no extra render pass,
texture, retained frame or queue is introduced. GPU service time remains a
measurement question, separate from the unchanged frame queue.

The current curved profile was measured with `node tools/crt-benchmark.mjs 10`
on an RTX 4070 through Edge/ANGLE D3D11 (hardware backend, valid nondisjoint
GPU timer). Median full CRT GPU service time was 0.652 ms at 1440 by 1080
and 1.736 ms at 2880 by 2160; median submission time was 0.040 and 0.038 ms.
These ten-sample diagnostics describe this implementation and machine, without
a controlled before/after comparison or an end-to-end latency claim. Allocated
textures total 9,771,520 bytes. Logs: `.cache/logs/crt-curvature-benchmark.log`;
full result: `%TEMP%/snes-crt-benchmark-rxJIN0/result.json`. Grid previews with
and without the surround are `.cache/crt-curvature-bezel.png` and
`.cache/crt-curvature-grid.png`.

## Geometry review

The historical 2026-11-01 planar review of [geometry.mjs](../src/crt/geometry.mjs) made the
coordinate contract explicit: normalized output/raster coordinates start
at the top left; source positions use seconds horizontally and raster lines
vertically. Source pixel coordinates refer to edges, so the first pixel
centre is (0.5, 0.5). The inverse transform intentionally leaves points in
the border outside the source rather than clamping them onto edge pixels.

The existing geometry is internally consistent with the profile assumptions:
one source row per raster line, a centred default picture and equal underscan
on both axes. No signal-flow correction or new hardware calibration was
justified. The 52 µs / 288-line window remains an explicit model choice.
Calculations expect positive dimensions, clocks and active intervals, and
an underscan value that leaves a nonzero raster. Both coordinates must be
supplied when an explicit source position is used.

The pixel-aspect expression simplifies to
`aspect * activeLines / dotClockHz / activeLineS`: source dimensions cancel.
It needs no temporary rectangle. The planar CRT output layout transforms its own
fresh rectangle in place, constructing two objects instead of three per call.
Different calls never share a rectangle, and input profiles are not modified.
There is no cache or additional retained state. Output layout and inverse
mapping keep the existing operation order; the simplified pixel-aspect
expression can differ in floating-point rounding only.

The geometry tests now also cover a different raster with independently
specified rectangles, explicit zero and asymmetric positions, pixel centres
and far edges, points beyond the border, unchanged pixel aspect under source
resizing, absent underscan and separate ownership of returned layouts.
Existing signal and real-browser tests cover the beam/renderer consumers.

A Node v24.14.0 microbenchmark used 64 varying source profiles, one million
calls per sample, eight alternating before/after samples and a 100,000-call
warmup. Median times were 15.30 to 9.61 ms for `pixelAspect` and 23.36 to
22.46 ms for `outputLayout`. Full samples and checksums are preserved in
`.cache/logs/crt-geometry-benchmark.log`; the original module is retained in
`.cache/crt-geometry-before.mjs`. The small layout timing difference does
not establish a reliable speedup. Object counts above describe source-level
construction, not measured heap bytes; the engine may eliminate temporaries.
`pixelAspect` currently has no product caller, and layout is set at startup
or toggling, not per rendered pixel. No game FPS, GPU or input-latency gain
is claimed; the recorded texture-memory baseline is unchanged.

## Controls review

The 2026-11-01 review of [controls.mjs](../src/crt/controls.mjs) preserves
defaults, slider limits and normalization behaviour. Brightness is a voltage
bias; contrast is an emitted-light gain. Their ranges are still the relative
model choices documented above, not newly calibrated Sony knob positions.
This module only prepares settings; the signal equations are unchanged.

Normalization now names both fields directly instead of using
`Object.entries`, a mapping callback and `Object.fromEntries`. A small helper
accepts finite numbers and clamps them with the existing min/max operations.
Strings and other value types are not coerced. Each missing or invalid field
falls back independently; valid contrast zero is retained. Malformed stored
JSON restores defaults. Every result is a fresh mutable object, while defaults
and limit arrays remain frozen. Extra stored keys are ignored.

The rewrite removes six temporary arrays and the mapping callback per
normalization at source level. It adds no cache or retained state; this is
not a claim about measured heap bytes or engine allocation elimination.
Additional tests cover partial settings, exact bounds, valid zero gain,
independent field fallback, unrelated stored keys and result ownership.
Existing signal and browser tests retain the checks for light behaviour,
stored settings, slider input, reset and keyboard isolation.

A Node v24.14.0 microbenchmark used ten varying inputs, one million calls
per sample, eight alternating before/after samples and a 100,000-call warmup.
Median normalization time fell from 390.47 to 25.24 ms, with matching result
checksums. Full samples: `.cache/logs/crt-controls-benchmark.log`; original
module: `.cache/crt-controls-before.mjs`. Normalization runs when settings
are initialized or changed, not per frame in the production renderer.
No game FPS, GPU, texture-memory or input-latency improvement is claimed.

## Signal review

The historical 2026-11-01 review of [signal.mjs](../src/crt/signal.mjs) retained the
documented DAC, bandwidth, tube and output-transfer equations. The PPU's
brightness is already present in the incoming 5-bit code and is not applied
again. Gaussian bandwidth and linear DAC response remain assumptions. No
new monitor calibration or hardware effect was introduced at that stage.
The 2026-11-02 [board-specific source stage](VIDEO-OUTPUT.md) subsequently
adds source gain and a causal output RC to these held-level equations.

The source signal is piecewise constant over pixel intervals [i, i+1).
`lineVoltage` integrates the Gaussian over those intervals, rather than
treating source pixels as impulses. Adjacent intervals share a boundary:
reusing that CDF value reduces evaluation count from 14 to 8 for the default
seven-pixel neighbourhood. Accumulation order and sample order remain the
same. No arrays, cache or retained state are added. The finite kernel is not
renormalized. At this review, wider Gaussian profiles needed an explicit
reach and LIGHT retained seven intervals. The 2026-11-02 support review below
makes both default reaches follow sigma.

`controlledLight` uses the shared immutable neutral defaults instead of
creating an empty parameter object when settings are omitted. Partial
settings keep their prior defaults. Brightness still biases voltage before
the gun curve, contrast scales emitted light, and values above reference
white remain available to later optical stages. Clipping stays in the final
output encoding. The shader and render pipeline are unchanged in this step.

Independent Simpson integration of Gaussian density checks nonuniform held
source levels without using the implementation's erf/CDF approximation.
Additional checks cover both picture edges, retained blanking/truncation
losses, partial controls and output-only clipping. Existing real-browser
tests compare the CPU reference against neutral and adjusted GPU output.

A Node v24.14.0 microbenchmark used 200,000 line evaluations per sample,
eight alternating before/after samples and a 20,000-call warmup. Median
time fell from 50.63 to 39.66 ms. All 2080 source-grid positions and 2000
additional fractional positions matched the old implementation exactly in
the recorded comparison. Full samples: `.cache/logs/crt-signal-benchmark.log`;
original module: `.cache/crt-signal-before.mjs`. This speeds the CPU reference,
not the production shader; no game FPS, GPU or texture-memory gain is claimed.

The stage description now distinguishes source-pixel integration from output
sampling. Neither LIGHT nor the final horizontal sample interpolation
explicitly integrates the horizontal output-pixel area. Its anti-aliasing
behaviour on small outputs therefore is not established by this source
integration. The existing vertical footprint approximation is a separate
operation. This boundary remains visible for the beam/shader review.
The Output-area review later replaces both with output-pixel area integration.

## Colour review

The 2026-11-01 review of [colour.mjs](../src/crt/colour.mjs) preserves all
profile values and the colour equations. Matrices are row-major and multiply
column vectors. All operations use linear light, preserve negative and
above-white values, and leave output encoding/clipping to the final stage.
Chromaticities must have nonzero y and independent primaries; the existing
profile preconditions are unchanged.

`rgbToXyz` constructs primary XYZ columns and solves their scale factors so
white has Y=1. It now uses a matrix-vector product for that solve instead of
padding the white vector into a mostly zero 3x3 matrix. Column scaling reuses
the newly constructed matrix. Inversion scales its own adjugate array rather
than mapping into another array; multiplication preallocates nine entries.
Inputs are not modified, results remain separate arrays and no cache is added.
At source level this removes four temporary arrays per `rgbToXyz`, or nine
per `phosphorToOutput`; it is not a measurement of actual heap allocation.

`phosphorToOutput` preserves XYZ while expressing phosphor light in output
RGB. It performs no chromatic adaptation. The current monitor and both output
profiles use D65, so white remains neutral. A different source white would
retain its XYZ chromaticity rather than silently becoming output white.
An equal-energy white test makes this existing behaviour explicit; no new
monitor preset or physical calibration is introduced.

New tests compare all nine sRGB and Display P3 RGB-to-XYZ coefficients against
the independent W3C matrices, check non-symmetric matrix orientation and
unclipped values, preserve a different white in XYZ, and verify frozen inputs
and independent arrays. Existing phosphor and browser/reference tests remain.

A Node v24.14.0 microbenchmark used 16 varying primary sets, two output
spaces, 100,000 calls per sample, eight alternating before/after samples and
a 10,000-call warmup. Median `rgbToXyz` time fell from 24.32 to 8.99 ms;
`phosphorToOutput` fell from 55.75 to 21.58 ms. Compared coefficients and
result checksums matched exactly. Full samples: `.cache/logs/crt-colour-benchmark.log`;
original module: `.cache/crt-colour-before.mjs`. Matrix construction happens
at renderer/reference initialization, not per frame in the GPU renderer.
No game FPS, GPU, texture-memory or input-latency improvement is claimed.

The matrix checks do not validate the browser's output colour-space state.
The current renderer selects `drawingBufferColorSpace = 'display-p3'` once
when a wide-gamut output is chosen, and does not restore sRGB when CRT is
disabled. Raw source bytes can therefore retain a P3 interpretation in that
mode. The renderer review below fixes this boundary and adds browser coverage.

## Screen review

The 2026-11-01 review of [screen.mjs](../src/crt/screen.mjs) preserves the
grille, thin-wire and convergence equations and all profile values. The file
is fully English and formatted. Coordinates refer to the full usable 4:3
screen, including its border: grille pitch is in output pixels; wire positions
are fractions of screen height; convergence returns millimetres, with positive
x rightward and positive y downward. Callers supply output pixel centres.
The convergence field shifts the beam, while grille and wires stay fixed.

The ideal mask has duty 1/3 per channel and unit combined RGB coverage. Its
Gaussian convolution is positive, but truncating its Fourier series does not
preserve that guarantee. The previous absolute positivity and moiré-free
claims were incorrect. At pitch 1.5 pixels the reference mask ranges from
0.331324 to 0.335342; at pitch 3 from 0.198881 to 0.469795. Numerical spatial
integration of rectangular stripes agrees within 5e-5 for tested pitches
0.5 through 12 pixels. Tiny negative values already occur at pitch 12 (about
-6.4e-7); at an extreme pitch of 96, ringing reaches -0.0641 and 1.0492.
This last scale would require a 92,160-pixel-wide output with the current
profile. Neither clamping nor changing the series is justified for the
documented target screens; the shader retains the same model.

Wire shading uses wire width in output pixels times a unit-area Gaussian,
with sigma 0.8 pixels. It approximates a finite opaque wire's convolution,
without integrating a pixel box. Against independent finite-width integration,
the absolute shadow error stays below 0.002 for the current profile at 1080
and 2160 output lines. This is a model comparison, not a monitor measurement.
At large widths or overlapping wires the sum saturates at one, so the former
unqualified area-preservation claim does not apply there. Missing wires return
zero. The JS reference can sum any number of wires; the current GPU pass has
two wire slots, matching the supplied profile.

The shared bilinear-field helper replaces a per-call closure. Wire Gaussian
denominators are computed once as scalars. Returned convergence arrays stay
independently owned, and profiles are never modified. No cache is introduced.
The added screen tests use independent spatial quadrature, channel coverage,
phase and periodicity, physical scaling, finite-width wire comparisons,
saturation and hand-calculated asymmetric convergence fields. Existing real
Edge tests cover the complete shader/reference path.

A Node v24.14.0 microbenchmark used 500,000 calls per sample, eight alternating
before/after samples and a 100,000-call warmup. Median grille time was 94.93 to
95.32 ms, wire shading 30.93 to 31.15 ms, and convergence 17.74 to 17.41 ms.
These small differences establish no reliable speedup. All sampled outputs
and checksums matched exactly. Full samples and scale ranges are retained in
`.cache/logs/crt-screen-benchmark.log`; the script is `.cache/crt-screen-review.mjs`
and the original module is `.cache/crt-screen-before.mjs`. These functions
serve the CPU reference; the GPU code is unchanged. No game FPS, GPU,
texture-memory or input-latency improvement is claimed.

## Beam review

The 2026-11-01 review of [beam.mjs](../src/crt/beam.mjs) preserves all profile
values, stage order and numerical equations. The spot inverse now names its
units: TV lines specify half as many cycles per active raster height; the
electronics response is evaluated in Hz; inferred isotropic Gaussian sigma
is converted into raster-line spacings and source pixels. Gaussian shape,
vertical isotropy and 5% limiting contrast remain assumptions, not additional
Sony measurements. Positive dimensions and bandwidths are required; the
limiting contrast must lie strictly between zero and the electronics response
at that frequency, giving a positive spot sigma.

`spotWeights` and `gaussWeights` share one discrete Gaussian implementation.
It normalizes the newly built array in place instead of allocating a second
array and callback. Every call still owns its kernel; accumulation and division
order stay the same. The frame reference lazily shares its two halo kernels
across RGB images, replaces per-sample lookup closures with plain helpers and
skips zero-energy halo images entirely. Profiles and frame bytes are borrowed
and must stay unchanged throughout a reference's lifetime. Lazy rows/images
belong to that one reference; separate frames need separate references.

At this review the reference filtered held voltage, applied controls and the gun curve,
then spreads emitted light. Horizontal spot convolution uses eight point
samples per source pixel and final linear interpolation between two texels.
It does not integrate the horizontal output-pixel area, so minification
filtering remained incomplete until the later Output-area review. The then-fixed
two-source-pixel margin is superseded by the 2026-11-02 support review.
Kernels use zero outside their images
and retain edge losses rather than locally renormalizing them.

Vertically, replacing a pixel box by a Gaussian with variance
`sigmaLines^2 + footprint^2/12` matches variance, not the exact box convolution.
Independent box integration differs by less than 0.002 in the tested density
samples for footprints 0.14 and 0.28 lines. The five-row sum never widens with
this footprint. For the current spot at a line centre, its missing fraction
against a 201-row sum is below 1e-13 at 1080p/4K, but about 0.52% at footprint
3 and 15.21% at footprint 6. Other phases and picture edges have their own
losses. The then-fixed +/-6 white-centre normalization was intended for the
current narrow spot; the 2026-11-02 support review below widens it according
to spot sigma. The supplied GPU caps (spot +/-64 texels, halo +/-128) exceed the
current required reaches of 7, 23 and 32, respectively. Wider profiles need
explicit support checks in the shader/renderer work. The Output-area review below
replaces this variance matching and the fixed five rows.

Halation starts from means of the pre-spot light within source-pixel columns;
the two-pixel light margin is not part of this halo base. Its Gaussian sigma
in mm is converted through the underscanned picture, with ceil(3*sigma)
margins and finite normalized kernels. The halo is bilinearly sampled at
unshifted picture coordinates, without grille or wire shading, and added as
`gain * energy * halo / 3`. Direct light is retained in full: the nominal 5%
is an additive model gain, not a proved conserved fraction of total energy.
The current GPU still runs halo passes even when that gain is zero.

The new tests independently specify a forward MTF with known spot widths,
rational Gaussian coefficients, physical halo dimensions, exact box quadrature,
and an impulse's held-voltage integral before nonlinear spreading. They also
check output sample centres, additive halo scaling, light beyond the picture,
fresh result arrays and isolation between references. Real Edge comparisons
continue to cover the full shader/reference path.

A Node v24.14.0 benchmark used eight alternating before/after samples. For
100,000 kernel builds (10,000 warmup), the median fell from 54.34 to 34.65 ms.
For five fresh references plus their first RGB pixel of a synthetic 32 x 24
frame (three warmup), the median was 60.39 to 58.80 ms with the existing halo
gain; that small difference does not establish a reliable speedup. With gain
zero it fell from 60.08 to 7.86 ms by avoiding unused halo work. Checksums
match, and 64 sampled RGB pixels per energy setting matched exactly. Logs:
`.cache/logs/crt-beam-benchmark.log`; reproduction: `.cache/crt-beam-review.mjs`;
original: `.cache/crt-beam-before.mjs` (imports redirected to the source modules).
The kernel helper also serves renderer initialization, but shaders, GPU passes
and texture allocations are unchanged. No game FPS or input-latency gain is
claimed.

## Shader review

The 2026-11-01 review of [shaders.mjs](../src/crt/shaders.mjs) formats GLSL
inside its template strings explicitly; Prettier only formats the surrounding
JavaScript. Passes, uniforms, coordinates, normalization and sampling limits
are readable. All profile values and model equations are retained. Final
picture coordinates start at the top left, while intermediate textures store
source data rows addressed directly by `gl_FragCoord`. The tests distinguish
these conventions with asymmetric rows and pixel centres.

LIGHT now shares each CDF boundary between adjacent held source intervals,
as the CPU reference already does. This reduces CDF evaluations for the seven
interval weights from fourteen to eight; picture-window coverage still needs
two additional evaluations. Accumulation order and finite support remain the
same. Default eightfold sampling gives binary-exact interval positions; other
sampling ratios may differ in floating-point rounding. In BEAM, a uniform
zero-energy branch skips the four halo texel reads. The renderer still
allocates halo textures and runs all three halo-building passes, including
at zero energy; this review changes only the final sampling work. The
renderer review below removes those halo targets and passes at zero energy.

| Pass      | Sampling/support contract                                                                                                                                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PLAIN     | Nearest source texel inside the picture rectangle; black outside, without transfer encoding.                                                                                                                                                                                                                                                           |
| LIGHT     | At the 2026-11-01 shader review: seven held source-pixel intervals. The 2026-11-02 support review derives the reach from sigma. Blanking outside the source, Gaussian voltage response, controls and gun curve remain; neither truncated weights nor blanking are renormalized.                                                                        |
| SPOT      | Discrete Gaussian in oversampled texels, radius at most 64; normalization includes weights outside the texture whose light is zero.                                                                                                                                                                                                                    |
| HALO_BASE | Mean over a positive integer oversample count at most 16; source columns only, excluding the light margin, with a separate zero halo margin.                                                                                                                                                                                                           |
| HALO_BLUR | Separable discrete Gaussian, radius at most 128, with full-support normalization and zero outside the image.                                                                                                                                                                                                                                           |
| BEAM      | Rows within four spot sigmas of the output pixel, each integrated exactly over its height; spot samples integrated exactly over its width. The former 64-row/128-texel caps were removed on 2026-11-02. Sixteen grille harmonics with a 1e-4 window cutoff, two wire slots, additive unshifted halo, colour matrix, then clipping and output transfer. |

These are implementation bounds, not newly measured hardware characteristics.
The supplied profile fits the discrete kernel caps. A wider LIGHT response
could lose appreciable voltage in its former seven intervals; a test with an
explicitly short reach retains that finite-support loss. The new automatic
wide-kernel test covers sigma two source pixels without it. At this review, strong minification still
lacks horizontal output-area integration and still broadens vertical variance
without widening the five-row sum (see Beam review). The later Output-area
review makes that coordinated reference/shader sampling change. Finite grille ringing,
thin-wire approximations and additive halo accounting remain as documented.
No profile validation or rendering-state changes are hidden in the GLSL.

The new real Edge tests use a minimal static page and
[crt-shader-probe.mjs](../tools/crt-shader-probe.mjs) to compile and draw all
exported passes into RGBA32F targets. Twelve fixtures use independent spatial
Gaussian quadrature for held DAC levels and grille stripes, exact rational
Gaussian coefficients for spot/halo, explicit halo averages and an asymmetric
colour matrix. They cover row orientation, pixel centres, blank borders,
finite-support losses, nonlinear stage order, light above one, convergence,
wire shadows, zero/nonzero halo and clipping only after colour conversion.
The 2e-5 absolute tolerance applies to these float probes, not to a complete
RGBA16F product render. Existing real-browser tests separately retain the
full production pipeline comparison against the JS reference.

Focused verification passes 13/13 tests (twelve fixtures plus the parent),
without skips: `.cache/logs/crt-shaders-focused-4.log`. Three earlier launches
used the restricted sandbox and stalled before the first shader checkpoint;
the elevated run completed in about one second. Their logs remain as
`crt-shaders-focused.log`, `crt-shaders-focused-2.log` and
`crt-shaders-focused-3.log` under `.cache/logs/`. Local Edge/CDP checks need
the same authorized execution permission as the release check. No sandbox
configuration was changed.

An isolated before/after GPU run used 40 draws per case, eight warmup frames,
neutral controls and the existing source pattern, with only the served shader
module exchanged. Edge 156.0.4314.50 used the NVIDIA GeForce RTX 4070 through
ANGLE/D3D11; the backend was hardware and no timer query was disjoint.

| CRT output  | GPU median before / after (ms) | GPU p95 before / after (ms) |
| ----------- | ------------------------------ | --------------------------- |
| 1440 x 1080 | 0.2870 / 0.2826                | 0.2907 / 0.2895             |
| 2880 x 2160 | 0.5594 / 0.5550                | 0.5622 / 0.5825             |

This small difference does not establish a reliable speedup. Complete-output
SHA-256 hashes, taken outside the measured draws, match before/after for both
resolutions with CRT on and off. Texture allocations remain 9,771,520 bytes;
the renderer adds no passes, targets or frame history. These measurements
do not establish game FPS or input/display latency improvements.

Full JSON: `.cache/logs/crt-shaders-before-benchmark.log` and
`.cache/logs/crt-shaders-after-benchmark.log`. Browser/result directories:
`C:/Users/Stefan/AppData/Local/Temp/snes-crt-benchmark-idyvNX/` and
`C:/Users/Stefan/AppData/Local/Temp/snes-crt-benchmark-6yYUgs/`. Reproduction:
`.cache/prepare-crt-shader-benchmark.mjs` prepares the two benchmark scripts,
using `.cache/crt-shaders-before.mjs` as the original module. All other
renderer modules stay current in both versions.

## Renderer review

The 2026-11-01 review of [crt.mjs](../src/crt/crt.mjs) formats the renderer
with Prettier and separates kernel checks, tube pass construction, wire
uniforms and GPU object ownership. Profile values, equations, pass order and
shader inputs for the current profiles are unchanged.

- **Colour space:** plain output passes source bytes through and is always
  tagged sRGB. Only enabled tube output uses `drawingBufferColorSpace =
'display-p3'`, and only where the browser exposes that property; otherwise
  the tube matrix stays sRGB, also for an explicit `'display-p3'` request.
  `output` reports this tube space. Switching CRT retags before redrawing.
  Unknown `output` values are rejected. In headless Edge, copying the
  asymmetric colour (200, 60, 120) from a P3-tagged buffer into an sRGB 2D
  canvas yields (217, 42, 121), matching the CSS Color 4 matrices; the
  plain picture copies bit exact. The old renderer fails this test.
- **Shader limits:** before any GPU allocation, the renderer rejects source
  level bits outside 1 to 8, an oversampling factor above 16, a spot reach
  above 64 texels, a halo reach above 128 texels (only with nonzero energy)
  and more than two damper wires. One wire uses the second slot one screen
  height above the top, where its Gaussian underflows to zero.
  The 2026-11-02 review adds an explicit bound on sigma-derived LIGHT reach.
- **Zero halation:** without energy the renderer allocates no halo targets
  and runs none of the three halo passes; BEAM samples no halo texels and
  receives the complete source texture on unit 1. The current profile has
  halation, so its work is unchanged.
- **Ownership:** every texture, framebuffer and program is deleted by
  `destroy()`, which is idempotent; shaders are deleted after linking.
  Drawing or taking a snapshot afterwards throws. The last drawn array is
  kept without copying for redraws, as before.

Complete-output SHA-256 hashes at 1080p and 4K, CRT on and off, match the
shader-review results on the hardware GPU; texture allocations remain
9,771,520 bytes. The intermediate targets are still allocated while CRT is
off. No timing change is claimed; per-frame work for the current profile is
unchanged. Log: `.cache/logs/crt-renderer-review-hashes.log`.

## Output-area review

The 2026-11-01 coordinated change of [beam.mjs](../src/crt/beam.mjs) and BEAM
in [shaders.mjs](../src/crt/shaders.mjs) replaces point sampling with the mean
direct beam light over each output pixel's area. Profiles, earlier passes,
grille, wires, halation and colour handling are unchanged. This is sampling,
not new hardware evidence: the Gaussian spot remains a model assumption.

- **Vertical:** each row's Gaussian line (sigma 0.361 lines) is integrated
  exactly over the output pixel's height, `(erf((d + f/2)/(sigma*sqrt 2)) -
erf((d - f/2)/(sigma*sqrt 2))) / (2f)` for footprint f in lines. This
  replaces the variance-matched Gaussian. Rows reach `LINE_REACH = 4`
  sigmas beyond the pixel's box instead of a fixed five rows, so the support
  grows with minification; each omitted tail holds below 3.2e-5 of a line's
  light. Both implementations use the same erf approximation (1.5e-7).
- **Horizontal:** the linear interpolant of the spot samples is integrated
  exactly over the output pixel's width with hat-function integrals. The
  shader computes these weights once per channel and pixel; up to four
  texels (all footprints below two samples, which covers 1080p and 4K)
  use a fixed four-texel path, wider boxes a loop.
- **Point limit:** footprints below `BOX_MINIMUM = 1e-3` lines or samples use
  point sampling, where the box difference would lose float precision.
- **Former caps:** this review used at most 64 rows and 128 texels per row,
  with no run-time size check. Those caps could truncate pictures narrower
  than about 16 output pixels or lower than about 4. The 2026-11-02 support
  review below removes them and checks tiny outputs against the reference.
- **Approximations at this stage:** grille, wires and halation were still
  evaluated at the pixel centre; the grille's own 0.8-pixel Gaussian remains
  its filter. The product of mean light and centre mask is not the area
  mean of their product. The Product-area integration below replaces this
  centre sampling. Convergence still shifts the box without changing its size.

The new reference tests check the vertical weight against independent
quadrature, box sampling against exact piecewise-linear integrals, and beam
energy conservation: summed mean light times pixel area stays within 1e-4
for outputs from 512 x 384 down to 3 x 2. The old reference deviates by up
to 100% there (a 4 x 3 output lost the lit pixel entirely). A new isolated
shader fixture covers 1.5 source pixels and four lines per output pixel;
a real 64 x 48 product canvas agrees with the reference within 1/255.

Comparison against the previous reference on the browser test pattern,
sRGB bytes (`.cache/logs/crt-output-area-compare.log`, script
`.cache/crt-area-compare.mjs`, previous module `.cache/crt-beam-area-before.mjs`):

| Output height | Max byte change | Changed values | White-area mean before / after |
| ------------- | --------------- | -------------- | ------------------------------ |
| 2160          | 2               | 0.30%          | 0.30386 / 0.30385              |
| 1080          | 3               | 1.37%          | 0.30371 / 0.30371              |
| 600           | 5               | 6.82%          | not measured                   |
| 300           | 14              | 37.5%          | 0.30426 / 0.30356              |
| 96            | 53              | 31.0%          | 0.30054 / 0.30344              |
| 48            | not measured    | not measured   | 0.25186 / 0.30344              |

GPU time rises. Edge 156.0.4314.50, RTX 4070/ANGLE D3D11, 40 samples, no
disjoint queries; texture allocation stays 9,771,520 bytes and CRT-off
output is unchanged:

| CRT output  | GPU median before / after (ms) | GPU p95 before / after (ms) |
| ----------- | ------------------------------ | --------------------------- |
| 1440 x 1080 | 0.2840 / 0.3994                | 0.2884 / 0.4045             |
| 2880 x 2160 | 0.5560 / 0.9206                | 0.5714 / 0.9255             |

Variants measured during the change: six-sigma rows with per-row weights
1.41 ms at 4K, shared weights 1.14 ms, then four-sigma rows 0.92 ms. Exact
per-pixel texel counts were slower through divergent branches. Logs:
`.cache/logs/crt-output-area-before-benchmark.log` and
`.cache/logs/crt-output-area-after-benchmark.log`. No game FPS or input
latency is claimed; the CRT pass adds about 0.37 ms GPU time at 4K here.
User decision 2026-11-01: keep this sampling and cost for now.

## Kernel support and tiny outputs

The first 2026-11-02 change coordinates signal.mjs, beam.mjs, shaders.mjs and
crt.mjs. It changed numerical support, retaining the physical profile and
the then-existing centre sampling of grille, wires and halation. The next
review below replaces that centre sampling.

- LIGHT and the reference now default to
  `max(3, ceil(6 * sigmaVoltage + 20 * sourceTau))` source
  pixels on either side of the current interval. At least six sigmas of
  each Gaussian tail are included: combined omitted mass is below 2e-9,
  before numerical error; the added RC tail contributes less than `exp(-20)`.
  The original pure-Gaussian bound remains applicable when sourceTau is zero.
  The current profile
  still uses seven intervals. An explicit short reference reach remains
  available for truncation tests, without renormalization.
- The renderer checks the LIGHT radius against 64 before canvas access or
  GPU allocation. Wider profiles fail explicitly. Voltage sigma must be
  finite and positive. Spot, halo, oversampling and wire limits remain.
- Light/spot targets have enough margin for the voltage's six-sigma tail,
  20 source RC time constants
  and the spot's actual finite support, with a minimum of two source
  pixels. Halo-base addressing and final sampling use the same derived
  margin. The current profile retains its existing target dimensions.
- White-line-centre normalization uses at least six spot sigmas rather
  than always stopping after six rows. The current profile is unchanged.
- BEAM clips row/texel traversal to the actual textures, retaining the
  four-texel path for normal output. Wider footprints visit their complete
  overlapping support; no fixed 64-row/128-texel truncation remains, including
  when a live canvas is resized down to 1 by 1 and back. Work can grow with
  the footprint, but never reads beyond the input textures.

Independent quadrature covers wide voltage fields and both blanking edges.
Isolated float-target fixtures exceed the old row and texel limits separately
and together. The full browser/reference comparison covers sigma two source
pixels, non-neutral controls, derived margins and resizing through 12 by 9,
4 by 3, 1 by 1 and back to 64 by 48.

Isolated hardware measurements: Edge 156.0.4314.58, RTX 4070/ANGLE D3D11,
eight warmups and 40 samples per case, no disjoint queries:

| CRT output  | GPU median before / after (ms) | GPU p95 before / after (ms) |
| ----------- | ------------------------------ | --------------------------- |
| 1440 x 1080 | 0.4004 / 0.3550                | 0.4045 / 0.3635             |
| 2880 x 2160 | 0.8491 / 0.8043                | 0.8612 / 0.8294             |

These runs show no added GPU cost for the current profile; one pair does not
establish a general performance guarantee. Full-output SHA-256 hashes match
before/after at both sizes, CRT on and off. Textures remain 9,771,520 bytes;
there are no additional passes, targets or queued frames. Logs:
`.cache/logs/crt-support-before-benchmark.log` and
`.cache/logs/crt-support-after-benchmark.log`. Raw results are in
`C:/Users/Stefan/AppData/Local/Temp/snes-crt-benchmark-W27Tra/` and
`C:/Users/Stefan/AppData/Local/Temp/snes-crt-benchmark-dc1PzA/`.
`.cache/prepare-crt-support-benchmark.mjs` preserves the four previous modules
from HEAD and prepares the identical before/after measurement scripts.

## Product-area integration

The second 2026-11-02 sampling block coordinates [area.mjs](../src/crt/area.mjs),
the frame reference and BEAM. Each channel now computes
`mean(beam * filteredGrille * wireTransmission) + haloEnergy * mean(halo) / 3`
over a unit output-pixel box. Gain, the colour matrix, final clipping and the
sRGB transfer follow the integral. The previous product of separate beam
means and centre screen samples is historical.

- **Horizontal product:** each piecewise-linear interpolation hat is
  integrated against the same finite, Gaussian-windowed Fourier grille.
  Zeroth and first cosine moments have closed forms. Small arguments use
  stable sinc/moment polynomials below 0.05 radians. The usual four-sample
  path shares interval moments between adjacent hats; wider footprints
  retain complete traversal of overlapping samples.
- **Vertical product:** an unsaturated thin-wire shadow times a Gaussian
  beam line is another Gaussian times their overlap density. Its box
  integral uses the existing erf approximation. If the two shadows can
  exceed one inside the pixel, their existing clamp is retained by composite
  eight-point Gauss-Legendre quadrature, with steps at most one beam sigma
  and 1/32 output pixel. Integration follows the line's support even under
  strong minification; that fallback's eight-sigma tails omit under 1.3e-15.
  Wires with a per-pixel upper shadow bound below 1e-8 are negligible and
  skipped, bounding the relative direct-light error by 1e-8 for positive light.
- **Halo:** integrate the existing zero-extended bilinear halo interpolant
  with separable hat weights on both axes. It remains unshifted and is not
  multiplied by the grille or wires. No border renormalization is introduced.
- **Preserved filter:** ANTIALIAS stays 0.8 in final output-pixel units. The
  Fourier cutoff, 16-harmonic limit and thin-wire Gaussian are unchanged;
  pixel-box averaging is additional to that filter. No supersampled canvas
  changes the filter's width. Finite-series ringing remains possible.
- **Limits:** footprints below BOX_MINIMUM retain the established constant
  beam/interpolant point limit, while still averaging the screen transmission.
  Tiny halo footprints likewise retain their point limit. The convergence
  field is still evaluated at the pixel centre and translates the box;
  variation of displacement across the box and its Jacobian remain an
  approximation. The Convergence footprint review below quantifies why that
  approximation is retained for the current profile.
  Numerical agreement does not calibrate any hardware parameter.

Independent spatial tests convolve ideal rectangular stripes with a fixed
0.8-pixel Gaussian, then integrate their product with interpolation hats.
Wire tests integrate Gaussian beam times clamped transmission, including
overlap, saturation, a 100-line footprint and the point limit. Isolated
RGBA32F shader tests cover nonuniform light, channel shifts, late clipping,
saturated wires and halo impulses crossing interpolation kinks and zero
borders. Existing product tests retain plain-output identity and resize
coverage down to 1 by 1.

Hardware measurement: Edge 156.0.4314.58, RTX 4070/ANGLE D3D11, eight warmups,
40 samples per case, no disjoint queries:

| CRT output  | GPU median before / after (ms) | GPU p95 before / after (ms) |
| ----------- | ------------------------------ | --------------------------- |
| 1440 x 1080 | 0.3823 / 0.5784                | 0.3857 / 0.5837             |
| 2880 x 2160 | 0.8620 / 1.5022                | 0.8653 / 1.5565             |

The added median GPU cost is about 0.20 ms at 1080p and 0.64 ms at 4K in
this isolated measurement. It is not a game FPS or input-latency measurement.
Texture allocation remains 9,771,520 bytes, with the same passes, targets
and queued-frame policy. Full-output plain-mode SHA-256 hashes match the
baseline at both sizes; CRT-on output changes as expected.

Logs: `.cache/logs/crt-product-before-benchmark.log` and
`.cache/logs/crt-product-moments-benchmark.log`. Raw browser/results:
`C:/Users/Stefan/AppData/Local/Temp/snes-crt-benchmark-6ikLoN/` and
`C:/Users/Stefan/AppData/Local/Temp/snes-crt-benchmark-qz7Bn7/`.
`.cache/prepare-crt-product-benchmark.mjs` preserves the baseline modules and
prepares identical measurement scripts. Earlier implementation measurements
are retained in `crt-product-initial-benchmark.log` and
`crt-product-after-benchmark.log`; sharing exact interval moments removes
repeated work from that slower implementation without changing the integral.

## Convergence footprint review

The earlier 2026-11-02 review compared the existing translation at each output-pixel
centre with the same bilinear inverse displacement evaluated throughout the
pixel. It retains the runtime approximation: the measured differences are
small for the then-current assumed profile, while a general spatial integral would
couple the formerly separable horizontal and vertical beam calculations.

Reproduce with `node tools/crt-convergence-review.mjs`; `--quick` runs two
checkerboard cases with lower quadrature orders. The full report is
`.cache/logs/crt-convergence-review.log`, about 269 seconds on this host.
The diagnostic lives in [proof/crt/convergence.mjs](../proof/crt/convergence.mjs)
and is never imported by the game.

The full-report numbers below are historical: they precede the nominal PAL
1CHIP source stage in [VIDEO-OUTPUT.md](VIDEO-OUTPUT.md). The diagnostic now
includes that stage, and the release checks its reference agreement with both
ideal and electrical sources and its bounded convergence cases. The full
561-point report was not repeated for the new source; those older values do
not establish bounds for its brighter output.

The comparison uses the actual source dimensions, assumed monitor profile,
held black/white DAC levels, Gaussian electronics, gun characteristic and
eight-sample horizontal spot interpolant. Its area integration independently
sums point Gaussian line densities with split Gauss-Legendre quadrature.
Horizontal intervals split wherever an interpolant changes slope; vertical
cells span at most one source line and 1/4 output pixel. Orders eight and
twelve are compared in both displacement modes. The mask and wire filters
retain their original 0.8-output-pixel width, pitch, phase and screen positions.
This is not a higher-resolution render that changes those filters.

White, one-source-pixel checkerboard and isolated white-pixel fixtures cover
561 sampled pixels in 21 pattern/size groups: picture edges, screen corners,
centre phases and wire rows. Neutral controls and zero halo isolate the direct
term affected by convergence. Both results use the same phosphor-to-sRGB matrix
and final encoding. Reported code differences are fractional
`255 * abs(sRGBa - sRGBb)` before byte rounding; they do not imply identical
rounded bytes.

| Output      | Sampled pixels | Largest linear RGB difference | Largest fractional code difference |
| ----------- | -------------- | ----------------------------- | ---------------------------------- |
| 2880 x 2160 | 141            | 0.00000469                    | 0.00199                            |
| 1440 x 1080 | 141            | 0.00001993                    | 0.00606                            |
| 400 x 300   | 141            | 0.00017503                    | 0.05478                            |
| 64 x 48     | 57             | 0.00015098                    | 0.17995                            |
| 12 x 9      | 51             | 0.00012223                    | 0.05064                            |
| 4 x 3       | 27             | 0.00010469                    | 0.03796                            |
| 1 x 1       | 3              | 0.00042309                    | 0.12576                            |

The largest observed eight-to-twelve-order refinement change is under
8.6e-9 code units. This resolves the sampled differences; it is not a rigorous
global error bound for all images, controls or monitor profiles. The comparison
uses eight-sigma point tails in both modes to isolate field variation from the
renderer's existing four-sigma row truncation. Separate baseline tests select
the renderer's exact row set, including the floating-point grouping at an
inclusion boundary, and agree with its reference within 3e-6 linear RGB.

Constant fields give identical results in both displacement modes. A deliberately
large synthetic gradient exceeds one fractional code unit under minification;
the tests therefore reject interpreting centre translation as a general affine
or bilinear area integral. A profile change needs a renewed review. The current
profile is retained because its sampled differences are far below one code unit
at 1080p/4K and below 0.18 even at the tested tiny outputs, not because the
approximation is mathematically exact or a physical calibration is complete.

The diagnostic follows the existing convention that displacement coefficients
are evaluated at destination coordinates and subtracted from them. It does not
establish an exact inverse of a source-indexed landing map or an optical
flux-redistribution law. No Jacobian light multiplier is introduced. The actual
monitor's displacement field, spot and transfer function remain unmeasured.
Runtime sources, profiles, shaders, textures, passes and GPU cost are unchanged
in this review; the preceding product-area benchmark remains the current code.

## Combined curved-area review

Completed 2026-11-02 at the user's request. The current PAL 1CHIP electrical
source and curved Sony profile retain their existing runtime approximation.
The new independent spatial comparison found small sampled differences at
1080p and 4K, including picture borders and damper wires. No runtime shader,
profile, pass, texture or frame-queue change was needed.

Reproduce with `node tools/crt-curved-area-review.mjs`. The full report and
per-case progress are in `.cache/logs/crt-curved-area-review.log`; this run took
145.70 seconds. Its numbers were measured with the earlier 0.899 ns source
RC, before the assumed cable capacitance (now 3.449 ns, about 0.018 source
pixels); the review was not repeated. `--quick` selects checkerboards at 1080p and 64 by 48 with
orders six and ten. `--tiny` additionally requests the much more expensive
4 by 3 and 1 by 1 cases. Those two sizes are outside the completed full
review; an earlier exploratory run was interrupted and its partial log is
preserved as `.cache/logs/crt-curved-area-review-tiny-interrupted.log`.

[proof/crt/curved-area.mjs](../proof/crt/curved-area.mjs) integrates three modes:

- **Local:** the renderer's centre intersection, diagonal footprint and
  constant centre convergence displacement.
- **Curved:** the cylinder is intersected throughout the output pixel,
  retaining the centre convergence displacement. This resolves shear and
  changing projection derivatives within that pixel.
- **Spatial:** both the cylinder and convergence field are evaluated throughout
  the pixel. This is the combined diagnostic reference.

The inverse cylinder map independently solves the forward sagitta projection
by Newton iteration. The area integral uses point Gaussian line densities and
split Gauss-Legendre quadrature, without the production `outputToSurface`,
`lineWeight`, `boxSample` or `area.mjs` integrals. Shared inputs are the existing
held-level voltage/nonlinear-light/spot fixture fields, the finite grille and
wire model and the phosphor-to-sRGB matrix. Halation is reconstructed from the
light fields with the same discrete kernels and included at its nonzero profile
energy. It remains unshifted and outside grille/wire shading.

Source interpolation knots are split in both directions, as are halo knots;
vertical cells resolve the Gaussian line density. Orders eight and twelve are
compared in all three modes. Eight-sigma point tails in each mode isolate mapping
differences from the runtime's existing finite four-sigma row selection.
The Gaussian mask filter stays 0.8 output pixels, using diagonal derivative
scales at the current integration position. No Jacobian light multiplier is
introduced. This retains the existing radiance and filtered-mask conventions;
it does not establish an exact optical convolution on a curved tube.

The review samples white, checkerboard and central impulse images at neutral
controls. For each pattern, the larger outputs include 59 positions at projected
picture corners, edges and interior, around wire rows, near the central impulse
and in blank borders. The 12 by 9 output uses nine positions per pattern.
Differences below are maxima over sampled patterns, positions and output
channels, after clipping and sRGB encoding but before byte rounding. One code
unit means one step on a 0 to 255 channel scale.

| Output size | Sampled pixels | Combined maximum, code units | Maximum order-8/order-12 change, code units |
| ----------- | -------------- | ---------------------------- | ------------------------------------------- |
| 2880 x 2160 | 177            | 0.05390                      | 1.67e-11                                    |
| 1440 x 1080 | 177            | 0.07927                      | 4.48e-12                                    |
| 400 x 300   | 177            | 0.56118                      | 2.03e-12                                    |
| 64 x 48     | 177            | 0.83868                      | 8.52e-10                                    |
| 12 x 9      | 27             | 0.43063                      | 2.06e-7                                     |

The largest sampled linear-RGB difference is 0.00170011. Projection variation
accounts for most of the observed difference: its isolated maximum is 0.07486
code units at 1080p and 0.05280 at 4K. The separately measured convergence
variation reaches 0.00703 and 0.00277 code units respectively. These maxima can
occur at different pixels and should not be added as an equality.

[crt-curved-area.test.mjs](../tools/crt-curved-area.test.mjs) checks the independent
inverse against forward projection and numerical derivatives, the local area
integral against the production reference with the same finite row support,
planar/constant-displacement null controls and quadrature refinement. A real
Edge/WebGL2 product render separately agrees with the independently integrated
local approximation within one output byte at the sampled 64 by 48 pixels,
including halation, wire rows and borders. This GPU comparison includes the
product's normal float-target precision; the spatial approximation figures
above compare double-precision diagnostic fields instead.

These are resolved sampled differences for the current profile and fixtures,
not a bound over all images, controls, sizes or profiles, and not a physical
monitor calibration. The documented source and model assumptions still apply.
Changing curvature or convergence requires a renewed approximation review.

## Kernel loop review

Review of 2026-11-04, with GPU time per draw call (timer query around each
pass, two seconds of warm-up). At 1440 by 1080 the passes took LIGHT 0.042,
SPOT 0.067, HALO_BASE 0.001, HALO_BLUR 0.039 (twice) and BEAM 0.433 ms.

SPOT and HALO_BLUR iterated over their full shader caps (-64..64 and
-128..128) and skipped offsets outside the actual reach with `continue`. The
current profile needs reach 7 for SPOT and 23/32 for the halo, so 129 and
257 iterations ran for 15 and 47/65 used terms. Both loops now run from
-reach to +reach and break there, as LIGHT already did. Offsets, weights,
normalization and accumulation order are unchanged; the caps remain. SPOT
fell to 0.014 ms and each HALO_BLUR to 0.014 ms.

The complete 1440 by 1080 output differs from before in 6,345 of 6,220,800
bytes (0.10 %), each by exactly one 8-bit step. The previous output was
deterministic across runs; the difference comes from the driver compiling
the constant-bound loop differently (unrolling and fused operations), not
from changed terms.

BEAM was examined by ablation. Its texture reads, vertical line integrals
and grille moments each cost about 0.13 ms at 1440 by 1080, with about
0.06 ms for setup, curvature and halo. Precomputing the harmonic weights once
per output pixel gave no measurable gain (the compiler already hoists them),
so that change was not kept. Splitting BEAM into a horizontal pass per
source row and a vertical pass would not be exact: the red and blue
convergence shift depends on the output row. BEAM stays unchanged.

`tools/crt-benchmark.mjs` now warms up for two seconds per case instead of
eight frames. With eight frames the first case measured 3.3 ms at 1440 by
1080 because the GPU was still in a low clock state; earlier tables in this
document that used eight warm-up frames may contain such effects.

Same tool, Edge 156.0.4314.58, RTX 4070 through ANGLE/D3D11, 40 samples per
case, no disjoint queries, only the shader module exchanged:

| CRT output  | GPU median before / after (ms) | GPU p95 before / after (ms) |
| ----------- | ------------------------------ | --------------------------- |
| 1440 x 1080 | 0.6308 / 0.5312                | 0.6349 / 0.5372             |
| 2880 x 2160 | 1.6896 / 1.6034                | 1.7386 / 1.7991             |

Textures remain 9,771,520 bytes; passes and targets are unchanged. No game
FPS or input-latency gain is claimed. Logs:
`.cache/logs/crt-loops-before-benchmark.log`,
`.cache/logs/crt-loops-after-benchmark.log` and the cold-start run
`.cache/logs/crt-loops-cold-benchmark.log`. The per-pass timing and ablation
scripts are in `.cache/crt-loops-review/`.

## Formatting and measurement

Prettier is pinned as a local development dependency with a lockfile. The
root configuration uses two-space indentation, single quotes, semicolons
and a target width of 100 characters. Format only the file being reviewed:

```powershell
npm ci
npm run format -- src/crt/profiles.mjs
npm run format:check -- src/crt/profiles.mjs
npm run benchmark:crt -- 40
```

The editor extension uses this local version and configuration. Generated
data, source resources and the historical handoff archive are ignored.
Formatting does not replace review of names, units, equations or GLSL strings.

[crt-benchmark.mjs](../tools/crt-benchmark.mjs) starts a separate headless Edge
without `--disable-gpu`, on an empty local page without game workers, audio
or a second CRT. It records the actual renderer, browser, driver and GPU
feature status, neutral controls and sRGB output. Each case has eight warmup
frames and 40 measured draws of the same deterministic pattern, with one
source pixel changing per draw. A 4:3 picture occupies 1440 x 1080 on a
1080p screen and 2880 x 2160 on a 4K screen.

- `submissionMs` measures the JavaScript call to `draw`, including texture
  upload and command submission; it is not pure JavaScript computation time.
- `gpuMs` uses `EXT_disjoint_timer_query_webgl2`, polls after yielding to the
  browser and discards disjoint results. It is null when unavailable or invalid.
  Reference: [Khronos extension specification](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/).
- `completedWithReadbackMs` includes a synchronous one-pixel readback after
  the draw. That diagnostic overhead serializes samples and is not present
  in the product. GPU queries exclude this readback.
- Texture storage is counted from actual `texStorage2D` allocations. It
  excludes driver overhead and browser compositor buffers. One RGBA8 output
  buffer is listed separately as an estimate, not measured GPU residency.

These are isolated rendering measurements, not game FPS, display latency or
a guarantee for another graphics card. No timer queries, readbacks or extra
frame buffering are added to the product. Existing browser regression tests
retain their separate software-backend setup.

Baseline on 2026-11-01, Edge 156.0.4314.50, NVIDIA GeForce RTX 4070,
ANGLE/D3D11, driver 32.0.16.2101; hardware renderer confirmed, no disjoint queries:

| Output      | CRT | GPU median / p95 (ms) | Submission median (ms) | With readback median (ms) |
| ----------- | --- | --------------------- | ---------------------- | ------------------------- |
| 1440 x 1080 | Off | 0.0246 / 0.0266       | 0.020                  | 0.240                     |
| 1440 x 1080 | On  | 0.2877 / 0.2916       | 0.035                  | 0.545                     |
| 2880 x 2160 | Off | 0.0552 / 0.0594       | 0.020                  | 0.278                     |
| 2880 x 2160 | On  | 0.5591 / 0.5632       | 0.025                  | 0.815                     |

Actual allocated textures total **9,771,520 bytes**: 229,376 bytes RGBA8
source, two 2080 x 224 RGBA16F light/spot targets and three 302 x 288
RGBA16F halo targets. The float targets alone total **9,542,144 bytes
(9.10 MiB)**. The CPU source array is another 229,376 bytes. One estimated
RGBA8 output buffer is 6,220,800 bytes at 1080p or 24,883,200 bytes at 4K.
The renderer currently allocates the intermediate targets even when CRT is
off; the off measurements retain them.

Full logs: `.cache/logs/crt-profile-baseline-readback.log`; raw JSON and
browser log: `C:/Users/Stefan/AppData/Local/Temp/snes-crt-benchmark-c60Rca/`.
The earlier `.cache/logs/crt-profile-baseline.log` is retained for diagnosis:
its CPU completion metric used only `finish()` and is superseded by the
explicit readback metric. GPU times were consistent, but are not combined
with this baseline.

## Target screens and decisions

- User 2026-10-30: development on 4K (3840 x 2160) at 60 Hz; lower limit
  1080p; as generic as possible.
- With the monitor frame disabled, at 4K the picture (4:3, full height) is 2880 pixels wide, the game picture
  in it about 7 pixels per line; at 1080p about 3.5 pixels per line. The
  scanlines can be drawn cleanly in both cases.
- With the complete photographic frame visible, the CRT canvas occupies about
  64.05% of the landscape display height. The active picture fills about 98%
  of the opening's width while retaining its aspect ratio. Scanline and grille visibility then
  follows that smaller output; see [CRT-BEZEL.md](CRT-BEZEL.md).
- Aperture grille: at 0.4 mm pitch and 384 mm visible width (data sheet)
  there are 960 triads, so at 4K about 3 pixels per triad (just
  displayable), at 1080p only 1.5. The model smooths its equal-width stripes
  with a Gaussian in output coordinates and integrates the resulting mask
  times beam light over each output-pixel box.
  At small pitch mainly the average transmission remains; residual ripple
  and aliasing are suppressed, not guaranteed absent (see Screen review).
- White point: D65 (factory setting per the manual, PAL reference white;
  user confirmed 2026-10-30), D93 later as a switch.
- Brightness: area-true, so a white area with the grille is on average a
  third as bright as the output could be (the same at every resolution). A
  brighter screen setting compensates (user 2026-10-30: leave it, no
  compensation in the filter).
- 50 Hz on 60 Hz: the game keeps running at 50 Hz; the judder from pictures
  of unequal length is not a filter question.

## Model assumptions and source limits

User decision of 2026-11-02: real-device measurements are not feasible.
Real-device CRT measurements and calibration are outside the project scope.
The following points document the model's source limits and assumptions;
they are not open measurement tasks or software completion requirements.

- PAL master clock 21.28137 MHz: retained as the existing clock model.
  The target schematic identifies X1 as 17.734476 MHz but does not establish
  its internal multiplication or dot-clock relationship. The Nintendo
  manual does not establish this PAL figure either.
- The SNES's analogue active window and number of active raster lines;
  position of the 224-line picture (line of the first pixel) and horizontal
  position: currently a centred picture in the 52 µs by 288-line model.
- Width of the phosphor stripes and black separating stripes of the 20FZ5;
  position, number and thickness of the damper wires of the 20FZ5;
  faceplate thickness and strength of the halation; actual convergence map
  of a 20M2E. The existing profile values remain explicitly assumed.
- Exact 20FZ5 surface radius and viewing geometry: the curved projection uses
  the user-approved 1100 mm cylinder and an assumed frontal 600 mm distance.
- Persistence times of the P-22; measuring condition of the characteristic
  2.25; exact DAC response and internal output bandwidth of the SNES.
  [VIDEO-OUTPUT.md](VIDEO-OUTPUT.md) supplies the nominal stock PAL 1CHIP
  gain and known external RC network, while documenting the unresolved
  ASIC/S-RGB/buffer response, coupling, clamp and brightness settling.
  C11 is assumed replaced by 470 nF; residual ghosting is treated as negligible.
- Growth of the spot with the beam current (blooming) and the measuring
  condition of the 600 TV lines (residual contrast, brightness); measured
  RGB transfer curve to replace the Gaussian -3 dB approximation.
- Aperture correction (0 to +6 dB per the service manual): the operating
  instructions say this control has no effect on RGB. No correction is modelled.
- Measured BRIGHT/CONTRAST knob characteristics and the exact blanking/pedestal
  outside the source picture; current relative ranges and window are assumptions.

## Tests

- `crt-geometry.test.mjs`: position of the picture in the raster, pixel
  aspect ratio, underscan, mapping back to source pixels, output without
  the tube; explicit positions in seconds/lines, a non-PAL raster, pixel
  centres and unclamped borders, absent underscan and independent rectangles.
  Cylinder checks cover independent sagitta/perspective values, straight
  verticals, source-edge round trips, local derivatives, projected bounds,
  flat fallback and rejection of invalid cylinder/view combinations.
- `crt-controls.test.mjs`: independent defaults for partial/invalid fields,
  exact slider bounds, zero gain, unrelated stored keys and fresh mutable results.
- `crt-colour.test.mjs`: independent W3C sRGB/Display P3 matrices, row-major
  orientation, unclipped values, preserved XYZ white, frozen profile inputs
  and independent result arrays.
- `crt-screen.test.mjs`: spatial Gaussian quadrature of stripes and finite
  wires, channel means/coverage, phase and periodicity, physical units,
  missing/saturated wire shadows and independently calculated convergence.
- `crt-area.test.mjs`: independent spatial stripe convolution times spot
  interpolation hats, beam/wire products, overlap and saturation, minification
  and the point limit, including a covariance case that rejects separate means.
- `crt-convergence.test.mjs`: diagnostic polynomial moments, constant-field
  identity, reference agreement with matched finite support, profile-specific
  refinement checks and a synthetic large-gradient counterexample.
- `crt-beam.test.mjs`: independent forward MTF, rational kernel weights,
  exact vertical and horizontal output-area integrals, energy conservation
  from 512 x 384 down to 3 x 2 outputs, box quadrature, physical halo dimensions, nonlinear-before-spot impulse,
  output centres, additive halo and independent result/frame ownership.
- `crt-shaders.test.mjs`: isolated real Edge float-target fixtures with
  independent per-pass expectations for voltage, spot, halo and final output;
  includes orientation, zero-border losses, nonlinear order, late clipping
  output-area integration beyond the former traversal caps, and a wider
  electronics response checked against held-level quadrature.
- `crt-signal-boundaries.test.mjs`: independent Gaussian quadrature for held
  source levels, both picture edges, unnormalized truncation losses, partial
  monitor controls and clipping only at output encoding.
- `crt-video-output.test.mjs`: PAL source/receiver load equations, nominal
  stock overdrive, separate monitor spot, stable RC/Gaussian response against
  independent circuit quadrature, electrical validation and support rejection.
  The shader probes include the stock circuit and a wider synthetic RC.
- `crt-signal.test.mjs`: DAC steps, -3 dB at 10 MHz, rise time about 34 ns,
  constant field and blanking, characteristic and sRGB; spot size from 600
  TV lines, line centre and gap of a white area; grille (mean a third,
  stripes at 4K, nearly flat at 1080p, negativity bounded within 1e-6 for its
  tested pitches); colour matrices (white
  stays white, each phosphor lands on its chromaticity); halation (width,
  falls with distance, a few percent), wires (position, strength, area equal
  to the wire width at the tested resolutions), convergence (below Sony's
  typical figures in this assumed field, corners different).
- `crt-renderer.test.mjs`: unknown outputs and profiles beyond the shader
  limits are rejected; in real Edge an asymmetric colour copied into an sRGB
  2D canvas proves the P3 tag on tube output, its removal for plain output
  and its return; P3 and reduced-profile (zero halation, one wire, no
  convergence) output, tiny resized canvases and a wider electronics profile match the reference; GPU
  objects are counted and freed.
- `crt-browser.test.mjs`: in real Edge with WebGL2 the output without the
  tube is exactly the four-times enlarged test pattern; with the tube every
  13th line (61440 pixels) equals the reference from beam.mjs to within two
  steps of 255, pixel centres map back through `toSource`, corners and edges
  are black; on the start page the tube is the default, and F9 switches it
  off and remembers it.
- Monitor control tests cover neutral output, black lift and cutoff, contrast
  about black, combined settings, no early clipping, zero drive, filtered
  blanking and stored value validation. Non-neutral GPU output agrees with the
  full JS reference at positive and negative brightness, different gains and
  zero drive. Plain output stays bit exact. Menu sliders redraw without another
  game frame, survive a reload, reset, disable with F9 and handle real arrow
  keys without game input.
- `live-game-browser.test.mjs` still compares the picture passed to the
  module with the native picture.
