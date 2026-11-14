// Numerical constants shared by the CRT reference modules in src/crt
// (docs/CRT-FILTER.md). The GLSL passes in src/crt/shaders.mjs mirror them;
// change both together, the browser tests compare GPU and reference output.

/** DAC code width of the source channels (8-bit RGBA input). */
export const SOURCE_LEVEL_BITS = 8;
/** Colour channels of the beam model: red, green and blue. */
export const RGB_CHANNELS = 3;
/** Offset of a pixel, stripe or sample centre from its left or top edge. */
export const CENTRE = 0.5;

// Aperture grille (src/crt/screen.mjs): three equal phosphor stripes per triad.
export const PHOSPHOR_STRIPES = 3;
/** Fourier harmonics of the filtered grille, and the weight below which they stop. */
export const GRILLE_HARMONICS = 16;
export const HARMONIC_CUTOFF = 1e-4;

// Truncation reaches of Gaussian and RC tails (src/crt/signal.mjs, beam.mjs).
/** Six sigmas per side: omitted Gaussian mass below 2e-9. */
export const GAUSSIAN_REACH_SIGMAS = 6;
/** Twenty RC time constants: causal tail below exp(-20). */
export const RC_REACH_TAUS = 20;
/** Three sigmas: reach of the discrete spot and halation kernels. */
export const KERNEL_REACH_SIGMAS = 3;

/** Footprints below this width (output pixels) use the point limit. */
export const POINT_FOOTPRINT = 1e-3;
