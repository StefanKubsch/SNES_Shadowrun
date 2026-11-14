// CRT filter (docs/CRT-FILTER.md): draws source frames on a canvas, either
// through the tube's signal path and beam in the video raster, or as plain
// pixels. Generic: it knows source and monitor profiles, nothing about the game.
//
//   const crt = createCrt(canvas, { source, monitor, enabled, output });
//                                  // output: 'auto' (Display P3 where supported), 'srgb', 'display-p3'
//   crt.draw(pixels);              // RGBA, source.width * source.height * 4 bytes
//   crt.setEnabled(false);         // immediately redraws the last frame
//   crt.setControls({ brightness: 0.02, contrast: 1.2 }); // immediately redraws
//   crt.toSource(clientX, clientY) // screen point to fractional source pixel
//   crt.layout                     // aspect ratio and source picture position
//
// Output uses the full canvas device-pixel size; this module sets its CSS
// aspect ratio. The tube requires WebGL2 and EXT_color_buffer_float.
// Otherwise only the plain picture is available (available=false), drawn with
// 2D if WebGL2 is absent.
//
// Colour space: plain output passes source bytes through unchanged and is
// always shown as sRGB. Only the tube converts phosphor light into Display P3,
// and only where the browser can tag the drawing buffer accordingly.
import { monitorSurface, outputLayout, outputToSource } from './geometry.mjs';
import { bandwidthSigma, sourceResponse, voltageReach } from './signal.mjs';
import { normalizeControls } from './controls.mjs';
import {
  OVERSAMPLE,
  gaussWeights,
  halationKernel,
  lightMargin,
  peakGain,
  samplesPerRow,
  spotSigma,
  spotWeights,
} from './beam.mjs';
import { ANTIALIAS, pitchPixels, screenHeightMm } from './screen.mjs';
import { DISPLAY_P3, MATRIX_ENTRIES, SRGB, phosphorToOutput } from './colour.mjs';
import {
  BEAM,
  HALO_BASE,
  HALO_BLUR,
  LIGHT,
  LIGHT_MAX_REACH,
  PLAIN,
  SPOT,
  VERTEX,
} from './shaders.mjs';
import { RGB_CHANNELS, SOURCE_LEVEL_BITS } from '../constants/crt.mjs';
import { OPAQUE, RGBA_BYTES } from '../constants/ppu.mjs';

// Full-screen quad as a triangle strip.
const QUAD_VERTICES = 4;
// RGBA alpha offset, and the rounding term of the 8-bit overlay blend.
const ALPHA = 3,
  BLEND_ROUNDING = 127;

const OUTPUTS = new Set(['auto', 'srgb', 'display-p3']);

// Fixed loop bounds and slots in shaders.mjs. A profile beyond them would be
// truncated silently, so it is rejected before any GPU allocation.
const SHADER_LIMITS = { spotReach: 64, haloReach: 128, oversample: 16, wires: 2 };

