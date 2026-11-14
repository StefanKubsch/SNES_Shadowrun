// Queue the native DSP's 32 kHz L/R pairs, apply the PAL 1CHIP output
// approximation and report native played, silent and dropped pair counts, the
// underruns and the current prebuffer (src/browser/sample-queue.mjs).
import { SampleQueue } from './sample-queue.mjs';
import { AudioPlaybackOutput, RENDER_QUANTUM } from './audio-output.mjs';
import { AUDIO_PROFILES } from './audio-profiles.mjs';

const SOUNDTRACK_MIX_STEP = 1 / 640;
class SnesAudio extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.queue = new SampleQueue();
    this.effectsQueue = new SampleQueue();
    this.tribute = false;
    this.tributeMix = 0;
    this.effectsLeft = new Float32Array(RENDER_QUANTUM);
    this.effectsRight = new Float32Array(RENDER_QUANTUM);
    this.output = new AudioPlaybackOutput({
      enabled: options.processorOptions?.analogEnabled !== false,
      profile: options.processorOptions?.audioProfile,
      sampleRate,
    });
    this.monoScratch = new Float32Array(RENDER_QUANTUM);
    this.reported = 0;
    this.port.onmessage = ({ data }) => {
      if (data instanceof Int16Array) this.queue.push(data);
      else if (data?.original instanceof Int16Array && data?.effects instanceof Int16Array) {
        this.queue.push(data.original);
        this.effectsQueue.push(data.effects);
      } else if (data?.command === 'tribute-active') this.tribute = data.active === true;
      else if (data?.command === 'analog-filter' && typeof data.enabled === 'boolean')
        this.output.setEnabled(data.enabled);
      else if (data?.command === 'audio-profile' && Object.hasOwn(AUDIO_PROFILES, data.profile))
        this.output.setProfile(data.profile);
    };
  }
  process(inputs, outputs) {
    const [left, right] = outputs[0];
    if (!left) return true;
    if (this.monoScratch.length !== left.length) this.monoScratch = new Float32Array(left.length);
    const r = right ?? this.monoScratch;
    this.queue.fill(left, r);
    if (this.effectsLeft.length !== left.length) {
      this.effectsLeft = new Float32Array(left.length);
      this.effectsRight = new Float32Array(left.length);
    }
    this.effectsQueue.fill(this.effectsLeft, this.effectsRight);
    const target = this.tribute ? 1 : 0;
    for (let i = 0; i < left.length; i++) {
      this.tributeMix += Math.max(
        -SOUNDTRACK_MIX_STEP,
        Math.min(SOUNDTRACK_MIX_STEP, target - this.tributeMix),
      );
      left[i] += this.tributeMix * (this.effectsLeft[i] - left[i]);
      r[i] += this.tributeMix * (this.effectsRight[i] - r[i]);
    }
    this.output.process(left, r);
    if (currentFrame - this.reported >= sampleRate / 2) {
      this.reported = currentFrame;
      const { played, silent, dropped, underruns, prebuffer } = this.queue;
      this.port.postMessage({
        played,
        silent,
        dropped,
        underruns,
        prebuffer,
        analogEnabled: this.output.enabled,
        audioProfile: this.output.circuit.definition?.id ?? 'custom',
        presentationGain: this.output.presentationGain,
        tributeActive: this.tribute,
      });
    }
    return true;
  }
}
registerProcessor('snes-audio', SnesAudio);
