import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { testTempDir } from './temp-dir.mjs';
import { SoundtrackDsp, SoundtrackApu } from '../src/apu/soundtrack-apu.mjs';
import { Apu, CoupledDsp } from '../src/apu/apu.mjs';
import { SONG_VOICES, ACTIVE_TRACKS } from '../src/apu/sound-driver-memory.mjs';
import {
  TRIBUTE_TRACKS,
  TRIBUTE_MAIN_THEME,
  tributeTrack,
} from '../src/browser/tribute-tracks.mjs';
import {
  TributePlayer,
  tributeVolume,
  DEFAULT_TRIBUTE_VOLUME,
} from '../src/browser/tribute-player.mjs';
import { AUDIO_HEADROOM } from '../src/browser/audio-output.mjs';
import { SampleQueue } from '../src/browser/sample-queue.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { browserServer, isServedPath } from './serve-browser.mjs';
import { buildWeb } from './build-web.mjs';
import { soundCatalog, romReader } from './sound-catalog.mjs';
import { roomSchedule, runSchedule } from './sound-apu-schedule.mjs';

const evidence = JSON.parse(readFileSync('proof/apu/tribute-song-identification.json'));
const tracks = [...Object.values(TRIBUTE_TRACKS), TRIBUTE_MAIN_THEME];
test('named active SPC pattern fingerprints match every European song and the tribute mapping', () => {
  const dirs = soundCatalog(),
    reader = romReader();
  for (const row of evidence.songs) {
    const ram = Buffer.alloc(65536),
      dir = dirs[row.directory === 'game' ? 0 : 1];
    const lay = (list) => {
      let at = list.destination;
      for (const chunk of list.chunks) {
        const b =
          chunk.kind === 'raw'
            ? reader.bytes(chunk.source, chunk.bytes)
            : Uint8Array.from(
                { length: chunk.bytes },
                (_, i) => (chunk.word >> (8 * (i & 1))) & 255,
              );
        ram.set(b, at);
        at += chunk.bytes;
      }
    };
    lay(dir.base);
    if (row.item !== null) lay(dir.items.find((i) => i.id === row.item));
    assert.equal(ram.readUInt16LE(row.table + 2 * (row.song - 1)), row.head);
    assert.ok(row.patterns.length >= 3);
    for (const pattern of row.patterns) {
      const list = ram.readUInt16LE(row.head + 1 + 2 * pattern.track);
      assert.equal(ram.readUInt16LE(list), pattern.aram);
      assert.equal(ram.subarray(pattern.aram, pattern.aram + 32).toString('hex'), pattern.bytes);
    }
    const track = tributeTrack(row);
    const title =
      {
        Morgue: 'The Morgue',
        'Seems Familiar...': 'Seems Familiar',
        'Seattle 2050 (Japanese)': 'Main Theme',
      }[row.spc_title] ?? row.spc_title;
    assert.equal(track?.name ?? 'Dead', title);
  }
  for (const song of [0, 3, 99]) assert.equal(tributeTrack({ table: 0x7674, song }), null);
  assert.equal(tributeTrack({ table: 0, song: 2 }), null);
  assert.equal(tracks.length, 12);
});

test('the shipped OGG files retain every supplied byte and only the twelve tracks ship', async (t) => {
  const hash = (b) => createHash('sha256').update(b).digest('hex');
  assert.deepEqual(readdirSync('assets/tribute').sort(), tracks.map((t) => t.file).sort());
  for (const track of tracks) {
    const data = readFileSync('assets/tribute/' + track.file);
    assert.equal(data.subarray(0, 4).toString(), 'OggS');
    assert.ok(data.includes(Buffer.from('\x01vorbis')));
    assert.equal(hash(data), evidence.files[track.file].sha256);
    assert.equal(data.length, evidence.files[track.file].bytes);
    assert.ok(isServedPath('/assets/tribute/' + track.file));
  }
  for (const path of [
    '/assets/tribute/13-ending.ogg',
    '/assets/tribute/cover.jpg',
    '/assets/tribute/01-main-theme.wav',
    '/Ressources/test.ogg',
    '/assets/tribute/../01-main-theme.ogg',
  ])
    assert.equal(isServedPath(path), false, path);
  const root = await testTempDir(t, 'snes-tribute-build-');
  mkdirSync(join(root, 'assets/tribute'), { recursive: true });
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'index.html'), 'test');
  writeFileSync(join(root, 'assets/tribute/01-main-theme.ogg'), 'OggS');
  writeFileSync(join(root, 'assets/tribute/cover.jpg'), 'excluded');
  const copied = await buildWeb(root, join(root, 'dist'));
  assert.deepEqual(copied.sort(), ['/assets/tribute/01-main-theme.ogg', '/index.html']);
});

