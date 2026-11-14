import { tributeTrack, tributeUrl, TITLE_SONG_TABLE } from './tribute-tracks.mjs';
import { AUDIO_HEADROOM } from './audio-output.mjs';

// Presentation gain and switch ramp; independent from the original music clock.
const SWITCH_SECONDS = 0.02;
const MEDIA_HAVE_METADATA = 1;
// The album is mastered much louder than the game's effects. Keep those effects
// unchanged and start the independent music fader at one quarter of its range.
export const DEFAULT_TRIBUTE_VOLUME = 0.25;
export function tributeVolume(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_TRIBUTE_VOLUME;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : DEFAULT_TRIBUTE_VOLUME;
}
export class TributePlayer {
  constructor(
    context,
    {
      enabled = false,
      volume = DEFAULT_TRIBUTE_VOLUME,
      createMedia = () => new Audio(),
      sourceFor = tributeUrl,
      onChange = () => {},
    } = {},
  ) {
    this.context = context;
    this.createMedia = createMedia;
    this.sourceFor = sourceFor;
    this.onChange = onChange;
    this.enabled = enabled;
    this.volume = tributeVolume(volume);
    this.paused = false;
    this.closed = false;
    this.key = null;
    this.state = null;
    this.entry = null;
    // Session-local positions survive a switch to another cue without retaining
    // multiple decoders, streams or audio nodes.
    this.positions = new Map();
    this.active = false;
    this.error = '';
  }
  setEnabled(enabled) {
    if (enabled && !this.enabled && this.error) {
      this.release();
      this.error = '';
    }
    this.enabled = enabled;
    this.sync();
  }
  setPaused(paused) {
    this.paused = paused;
    this.sync();
  }
  setVolume(value) {
    this.volume = tributeVolume(value);
    this.sync();
  }
  update(state) {
    if (this.closed || !state) return;
    const key = `${state.table}:${state.song}:${state.revision}`;
    if (key !== this.key) {
      // Dialog/menu cleanup can stop and request the same cue again (the punk
      // returns to Tenth Street). Keep that recording and its playback position.
      // The combined title continues into the menu; a new title intro restarts it.
      const track = tributeTrack(state),
        restartsIntro = state.table === TITLE_SONG_TABLE && state.song === 1,
        keep =
          this.entry && (state.song === 0 || (track?.file === this.entry.file && !restartsIntro));
      if (!keep) this.release();
      if (restartsIntro) this.positions.delete(track.file);
      this.key = key;
      this.error = '';
    }
    this.state = state;
    this.sync();
  }
  gain(value) {
    const parameter = this.entry?.gain.gain;
    if (!parameter) return;
    const now = this.context.currentTime;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(parameter.value, now);
    parameter.linearRampToValueAtTime(value, now + SWITCH_SECONDS);
  }
  report(active) {
    this.active = active;
    const track = tributeTrack(this.state ?? {});
    this.onChange({
      active,
      // Reserve the SFX-only mix while loading/restarting a supported cue.
      // Falling back during every play() briefly mixes old original music in.
      replaceMusic: !!(this.enabled && this.state?.playing && track && !this.error && !this.closed),
      error: this.error,
      track,
      playing: !!this.state?.playing,
      paused: this.paused,
    });
  }
  sync() {
    if (this.closed) return;
    const track = tributeTrack(this.state ?? {});
    if (!this.enabled || !this.state?.playing || !track || this.paused || this.error) {
      if (this.entry?.pending) {
        this.entry.attempt++;
        this.entry.pending = false;
      }
      this.entry?.media.pause();
      this.gain(0);
      this.report(false);
      return;
    }
    if (!this.entry) {
      const media = this.createMedia(),
        gain = this.context.createGain(),
        source = this.context.createMediaElementSource(media);
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(this.context.destination);
      const entry = (this.entry = {
        media,
        gain,
        source,
        pending: false,
        ready: false,
        attempt: 0,
        file: track.file,
        resumeAt: this.positions.get(track.file) || null,
      });
      media.preload = 'auto';
      media.addEventListener('loadedmetadata', () => {
        if (this.entry === entry) this.sync();
      });
      media.addEventListener('error', () =>
        this.fail(entry, 'Tribute unavailable; playing original soundtrack.'),
      );
      media.addEventListener('ended', () => {
        if (this.entry !== entry) return;
        // loop normally prevents ended. Also handle an already-ended stream
        // on resume and browser end events without restoring original music.
        entry.ready = false;
        entry.media.currentTime = 0;
        this.sync();
      });
      media.addEventListener('waiting', () => {
        if (this.entry !== entry) return;
        this.gain(0);
        this.report(false);
      });
      media.addEventListener('playing', () => {
        if (this.entry !== entry || !this.enabled || this.paused || !this.state?.playing) return;
        this.gain(this.state.volume * this.volume * AUDIO_HEADROOM);
        this.report(true);
      });
      media.src = this.sourceFor(track.file);
    }
    const entry = this.entry;
    entry.media.loop = true;
    if (entry.resumeAt !== null) {
      // Seek before play(), once metadata makes the saved offset usable. Do not
      // briefly play the beginning while a returning track is still loading.
      if (!(entry.media.readyState >= MEDIA_HAVE_METADATA)) {
        this.report(false);
        return;
      }
      const duration = entry.media.duration,
        position = entry.resumeAt;
      entry.resumeAt = null;
      entry.media.currentTime =
        Number.isFinite(duration) && duration > 0 ? position % duration : position;
    }
    if (entry.ready && !entry.media.paused) {
      this.gain(this.state.volume * this.volume * AUDIO_HEADROOM);
      return;
    }
    if (entry.pending) return;
    entry.pending = true;
    const attempt = ++entry.attempt;
    this.report(false);
    Promise.resolve()
      .then(() => {
        if (this.entry === entry && entry.attempt === attempt && this.enabled && !this.paused)
          return entry.media.play();
      })
      .then(() => {
        if (entry.attempt !== attempt) return;
        entry.pending = false;
        if (this.entry !== entry || this.closed) return;
        if (!this.enabled || this.paused || !this.state?.playing) {
          entry.media.pause();
          return;
        }
        entry.ready = true;
        this.gain(this.state.volume * this.volume * AUDIO_HEADROOM);
        this.report(true);
      })
      .catch(() => {
        if (entry.attempt !== attempt) return;
        entry.pending = false;
        // pause() can cancel an outstanding play() during a switch or a pause.
        if (this.entry === entry && this.enabled && !this.paused && this.state?.playing)
          this.fail(entry, 'Tribute unavailable; playing original soundtrack.');
      });
  }
  fail(entry, message) {
    if (this.entry !== entry || this.closed) return;
    this.error = message;
    entry.media.pause();
    this.gain(0);
    this.report(false);
  }
  release() {
    const entry = this.entry;
    this.entry = null;
    if (entry) {
      entry.media.pause();
      // A pending restore has not played yet; its unloaded media reports zero.
      // Preserve the saved offset if another cue supersedes it before metadata.
      const position = entry.resumeAt ?? entry.media.currentTime;
      if (Number.isFinite(position) && position >= 0) this.positions.set(entry.file, position);
      entry.media.removeAttribute('src');
      entry.media.load();
      entry.source.disconnect();
      entry.gain.disconnect();
    }
    this.report(false);
  }
  close() {
    this.closed = true;
    this.release();
    this.positions.clear();
  }
}