export function createCrt(
  canvas,
  { source, monitor = null, enabled = true, output = 'auto', controls } = {},
) {
  if (!OUTPUTS.has(output)) throw Error(`crt: unknown output ${output}`);
  const surface = monitorSurface(monitor);
  const kernels = monitor ? tubeKernels(source, monitor) : null;
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
  });
  const flat = gl ? null : canvas.getContext('2d');
  const tube = !!gl && !!monitor && !!gl.getExtension('EXT_color_buffer_float');

  // The tube writes Display P3 values only into a buffer tagged as P3.
  const tagged = !!gl && 'drawingBufferColorSpace' in gl;
  const wide =
    tube &&
    tagged &&
    (output === 'display-p3' ||
      (output === 'auto' && !!globalThis.matchMedia?.('(color-gamut: p3)').matches));
  const space = wide ? DISPLAY_P3 : SRGB;

  let on = tube && enabled;
  let layout = null;
  let last = null;
  let overlay = null;
  let composite = null;
  let displayed = null;
  let settings = normalizeControls(controls);
  let destroyed = false;

  // Every GPU object created here, deleted again by destroy().
  const owned = [];
  const frame = gl && texture(gl, owned, gl.RGBA8, source.width, source.height);
  const plain = gl && program(gl, owned, PLAIN, { frame: 0, size: [source.width, source.height] });
  const passes = tube ? tubePasses(gl, owned, source, monitor, kernels, space, surface) : null;

  if (!gl) {
    canvas.width = source.width;
    canvas.height = source.height;
  }

  // Changing the tag may reallocate the drawing buffer; callers redraw afterwards.
  function useColourSpace() {
    const name = on ? space.name : SRGB.name;
    if (tagged && gl.drawingBufferColorSpace !== name) gl.drawingBufferColorSpace = name;
  }

  function apply() {
    useColourSpace();
    layout = outputLayout(source, source.standard, monitor, on);
    canvas.style.aspectRatio = String(layout.aspect);
    canvas.style.imageRendering = gl ? '' : 'pixelated';
  }

  function render() {
    if (!last || destroyed) return;
    if (!gl) {
      const bytes = new Uint8ClampedArray(
        displayed.buffer,
        displayed.byteOffset,
        displayed.byteLength,
      );
      flat.putImageData(new ImageData(bytes, source.width, source.height), 0, 0);
      return;
    }
    const p = layout.picture;
    const picture = [p.x, p.y, p.width, p.height];
    if (!on) {
      pass(plain, null, frame, { picture });
      return;
    }
    const { light, spread, halo, beam } = passes;
    pass(light.program, light, frame, settings);
    pass(spread.program, spread, light);
    // Without halation BEAM skips its halo reads; any complete texture serves.
    let scattered = frame;
    if (halo) {
      pass(halo.base.program, halo.base, light);
      pass(halo.wide.program, halo.wide, halo.base);
      pass(halo.out.program, halo.out, halo.wide);
      scattered = halo.out;
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, scattered.texture);
    pass(beam, null, spread, {
      picture,
      outputSize: [canvas.width, canvas.height],
      // Output pixel width in source pixels and height in raster lines.
      footprint: [
        source.width / (p.width * canvas.width),
        source.height / (p.height * canvas.height),
      ],
      pitch: pitchPixels(monitor, canvas.width),
      wires: wireUniform(monitor, canvas.height),
    });
  }

  // One full-target draw; input is bound to texture unit 0.
  function pass(use, into, input, values = {}) {
    gl.useProgram(use);
    set(gl, use, values);
    gl.bindFramebuffer(gl.FRAMEBUFFER, into ? into.framebuffer : null);
    gl.viewport(0, 0, into ? into.width : canvas.width, into ? into.height : canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, input.texture);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, QUAD_VERTICES);
  }

  function alive() {
    if (destroyed) throw Error('crt: renderer was destroyed');
  }

  // Composite UI into the input signal without changing the retained game
  // frame. The normal game path uploads last directly and performs no copy.
  function upload() {
    if (!last) return;
    displayed = last;
    if (overlay) {
      composite ??= new Uint8Array(last.length);
      for (let i = 0; i < last.length; i += RGBA_BYTES) {
        const alpha = overlay[i + ALPHA],
          remaining = OPAQUE - alpha;
        for (let c = 0; c < RGB_CHANNELS; c++)
          composite[i + c] = Math.floor(
            (overlay[i + c] * alpha + last[i + c] * remaining + BLEND_ROUNDING) / OPAQUE,
          );
        composite[i + ALPHA] = OPAQUE;
      }
      displayed = composite;
    }
    if (!gl) return;
    gl.bindTexture(gl.TEXTURE_2D, frame.texture);
    const bytes = new Uint8Array(displayed.buffer, displayed.byteOffset, displayed.byteLength);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      source.width,
      source.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      bytes,
    );
  }

  // Canvas device pixels follow its displayed size.
  const resized = new ResizeObserver(([entry]) => {
    const box = entry.devicePixelContentBoxSize?.[0];
    const width = box ? box.inlineSize : Math.round(entry.contentRect.width * devicePixelRatio);
    const height = box ? box.blockSize : Math.round(entry.contentRect.height * devicePixelRatio);
    if (!gl || !width || !height || (width === canvas.width && height === canvas.height)) return;
    canvas.width = width;
    canvas.height = height;
    render();
  });
  resized.observe(canvas);
  apply();

  return {
    available: tube,
    monitor,
    // Tube output colour space ('srgb' or 'display-p3', colour.mjs). Plain
    // output is always sRGB.
    output: space.name,
    get enabled() {
      return on;
    },
    // Output aspect ratio and source picture position (geometry.mjs).
    get layout() {
      return layout;
    },
    // Beam spot size in line spacings and source pixels (beam.mjs).
    get spot() {
      return tube ? kernels.spot : null;
    },
    get controls() {
      return { ...settings };
    },
    setControls(value) {
      settings = normalizeControls({ ...settings, ...value });
      render();
    },
    setEnabled(value) {
      if (!tube || on === !!value) return;
      on = !!value;
      apply();
      render();
    },
    // The array is kept without copying for redraws; callers must not reuse
    // it for another frame while it is the last one drawn.
    draw(pixels) {
      alive();
      if (pixels.length !== source.width * source.height * RGBA_BYTES)
        throw Error('crt: picture size does not match source profile');
      last = pixels;
      upload();
      render();
    },
    // Straight-alpha RGBA UI in source coordinates, blended before the tube.
    // null restores the unmodified frame. The caller owns this retained view.
    setOverlay(pixels) {
      alive();
      if (pixels !== null && pixels.length !== source.width * source.height * RGBA_BYTES)
        throw Error('crt: overlay size does not match source profile');
      overlay = pixels;
      upload();
      render();
    },
    // Last submitted source frame (tests and screenshots).
    source() {
      return last;
    },
    // Output bytes in device pixels, rows from the top (redraws the last
    // frame). Values are in the drawing buffer's colour space.
    snapshot() {
      alive();
      if (!gl) return flat.getImageData(0, 0, canvas.width, canvas.height).data;
      render();
      const row = canvas.width * RGBA_BYTES;
      const out = new Uint8Array(row * canvas.height);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, out);
      const flipped = new Uint8Array(out.length);
      for (let y = 0; y < canvas.height; y++)
        flipped.set(
          out.subarray((canvas.height - 1 - y) * row, (canvas.height - y) * row),
          y * row,
        );
      return flipped;
    },
    toSource(clientX, clientY) {
      const box = canvas.getBoundingClientRect();
      // Percentage layouts (the monitor bezel) can have fractional CSS sizes;
      // clientWidth/Height alone round them and shift the mouse hit position.
      const width = box.width - (canvas.offsetWidth - canvas.clientWidth);
      const height = box.height - (canvas.offsetHeight - canvas.clientHeight);
      return outputToSource(
        layout,
        source,
        (clientX - box.left - canvas.clientLeft) / width,
        (clientY - box.top - canvas.clientTop) / height,
      );
    },
    // Frees every owned GPU object and stops resize tracking; idempotent.
    destroy() {
      if (destroyed) return;
      destroyed = true;
      last = null;
      overlay = composite = displayed = null;
      resized.disconnect();
      if (!gl) return;
      for (const release of owned) release();
      owned.length = 0;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

// Kernel sizes derived from the profiles, checked against SHADER_LIMITS.
function tubeKernels(source, monitor) {
  const limit = (name, value, max) => {
    if (!(value <= max)) throw Error(`crt: ${name} ${value} exceeds shader limit ${max}`);
  };
  const bits = source.levelBits ?? SOURCE_LEVEL_BITS;
  if (!Number.isInteger(bits) || bits < 1 || bits > SOURCE_LEVEL_BITS)
    throw Error(`crt: levelBits ${bits} must be an integer from 1 to ${SOURCE_LEVEL_BITS}`);
  if (!Number.isInteger(OVERSAMPLE) || OVERSAMPLE < 1)
    throw Error(`crt: OVERSAMPLE ${OVERSAMPLE} must be a positive integer`);
  limit('OVERSAMPLE', OVERSAMPLE, SHADER_LIMITS.oversample);
  const sigma = bandwidthSigma(source, monitor);
  const response = sourceResponse(source, monitor);
  const lightReach = voltageReach(sigma, response.tau);
  limit('light reach', lightReach, LIGHT_MAX_REACH);
  const spot = spotSigma(source, monitor);
  const spotReach = spotWeights(spot.pixels * OVERSAMPLE).reach;
  limit('spot reach', spotReach, SHADER_LIMITS.spotReach);
  const halo = halationKernel(source, monitor);
  const haloReach = halo.energy ? [gaussWeights(halo.x).reach, gaussWeights(halo.y).reach] : null;
  if (haloReach) for (const reach of haloReach) limit('halo reach', reach, SHADER_LIMITS.haloReach);
  limit('damper wire count', monitor.damperWires?.positions.length ?? 0, SHADER_LIMITS.wires);
  const margin = lightMargin(sigma, spot.pixels, response.tau);
  return { bits, sigma, response, lightReach, margin, spot, spotReach, halo, haloReach };
}

// Float targets and programs of the tube (shaders.mjs, pass order there).
// The three halo passes and their targets exist only with nonzero energy.
function tubePasses(gl, owned, source, monitor, kernels, space, surface) {
  const { bits, sigma, response, lightReach, margin, spot, spotReach, halo, haloReach } = kernels;
  const size = [source.width, source.height];
  const haloMargin = [halo.marginX, halo.marginY];
  const count = samplesPerRow(source, margin);

  // Passes 1 and 2: light and spot samples along each source line.
  const light = target(gl, owned, count, source.height);
  light.program = program(gl, owned, LIGHT, {
    frame: 0,
    size,
    sigma,
    sourceGain: response.gain,
    sourceTau: response.tau,
    reach: lightReach,
    levelDivisor: 1 << (SOURCE_LEVEL_BITS - bits),
    levelSteps: (1 << bits) - 1,
    gamma: monitor.gamma,
    oversample: OVERSAMPLE,
    margin,
  });
  const spread = target(gl, owned, count, source.height);
  spread.program = program(gl, owned, SPOT, {
    light: 0,
    sigma: spot.pixels * OVERSAMPLE,
    reach: spotReach,
  });

  // Halation: mean per source pixel, then horizontal and vertical Gaussians.
  let scattered = null;
  if (haloReach) {
    const base = target(gl, owned, halo.width, halo.height);
    base.program = program(gl, owned, HALO_BASE, {
      light: 0,
      size,
      haloMargin,
      oversample: OVERSAMPLE,
      margin,
    });
    const wide = target(gl, owned, halo.width, halo.height);
    wide.program = program(gl, owned, HALO_BLUR, {
      image: 0,
      sigma: halo.x,
      reach: haloReach[0],
      direction: [1, 0],
    });
    const out = target(gl, owned, halo.width, halo.height);
    out.program = program(gl, owned, HALO_BLUR, {
      image: 0,
      sigma: halo.y,
      reach: haloReach[1],
      direction: [0, 1],
    });
    scattered = { base, wide, out };
  }

  const none = { x: [0, 0, 0, 0], y: [0, 0, 0, 0] };
  const red = monitor.convergence?.red ?? none;
  const blue = monitor.convergence?.blue ?? none;
  const beam = program(gl, owned, BEAM, {
    spread: 0,
    halo: 1,
    size,
    sigma: spot.lines,
    gain: peakGain(spot.lines),
    oversample: OVERSAMPLE,
    margin,
    antialias: ANTIALIAS,
    colour: phosphorToOutput(monitor.phosphor, monitor.white, space),
    screenMm: [monitor.screenWidthMm, screenHeightMm(monitor)],
    curvature: [surface?.radius ?? 0, surface?.distance ?? 0],
    haloMargin,
    haloEnergy: halo.energy,
    redX: red.x,
    redY: red.y,
    blueX: blue.x,
    blueY: blue.y,
  });
  return { light, spread, halo: scattered, beam };
}

// BEAM wires uniform: two positions (fractions of screen height), shared
// width and full height, both in output pixels. An unused slot sits one
// screen height above the top, where its Gaussian underflows to zero.
function wireUniform(monitor, height) {
  const wires = monitor.damperWires;
  if (!wires) return [0, 0, 0, height];
  const [first = -1, second = -1] = wires.positions;
  return [first, second, (wires.widthMm / screenHeightMm(monitor)) * height, height];
}

function texture(gl, owned, format, width, height) {
  const handle = gl.createTexture();
  owned.push(() => gl.deleteTexture(handle));
  gl.bindTexture(gl.TEXTURE_2D, handle);
  gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
  for (const name of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
    gl.texParameteri(gl.TEXTURE_2D, name, gl.NEAREST);
  for (const name of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T])
    gl.texParameteri(gl.TEXTURE_2D, name, gl.CLAMP_TO_EDGE);
  return { texture: handle, width, height };
}

// RGBA16F intermediate render target.
function target(gl, owned, width, height) {
  const into = texture(gl, owned, gl.RGBA16F, width, height);
  const framebuffer = gl.createFramebuffer();
  owned.push(() => gl.deleteFramebuffer(framebuffer));
  into.framebuffer = framebuffer;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, into.texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw Error('crt: incomplete float target');
  return into;
}

// Linked program with initial uniforms. Shaders are deleted after linking;
// the program keeps what it needs.
function program(gl, owned, fragment, values) {
  const linked = gl.createProgram();
  owned.push(() => gl.deleteProgram(linked));
  const shaders = [];
  for (const [type, text] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, fragment],
  ]) {
    const shader = gl.createShader(type);
    shaders.push(shader);
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw Error('crt: ' + gl.getShaderInfoLog(shader));
    gl.attachShader(linked, shader);
  }
  gl.linkProgram(linked);
  for (const shader of shaders) {
    gl.detachShader(linked, shader);
    gl.deleteShader(shader);
  }
  if (!gl.getProgramParameter(linked, gl.LINK_STATUS))
    throw Error('crt: ' + gl.getProgramInfoLog(linked));
  gl.useProgram(linked);
  set(gl, linked, values);
  return linked;
}

// Named uniforms: nine values as a row-major mat3, other lists as vectors;
// samplers and reach as integers, other scalars as floats.
const INTEGER = new Set(['frame', 'light', 'spread', 'halo', 'image', 'reach']);
function set(gl, linked, values) {
  for (const [name, value] of Object.entries(values)) {
    const at = gl.getUniformLocation(linked, name);
    if (!at) continue;
    if (value.length === MATRIX_ENTRIES) gl.uniformMatrix3fv(at, true, value);
    else if (Array.isArray(value)) gl[`uniform${value.length}f`](at, ...value);
    else if (INTEGER.has(name)) gl.uniform1i(at, value);
    else gl.uniform1f(at, value);
  }
}
