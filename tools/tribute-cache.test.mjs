import test from 'node:test';
import assert from 'node:assert/strict';
import { TributeCache } from '../src/browser/tribute-cache.mjs';
import { TRIBUTE_MAIN_THEME, TRIBUTE_TRACKS, tributeUrl } from '../src/browser/tribute-tracks.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('preload keeps all compressed recordings once with two downloads and releases their URLs', async () => {
  const requests = [],
    revoked = [];
  let active = 0,
    peak = 0,
    created = 0;
  const cache = new TributeCache({
    fetchTrack: async (url, { priority }) => {
      requests.push(url);
      assert.equal(priority, 'low');
      peak = Math.max(peak, ++active);
      await settle();
      active--;
      return new Response('unchanged compressed recording', {
        headers: { 'Content-Type': 'audio/ogg' },
      });
    },
    createUrl: (blob) => {
      assert.equal(blob.type, 'audio/ogg');
      assert.equal(blob.size, 'unchanged compressed recording'.length);
      return `blob:track-${++created}`;
    },
    revokeUrl: (url) => revoked.push(url),
  });
  assert.equal(requests.length, 0, 'Original mode does not start preloading');
  const loading = cache.preload();
  assert.equal(cache.preload(), loading, 'repeated requests share the same background run');
  assert.equal(
    cache.source(TRIBUTE_MAIN_THEME.file),
    tributeUrl(TRIBUTE_MAIN_THEME.file),
    'unfinished preloads retain immediate streaming',
  );
  await loading;
  const tracks = [TRIBUTE_MAIN_THEME, ...Object.values(TRIBUTE_TRACKS)];
  assert.equal(peak, 2);
  assert.deepEqual(requests.slice(0, 2), [
    tributeUrl(TRIBUTE_MAIN_THEME.file),
    tributeUrl(TRIBUTE_TRACKS[7].file),
  ]);
  assert.equal(new Set(requests).size, tracks.length);
  assert.equal(requests.length, tracks.length);
  for (const track of tracks) assert.match(cache.source(track.file), /^blob:/);
  await cache.preload();
  assert.equal(requests.length, tracks.length, 'ready tracks are never downloaded again');
  cache.close();
  assert.equal(revoked.length, tracks.length);
  assert.equal(cache.urls.size, 0);
  await cache.preload();
  assert.equal(requests.length, tracks.length, 'closing cannot restart downloads');
});

test('failed preloads retain streaming and retry without losing successful recordings', async () => {
  let fail = true,
    created = 0;
  const failedFile = TRIBUTE_MAIN_THEME.file;
  const cache = new TributeCache({
    fetchTrack: async (url) => {
      if (fail && url === tributeUrl(failedFile)) throw Error('offline');
      if (fail && url === tributeUrl(TRIBUTE_TRACKS[7].file))
        return new Response(null, { status: 404 });
      return new Response('recording');
    },
    createUrl: () => `blob:track-${++created}`,
    revokeUrl() {},
  });
  await cache.preload();
  assert.equal(cache.source(failedFile), tributeUrl(failedFile));
  assert.equal(cache.source(TRIBUTE_TRACKS[7].file), tributeUrl(TRIBUTE_TRACKS[7].file));
  const street = cache.source(TRIBUTE_TRACKS[1].file);
  assert.match(street, /^blob:/);
  fail = false;
  await cache.preload();
  assert.match(cache.source(failedFile), /^blob:/);
  assert.equal(cache.source(TRIBUTE_TRACKS[1].file), street);
  cache.close();
});

test('cancelling and restarting ignores late old downloads and closing revokes only usable URLs', async () => {
  const pending = [],
    revoked = [];
  let created = 0;
  const cache = new TributeCache({
    fetchTrack: (url, { signal }) =>
      new Promise((resolve) => pending.push({ url, signal, resolve })),
    createUrl: () => `blob:track-${++created}`,
    revokeUrl: (url) => revoked.push(url),
  });
  const old = cache.preload();
  const stale = pending.splice(0);
  cache.cancel();
  assert.ok(stale.every((request) => request.signal.aborted));
  const current = cache.preload();
  for (const request of stale) request.resolve(new Response('obsolete'));
  await old;
  assert.equal(created, 0, 'a cancelled completion cannot publish or leak a URL');
  assert.equal(cache.preload(), current, 'old finalization cannot clear the current run');
  while (pending.length) {
    for (const request of pending.splice(0)) request.resolve(new Response('current'));
    await settle();
  }
  await current;
  assert.equal(cache.urls.size, 12);
  cache.close();
  assert.equal(revoked.length, created);
});
