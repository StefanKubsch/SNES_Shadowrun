// PAL 1CHIP output approximation in the 32 kHz PCM baseband. Hardware sources,
// chosen parameters and numerical limits are recorded in docs/AUDIO-OUTPUT.md.
import { PAL_1CHIP_AUDIO, getAudioProfile } from './audio-profiles.mjs';
export { PAL_1CHIP_AUDIO } from './audio-profiles.mjs';

// b^2 - 4ac of the output pole quadratic (c = 1).
const QUADRATIC_DISCRIMINANT = 4;
// Kernel design samples the response at bin centres.
const BIN_CENTRE = 0.5;
// Generalized Blackman window with alpha 0.08: a0 = (1 - alpha) / 2, a1 = 1/2, a2 = alpha / 2.
const BLACKMAN_A0 = 0.46,
  BLACKMAN_A1 = 0.5,
  BLACKMAN_A2 = 0.04;
// Filter states below this magnitude are flushed to zero (avoids denormals).
const DENORMAL_FLOOR = 1e-24;
// Web Audio render quantum (frames per process call).
export const RENDER_QUANTUM = 128;
// Crossfade step per sample between bypass and the analogue path (64 samples, 2 ms).
const MIX_STEP = 1 / 64;
export const DSP_SAMPLE_RATE = 32000;
// Presentation headroom, separate from circuit gain. The default circuit's
// impulse absolute sum is below 2.06, keeping any full-scale PCM stream < 1.
export const AUDIO_HEADROOM = 0.48;
// Keep at least one percent of full scale free for Float32 playback rounding.
const PLAYBACK_PEAK_LIMIT = 0.99;
// Bound a finite impulse prefix and its analytic infinite tail at construction.
const HEADROOM_PREFIX_SAMPLES = 4096,
  BOUND_ROUNDOFF_ALLOWANCE = 1e-9;

const RADIUS = 32,
  TAPS = 2 * RADIUS + 1,
  BINS = 1024;

function parameters(options) {
  for (const key of Object.keys(options))
    if (!Object.hasOwn(PAL_1CHIP_AUDIO, key))
      throw new RangeError('Unknown audio parameter: ' + key);
  const profile = { ...PAL_1CHIP_AUDIO, ...options };
  if (typeof profile.dacHold !== 'boolean') throw new RangeError('Invalid DAC hold option');
  for (const key of Object.keys(PAL_1CHIP_AUDIO).filter((key) => key !== 'dacHold')) {
    const value = profile[key];
    // null explicitly omits the unresolved input stage; a zero series
    // capacitance would physically open the circuit and is not a bypass.
    if (key === 'inputCapacitanceF' && value === null) continue;
    if (!Number.isFinite(value) || value < 0)
      throw new RangeError('Invalid audio parameter: ' + key);
  }
  for (const key of [
    'inputCapacitanceF',
    'inputResistanceOhm',
    'outputCapacitanceF',
    'loadResistanceOhm',
  ])
    if (profile[key] === 0) throw new RangeError('Audio parameter must be positive: ' + key);
  return Object.freeze(profile);
}

function multiply([ar, ai], [br, bi]) {
  return [ar * br - ai * bi, ar * bi + ai * br];
}

// The exact series R/C, shunt C and receiving R have two real poles. Evaluate
// the slow root without subtracting nearly equal values (Cshunt is very small).
function outputPoles(p) {
  const b =
    (p.outputResistanceOhm + p.loadResistanceOhm) * p.outputCapacitanceF +
    p.loadResistanceOhm * p.outputShuntF;
  const a = p.outputResistanceOhm * p.loadResistanceOhm * p.outputCapacitanceF * p.outputShuntF;
  // Roots of a s^2 + b s + 1: (b +- sqrt(b^2 - 4a)) / 2a.
  const root = Math.sqrt(Math.max(0, b * b - QUADRATIC_DISCRIMINANT * a)),
    slow = 2 / (b + root);
  return { slow, fast: a ? (b + root) / (2 * a) : Infinity };
}

