import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { counterBytes } from '../src/vm/frame-events.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { MouseControl } from '../src/browser/mouse-control.mjs';
import {
  Recorder,
  parseRecording,
  replayRecording,
  unpackInput,
  wramHash,
} from '../src/browser/recording.mjs';
import {
  DEBUG_ROOM_EVENT,
  debugRoomReachable,
  warpToDebugRoom,
} from '../src/browser/debug-room.mjs';
import { DEFAULT_GAMEPLAY, ORIGINAL_GAMEPLAY } from '../src/game/bugfixes.mjs';

// A session as the worker runs it (game-worker.mjs): every pad read goes through the recorder,
// then the mouse control. Inputs: Start in the title (new game), then a fixed pseudo-random run
// of pad words, mouse moves and buttons in the morgue. The replay from the JSON text must give
// the same WRAM at every check and at the end; a changed input must show as a difference. From NMI
// 5600 the page's debug room warp happens at the first pad read where Jake moves freely, as in the
// worker; the replay must apply it at the same pad read.
const START = 0x1000,
  UNTIL = 6200,
  SEED = 0x1234567;
test('fixed sessions replay their own settings; legacy recordings retain original behaviour', () => {
  const recorder = new Recorder(SEED, null, DEFAULT_GAMEPLAY);
  let control;
  const game = new LiveGame(cartridge, {
    gameplay: DEFAULT_GAMEPLAY,
    counter: counterBytes(SEED),
    pad: (k) => {
      const word =
        (k >= 3000 && k < 3004) || (k >= 3300 && k < 3304) || (k >= 3600 && k < 3604) ? START : 0;
      recorder.input(k, [word, 0, 0, 0, 0]);
      return control.pad(k, unpackInput(word, 0, 0, 0, 0));
    },
    onFrame: (f) => recorder.frame(f.nmi, game.memory.wram),
  });
  control = new MouseControl(game);
  while (game.nmis < 5000) game.step();
  assert.equal(game.memory.read16(0x7e381e), 0, 'the real new game used the vest fix');
  const encoded = JSON.parse(JSON.stringify(recorder));
  assert.deepEqual(encoded.gameplay, DEFAULT_GAMEPLAY);
  const parsed = parseRecording(JSON.stringify(encoded));
  // The recording ends at the last zero-based frame label, whereas nmis
  // counts entered NMIs. Compare both owners at the same returned step.
  assert.equal(parsed.nmis + 1, game.nmis);
  const replay = replayRecording(cartridge, parsed, { until: game.nmis, stop: true });
  assert.equal(replay.nmis, game.nmis);
  assert.equal(replay.mismatch, null);
  assert.equal(replay.offPath, null);
  assert.deepEqual(replay.game.memory.wram, game.memory.wram);
  const original = replayRecording(
    cartridge,
    { ...parsed, gameplay: ORIGINAL_GAMEPLAY },
    { until: game.nmis, stop: true },
  );
  assert.ok(original.mismatch, 'using the wrong fixes is observable');
  delete encoded.gameplay;
  assert.deepEqual(parseRecording(JSON.stringify(encoded)).gameplay, ORIGINAL_GAMEPLAY);
  for (const gameplay of [
    null,
    { ...DEFAULT_GAMEPLAY, version: 2 },
    { ...DEFAULT_GAMEPLAY, bugfixes: 'on' },
  ])
    assert.throws(
      () => parseRecording(JSON.stringify({ ...encoded, gameplay })),
      /gameplay_settings_required/,
    );
});
function session() {
  let x = 7;
  const rnd = (n) => (x = (x * 1103515245 + 12345) & 0x7fffffff) % n;
  let values = [0, 0, 0, 0, 0],
    mouse = 0;
  const recorder = new Recorder(SEED, null);
  let control = null,
    warped = 0;
  const game = new LiveGame(cartridge, {
    counter: counterBytes(SEED),
    pad: (k) => {
      if (k < 5000)
        values = [
          (k >= 3000 && k < 3004) || (k >= 3300 && k < 3304) || (k >= 3600 && k < 3604) ? START : 0,
          0,
          0,
          0,
          0,
        ];
      else if (k % 12 === 0) {
        const word = [0, 0x0800, 0x0400, 0x0200, 0x0100, 0x8000, 0x0080, 0x0040][rnd(8)];
        if (rnd(3) === 0)
          mouse =
            ((((mouse >>> 16) + 1) & 0x7fff) << 16) | ((20 + rnd(180)) << 8) | (20 + rnd(200));
        values = [word, rnd(4) === 0 ? word & 0x0fc0 : 0, mouse, rnd(5) === 0 ? 1 << 16 : 0, 0];
      }
      if (k >= 5600 && !warped && debugRoomReachable(game)) {
        warped = k;
        recorder.event(DEBUG_ROOM_EVENT);
        warpToDebugRoom(game.memory.wram);
      }
      recorder.input(k, values);
      return control.pad(k, unpackInput(...values));
    },
    onFrame: (f) => recorder.frame(f.nmi, game.memory.wram),
  });
  control = new MouseControl(game);
  while (game.nmis < UNTIL) game.step();
  return { game, warped, recording: JSON.stringify(recorder) };
}
test(
  'a recorded session replays to the same WRAM, and a changed input is found',
  { timeout: 900000 },
  () => {
    const { game, warped, recording } = session();
    const parsed = parseRecording(recording);
    assert.ok(
      parsed.checks.length >= 6 && parsed.inputs.length >= 40,
      'checks and input changes recorded',
    );
    assert.ok(warped >= 5600 && warped < 6000, 'warp at ' + warped);
    assert.deepEqual(
      parsed.events.map((e) => e[1]),
      [DEBUG_ROOM_EVENT],
      'debug room event recorded',
    );
    const replay = replayRecording(cartridge, parsed, { until: game.nmis });
    assert.equal(replay.mismatch, null);
    assert.equal(replay.offPath, null);
    assert.equal(replay.nmis, game.nmis);
    assert.equal(
      wramHash(replay.game.memory.wram),
      wramHash(game.memory.wram),
      'same WRAM at the end',
    );
    // Without the event the replay differs from the first check after it.
    const missing = replayRecording(
      cartridge,
      { ...parsed, events: [] },
      { until: game.nmis, stop: true },
    );
    assert.equal(missing.mismatch?.nmi, 6000, 'debug room event replayed');
    // The inputs after NMI 5200 replaced by right: the replay reports the first differing check.
    const changed = structuredClone(parsed);
    for (const input of changed.inputs)
      if (input[1] > 5200) input.splice(2, 5, 0x0100, 0x0100, 0, 0, 0);
    const wrong = replayRecording(cartridge, changed, { until: game.nmis, stop: true });
    assert.ok(wrong.mismatch && wrong.mismatch.nmi > 5200, 'difference found after the change');
    assert.throws(() => parseRecording('{"format":"other"}'), /Not a Shadowrun recording/);
    assert.throws(
      () => parseRecording(JSON.stringify({ ...JSON.parse(recording), events: [[1, 'other']] })),
      /Damaged recording/,
    );
  },
);
