// CRT profiles contain data only: no frame work or derived filter kernels.
// Sources and modelling limits: docs/CRT-FILTER.md, "Profile review".

// Analogue PAL reference window, used for a progressive one-field picture.
// The 52 us window is a model choice, not BT.601's digital active line:
// BT.601-7 Annex 1, Part A, Table 4 (PDF 10, printed 8) specifies 720 samples
// at 13.5 MHz (53 1/3 us). The earlier attribution of 702 samples to BT.601
// was incorrect. Keep the existing analogue geometry pending SNES evidence.
// Likewise, 288 active lines per field and a centred picture are the current
// raster model, not a measured PAL SNES blanking or first-line contract.
export const PAL_625 = {
  name: 'PAL 625/50',
  activeLineS: 52e-6,
  activeLines: 288,
  aspect: 4 / 3,
};

// PAL SNES RGB, 256 x 224. Nintendo Book I, PDF 133, printed 2-27-18:
// register 2133 bit 2 selects 224 lines. The target schematic identifies X1,
// but not its internal clock multiplication; retain 21.28137 MHz / 4 as the
// pixel-clock model (docs/VIDEO-OUTPUT.md).
// The PPU's output stores each post-2100-brightness 5-bit channel as
// (value << 3) | (value >> 2); levelBits recovers that code for the DAC model.
// Book I PDF 61 and 125 establish CG-RAM format, not analogue DAC linearity.
// Missing position means centred in the reference window (an assumption).
export const SNES_PAL_RGB = {
  name: 'Super Nintendo PAL 1CHIP-01/02 (C11 470 nF)',
  boards: ['SNSP-CPU-1CHIP-01', 'SNSP-CPU-1CHIP-02'],
  // User-selected hardware premise (2026-11-02): the C11 ghosting fix is
  // already installed. Metadata only: residual ghosting is assumed negligible;
  // brightness-DAC settling is not simulated. This is not the AV shunt below.
  videoModifications: { c11CapacitanceF: 470e-9 },
  width: 256,
  height: 224,
  dotClockHz: 21_281_370 / 4,
  format: 'rgba8',
  levelBits: 5,
  // Target schematic Rev. 0.5, PDF 1: S-CPUN -> C6/C7/C8 -> S-RGB ->
  // Q1/Q2/Q3 -> R17/R16/R15 -> Multi Out. PAL cable: 75 ohms to ground.
  // The 0.8 V DAC swing, 6.5 dB encoder and unity emitter-follower gain are
  // nominal family assumptions, not measured specifications of these boards.
  // Borti's board research supplies the 47 pF AV shunts. Complete evidence,
  // load equations and unresolved coupling/ghosting: docs/VIDEO-OUTPUT.md.
  rgbOutput: {
    dacFullScaleV: 0.8,
    encoderGain: 10 ** (6.5 / 20),
    bufferGain: 1,
    seriesOhm: 39,
    shuntF: 47e-12,
    cableShuntOhm: 75,
    // Assumed cable, not a manufacturer figure: 2 m of 75 ohm coax with solid
    // PE (er 2.25), C' = sqrt(er) / (c * Z0) = 66.7 pF/m. Electrically short
    // at the monitor's 10 MHz, so it is lumped onto the shunt node.
    cableLengthM: 2,
    cableFPerM: 66.7e-12,
  },
  standard: PAL_625,
};

// Sony Operation and Maintenance Manual, Specifications, PDF/printed 2-4:
// 600 TV lines; RGB response 10 MHz +/-3 dB; 5% underscan; P-22; factory D65;
// typical convergence 0.6 mm at the centre and 1.0 mm at the periphery.
// Parts list PDF 92, printed 110: tube 20FZ5 (DARK), 8-736-135-05, for 20M2U/E.
// Sony PVM-M Series data sheet, Specification table, local PDF 3 (unpaginated):
// PVM-20M2U pitch 0.4 mm and visible diagonal 480 mm. Width derives from 4:3.
// Local PDFs: Ressources/SONY-PVM-20M2U-20M4U-Operation-Maintenance-Manual.pdf
// and Ressources/Sony_PVM_14M2U_Datasheet_2016218115534.pdf.
export const SONY_PVM_20M2E = {
  name: 'Sony PVM-20M2E',
  tube: '20FZ5',

  // Reading "5% underscan" as a centred 5% reduction on each axis is a model
  // interpretation. The manual does not define that geometry precisely.
  underscan: 0.05,

  // Raney_PVM_20M2U in danmons/colour_matrix_adaptations, csv/inputs.csv:
  // gamma and primary chromaticities attributed to Keith Raney's 20M2U.
  // Transfer to the 20M2E is an assumption; measurement conditions are absent.
  gamma: 2.25,
  resolutionTvLines: 600,
  // Assumed limiting contrast, not a Sony figure. Together with the assumed
  // Gaussian electronics response it sets the inferred Gaussian spot size.
  resolutionContrast: 0.05,
  // The manual gives 10 MHz +/-3 dB, not a measured Gaussian transfer curve.
  // Using exactly -3 dB at 10 MHz is the current electronics approximation.
  rgbBandwidthHz: 10e6,
  rgbInputVpp: 0.7,
  rgbInputOhm: 75,
  grillePitchMm: 0.4,
  screenWidthMm: 480 * 0.8,
  // User-approved geometry approximation (2026-11-02), not a Sony tube value.
  // At this chord width the 1100 mm cylinder has 16.886 mm centre-to-edge sag.
  // View frontally from 600 mm; see docs/CRT-FILTER.md, "Curved surface".
  curvature: { radiusMm: 1100, viewingDistanceMm: 600 },
  // Factory D65 was selected by the user. The dataset's D93 white is nominal;
  // it is not used as a measured white point for this monitor.
  white: [0.3127, 0.329],
  phosphor: {
    name: 'P-22',
    red: [0.63, 0.345],
    green: [0.285, 0.605],
    blue: [0.15, 0.065],
  },

  // User-approved approximations (2026-10-30), not measurements of the 20FZ5.
  // A broad Gaussian stands in for faceplate scattering; sigma and energy
  // are assumptions, not a derived total-internal-reflection point spread.
  halation: { sigmaMm: 10, energy: 0.05 },
  // Positions borrowed from the GDM-20E21 description, not proved for 20FZ5;
  // shadow width is assumed. Positions are fractions of screen height.
  damperWires: { positions: [0.273, 0.727], widthMm: 0.05 },
  // Red/blue displacement relative to green, in mm: c0 + cu*u + cv*v + cuv*u*v.
  // Coordinates run -1..1 across the screen, v downward. An assumed adjusted
  // set: red-blue distance about 0.2 mm centrally and up to 0.85 mm at corners.
  // Sony's typical figures guide this choice; they are not guaranteed limits.
  convergence: {
    red: { x: [0.1, 0.2, 0.08, 0.12], y: [-0.05, 0.06, 0.15, -0.1] },
    blue: { x: [-0.08, -0.18, 0.1, -0.15], y: [0.06, -0.12, -0.14, 0.08] },
  },

  // Specification metadata, not extra signal processing. The operating
  // instructions exclude aperture correction on RGB (PDF/printed 7).
  apertureCorrectionDb: [0, 6],
  convergenceMm: { center: 0.6, edge: 1.0 },
  whitePoints: ['D65', 'D93'],
};
