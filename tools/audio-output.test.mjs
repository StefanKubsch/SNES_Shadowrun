import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_HEADROOM,
  AudioPlaybackOutput,
  DSP_SAMPLE_RATE as FS,
  PAL_1CHIP_AUDIO,
  PalAudioOutput,
} from '../src/browser/audio-output.mjs';
import { SampleQueue } from '../src/browser/sample-queue.mjs';
import { AUDIO_PROFILES } from '../src/browser/audio-profiles.mjs';

const multiply = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
const divide = ([a, b], [c, d]) => [
  (a * c + b * d) / (c * c + d * d),
  (b * c - a * d) / (c * c + d * d),
];

// Independent continuous circuit oracle: complex impedances at the original
// nodes, without the implementation's pole factorization, IIR or FIR design.
function circuit(frequency, profile) {
  const w = 2 * Math.PI * frequency,
    input = profile.inputCapacitanceF
      ? divide(
          [profile.inputResistanceOhm, 0],
          [
            profile.inputResistanceOhm + profile.inputSourceResistanceOhm,
            -1 / (w * profile.inputCapacitanceF),
          ],
        )
      : [1, 0],
    load = divide([1, 0], [1 / profile.loadResistanceOhm, w * profile.outputShuntF]),
    output = divide(load, [
      profile.outputResistanceOhm + load[0],
      load[1] - 1 / (w * profile.outputCapacitanceF),
    ]),
    angle = (Math.PI * frequency) / FS,
    hold = profile.dacHold ? Math.sin(angle) / angle : 1;
  let response = multiply(input, output);
  if (profile.mixerLowPassHz)
    response = multiply(response, divide([1, 0], [1, frequency / profile.mixerLowPassHz]));
  return response.map((part) => part * hold * profile.mixerGain);
}

function impulse(profile = {}) {
  const output = new PalAudioOutput(profile),
    left = new Float64Array(8 * FS),
    right = new Float64Array(left.length);
  left[0] = 1;
  output.process(left, right);
  assert.ok(
    right.every((value) => value === 0),
    'no crosstalk into the silent channel',
  );
  return { output, left };
}

function transform(samples, frequency, delay) {
  let re = 0,
    im = 0;
  for (let i = 0; i < samples.length; i++) {
    const angle = (-2 * Math.PI * frequency * (i - delay)) / FS;
    re += samples[i] * Math.cos(angle);
    im += samples[i] * Math.sin(angle);
  }
  return [re, im];
}

test('the PAL output matches the continuous circuit in magnitude and relative phase', () => {
  for (const profile of [
    ...Object.keys(AUDIO_PROFILES),
    { inputResistanceOhm: 10000 },
    { inputResistanceOhm: 1000000, inputCapacitanceF: 120e-9 },
    { outputShuntF: 10e-9, loadResistanceOhm: 10000 },
    { mixerLowPassHz: 16000 },
    { inputCapacitanceF: null, outputShuntF: 0, dacHold: false },
    { inputSourceResistanceOhm: 10000 },
    { inputSourceResistanceOhm: 100000, inputCapacitanceF: 150e-9 },
  ]) {
    const { output, left } = impulse(profile);
    assert.equal(output.delaySamples, 32, '1 ms processing delay at 32 kHz');
    for (const frequency of [5, 20, 50, 1000, 8000, 12000, 15000]) {
      const ratio = divide(
          transform(left, frequency, output.delaySamples),
          circuit(frequency, output.profile),
        ),
        db = 20 * Math.log10(Math.hypot(...ratio)),
        degrees = (Math.atan2(ratio[1], ratio[0]) * 180) / Math.PI;
      assert.ok(Math.abs(db) < 0.05, `${frequency} Hz: ${db} dB, ${JSON.stringify(profile)}`);
      assert.ok(Math.abs(degrees) < 1.5, `${frequency} Hz: ${degrees} degrees`);
    }
  }
});

