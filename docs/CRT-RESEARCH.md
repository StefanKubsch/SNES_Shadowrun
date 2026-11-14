# CRT source research

Research date: 2026-11-02. Scope: PAL SNES RGB geometry, the Sony PVM M2/M4
family, the assumed beam and optical response, and the implementation limits
listed in [PROJECT-STATUS.json](PROJECT-STATUS.json). The implementation
contract remains [CRT-FILTER.md](CRT-FILTER.md).

## Project scope

User decision of 2026-11-02: real-device measurements are not feasible.
Real-device measurements and hardware calibration are outside
the project scope. The CRT model uses published sources and documented
assumptions; source gaps below describe its limits, not pending measurement
tasks or prerequisites for completing the software.

## Findings and decisions

| Question                                                             | Evidence found                                                                                                                                                                                                  | Decision                                                                                                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is a 52 microsecond analogue reference window defensible?            | ITU-R BT.470-6 specifies a nominal 64 microsecond line and about 12 microseconds of blanking for the relevant 625-line broadcast systems.                                                                       | Retain 52 microseconds as reference geometry. This is evidence for the television convention, not a measurement of the SNES output.               |
| Does BT.601 prove the SNES picture position?                         | Its RGB digital active line is 720 samples at 13.5 MHz, or 53 1/3 microseconds.                                                                                                                                 | No. Keep digital capture timing separate from analogue blanking and monitor adjustment.                                                           |
| Can related PVM models supply useful evidence?                       | Sony lists the same 20FZ5 tube part for 20M2U/E and 20M2MDU/E/A. M4 models have different tube parts.                                                                                                           | Use M2 relatives for tube evidence, and shared family procedures for circuit and calibration context. Do not copy M4 spot or phosphor parameters. |
| Do the sources establish Gaussian response and 5% limiting contrast? | Sony specifies bandwidth and TV-line resolution, but no full measured transfer function or contrast threshold. CRT research reports both approximately Gaussian spots and current-dependent non-Gaussian tails. | Keep the existing parameters explicitly assumed. Do not substitute a new unmeasured curve.                                                        |
| Are two damper wires plausible?                                      | Sony's general Trinitron support article describes one wire for small monitors and two for 17-inch and larger monitors.                                                                                         | Family support for two wires improves, but exact 20FZ5 positions and shadow width remain unmeasured.                                              |
| Is a broad additive halo physically motivated?                       | Display metrology describes optical and electron scattering and an additive diffuse image.                                                                                                                      | The effect is supported; this model's 10 mm sigma and 0.05 gain are not calibrated by those sources.                                              |
| Can wider electronics profiles be supported safely?                  | The old seven-interval sum loses substantial voltage for sigma two source pixels.                                                                                                                               | Derive support and margins from sigma; reject unsupported shader reaches before allocation.                                                       |
| Must tiny canvases lose beam energy?                                 | The old fixed loops can end before the output footprint has been covered.                                                                                                                                       | Bound traversal by overlapping texture samples rather than fixed 64-row and 128-texel limits.                                                     |

## PAL source evidence

1. [ITU-R BT.470-6, Conventional Television Systems](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.470-6-199811-S!!PDF-E.pdf),
   Annex 1, Table 2, PDF/printed page 5, specifies line period and blanking
   with tolerances, measured at the half-amplitude crossings. Subtracting
   nominal blanking from nominal line duration gives the 52 microsecond
   reference. A progressive SNES signal is not established as a fully
   compliant broadcast signal by that calculation.
2. [ITU-R BT.601-7](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.601-7-201103-I!!PDF-E.pdf),
   Annex 1, Part A, Table 4, PDF page 10, printed page 8: digital RGB uses
   720 active samples per line at 13.5 MHz. Its digital window must not
   replace an analogue window without defining the capture aperture and
   its relationship to synchronisation.
3. Local Nintendo [Book I](../Ressources/book1_text.pdf), chapter 2,
   register SETINI (2133), PDF page 133, printed identifier 2-27-18,
   re-read for this work: bit 2 selects 224 or 239 picture lines; bit 0
   selects interlace. This establishes the selected picture height, not
   the analogue first-line position, porch widths, DAC response or PAL
   television aperture. The existing SNES profile remains 256 by 224.
