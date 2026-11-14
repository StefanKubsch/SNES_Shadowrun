// CRT shaders (docs/CRT-FILTER.md). References: signal.mjs (voltage/light),
// beam.mjs (spot/halo), screen.mjs (grille/wires) and colour.mjs (output).
// Intermediate textures contain linear values, including light above one.
// Profile assumptions remain separate from these sampling approximations.
import { BOX_MINIMUM, LINE_REACH } from './beam.mjs';

export const LIGHT_MAX_REACH = 64;

// GLSL literal of a JS number; integers keep a decimal point.
const glslFloat = (value) => (Number.isInteger(value) ? value.toFixed(1) : String(value));

// Same rational approximation as signal.mjs erf (maximum error 1.5e-7).
const ERF = `float erf(float x) {
  float a = abs(x), t = 1.0 / (1.0 + 0.3275911 * a);
  return sign(x) * (1.0 - ((((
    1.061405429 * t - 1.453152027) * t + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * exp(-a * a));
}
`;

// Full-target rectangle. Final picture coordinates start at the top left.
// Intermediate passes address data rows directly through gl_FragCoord.
export const VERTEX = `#version 300 es
out vec2 position;

void main() {
  vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  position = vec2(corner.x, 1.0 - corner.y);
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

// Plain output: nearest source pixel, black outside the picture.
export const PLAIN = `#version 300 es
precision highp float;
uniform sampler2D frame;
uniform vec4 picture;
uniform vec2 size;
in vec2 position;
out vec4 color;