test('OGG serving supports metadata, seeking, loop ranges and invalid ranges', async () => {
  const server = browserServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/assets/tribute/01-main-theme.ogg`;
    for (const [range, expected, length] of [
      ['bytes=0-3', 206, 4],
      ['bytes=-8', 206, 8],
      ['bytes=1808910-', 206, 3],
      ['bytes=99999999-', 416, 0],
      ['bytes=7-3', 416, 0],
      ['bytes=-0', 416, 0],
      ['bytes=-', 416, 0],
      ['bytes=0-2,4-5', 416, 0],
    ]) {
      const response = await fetch(url, { headers: { Range: range } });
      assert.equal(response.status, expected, range);
      assert.equal(response.headers.get('Content-Type'), 'audio/ogg');
      const body = Buffer.from(await response.arrayBuffer());
      assert.equal(body.length, length, range);
      if (range === 'bytes=0-3') assert.equal(body.toString(), 'OggS');
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

function dspFixture(Type, mask) {
  const ram = new Uint8Array(65536),
    dsp = new Type(ram);
  ram[SONG_VOICES] = mask;
  ram.set([0, 3, 0, 3], 0x200);
  ram.set([0xc3, ...Array(8).fill(0x12)], 0x300);
  for (const [reg, value] of [
    [0x5d, 2],
    [0x0c, 0x7f],
    [0x1c, 0x7f],
    [0x2c, 0x40],
    [0x3c, 0x40],
    [0x4d, 3],
    [0x6d, 0x40],
    [0x7d, 2],
    [0x0f, 0x7f],
    [0x0d, 0x20],
    [0x6c, 0],
  ])
    dsp.write(reg, value);
  for (let v = 0; v < 2; v++) {
    const b = v << 4;
    for (const [off, value] of [
      [0, 0x60],
      [1, v ? 0x30 : 0x70],
      [3, 0x10],
      [7, 0x7f],
    ])
      dsp.write(b + off, value);
  }
  dsp.out = new Int16Array(16384);
  if (dsp.enableEffectsOutput) dsp.enableEffectsOutput(dsp.out.length);
  dsp.write(0x4c, 3);
  return dsp;
}
class EffectsReference extends CoupledDsp {
  voiceOutput(voice, channel) {
    if (!(this.ram[SONG_VOICES] & voice.bit)) super.voiceOutput(voice, channel);
  }
}
test('separating song voices preserves the original DSP and SFX, including their private echo', () => {
  for (const mask of [0, 1, 2, 3]) {
    const split = dspFixture(SoundtrackDsp, mask),
      original = dspFixture(CoupledDsp, mask),
      effects = dspFixture(EffectsReference, mask);
    for (let i = 0; i < 8192; i++) {
      for (const d of [split, original, effects]) d.sample();
    }
    assert.deepEqual(split.out, original.out, `full output, mask ${mask}`);
    assert.deepEqual(split.ram, original.ram, `original echo RAM, mask ${mask}`);
    assert.deepEqual(split.regs, original.regs, `original DSP registers, mask ${mask}`);
    assert.deepEqual(split.voices, original.voices, `envelopes/decoder, mask ${mask}`);
    assert.deepEqual(split.effects.out, effects.out, `isolated SFX including echo, mask ${mask}`);
    assert.equal(
      split.effects.out.some((s) => s !== 0),
      mask !== 3,
    );
  }
});

test('real boot and first-room commands retain every original sample and handshake with soundtrack observation', () => {
  const original = new Apu(),
    split = new SoundtrackApu();
  const reader = romReader(),
    rom = readFileSync('Shadowrun (E).smc');
  original.enableOutput(256);
  split.enableOutput(256);
  const states = [];
  for (const event of roomSchedule(rom)) {
    runSchedule([original, split], [event], reader);
    if (event[0] === 'f') {
      const full = split.takeOutput(),
        effects = split.takeEffectsOutput();
      assert.deepEqual(full, original.takeOutput());
      assert.equal(effects.length, full.length);
      const state = split.musicState();
      if (!states.some((s) => s.revision === state.revision)) states.push(state);
    }
  }
  assert.deepEqual(split.ram, original.ram);
  assert.deepEqual(split.dsp.regs, original.dsp.regs);
  assert.ok(states.some((s) => s.table === 0x7674 && s.song === 2));
  assert.ok(states.some((s) => s.table === 0xd067 && s.song === 7));
  assert.equal(split.musicState().playing, true);
  split.ram[ACTIVE_TRACKS] = 0;
  assert.equal(
    split.musicState().playing,
    true,
    'the original note-list end cannot end the tribute',
  );
  runSchedule([split], [['cmd', 0x0c, 0]], reader);
  assert.equal(
    split.musicState().playing,
    false,
    'an explicit original stop still stops the tribute',
  );
});

test('the real start menu excludes animated musical accents but retains UI sound effects', () => {
  const apu = new SoundtrackApu(),
    reader = romReader();
  let game,
    menuFrames = 0,
    originalSound = false,
    ambientPeak = 0,
    uiPeak = 0,
    injected = false;
  game = new LiveGame(cartridge, {
    apu,
    onFrame: () => {
      const original = apu.takeOutput(),
        effects = apu.takeEffectsOutput(),
        music = apu.musicState();
      if (music.table !== 0x7674 || music.song !== 2) return;
      menuFrames++;
      originalSound ||= original.some((sample) => sample !== 0);
      for (const sample of effects) {
        if (injected) uiPeak = Math.max(uiPeak, Math.abs(sample));
        else ambientPeak = Math.max(ambientPeak, Math.abs(sample));
      }
    },
  });
  apu.enableOutput(256);
  while (game.nmis < 3700 && (!injected || !uiPeak)) {
    game.step();
    if (!injected && menuFrames > 150) {
      assert.ok(apu.dsp.menuMusicVoices, 'real title callback used command-based music accents');
      assert.equal(ambientPeak, 0, 'music accents never leak into the effects-only mix');
      injected = true;
      runSchedule(
        [apu],
        [
          ['cmd', 0x0f, 1],
          ['cmd', 0x07, 0x2209],
        ],
        reader,
      );
    }
  }
  assert.ok(originalSound && menuFrames > 150);
  assert.ok(uiPeak > 0, 'the original menu cursor effect remains audible');
});

function playerFixture({ metadataReady = true } = {}) {
  const media = [],
    events = [];
  const context = {
    currentTime: 0,
    destination: {},
    createGain: () => ({
      gain: {
        value: 0,
        cancelScheduledValues() {},
        setValueAtTime(v) {
          this.value = v;
        },
        linearRampToValueAtTime(v) {
          this.value = v;
        },
      },
      connect() {},
      disconnect() {},
    }),
    createMediaElementSource: () => ({ connect() {}, disconnect() {} }),
  };
  const player = new TributePlayer(context, {
    onChange: (e) => events.push(e),
    createMedia: () => {
      const m = {
        paused: true,
        currentTime: 0,
        readyState: metadataReady ? 1 : 0,
        duration: 200,
        playStarts: [],
        listeners: {},
        addEventListener(k, f) {
          this.listeners[k] = f;
        },
        play() {
          this.playStarts.push(this.currentTime);
          this.paused = false;
          return Promise.resolve();
        },
        pause() {
          this.paused = true;
        },
        load() {},
        removeAttribute() {},
      };
      media.push(m);
      return m;
    },
  });
  return { player, media, events };
}
const music = { table: 0xd067, song: 7, revision: 1, playing: true, repeat: true, volume: 1 };
const settle = () => new Promise((resolve) => setImmediate(resolve));
test('track positions survive a different dialog cue and an original fallback within the session', async () => {
  const { player, media } = playerFixture();
  const street = { ...music, song: 1 },
    dialog = { ...music, song: 10, revision: 2 };
  player.setEnabled(true);
  player.update(street);
  await settle();
  media[0].currentTime = 17.25;
  player.update(dialog);
  await settle();
  assert.equal(media[0].paused, true);
  assert.equal(media[1].playStarts[0], 0, 'a first visit starts at the beginning');
  media[1].currentTime = 8.5;
  player.update({ ...music, song: 11, revision: 3 });
  assert.equal(player.entry, null);
  assert.equal(media[1].paused, true);
  player.update({ ...street, revision: 4 });
  await settle();
  assert.equal(media[2].playStarts[0], 17.25, 'street resumes before any audio plays');
  media[2].currentTime = 19;
  player.update({ ...dialog, revision: 5 });
  await settle();
  assert.equal(media[3].playStarts[0], 8.5, 'the dialog keeps its own independent position');
  player.update({ ...street, revision: 6 });
  await settle();
  assert.equal(media[4].playStarts[0], 19, 'each departure updates the remembered position');
  assert.ok(
    media.slice(0, -1).every((m) => m.paused),
    'only the current recording can play',
  );
  player.close();
  assert.equal(player.positions.size, 0, 'a new session starts fresh');
});

test('track position switches wait for metadata and ignore superseded loading callbacks', async () => {
  const { player, media, events } = playerFixture({ metadataReady: false });
  const street = { ...music, song: 1 },
    dialog = { ...music, song: 10, revision: 2 };
  player.setEnabled(true);
  player.update(street);
  media[0].readyState = 1;
  media[0].listeners.loadedmetadata();
  await settle();
  media[0].currentTime = 42.5;
  player.update(dialog);
  media[1].readyState = 1;
  media[1].listeners.loadedmetadata();
  await settle();
  media[1].currentTime = 7;
  player.update({ ...street, revision: 3 });
  await settle();
  assert.deepEqual(media[2].playStarts, [], 'the returning street must not start from zero');
  assert.equal(events.at(-1).replaceMusic, true, 'loading does not expose original music');
  player.update({ ...dialog, revision: 4 });
  media[2].readyState = 1;
  media[2].listeners.loadedmetadata();
  await settle();
  assert.deepEqual(media[2].playStarts, [], 'a late metadata event cannot revive a retired stream');
  assert.equal(player.entry.media, media[3]);
  media[3].readyState = 1;
  media[3].listeners.loadedmetadata();
  await settle();
  assert.deepEqual(media[3].playStarts, [7]);
  player.update({ ...street, revision: 5 });
  media[4].duration = 40;
  media[4].readyState = 1;
  media[4].listeners.loadedmetadata();
  await settle();
  assert.deepEqual(media[4].playStarts, [2.5], 'a wrapped position stays within the loop duration');
  assert.equal(player.active, true);
  player.close();
});
test('every tribute cue loops and an end event restarts the same recording without original fallback', async () => {
  for (const state of [
    { ...music, repeat: false },
    { ...music, table: 0x7674, song: 2, repeat: false },
  ]) {
    const { player, media, events } = playerFixture();
    player.setEnabled(true);
    player.update(state);
    await settle();
    assert.equal(media[0].loop, true, 'loop independently of the native repeat flag');
    const start = events.length;
    media[0].currentTime = 100;
    media[0].paused = true;
    media[0].listeners.ended();
    await settle();
    assert.equal(media.length, 1);
    assert.equal(media[0].currentTime, 0);
    assert.equal(player.active, true);
    assert.ok(
      events.slice(start).every((event) => event.replaceMusic),
      'no original between loops',
    );
    player.close();
  }
});
test('one oversized no-NMI audio block cannot replay old explosions seconds after the scene', () => {
  const original = new SampleQueue({ prebuffer: 2, limit: 4, declick: false, maxPrebuffer: 2 }),
    effects = new SampleQueue({ prebuffer: 2, limit: 4, declick: false, maxPrebuffer: 2 });
  const samples = Int16Array.from(Array.from({ length: 20 }, (_, i) => [i, -i]).flat());
  original.push(samples);
  effects.push(samples);
  assert.deepEqual([original.queued, original.dropped], [4, 16]);
  const left = new Float32Array(4),
    right = new Float32Array(4);
  original.fill(left, right);
  assert.deepEqual(
    [...left].map((x) => x * 32768),
    [16, 17, 18, 19],
  );
  const otherLeft = new Float32Array(4),
    otherRight = new Float32Array(4);
  effects.fill(otherLeft, otherRight);
  assert.deepEqual(otherLeft, left);
  assert.deepEqual(otherRight, right);
});

test('a punk-dialog return retains Tenth Street and keeps original music muted while resuming', async () => {
  const { player, media, events } = playerFixture();
  const street = { ...music, song: 1, revision: 8 };
  player.setEnabled(true);
  player.update(street);
  assert.equal(events.at(-1).replaceMusic, true, 'loading never exposes original music');
  assert.equal(player.active, false);
  await settle();
  media[0].currentTime = 32;
  player.update({ ...street, song: 0, revision: 9, playing: false });
  assert.equal(media[0].paused, true);
  player.update({ ...street, revision: 12 });
  await settle();
  assert.equal(player.active, true);
  assert.equal(media.length, 1);
  assert.equal(media[0].currentTime, 32);
  media[0].listeners.waiting();
  assert.equal(events.at(-1).replaceMusic, true, 'a buffer wait never restores original music');
  player.update({ ...street, revision: 12, volume: 0.8 });
  media[0].listeners.playing();
  assert.equal(player.active, true);
  media[0].listeners.error();
  assert.equal(events.at(-1).replaceMusic, false, 'a real error restores original');
  player.close();
});

test('leaving the title for the shooting cue stops the combined recording before fallback music', async () => {
  const { player, media, events } = playerFixture();
  player.setEnabled(true);
  player.update({ ...music, table: 0x7674, song: 1 });
  await settle();
  player.update({ ...music, table: 0x7674, song: 2, revision: 2 });
  const combined = media[0];
  combined.currentTime = 52;
  player.update({ ...music, table: 0x7674, song: 0, revision: 3, playing: false });
  player.update({ ...music, table: 0x7674, song: 3, revision: 4 });
  await settle();
  assert.equal(combined.paused, true);
  assert.equal(player.entry, null);
  assert.equal(player.active, false);
  assert.equal(events.at(-1).replaceMusic, false);
  player.close();
});
test('tribute loudness has an independent live fader while native SFX keep their original level', async () => {
  for (const value of [null, undefined, '', NaN, 'invalid', -1, 2])
    assert.equal(tributeVolume(value), DEFAULT_TRIBUTE_VOLUME);
  assert.equal(tributeVolume('0'), 0);
  assert.equal(tributeVolume('1'), 1);
  const { player } = playerFixture();
  player.setEnabled(true);
  player.update(music);
  await settle();
  assert.equal(player.entry.gain.gain.value, AUDIO_HEADROOM * 0.25);
  player.setVolume(0.6);
  assert.equal(player.entry.gain.gain.value, AUDIO_HEADROOM * 0.6);
  player.update({ ...music, volume: 0.5 });
  assert.equal(player.entry.gain.gain.value, AUDIO_HEADROOM * 0.3);
  player.setVolume(0);
  assert.equal(player.entry.gain.gain.value, 0);
  assert.equal(player.active, true, 'music fader zero keeps original music suppressed');
  player.close();
});
test('the combined title recording continues from Seattle 2050 through the stop into the menu', async () => {
  const { player, media } = playerFixture();
  const intro = { ...music, table: 0x7674, song: 1, repeat: false };
  player.setEnabled(true);
  player.update(intro);
  await settle();
  media[0].currentTime = 45;
  player.update({ ...intro, song: 0, playing: false, revision: 2 });
  assert.equal(media.length, 1);
  assert.equal(player.active, false);
  player.update({ ...intro, song: 2, repeat: true, revision: 3 });
  await settle();
  assert.equal(media.length, 1);
  assert.equal(media[0].currentTime, 45);
  assert.equal(media[0].loop, true);
  assert.equal(player.active, true);
  player.update({ ...intro, revision: 4 });
  await settle();
  assert.equal(media.length, 2, 'a new intro starts a fresh arrangement');
  player.close();
});
test('live switching retains position, follows song restarts/stops and handles failure and stale play promises', async () => {
  const { player, media } = playerFixture();
  player.update(music);
  assert.equal(media.length, 0, 'original mode never fetches tribute');
  player.setEnabled(true);
  await settle();
  assert.equal(player.active, true);
  assert.equal(media[0].loop, true);
  media[0].currentTime = 19;
  player.setEnabled(false);
  assert.equal(player.active, false);
  assert.equal(media[0].paused, true);
  player.setEnabled(true);
  await settle();
  assert.equal(media[0].currentTime, 19);
  assert.equal(media.length, 1);
  player.setPaused(true);
  assert.equal(media[0].paused, true);
  player.setPaused(false);
  await settle();
  assert.equal(player.active, true);
  player.update({ ...music, song: 11 });
  assert.equal(player.active, false);
  player.update({ ...music, revision: 2 });
  await settle();
  assert.equal(player.active, true);
  player.update({ ...music, song: 2, revision: 3 });
  player.update({ ...music, revision: 4 });
  await settle();
  assert.equal(player.active, true, 'an obsolete load cannot take over');
  const current = media.at(-1);
  current.listeners.error();
  assert.equal(player.active, false);
  assert.match(player.error, /original soundtrack/);
  player.setEnabled(false);
  player.setEnabled(true);
  await settle();
  assert.equal(player.active, true, 'reselect retries a failed file');
  player.update({ ...music, revision: 4, playing: false });
  assert.equal(player.active, false);
  player.close();
  assert.equal(media.at(-1).paused, true);
});

test('rapid disable/enable and pause cancel stale play rejections without a false fallback', async () => {
  const { player, media } = playerFixture();
  player.update(music);
  player.setEnabled(true);
  await settle();
  player.setEnabled(false);
  let rejectOld;
  media[0].play = () =>
    new Promise((resolve, reject) => {
      rejectOld = reject;
    });
  player.setEnabled(true);
  await settle();
  player.setEnabled(false);
  media[0].play = () => {
    media[0].paused = false;
    return Promise.resolve();
  };
  player.setEnabled(true);
  await settle();
  rejectOld(Error('interrupted'));
  await settle();
  assert.equal(player.error, '');
  assert.equal(player.active, true);
  player.close();
});
