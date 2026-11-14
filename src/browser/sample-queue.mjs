// Queue of the sound output in the AudioWorklet: Int16 L/R pairs (32 kHz) from
// the worker, output as Float32 per channel. The frame clock (50 Hz from the
// display clock) and the audio clock run separately; the queue evens this out:
// it starts only with prebuffer pairs, outputs silence when empty and then
// prefills again, and above limit pairs the oldest blocks are dropped.
// Default fill levels in L/R pairs at 32 kHz: start after 40 ms, drop above 160 ms.
//
// Each break in the signal (the queue running empty, starting again, or dropping
// queued pairs) would be a step in the waveform, heard as a click. With declick
// the output carries the step as an offset that decays within a few milliseconds
// (an exponential glide from the last output value). After the queue ran empty
// while playing, the worker could not keep up (a busy page or scene change), so the
// prebuffer doubles up to 80 ms.
const PREBUFFER_PAIRS = 1280,
  LIMIT_PAIRS = 5120,
  MAX_PREBUFFER_PAIRS = 2560,
  // Offset decay per pair: a time constant of about 4 ms at 32 kHz.
  DECLICK_DECAY = 0.992;
// Int16 sample to Float32 in [-1, 1).
const INT16_SCALE = 0x8000;
export class SampleQueue {
  constructor({
    prebuffer = PREBUFFER_PAIRS,
    limit = LIMIT_PAIRS,
    declick = true,
    maxPrebuffer = MAX_PREBUFFER_PAIRS,
  } = {}) {
    this.chunks = [];
    this.offset = 0;
    this.queued = 0;
    this.running = false;
    this.prebuffer = prebuffer;
    this.limit = limit;
    this.declick = declick;
    this.maxPrebuffer = Math.max(prebuffer, Math.min(maxPrebuffer, limit >> 1));
    this.played = 0;
    this.silent = 0;
    this.dropped = 0;
    this.underruns = 0;
    // The last output pair, the decaying offsets and a break to bridge.
    this.lastLeft = 0;
    this.lastRight = 0;
    this.offsetLeft = 0;
    this.offsetRight = 0;
    this.broken = false;
  }
  push(samples) {
    // Frames without DSP output are valid. An empty chunk must never become
    // an undefined sample and poison the output circuit's persistent state.
    if (!samples.length) return;
    this.chunks.push(samples);
    this.queued += samples.length >> 1;
    const before = this.dropped;
    while (this.queued > this.limit && this.chunks.length > 1) {
      const n = (this.chunks.shift().length - this.offset) >> 1;
      this.queued -= n;
      this.dropped += n;
      this.offset = 0;
    }
    // A no-NMI music wait can deliver seconds in a single block. Keeping that
    // whole block defeats the latency limit and plays old scene effects late.
    if (this.queued > this.limit) {
      const n = this.queued - this.limit;
      this.offset += n * 2;
      this.queued -= n;
      this.dropped += n;
    }
    if (this.dropped !== before && this.running) this.broken = true;
  }
  fill(left, right) {
    if (!this.running && this.queued >= this.prebuffer) {
      this.running = true;
      this.broken = true;
    }
    for (let i = 0; i < left.length; i++) {
      const c = this.chunks[0];
      let l = 0,
        r = 0;
      if (!this.running || !c) {
        if (this.running) {
          // Ran empty while playing: bridge the step and buffer more next time.
          this.underruns++;
          this.prebuffer = Math.min(this.prebuffer * 2, this.maxPrebuffer);
          this.broken = true;
        }
        this.silent++;
        this.running = false;
      } else {
        l = c[this.offset] / INT16_SCALE;
        r = c[this.offset + 1] / INT16_SCALE;
        this.offset += 2;
        this.queued--;
        this.played++;
        if (this.offset >= c.length) {
          this.chunks.shift();
          this.offset = 0;
        }
      }
      if (this.declick) {
        if (this.broken) {
          this.offsetLeft = this.lastLeft - l;
          this.offsetRight = this.lastRight - r;
          this.broken = false;
        }
        l += this.offsetLeft;
        r += this.offsetRight;
        this.offsetLeft *= DECLICK_DECAY;
        this.offsetRight *= DECLICK_DECAY;
        this.lastLeft = l;
        this.lastRight = r;
      } else this.broken = false;
      left[i] = l;
      right[i] = r;
    }
  }
}
