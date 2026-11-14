import { TRIBUTE_MAIN_THEME, TRIBUTE_TRACKS, tributeUrl } from './tribute-tracks.mjs';

// Keep compressed recordings, not decoded PCM or twelve live media players.
// Intro and the first room take priority; two downloads leave room for game data.
const PRELOAD_TRACKS = [
  TRIBUTE_MAIN_THEME,
  TRIBUTE_TRACKS[7],
  ...Object.values(TRIBUTE_TRACKS).filter((track) => track !== TRIBUTE_TRACKS[7]),
];
const PRELOAD_CONCURRENCY = 2;

export class TributeCache {
  constructor({
    fetchTrack = (url, options) => fetch(url, options),
    createUrl = (blob) => URL.createObjectURL(blob),
    revokeUrl = (url) => URL.revokeObjectURL(url),
  } = {}) {
    this.fetchTrack = fetchTrack;
    this.createUrl = createUrl;
    this.revokeUrl = revokeUrl;
    this.urls = new Map();
    this.run = null;
    this.closed = false;
  }
  source(file) {
    // An unfinished or failed preload must not delay ordinary media streaming.
    return this.urls.get(file) ?? tributeUrl(file);
  }
  preload() {
    if (this.closed) return Promise.resolve();
    if (this.run) return this.run.done;
    const run = { controller: new AbortController(), done: null };
    this.run = run;
    const pending = PRELOAD_TRACKS.filter((track) => !this.urls.has(track.file));
    const worker = async () => {
      while (pending.length && !run.controller.signal.aborted) {
        const track = pending.shift();
        try {
          const response = await this.fetchTrack(tributeUrl(track.file), {
            signal: run.controller.signal,
            priority: 'low',
          });
          if (!response.ok) continue;
          const blob = await response.blob();
          if (run.controller.signal.aborted || this.closed) return;
          this.urls.set(track.file, this.createUrl(blob));
        } catch {
          // Preloading is optional. The player retains its normal stream/error path.
        }
      }
    };
    run.done = Promise.all(Array.from({ length: PRELOAD_CONCURRENCY }, worker)).finally(() => {
      if (this.run === run) this.run = null;
    });
    return run.done;
  }
  cancel() {
    this.run?.controller.abort();
    this.run = null;
  }
  close() {
    this.closed = true;
    this.cancel();
    for (const url of this.urls.values()) this.revokeUrl(url);
    this.urls.clear();
  }
}