4. Martin Korth's [fullsnes](https://problemkaputt.de/fullsnes.htm#snestimings),
   sections SNES Timing Oscillators and SNES Timing H/V Counters, reports
   PAL master clock 21.2813700 MHz and normal lines of 1364 master clocks.
   This is author-published reverse-engineering documentation, not a
   new trace from this project. It supports the existing clock model;
   counter coordinates alone do not locate the RGB picture relative to
   the PVM's independently adjustable raster.

Targeted searches for PAL RGB captures, sync-relative active intervals and
first/last picture lines did not yield a complete, reproducible measurement
with console revision, load, probe setup and raw timing data. This is a
limit of this search, not a claim that no such data exist. The Nintendo PAL
service PDF linked from Fabien Sanglard's video article returned HTTP 406
on download; Console5's PAL schematic returned HTTP 403 in the web tool.
Neither unread file is used as evidence for a new parameter.

A capture card's cropped image or an emulator screenshot alone does not
establish the console's analogue timing or the monitor's geometry. A bright
pixel window and the console's blanking window need not be the same interval.
The existing reference geometry remains an explicit model assumption.

## Transfer within the Sony family

The local [Sony service manual](../Ressources/SONY-PVM-20M2U-20M4U-Operation-Maintenance-Manual.pdf)
and its [public mirror](https://www.crt-mon.com/pdf/SONY/SONY-PVM-20M2U-20M4U-Operation-Maintenance-Manual.pdf)
cover several M2/M4 variants. The following conclusions use the page images,
not OCR spellings of the tube identifiers.

| Model                 | Connection to the current profile                                                                   | Transfer limit                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| PVM-20M2U             | Same 20FZ5 (DARK), part 8-736-135-05, as 20M2E; local PDF 92, printed 110.                          | Useful for tube identity and measured colour. Adjustment, ageing and regional input paths can differ.                          |
| PVM-20M2MDU/E/A       | Sony's medical-family service manual, section 7-4, item 172, lists 20FZ5 (DARK), part 8-736-135-05. | Stronger relation than a similar model name. Shared tube identity still does not establish equal full-monitor transfer curves. |
| PVM-14M2 variants     | Same family procedures and 600 TV-line class, with separate size tables.                            | Different tube size: do not transfer physical pitch, wire position or spot width without parts evidence.                       |
| PVM-20M4E/A and 20M4U | Family manual, but parts 20MT1 and 20MT3 respectively; local PDF 92, printed 110.                   | 800 TV-line class and different phosphor/tube variants prevent copying spatial or colour parameters to 20M2E.                  |
| PVM-20L2MDU           | Independently listed Raney colour measurement.                                                      | Supports comparison of colour data only; it does not calibrate M2 spatial response.                                            |

The [M2MD family manual](https://consolemods.org/wiki/images/c/c3/PVM-20M2MD_PVM-14M2MD_Service_Manual.pdf),
printed section 7-4, is an original Sony document hosted by a third party.
Its part number agrees with the local M2/M4 manual. OCR variants of the
parenthesised tube name are inconsistent, so that alias is not promoted
into the profile.

The local manual's section 5, PDF/printed pages 29-30, gives separate
525/625 adjustments and a 20-inch underscan target of 364 by 272 mm in
Table 5-6. This is a useful calibration target. It does not identify the
SNES's active aperture or establish that an arbitrary surviving monitor
has that adjustment. The current single 5% underscan parameter remains
an explicitly documented geometry approximation.

Sony [Operating Instructions 3-859-663-25(1)](https://pro.sony/s3/cms-static-content/operation-manual/3859663251.pdf),
PDF/printed pages 16-18, supports the family specifications and differing
phosphors. Its control description on PDF/printed page 7 excludes aperture
correction on RGB. That control must not be added to sharpen RGB merely
because the shared specifications list it.

## Beam, colour and optical evidence

- Knudson et al., [Experimental evaluation of the resolution capabilities
  of image-transmission systems](https://doi.org/10.1002/j.2637-496X.1968.tb05066.x),
  Information Display 5(5), 31-43 (1968), discusses slit/edge measurements
  and Gaussian approximations for the particular CRTs tested. This supports
  a modelling method, not a PVM-20M2E parameter set.
- Infante, [The use of Lorentzian functions in the analysis of non-Gaussian
  CRT spots](https://doi.org/10.1889/1.1984864), Journal of the SID 1(2),
  229-232 (1993), reports current-dependent tails. The accessible abstract
  establishes a limitation of a fixed Gaussian; the full experiment was
  not used to infer new Sony values.
- Banbury and Whitfield, [Measurement of modulation transfer function for
  cathode ray tubes](<https://doi.org/10.1016/0141-9382(81)90158-X>), Displays
  2(4), 189-198 (1981), stresses operating conditions and nonlinear response.
  Only its public abstract was available. A quoted TV-line count cannot
  determine a unique beam function or a universal limiting contrast.
- [AAPM TG18 report](https://www.aapm.org/pubs/reports/OR_03.pdf), section 4.7,
  PDF pages 114-118, printed 105-109, describes electron and optical
  contributions to veiling glare, additive diffuse light and measurements
  with a dark target surrounded by a bright field. It also describes
  variation with target radius and the need to exclude measuring-optics
  flare. Those medical-display procedures motivate an optical measurement;
  their numerical acceptance criteria do not calibrate a Sony PVM.
- Sony [support article S500081251](https://www.sony.co.kr/electronics/support/articles/S500081251)
  describes damper wires and the usual count by screen size. It supplies
  neither 20FZ5 wire coordinates nor shadow width. The existing borrowed
  positions 0.273/0.727 and width 0.05 mm therefore remain assumptions.
- Dan Mons's [published measurement data](https://raw.githubusercontent.com/danmons/colour_matrix_adaptations/main/csv/inputs.csv)
  gives Raney_PVM_20M2U and Raney_PVM_20L2MDU, both labelled gamma 2.25,
  with slightly different primary coordinates. His [first-party account](https://retrorgb.com/colour-malarkey.html)
  says Raney serviced and profiled the units with a colourimeter. This
  improves the provenance description over saying the method is wholly
  unstated. Raw sweeps, meter model, uncertainty, luminance, settings and
  a measured white point are still absent from the CSV; its D93 entry is
  nominal. Retain the user's D65 choice and the existing primary values.

No retrieved family measurement fixes the current 0.05 resolution contrast,
10 mm halo sigma, 0.05 halo gain or convergence map. Photographs can help
locate wires and stripes, but require known scale and controlled camera
processing before they can constrain light spread or contrast.

## Software work and remaining integration

The first implementation block makes electronics support depend on sigma,
including texture margins, and removes the final beam traversal's silent
fixed limits. Six-sigma electronics support omits less than 2e-9 Gaussian
mass before numerical error. The shader rejects a reach above 64; the CPU
reference can still use a larger or explicitly shorter kernel. Blanking
and intentionally truncated kernels are never renormalised.

The following coordinated block averages the product of beam, grille and
wire transmission, plus the separately averaged halo. It is documented in
[CRT-FILTER.md](CRT-FILTER.md#product-area-integration), with independent
spatial quadrature, optical boundaries, plain-output identity and GPU costs
at 1080p/4K. It retains the 0.8-output-pixel Gaussian mask filter; rendering
at a higher resolution would change that width and would not constitute an
independent integration reference. The following
[convergence footprint review](CRT-FILTER.md#convergence-footprint-review)
retains translation at the output pixel's centre after sampled comparisons
against spatially varying displacement: under 0.0061 fractional sRGB code
units at 1080p, under 0.0020 at 4K and under 0.18 at the tested tiny outputs.
These are profile-specific numerical observations, not a global error bound
or a measured convergence field; arbitrary profiles can differ materially.

No researched source justified changing the physical profile's numerical
defaults in those implementation blocks. The later user-approved
[curved surface](CRT-FILTER.md#curved-surface) adds an explicitly assumed
1100 mm radius and 600 mm frontal viewing distance; the cited Sony training
manual establishes the cylindrical family shape, not those dimensions.
Numerical agreement of CPU
and GPU proves their agreement with the model, not calibration to hardware.