test('the DAC aperture adds its sinc droop once, and input impedance mainly changes bass', () => {
  const base = PAL_1CHIP_AUDIO,
    db = (frequency, overrides) =>
      20 * Math.log10(Math.hypot(...circuit(frequency, { ...base, ...overrides })));
  const { output, left } = impulse({ dacHold: false });
  for (const frequency of [8000, 12000, 15000]) {
    const measured =
        20 * Math.log10(Math.hypot(...transform(left, frequency, output.delaySamples))),
      expected = db(frequency, { dacHold: false });
    assert.ok(Math.abs(measured - expected) < 0.05);
    const angle = (Math.PI * frequency) / FS;
    assert.ok(
      Math.abs(db(frequency, {}) - expected - 20 * Math.log10(Math.sin(angle) / angle)) < 1e-10,
    );
  }
  assert.ok(db(50, { inputResistanceOhm: 10000 }) - db(50, {}) < -10);
  assert.ok(Math.abs(db(8000, { inputResistanceOhm: 10000 }) - db(8000, {})) < 0.01);
});

test('output coupling discharges with the known 10 uF capacitor and the chosen receiving load', () => {
  const filter = new PalAudioOutput({ inputCapacitanceF: null, outputShuntF: 0, dacHold: false }),
    left = new Float64Array(4 * FS).fill(1),
    right = new Float64Array(left.length),
    p = filter.profile,
    tau = (p.outputResistanceOhm + p.loadResistanceOhm) * p.outputCapacitanceF,
    gain = p.loadResistanceOhm / (p.outputResistanceOhm + p.loadResistanceOhm);
  filter.process(left, right);
  for (const seconds of [0.01, 0.1, 0.48, 1, 3]) {
    const index = Math.round(seconds * FS) + filter.delaySamples;
    assert.ok(Math.abs(left[index] - gain * Math.exp(-seconds / tau)) < 0.00005);
  }
  assert.ok(Math.abs(left.at(-1)) < 0.0003);
});

test('processing is independent of render block boundaries and preserves stereo sign and input PCM', () => {
  const source = Int16Array.from({ length: 4096 }, (_, i) => ((i * 3709) & 65535) - 32768),
    saved = source.slice(),
    left = Float64Array.from(source, (value) => value / 32768),
    right = Float64Array.from(left, (value) => -value),
    splitLeft = left.slice(),
    splitRight = right.slice(),
    whole = new PalAudioOutput(),
    split = new PalAudioOutput();
  whole.process(left, right);
  let start = 0;
  for (const length of [1, 127, 0, 257, 13, 2048, 1650]) {
    split.process(
      splitLeft.subarray(start, start + length),
      splitRight.subarray(start, start + length),
    );
    start += length;
  }
  assert.equal(start, source.length);
  assert.deepEqual(splitLeft, left);
  assert.deepEqual(splitRight, right);
  assert.ok(left.every((value, i) => value === -right[i]));
  assert.deepEqual(source, saved);
});

test('queue starvation continues analogue decay, refill keeps state, and a new instance starts silent', () => {
  const queue = new SampleQueue({ prebuffer: 128, limit: 1024, declick: false, maxPrebuffer: 128 }),
    filter = new PalAudioOutput(),
    samples = new Int16Array(256).fill(12000),
    saved = samples.slice(),
    left = new Float32Array(128),
    right = new Float32Array(128);
  queue.push(samples);
  queue.fill(left, right);
  filter.process(left, right);
  queue.fill(left, right);
  assert.ok(
    left.every((value) => value === 0),
    'the raw queue supplies zero input',
  );
  filter.process(left, right);
  assert.ok(
    left.some((value) => Math.abs(value) > 0.0001),
    'stored charge has a tail',
  );
  assert.deepEqual([queue.played, queue.silent, queue.dropped], [128, 128, 0]);
  const expected = new PalAudioOutput();
  const fullLeft = new Float32Array(384),
    fullRight = new Float32Array(384);
  fullLeft.fill(12000 / 32768, 0, 128);
  fullRight.set(fullLeft);
  expected.process(fullLeft, fullRight);
  queue.push(new Int16Array(256));
  queue.fill(left, right);
  filter.process(left, right);
  assert.deepEqual(left, fullLeft.subarray(256));
  assert.deepEqual(right, fullRight.subarray(256));
  new PalAudioOutput().process(left.fill(0), right.fill(0));
  assert.ok(left.every((value) => value === 0));
  assert.deepEqual(samples, saved);
});