void main() {
  vec2 at = (position - picture.xy) / picture.zw;
  if (any(lessThan(at, vec2(0.0))) || any(greaterThanEqual(at, vec2(1.0)))) {
    color = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  color = vec4(texelFetch(frame, ivec2(at * size), 0).rgb, 1.0);
}
`;

// Light per source row: held DAC levels, Gaussian electronics, monitor controls
// and gun characteristic. sigma/margin are in source pixels. Each output texel
// is a point sample, not the integral over a final horizontal output pixel.
// The renderer supplies the same sigma-derived reach as lineVoltage. Profiles
// beyond LIGHT_MAX_REACH are rejected before allocating GPU resources.
export const LIGHT = `#version 300 es
precision highp float;
uniform sampler2D frame;
uniform vec2 size;
uniform float sigma, levelDivisor, levelSteps, gamma, oversample, margin;
uniform float brightness, contrast;
uniform float sourceGain, sourceTau;
uniform int reach;
out vec4 color;

${ERF}
float cdf(float x) {
  return 0.5 * (1.0 + erf(x * 0.7071067811865476));
}

// Stable RC/Gaussian step response, matching signal.mjs. The source RC is
// causal; it is not folded into the monitor bandwidth or inferred beam spot.
float erfcx(float x) {
  if (x < 2.0) return exp(x * x) * (1.0 - erf(x));
  float denominator = x;
  for (int k = 12; k >= 1; k--) {
    if (x >= 4.0 && k > 6) continue;
    denominator = x + (float(k) * 0.5) / denominator;
  }
  return 0.5641895835477563 / denominator;
}
float stepResponse(float x) {
  float z = x / sigma;
  if (sourceTau == 0.0) return cdf(z);
  if (z <= -8.0) return 0.0;
  if (x >= 8.0 * sigma + 24.0 * sourceTau) return 1.0;
  float ratio = sigma / sourceTau;
  float at = (ratio - z) * 0.7071067811865476;
  float tail = at >= 0.0
    ? 0.5 * exp(-0.5 * z * z) * erfcx(at)
    : exp(ratio * (0.5 * ratio - z)) * cdf(z - ratio);
  return clamp(cdf(z) - tail, 0.0, 1.0);
}

vec3 voltage(int x, int row) {
  if (x < 0 || x >= int(size.x)) return vec3(0.0);
  vec3 encoded = texelFetch(frame, ivec2(x, row), 0).rgb;
  return floor(floor(encoded * 255.0 + 0.5) / levelDivisor) / levelSteps;
}

void main() {
  int row = int(gl_FragCoord.y);
  float x = gl_FragCoord.x / oversample - margin;
  int first = int(floor(x)) - reach;
  vec3 filtered = vec3(0.0);
  // Adjacent held intervals share a CDF boundary: eight evaluations instead
  // of fourteen. The finite sum retains truncation and blanking losses.
  float left = stepResponse(x - float(first));
  for (int offset = 0; offset <= ${2 * LIGHT_MAX_REACH}; offset++) {
    if (offset > 2 * reach) break;
    float i = float(first + offset);
    float right = stepResponse(x - i - 1.0);
    filtered += voltage(first + offset, row) * (left - right);
    left = right;
  }
  float coverage = stepResponse(x) - stepResponse(x - size.x);
  vec3 drive = max(sourceGain * filtered + brightness * coverage, vec3(0.0));
  color = vec4(contrast * pow(drive, vec3(gamma)), 1.0);
}
`;

// Horizontal spot over light samples. sigma is in oversampled texels.
// reach must fit the 64-texel cap. Normalize over full kernel support,
// including weights whose samples fall outside the texture (zero there).
export const SPOT = `#version 300 es
precision highp float;
uniform sampler2D light;
uniform float sigma;
uniform int reach;
out vec4 color;

void main() {
  ivec2 at = ivec2(gl_FragCoord.xy);
  int count = textureSize(light, 0).x;
  vec3 sum = vec3(0.0);
  float total = 0.0;
  // Only offsets -reach..reach, in ascending order: the constant bound is the
  // shader cap, the break ends the loop at the actual reach.
  for (int k = 0; k <= 128; k++) {
    if (k > 2 * reach) break;
    int offset = k - reach;
    float weight = exp(-float(offset * offset) / (2.0 * sigma * sigma));
    total += weight;
    int x = at.x + offset;
    if (x >= 0 && x < count) {
      sum += weight * texelFetch(light, ivec2(x, at.y), 0).rgb;
    }
  }
  color = vec4(sum / total, 1.0);
}
`;

// Halo base: average pre-spot light over each source-pixel column. The light
// texture's margin is excluded; the larger halo target has its own zero border.
// oversample must be a positive integer at most 16 (currently eight).
export const HALO_BASE = `#version 300 es
precision highp float;
uniform sampler2D light;
uniform vec2 size, haloMargin;
uniform float oversample, margin;
out vec4 color;

void main() {
  ivec2 at = ivec2(gl_FragCoord.xy) - ivec2(haloMargin);
  vec3 sum = vec3(0.0);
  if (at.x >= 0 && at.x < int(size.x) && at.y >= 0 && at.y < int(size.y)) {
    int first = (at.x + int(margin)) * int(oversample);
    for (int sampleIndex = 0; sampleIndex < 16; sampleIndex++) {
      if (sampleIndex >= int(oversample)) break;
      sum += texelFetch(light, ivec2(first + sampleIndex, at.y), 0).rgb;
    }
    sum /= oversample;
  }
  color = vec4(sum, 1.0);
}
`;

// Separable halo blur; sigma is in texels, direction is [1,0] or [0,1].
// reach must fit the 128-texel cap. Preserve zero-border losses as for SPOT.
export const HALO_BLUR = `#version 300 es
precision highp float;
uniform sampler2D image;
uniform float sigma;
uniform int reach;
uniform vec2 direction;
out vec4 color;

void main() {
  ivec2 at = ivec2(gl_FragCoord.xy);
  ivec2 size = textureSize(image, 0), step = ivec2(direction);
  vec3 sum = vec3(0.0);
  float total = 0.0;
  // Only offsets -reach..reach, in ascending order, as in SPOT.
  for (int k = 0; k <= 256; k++) {
    if (k > 2 * reach) break;
    int offset = k - reach;
    float weight = exp(-float(offset * offset) / (2.0 * sigma * sigma));
    total += weight;
    ivec2 sampleAt = at + step * offset;
    if (sampleAt.x >= 0 && sampleAt.y >= 0 && sampleAt.x < size.x && sampleAt.y < size.y) {
      sum += weight * texelFetch(image, sampleAt, 0).rgb;
    }
  }
  color = vec4(sum / total, 1.0);
}
`;

// Final output: average beam*grille*wire transmission plus additive halo over
// the output pixel's area, then colour conversion and sRGB
// transfer (also used by Display P3). gain normalizes the bare white line
// centre at zero footprint, not the final masked picture. footprint is the
// output pixel's width in source pixels and height in raster lines.
// Convergence is in mm on the full usable screen. Grille/wires stay fixed.
// Same sampling as beam.mjs/area.mjs. Convergence remains a centre translation.
// Loops visit
// only overlapping samples and are bounded by the actual texture dimensions.
export const BEAM = `#version 300 es
precision highp float;
uniform sampler2D spread, halo;
uniform vec4 picture;
uniform vec2 size, screenMm, haloMargin;
uniform vec2 footprint;
vec2 sampleFootprint;
uniform float sigma, gain, oversample, margin, pitch, antialias, haloEnergy;
float samplePitch;
uniform vec2 curvature, outputSize;
uniform mat3 colour;
uniform vec4 redX, redY, blueX, blueY;
// Two positions as screen-height fractions, width in output pixels, height
// in output pixels. The renderer must provide exactly this two-wire layout.
uniform vec4 wires;
vec4 sampleWires;
in vec2 position;
out vec4 color;

// Finite Gaussian-windowed series, not an exact positive convolution.
// Harmonic cutoff and output scaling can leave residual ripple/ringing.
vec2 maskMoments(float channel, float x, float first, float last) {
  if (last <= first) return vec2(0.0);
  float halfWidth = 0.5 * (last - first), middle = 0.5 * (first + last);
  vec2 sum = vec2(1.0 / 3.0, 0.0);
  for (int harmonic = 1; harmonic <= 16; harmonic++) {
    float frequency = float(harmonic) / samplePitch;
    float weight = exp(-19.739208802178716 * antialias * antialias * frequency * frequency);
    if (weight < 1e-4) break;
    float omega = 6.283185307179586 * frequency;
    float z = omega * halfWidth, z2 = z * z;
    float sinc, moment;
    if (abs(z) < 0.05) {
      sinc = 1.0 - z2 / 6.0 + z2 * z2 / 120.0;
      moment = z * (1.0 / 3.0 - z2 / 30.0 + z2 * z2 / 840.0);
    } else {
      sinc = sin(z) / z;
      moment = (sin(z) - z * cos(z)) / z2;
    }
    float phase = omega * (x + middle - (channel + 0.5) * samplePitch / 3.0);
    sum += weight * 2.0 * sin(3.141592653589793 * float(harmonic) / 3.0)
      / (3.141592653589793 * float(harmonic))
      * vec2(cos(phase) * sinc, -halfWidth * sin(phase) * moment);
  }
  return 2.0 * halfWidth * sum;
}

float maskedSegment(float channel, float x, float first, float last, float value, float slope) {
  return dot(vec2(value, slope), maskMoments(channel, x, first, last));
}

${ERF}
float texel(int index, int row, int channel) {
  return index >= 0 && index < textureSize(spread, 0).x
    ? texelFetch(spread, ivec2(index, row), 0)[channel] : 0.0;
}

// Integral of the unit hat (linear interpolation basis) up to x.
float hatIntegral(float x) {
  x = clamp(x, -1.0, 1.0);
  return x <= 0.0 ? 0.5 * (x + 1.0) * (x + 1.0) : 1.0 - 0.5 * (1.0 - x) * (1.0 - x);
}

// Output pixel's horizontal box in sample units, texels from..to. Its
// grille-weighted interpolation integrals do not depend on the row. Up to
// four texels keep them in near; wider boxes evaluate them in the row loop.
struct Box {
  int from, to;
  float first, last, width, centre, channel, screenX;
  vec4 near;
};

float grilleHat(Box box, int index) {
  if (box.width < ${glslFloat(BOX_MINIMUM)})
    return maskedSegment(box.channel, box.screenX, -0.5, 0.5,
      max(0.0, 1.0 - abs(box.centre - float(index))), 0.0);
  float first = max(-0.5, (float(index) - 1.0 - box.centre) / box.width);
  float middle = (float(index) - box.centre) / box.width;
  float last = min(0.5, (float(index) + 1.0 - box.centre) / box.width);
  float leftEnd = min(last, middle), rightStart = max(first, middle);
  float a = 1.0 - abs(box.centre + box.width * 0.5 * (first + leftEnd) - float(index));
  float b = 1.0 - abs(box.centre + box.width * 0.5 * (rightStart + last) - float(index));
  return maskedSegment(box.channel, box.screenX, first, leftEnd, a, box.width)
    + maskedSegment(box.channel, box.screenX, rightStart, last, b, -box.width);
}

Box horizontalBox(float x, int channel, float screenX) {
  Box box;
  float centre = (x + margin) * oversample - 0.5;
  box.centre = centre;
  box.channel = float(channel);
  box.screenX = screenX;
  box.width = sampleFootprint.x * oversample;
  box.near = vec4(0.0);
  if (box.width < ${glslFloat(BOX_MINIMUM)}) {
    float left = floor(centre);
    box.from = int(left);
    box.to = box.from + 1;
    float mean = maskMoments(float(channel), screenX, -0.5, 0.5).x;
    box.near.xy = mean * vec2(1.0 - (centre - left), centre - left);
  } else {
    box.first = centre - 0.5 * box.width;
    box.last = centre + 0.5 * box.width;
    box.from = int(floor(box.first));
    box.to = int(ceil(box.last));
    if (box.to - box.from < 4) {
      // Adjacent hats share a linear interval. Evaluate its two mask moments
      // once and distribute them to both samples, keeping the exact integral.
      for (int i = 0; i < 3; i++) {
        float index = float(box.from + i);
        float first = max(-0.5, (index - centre) / box.width);
        float last = min(0.5, (index + 1.0 - centre) / box.width);
        if (last <= first) continue;
        vec2 moments = maskMoments(float(channel), screenX, first, last);
        float fraction = centre + box.width * 0.5 * (first + last) - index;
        box.near[i] += (1.0 - fraction) * moments.x - box.width * moments.y;
        box.near[i + 1] += fraction * moments.x + box.width * moments.y;
      }
    }
  }
  return box;
}

// Mean of interpolated spot light times the filtered grille over the box.
float along(Box box, int row, int channel) {
  if (box.to - box.from < 4) {
    return dot(box.near, vec4(
      texel(box.from, row, channel), texel(box.from + 1, row, channel),
      texel(box.from + 2, row, channel), texel(box.from + 3, row, channel)));
  }
  float sum = 0.0;
  int first = max(box.from, 0);
  int last = min(box.to, textureSize(spread, 0).x - 1);
  for (int index = first; index <= last; index++) {
    sum += texel(index, row, channel) * grilleHat(box, index);
  }
  return sum;
}

// Mean vertical beam density over the output pixel's height.
float lineWeight(float distance) {
  if (sampleFootprint.y < ${glslFloat(BOX_MINIMUM)})
    return exp(-distance * distance / (2.0 * sigma * sigma)) / (sigma * 2.5066282746310002);
  float scale = 0.7071067811865476 / sigma, halfHeight = 0.5 * sampleFootprint.y;
  return (erf((distance + halfHeight) * scale) - erf((distance - halfHeight) * scale))
    / (2.0 * sampleFootprint.y);
}

float density(float x, float s) {
  return exp(-0.5 * x * x / (s * s)) / (s * 2.5066282746310002);
}
float mass(float d, float s, float width) {
  float scale = 0.7071067811865476 / s;
  return 0.5 * (erf((d + 0.5 * width) * scale) - erf((d - 0.5 * width) * scale));
}
float wireShadow(float y) {
  return min(1.0, sampleWires[2] * (density(y - sampleWires[0] * sampleWires[3], antialias)
    + density(y - sampleWires[1] * sampleWires[3], antialias)));
}

// The normal thin-wire path integrates products of two Gaussians analytically.
// Saturated shadows retain their existing clamp via composite Gauss-Legendre.
float wiredLine(float distance, float y, float bound) {
  float bare = lineWeight(distance);
  // This upper bound makes far-away wires negligible before Gaussian products.
  if (bound < 1e-8) return bare;
  vec2 offsets = vec2(y) - sampleWires.xy * sampleWires[3];
  if (bound > 1.0 || sampleFootprint.y < ${glslFloat(BOX_MINIMUM)}) {
    bool point = sampleFootprint.y < ${glslFloat(BOX_MINIMUM)};
    float scale = point ? 1.0 : sampleFootprint.y;
    float first = point ? -0.5 : max(-0.5 * sampleFootprint.y, -distance - 8.0 * sigma);
    float last = point ? 0.5 : min(0.5 * sampleFootprint.y, -distance + 8.0 * sigma);
    int count = max(1, int(ceil((last - first) / min(point ? 1.0 : sigma, scale / 32.0))));
    float halfWidth = (last - first) / (2.0 * float(count)), sum = 0.0;
    const float nodes[4] = float[4](0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363);
    const float weights[4] = float[4](0.362683783378362, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763);
    for (int i = 0; i < count && last > first; i++) {
      float middle = first + float(2 * i + 1) * halfWidth;
      for (int n = 0; n < 4; n++) {
        float a = middle - halfWidth * nodes[n], b = middle + halfWidth * nodes[n];
        float left = (point ? bare : density(distance + a, sigma)) * (1.0 - wireShadow(y + a / scale));
        float right = (point ? bare : density(distance + b, sigma)) * (1.0 - wireShadow(y + b / scale));
        sum += halfWidth * weights[n] * (left + right);
      }
    }
    return sum / scale;
  }
  float wireSigma = sampleFootprint.y * antialias;
  float variance = sigma * sigma + wireSigma * wireSigma;
  float productSigma = sigma * wireSigma * inversesqrt(variance);
  float sum = bare;
  for (int wire = 0; wire < 2; wire++) {
    float offset = sampleFootprint.y * offsets[wire];
    float middle = (distance * wireSigma * wireSigma + offset * sigma * sigma) / variance;
    sum -= sampleWires[2] * density(distance - offset, sqrt(variance)) * mass(middle, productSigma, sampleFootprint.y);
  }
  return sum;
}

float beam(int channel, vec2 at, float screenX, float screenY, float wireBound) {
  float line = at.y * size.y, sum = 0.0;
  Box box = horizontalBox(at.x * size.x, channel, screenX);
  float reach = ${glslFloat(LINE_REACH)} * sigma + 0.5 * sampleFootprint.y;
  int first = max(0, int(ceil(line - reach - 0.5)));
  int last = min(int(size.y) - 1, int(floor(line + reach - 0.5)));
  for (int row = first; row <= last; row++) {
    sum += wiredLine(line - (float(row) + 0.5), screenY, wireBound) * along(box, row, channel);
  }
  return sum;
}

vec3 haloAt(vec2 at) {
  vec2 texel = at * size + haloMargin - 0.5;
  ivec2 size = textureSize(halo, 0);
  vec2 first = texel - 0.5 * sampleFootprint, last = texel + 0.5 * sampleFootprint;
  ivec2 from = max(ivec2(floor(first)), ivec2(0));
  ivec2 to = min(ivec2(ceil(last)), size - 1);
  vec3 sum = vec3(0.0);
  for (int row = from.y; row <= to.y; row++) {
    float wy = sampleFootprint.y < ${glslFloat(BOX_MINIMUM)} ? max(0.0, 1.0 - abs(texel.y - float(row)))
      : (hatIntegral(last.y - float(row)) - hatIntegral(first.y - float(row))) / sampleFootprint.y;
    for (int column = from.x; column <= to.x; column++) {
      float wx = sampleFootprint.x < ${glslFloat(BOX_MINIMUM)} ? max(0.0, 1.0 - abs(texel.x - float(column)))
        : (hatIntegral(last.x - float(column)) - hatIntegral(first.x - float(column))) / sampleFootprint.x;
      sum += texelFetch(halo, ivec2(column, row), 0).rgb * wx * wy;
    }
  }
  return sum;
}

vec3 srgb(vec3 light) {
  light = clamp(light, 0.0, 1.0);
  return mix(1.055 * pow(light, vec3(1.0 / 2.4)) - 0.055, 12.92 * light,
             lessThanEqual(light, vec3(0.0031308)));
}

vec2 shift(vec4 x, vec4 y, vec2 uv) {
  vec4 terms = vec4(1.0, uv.x, uv.y, uv.x * uv.y);
  return vec2(dot(x, terms), dot(y, terms)) / screenMm;
}

void main() {
  vec2 screen = position;
  sampleFootprint = footprint;
  samplePitch = pitch;
  sampleWires = wires;
  float x = gl_FragCoord.x;
  if (curvature.x > 0.0) {
    // The same stable front ray/cylinder intersection as geometry.mjs.
    float r = curvature.x, d = curvature.y, u = position.x - 0.5;
    float root = sqrt(d * d * r * r - u * u * d * (d + 2.0 * r));
    float t = d * (d + 2.0 * r) / (d * (d + r) + root);
    float derivative = t * t * u / root;
    vec2 scale = vec2(t + u * derivative, t);
    screen = 0.5 + (position - 0.5) * t;
    // Local rectangular footprint: scale follows perspective; the small
    // horizontal-to-vertical shear is omitted (documented model limit).
    sampleFootprint *= scale;
    samplePitch /= scale.x;
    x = screen.x * outputSize.x / scale.x;
    sampleWires.zw /= scale.y;
  }
  vec2 uv = screen * 2.0 - 1.0;
  vec2 green = (screen - picture.xy) / picture.zw;
  float y = screen.y * sampleWires[3];
  vec2 nearest = max(abs(vec2(y) - sampleWires.xy * sampleWires[3]) - 0.5, vec2(0.0));
  float wireBound = sampleWires[2] * (density(nearest.x, antialias) + density(nearest.y, antialias));
  vec3 direct = vec3(
    beam(0, (screen - shift(redX, redY, uv) - picture.xy) / picture.zw, x, y, wireBound),
    beam(1, green, x, y, wireBound),
    beam(2, (screen - shift(blueX, blueY, uv) - picture.xy) / picture.zw, x, y, wireBound)
  );
  // Halation is unshifted, without grille/wires, and added to the full direct
  // term. The uniform branch avoids four unused texture reads at zero energy.
  vec3 scattered = vec3(0.0);
  if (haloEnergy != 0.0) scattered = haloEnergy * haloAt(green) / 3.0;
  vec3 light = gain * (direct + scattered);
  color = vec4(srgb(colour * light), 1.0);
}
`;