// The slow poles retain their infinite decay in IIR state. The FIR corrects
// bilinear frequency warping and models the DAC aperture and the fast poles.
function highPassCorrection(w, pole) {
  if (!pole) return [1, 0];
  const v = 2 * DSP_SAMPLE_RATE * Math.tan(w / (2 * DSP_SAMPLE_RATE)),
    scale = w / v / (pole * pole + w * w);
  return [scale * (pole * pole + v * w), scale * pole * (v - w)];
}

function lowPass(w, pole) {
  if (!Number.isFinite(pole)) return [1, 0];
  const ratio = w / pole,
    gain = 1 / (1 + ratio * ratio);
  return [gain, -ratio * gain];
}

function kernel(p, inputPole, output) {
  const result = new Float64Array(TAPS),
    inputGain =
      p.inputCapacitanceF === null
        ? 1
        : p.inputResistanceOhm / (p.inputResistanceOhm + p.inputSourceResistanceOhm),
    gain = p.mixerGain * p.loadResistanceOhm * p.outputCapacitanceF * output.slow * inputGain;
  for (let bin = 0; bin < BINS; bin++) {
    const theta = (Math.PI * (bin + BIN_CENTRE)) / BINS,
      w = theta * DSP_SAMPLE_RATE,
      aperture = p.dacHold ? Math.sin(theta / 2) / (theta / 2) : 1;
    let response = multiply(highPassCorrection(w, inputPole), highPassCorrection(w, output.slow));
    response = multiply(response, lowPass(w, output.fast));
    if (p.mixerLowPassHz) response = multiply(response, lowPass(w, 2 * Math.PI * p.mixerLowPassHz));
    for (let tap = 0; tap < TAPS; tap++) {
      const angle = theta * (tap - RADIUS);
      result[tap] += aperture * (response[0] * Math.cos(angle) - response[1] * Math.sin(angle));
    }
  }
  let sum = 0;
  for (let tap = 0; tap < TAPS; tap++) {
    const angle = (Math.PI * (tap - RADIUS)) / RADIUS;
    // Generalized Blackman, alpha 0.08: retain the 1 ms delay while reducing
    // the near-Nyquist error for the tested shunt/bandwidth alternatives.
    result[tap] *= BLACKMAN_A0 + BLACKMAN_A1 * Math.cos(angle) + BLACKMAN_A2 * Math.cos(2 * angle);
    sum += result[tap];
  }
  for (let tap = 0; tap < TAPS; tap++) result[tap] *= gain / sum;
  if (!result.every(Number.isFinite))
    throw new RangeError('Audio parameters exceed numerical range');
  return result;
}

class HighPass {
  constructor(pole) {
    this.a = (2 * DSP_SAMPLE_RATE - pole) / (2 * DSP_SAMPLE_RATE + pole);
    if (!Number.isFinite(this.a) || Math.abs(this.a) >= 1)
      throw new RangeError('Audio pole exceeds numerical range');
    this.b = (1 + this.a) / 2;
    this.x = new Float64Array(2);
    this.y = new Float64Array(2);
  }
  sample(x, channel) {
    const y = this.a * this.y[channel] + this.b * (x - this.x[channel]);
    this.x[channel] = x;
    this.y[channel] = Math.abs(y) < DENORMAL_FLOOR ? 0 : y;
    return y;
  }
}

// For zero future input, u[k] = a1^k*u[0] and
// v[k] = a2^k*v[0] + b2*(a1-1)*u[0]*(a2^k-a1^k)/(a2-a1).
// Bound both geometric tails. The convolution form also covers equal poles.
function highPassTail(input, output, u, v) {
  const a1 = input?.a ?? 0,
    a2 = output.a,
    q1 = Math.abs(a1),
    q2 = Math.abs(a2),
    forcing = output.b * (a1 - 1) * u;
  let bound = (Math.abs(v) * q2) / (1 - q2) + Math.abs(forcing) / ((1 - q1) * (1 - q2));
  if (a1 !== a2) {
    const residue = forcing / (a2 - a1);
    bound = Math.min(
      bound,
      (Math.abs(v + residue) * q2) / (1 - q2) + (Math.abs(residue) * q1) / (1 - q1),
    );
  }
  return bound;
}