test('empty DSP blocks around startup, queued samples and refill never become undefined samples', () => {
  const queue = new SampleQueue({ prebuffer: 2, limit: 8, declick: false, maxPrebuffer: 2 }),
    playback = new AudioPlaybackOutput(),
    left = new Float32Array(4),
    right = new Float32Array(4);
  queue.push(new Int16Array(0));
  queue.fill(left, right);
  playback.process(left, right);
  queue.push(Int16Array.of(12000, -12000, 16000, -16000));
  queue.push(new Int16Array(0));
  queue.push(Int16Array.of(8000, -8000));
  queue.push(new Int16Array(0));
  queue.fill(left, right);
  assert.deepEqual([...left], [12000 / 32768, 16000 / 32768, 8000 / 32768, 0]);
  assert.deepEqual([...right], [-12000 / 32768, -16000 / 32768, -8000 / 32768, 0]);
  assert.equal(queue.queued, 0);
  assert.equal(queue.played, 3, 'no phantom played pair from an empty chunk');
  playback.process(left, right);
  for (let block = 0; block < 40; block++) {
    queue.push(new Int16Array(0));
    queue.fill(left, right);
    playback.process(left, right);
    assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
  }
  queue.push(Int16Array.of(14000, -14000, 14000, -14000));
  queue.fill(left, right);
  playback.process(left, right);
  assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
});

test('presentation headroom bounds the default response without clipping inside the circuit model', () => {
  const { left } = impulse(),
    absoluteSum = left.reduce((sum, value) => sum + Math.abs(value), 0);
  assert.ok(absoluteSum < 2.06);
  assert.ok(absoluteSum * AUDIO_HEADROOM < 0.99);
  assert.ok(Math.abs(left.at(-1)) < 1e-10, 'truncated tail is negligible for the bound');
});

test('bypass has the same level and delay, toggles smoothly and retains the advancing circuit state', () => {
  const samples = Float32Array.from({ length: 1024 }, (_, i) => 0.2 * Math.sin(i * 0.51)),
    actual = samples.slice(),
    actualRight = samples.slice(),
    filtered = samples.slice(),
    filteredRight = samples.slice(),
    playback = new AudioPlaybackOutput({ enabled: false }),
    reference = new PalAudioOutput();
  reference.process(filtered, filteredRight);
  playback.process(actual.subarray(0, 256), actualRight.subarray(0, 256));
  const dry = (i) => (i < reference.delaySamples ? 0 : samples[i - reference.delaySamples]);
  for (let i = 0; i < 256; i++) assert.equal(actual[i], Math.fround(dry(i) * AUDIO_HEADROOM));
  playback.setEnabled(true);
  playback.process(actual.subarray(256, 512), actualRight.subarray(256, 512));
  for (let i = 256; i < 512; i++) {
    const mix = Math.min(1, (i - 255) / 64),
      expected = (dry(i) + mix * (filtered[i] - dry(i))) * AUDIO_HEADROOM;
    assert.ok(Math.abs(actual[i] - expected) < 1e-7, 'crossfade and retained state at ' + i);
  }
  playback.setEnabled(false);
  playback.process(actual.subarray(512), actualRight.subarray(512));
  for (let i = 512; i < actual.length; i++) {
    const mix = Math.max(0, 1 - (i - 511) / 64),
      expected = (dry(i) + mix * (filtered[i] - dry(i))) * AUDIO_HEADROOM;
    assert.ok(Math.abs(actual[i] - expected) < 1e-7);
  }
  assert.deepEqual(actualRight, actual);
  assert.equal(playback.enabled, false);
  assert.equal(playback.mix, 0);
});

