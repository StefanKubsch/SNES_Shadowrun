// CRT phosphor light to the output colour space (docs/CRT-FILTER.md).
// All matrices are flat, row-major 3x3 arrays multiplying column vectors.
// Calculations use linear light; encoding and clipping belong to the output.
export const D65 = [0.3127, 0.329];

// CSS Color 4 sections 10.2 and 10.4: both use D65 and the sRGB transfer curve.
// Display P3 uses the P3 primaries, not the cinema white or transfer curve.
export const SRGB = {
  name: 'srgb',
  red: [0.64, 0.33],
  green: [0.3, 0.6],
  blue: [0.15, 0.06],
  white: D65,
};
export const DISPLAY_P3 = {
  name: 'display-p3',
  red: [0.68, 0.32],
  green: [0.265, 0.69],
  blue: [0.15, 0.06],
  white: D65,
};

// xy chromaticity to XYZ at unit luminance Y. Profiles must supply valid
// chromaticities with nonzero y and linearly independent RGB primaries.
const unitXyz = ([x, y]) => [x / y, 1, (1 - x - y) / y];

// Row-major 3 x 3 matrices.
const MATRIX_SIZE = 3;
export const MATRIX_ENTRIES = MATRIX_SIZE * MATRIX_SIZE;
const ROW_2 = MATRIX_SIZE,
  ROW_3 = 2 * MATRIX_SIZE;

function multiply(left, right) {
  const product = new Array(MATRIX_ENTRIES);
  for (let row = 0; row < MATRIX_SIZE; row++) {
    const start = row * MATRIX_SIZE;
    for (let column = 0; column < MATRIX_SIZE; column++) {
      product[start + column] =
        left[start] * right[column] +
        left[start + 1] * right[ROW_2 + column] +
        left[start + 2] * right[ROW_3 + column];
    }
  }
  return product;
}

function invert(matrix) {
  // Row-major layout: [a b c; d e f; g h i]. The adjugate is the transposed
  // cofactor matrix; dividing by the determinant gives the inverse.
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const cofactor00 = e * i - f * h;
  const cofactor01 = f * g - d * i;
  const cofactor02 = d * h - e * g;
  const determinant = a * cofactor00 + b * cofactor01 + c * cofactor02;
  const inverse = [
    cofactor00,
    c * h - b * i,
    b * f - c * e,
    cofactor01,
    a * i - c * g,
    c * d - a * f,
    cofactor02,
    b * g - a * h,
    a * e - b * d,
  ];
  for (let index = 0; index < MATRIX_ENTRIES; index++) inverse[index] /= determinant;
  return inverse;
}

// Linear RGB to XYZ, normalized so RGB [1,1,1] gives the white point at Y=1.
// The unscaled primary XYZ vectors form the columns. Solve their scale factors
// with a matrix-vector product, then scale the newly constructed columns.
export function rgbToXyz({ red, green, blue, white }) {
  const redXyz = unitXyz(red);
  const greenXyz = unitXyz(green);
  const blueXyz = unitXyz(blue);
  const matrix = [
    redXyz[0],
    greenXyz[0],
    blueXyz[0],
    redXyz[1],
    greenXyz[1],
    blueXyz[1],
    redXyz[2],
    greenXyz[2],
    blueXyz[2],
  ];
  const scales = applyMatrix(invert(matrix), unitXyz(white));
  for (let column = 0; column < MATRIX_SIZE; column++) {
    matrix[column] *= scales[column];
    matrix[ROW_2 + column] *= scales[column];
    matrix[ROW_3 + column] *= scales[column];
  }
  return matrix;
}

// Preserve XYZ when expressing phosphor light as linear output RGB. No
// chromatic adaptation is applied: a different monitor white stays different.
// The current monitor and both output profiles use D65.
export function phosphorToOutput(phosphor, white, output) {
  const xyzToOutput = invert(rgbToXyz(output));
  const phosphorToXyz = rgbToXyz({ ...phosphor, white });
  return multiply(xyzToOutput, phosphorToXyz);
}

// Preserve negative/out-of-gamut and above-white values for later processing.
export function applyMatrix(matrix, [red, green, blue]) {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = matrix;
  return [
    m00 * red + m01 * green + m02 * blue,
    m10 * red + m11 * green + m12 * blue,
    m20 * red + m21 * green + m22 * blue,
  ];
}