// Construction only: simulate scalar IIR/FIR impulse state without touching
// either live stereo channel. Triangle bounds include FIR history and the
// entire remaining IIR decay; a slowly decaying pole is never truncated away.
function impulseBound(coefficients, input, output) {
  const history = new Float64Array(TAPS);
  let previous = 0,
    u = 0,
    v = 0,
    position = 0,
    prefix = 0;
  for (let i = 0; i < HEADROOM_PREFIX_SAMPLES; i++) {
    const x = i === 0 ? 1 : 0,
      next = input ? input.a * u + input.b * (x - previous) : x;
    v = output.a * v + output.b * (next - u);
    u = next;
    previous = x;
    history[position] = v;
    let y = 0,
      index = position;
    for (let tap = 0; tap < TAPS; tap++) {
      y += coefficients[tap] * history[index];
      if (--index < 0) index = TAPS - 1;
    }
    prefix += Math.abs(y);
    if (++position === TAPS) position = 0;
  }
  const remainder = highPassTail(input, output, input ? u : 0, v);
  let tail = 0,
    suffix = 0;
  for (let tap = 0; tap < TAPS; tap++) {
    if (tap) suffix += Math.abs(history[(position - tap + TAPS) % TAPS]);
    tail += Math.abs(coefficients[tap]) * (remainder + suffix);
  }
  const bound = (prefix + tail) * (1 + BOUND_ROUNDOFF_ALLOWANCE) + BOUND_ROUNDOFF_ALLOWANCE;
  if (!Number.isFinite(bound)) throw new RangeError('Audio headroom exceeds numerical range');
  return Object.freeze({ prefixSamples: HEADROOM_PREFIX_SAMPLES, prefix, tail, bound });
}

export class PalAudioOutput {
  constructor(options = {}, sampleRate = DSP_SAMPLE_RATE) {
    if (sampleRate !== DSP_SAMPLE_RATE)
      throw new RangeError('PAL audio output requires 32000 Hz PCM');
    this.definition =
      typeof options === 'string'
        ? getAudioProfile(options)
        : Object.keys(options).length === 0
          ? getAudioProfile()
          : null;
    this.profile = parameters(this.definition?.parameters ?? options);
    const p = this.profile,
      inputPole = p.inputCapacitanceF
        ? 1 / (p.inputCapacitanceF * (p.inputResistanceOhm + p.inputSourceResistanceOhm))
        : 0,
      output = outputPoles(p);
    if (
      !Number.isFinite(inputPole) ||
      (p.inputCapacitanceF !== null && inputPole <= 0) ||
      !Number.isFinite(output.slow) ||
      Number.isNaN(output.fast)
    )
      throw new RangeError('Audio parameters exceed numerical range');
    this.input = inputPole ? new HighPass(inputPole) : null;
    this.output = new HighPass(output.slow);
    this.coefficients = kernel(p, inputPole, output);
    this.headroom = impulseBound(this.coefficients, this.input, this.output);
    this.left = new Float64Array(TAPS);
    this.right = new Float64Array(TAPS);
    this.position = 0;
    this.delaySamples = RADIUS;
  }

  // In-place playback processing. Always process zero input too: underflow
  // releases stored charge instead of pausing the circuit or cutting its tail.
  process(left, right) {
    for (let i = 0; i < left.length; i++) {
      let l = left[i],
        r = right[i];
      if (this.input) {
        l = this.input.sample(l, 0);
        r = this.input.sample(r, 1);
      }
      this.left[this.position] = this.output.sample(l, 0);
      this.right[this.position] = this.output.sample(r, 1);
      l = 0;
      r = 0;
      let index = this.position;
      for (let tap = 0; tap < TAPS; tap++) {
        l += this.coefficients[tap] * this.left[index];
        r += this.coefficients[tap] * this.right[index];
        if (--index < 0) index = TAPS - 1;
      }
      left[i] = l;
      right[i] = r;
      if (++this.position === TAPS) this.position = 0;
    }
  }
}