test('invalid circuit parameters and a different PCM rate fail before playback', () => {
  for (const profile of [
    { inputCapacitanceF: 0 },
    { inputResistanceOhm: 0 },
    { inputSourceResistanceOhm: -1 },
    { inputSourceResistanceOhm: Infinity },
    { inputSourceResistanceOhm: 1e308, inputResistanceOhm: 1e308 },
    { outputCapacitanceF: 0 },
    { loadResistanceOhm: -1 },
    { outputShuntF: NaN },
    { mixerGain: Infinity },
    { dacHold: 1 },
    { inputCapacitanceF: 1e-320 },
    { inputCapacitanceF: 1e300 },
    { inputResistenceOhm: 10000 },
  ])
    assert.throws(() => new PalAudioOutput(profile), RangeError);
  assert.throws(() => new PalAudioOutput({}, 48000), RangeError);
  assert.throws(() => new PalAudioOutput('unknown-profile'), RangeError);
});

test('profile changes crossfade circuit state and gain, preserve bypass delay and reject invalid IDs atomically', () => {
  const id = 'pal_1chip_optional_lp12k';
  for (const enabled of [true, false]) {
    const playback = new AudioPlaybackOutput({ enabled }),
      old = new AudioPlaybackOutput({ enabled }),
      next = new AudioPlaybackOutput({ enabled, profile: id });
    const warm = Float32Array.from({ length: 128 }, (_, i) => Math.sin(i / 7) * 0.8);
    playback.process(warm.slice(), warm.slice());
    old.process(warm.slice(), warm.slice());
    playback.setProfile('pal_1chip_reference_150n_100k');
    playback.setProfile(id);
    assert.equal(playback.previousCircuit.definition.id, old.circuit.definition.id);
    const circuit = playback.circuit;
    assert.throws(() => playback.setProfile('missing'), RangeError);
    assert.equal(playback.circuit, circuit, 'invalid selection has no effects');
    playback.setProfile(id);
    assert.equal(playback.circuit, circuit, 'unchanged selection retains state');
    const input = Float32Array.from({ length: 128 }, (_, i) => Math.cos(i / 5) * 0.8),
      actualL = input.slice(),
      actualR = input.slice(),
      oldL = input.slice(),
      oldR = input.slice(),
      nextL = input.slice(),
      nextR = input.slice();
    // The bypass history belongs to playback, independently of the new circuit.
    next.delayLeft.set(old.delayLeft);
    next.delayRight.set(old.delayRight);
    next.position = old.position;
    old.process(oldL, oldR);
    next.process(nextL, nextR);
    playback.process(actualL, actualR);
    for (let i = 0; i < input.length; i++) {
      const mix = Math.min(1, (i + 1) / 64),
        expected = oldL[i] + mix * (nextL[i] - oldL[i]);
      assert.ok(Math.abs(actualL[i] - expected) < 1e-7, `enabled=${enabled}, sample=${i}`);
    }
    assert.deepEqual(actualL, actualR);
    assert.equal(playback.previousCircuit, null);
    assert.equal(playback.profileMix, 1);
    assert.equal(playback.enabled, enabled);
    assert.equal(playback.presentationGain, next.presentationGain);
    assert.deepEqual(playback.delayLeft, next.delayLeft);
  }
});

test('source impedance changes both the input corner and passband divider', () => {
  const overrides = { inputSourceResistanceOhm: 100000, dacHold: false, outputShuntF: 0 },
    loaded = impulse(overrides),
    ideal = impulse({ dacHold: false, outputShuntF: 0 });
  for (const hz of [5, 50, 1000, 12000]) {
    const actual = divide(
        transform(loaded.left, hz, loaded.output.delaySamples),
        transform(ideal.left, hz, ideal.output.delaySamples),
      ),
      w = 2 * Math.PI * hz,
      reactance = -1 / (w * PAL_1CHIP_AUDIO.inputCapacitanceF),
      expected = divide(
        [PAL_1CHIP_AUDIO.inputResistanceOhm, reactance],
        [2 * PAL_1CHIP_AUDIO.inputResistanceOhm, reactance],
      );
    assert.ok(
      Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 0.0001,
      'Thevenin source changes the divider as well as RC at ' + hz + ' Hz',
    );
  }
  const omitted = impulse({ inputCapacitanceF: null, inputSourceResistanceOhm: 100000 });
  const omittedIdeal = impulse({ inputCapacitanceF: null });
  assert.deepEqual(omitted.left, omittedIdeal.left, 'null omits the whole input stage');
});

test('equal RC candidates remain equivalent with an ideal source but differ under source loading', () => {
  const a = impulse('pal_1chip_reference_150n_100k'),
    b = impulse('pal_1chip_100n_150k');
  assert.deepEqual(a.left, b.left);
  const loadedA = impulse({ ...a.output.profile, inputSourceResistanceOhm: 100000 }),
    loadedB = impulse({ ...b.output.profile, inputSourceResistanceOhm: 100000 });
  const level = (item) => Math.hypot(...transform(item.left, 1000, item.output.delaySamples));
  assert.ok(
    Math.abs(level(loadedA) / level(loadedB) - 5 / 6) < 0.0001,
    'different input resistances give different loaded passband dividers',
  );
});

test('each profile has safe fixed presentation gain in filtered and bypass playback', () => {
  for (const id of Object.keys(AUDIO_PROFILES)) {
    const { output, left } = impulse(id),
      playback = new AudioPlaybackOutput({ profile: id }),
      measuredSum = left.reduce((sum, value) => sum + Math.abs(value), 0),
      length = output.headroom.prefixSamples,
      adversarial = Float64Array.from(left.subarray(0, length), (value) =>
        Math.sign(value),
      ).reverse(),
      right = Float64Array.from(adversarial, (value) => -value);
    assert.ok(output.headroom.bound >= measuredSum, id + ': includes the tail beyond the prefix');
    assert.ok(output.headroom.tail > 0, 'tail is bounded analytically, not discarded');
    assert.ok(playback.presentationGain <= AUDIO_HEADROOM);
    assert.ok(playback.presentationGain * output.headroom.bound <= 0.99 + 1e-14);
    playback.process(adversarial, right);
    assert.ok(adversarial.every((value) => Math.abs(value) < 1));
    assert.ok(
      Math.abs(
        adversarial.at(-1) -
          left.subarray(0, length).reduce((sum, value) => sum + Math.abs(value), 0) *
            playback.presentationGain,
      ) < 1e-10,
      id + ': adversarial input realizes the finite impulse sum',
    );
    const bypass = new AudioPlaybackOutput({ profile: id, enabled: false }),
      dry = new Float64Array(128).fill(1),
      dryRight = new Float64Array(128).fill(-1);
    bypass.process(dry, dryRight);
    assert.equal(dry[output.delaySamples], playback.presentationGain);
    assert.equal(dryRight[output.delaySamples], -playback.presentationGain);
  }
  assert.equal(new AudioPlaybackOutput().presentationGain, AUDIO_HEADROOM);
  assert.ok(
    new AudioPlaybackOutput({ profile: 'pal_1chip_optional_lp12k' }).presentationGain <
      AUDIO_HEADROOM,
  );
});

test('headroom includes slow, equal and nearly equal IIR pole tails without mutating live state', () => {
  const equalCapacitance =
    ((PAL_1CHIP_AUDIO.outputResistanceOhm + PAL_1CHIP_AUDIO.loadResistanceOhm) *
      PAL_1CHIP_AUDIO.outputCapacitanceF) /
    PAL_1CHIP_AUDIO.inputResistanceOhm;
  for (const profile of [
    { inputCapacitanceF: equalCapacitance, outputShuntF: 0 },
    { inputCapacitanceF: equalCapacitance * (1 + 1e-12), outputShuntF: 0 },
    { inputResistanceOhm: 1e9 },
    { inputCapacitanceF: null },
    { mixerGain: 0 },
    { inputCapacitanceF: 1e-12 },
  ]) {
    const { output, left } = impulse(profile),
      sum = left.reduce((total, value) => total + Math.abs(value), 0);
    assert.ok(Number.isFinite(output.headroom.bound));
    assert.ok(output.headroom.bound >= sum, JSON.stringify(profile));
    const fresh = new PalAudioOutput(profile),
      zeroL = new Float64Array(128),
      zeroR = new Float64Array(128);
    fresh.process(zeroL, zeroR);
    assert.ok(
      zeroL.every((value) => value === 0) && zeroR.every((value) => value === 0),
      'headroom analysis must leave the live channels fresh',
    );
  }
});