// Keep bypass at the same reference delay and presentation level. Both paths
// advance during bypass, and a 2 ms crossfade avoids abrupt toggle edges.
export class AudioPlaybackOutput {
  constructor({ enabled = true, profile = {}, sampleRate = DSP_SAMPLE_RATE } = {}) {
    this.circuit = new PalAudioOutput(profile, sampleRate);
    // One fixed presentation gain for wet and dry paths; never compress or
    // normalize the signal dynamically. Default PCM remains bit-for-bit equal.
    this.presentationGain = Math.min(
      AUDIO_HEADROOM,
      PLAYBACK_PEAK_LIMIT / Math.max(1, this.circuit.headroom.bound),
    );
    this.enabled = enabled;
    this.mix = enabled ? 1 : 0;
    this.dryLeft = new Float32Array(RENDER_QUANTUM);
    this.dryRight = new Float32Array(RENDER_QUANTUM);
    this.delayLeft = new Float32Array(this.circuit.delaySamples);
    this.delayRight = new Float32Array(this.circuit.delaySamples);
    this.position = 0;
    this.previousCircuit = null;
    this.profileMix = 1;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  // Keep the last audible circuit while profile choices arrive during a pause.
  // Blend its output and presentation gain into the fresh circuit over 2 ms.
  setProfile(id) {
    if (this.circuit.definition?.id === id) return;
    const circuit = new PalAudioOutput(id),
      gain = Math.min(AUDIO_HEADROOM, PLAYBACK_PEAK_LIMIT / Math.max(1, circuit.headroom.bound));
    if (!this.previousCircuit) {
      this.previousCircuit = this.circuit;
      this.previousGain = this.presentationGain;
    }
    this.circuit = circuit;
    this.presentationGain = gain;
    this.profileMix = 0;
  }

  process(left, right) {
    if (this.dryLeft.length !== left.length) {
      this.dryLeft = new Float32Array(left.length);
      this.dryRight = new Float32Array(left.length);
    }
    this.dryLeft.set(left);
    this.dryRight.set(right);
    if (this.previousCircuit) {
      if (this.previousLeft?.length !== left.length) {
        this.previousLeft = new Float32Array(left.length);
        this.previousRight = new Float32Array(left.length);
      }
      this.previousLeft.set(left);
      this.previousRight.set(right);
      this.previousCircuit.process(this.previousLeft, this.previousRight);
    }
    this.circuit.process(left, right);
    const target = this.enabled ? 1 : 0;
    for (let i = 0; i < left.length; i++) {
      const dryL = this.delayLeft[this.position],
        dryR = this.delayRight[this.position];
      this.delayLeft[this.position] = this.dryLeft[i];
      this.delayRight[this.position] = this.dryRight[i];
      if (++this.position === this.delayLeft.length) this.position = 0;
      this.mix += Math.max(-MIX_STEP, Math.min(MIX_STEP, target - this.mix));
      left[i] =
        (this.mix === 0 ? dryL : dryL + this.mix * (left[i] - dryL)) * this.presentationGain;
      right[i] =
        (this.mix === 0 ? dryR : dryR + this.mix * (right[i] - dryR)) * this.presentationGain;
      if (this.previousCircuit && this.profileMix < 1) {
        this.profileMix = Math.min(1, this.profileMix + MIX_STEP);
        const previousL = (dryL + this.mix * (this.previousLeft[i] - dryL)) * this.previousGain,
          previousR = (dryR + this.mix * (this.previousRight[i] - dryR)) * this.previousGain;
        left[i] = previousL + this.profileMix * (left[i] - previousL);
        right[i] = previousR + this.profileMix * (right[i] - previousR);
      }
    }
    if (this.profileMix === 1) this.previousCircuit = null;
  }
}
