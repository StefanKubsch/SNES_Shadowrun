import test from 'node:test';
import assert from 'node:assert/strict';
import { setMusicModeRoutine } from '../src/apu/audio-routines.mjs';
import * as direct from '../src/game/dialog-talk.mjs';
import * as former from '../proof/caller/dialog-talk.mjs';
import { buildSpriteList } from '../proof/replay/native-scene-sprites.mjs';
import { reloadObjectTiles } from '../src/system/native-scene-tiles.mjs';
import * as W from '../src/data/wram.mjs';
import { closePortraitWindowSequence } from '../proof/caller/portrait-window.mjs';
import {
  runFrameWait,
  runPadPresses,
  frameWaitCallSequence,
} from '../src/system/live-input-calls.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
} from '../src/system/native-call-continuation.mjs';
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';
import {
  DIALOG_HDMA_TABLE,
  HDMAEN_SHADOW,
  TMW_SHADOW,
  RANDOM_STATE,
  PAD_HELD,
  PAD_PRESSED,
} from '../src/data/wram.mjs';

function runClose(module, shadow, counter, held, budget) {
  const side = textWindowSide(),
    { h, a, mem, put, events } = side;
  // Keep nested call frames away from the live HDMA fields at 01C4.
  h.ctx.s = 0x1eef;
  put(W.DRAW_LIST_INDEX, 0);
  put(W.DRAW_LIST, 0);
  put(W.OBJECT_VRAM_SLOT_COUNT, 1);
  put(W.OBJECT_FRAME_OFFSET, 2);
  put(W.VRAM_SLOT_NEXT, 0);
  put(HDMAEN_SHADOW, shadow);
  put(TMW_SHADOW, 15);
  put(RANDOM_STATE, counter);
  put(PAD_HELD, held);
  events.interrupts.textWait = (_h, _events, _status, pc) => {
    if (pc === 0x80ae0c) return true;
    if (pc === 0x80ae0f) {
      if (!mem.read16(W.NMI_JOB_LISTS)) return true;
      side.calls.push([
        'object tiles',
        mem.wram.slice(W.VRAM_UPLOAD_SOURCES, W.VRAM_UPLOAD_SOURCES + 6),
      ]);
      put(W.NMI_JOB_LISTS, 0);
      put(W.DP_VRAM_UPLOAD_INDEX, 0);
      return true;
    }
    assert.equal(pc, 0x81b0a9);
    side.calls.push([
      'frame',
      h.ctx.x,
      mem.wram[HDMAEN_SHADOW],
      mem.wram.slice(DIALOG_HDMA_TABLE, DIALOG_HDMA_TABLE + 16),
    ]);
    put(RANDOM_STATE, mem.read16(RANDOM_STATE) + 1);
    return true;
  };
  const wait = () => assert.fail('wait must resume cooperatively');
  const portrait = () => assert.fail('portrait must resume cooperatively');
  const table = new Map([
    [0x80adf4, reloadObjectTiles],
    [0x80b8de, buildSpriteList],
    [0x808f97, portrait],
    [0x81b0a1, wait],
    [0x809e1a, (callee, e) => runPadPresses(callee, e)],
  ]);
  NATIVE_CALL_CONTINUATIONS.set(wait, {
    run: wait,
    create: () => new NativeCallContinuation(a, frameWaitCallSequence(h, events)),
  });
  NATIVE_CALL_CONTINUATIONS.set(portrait, {
    run: portrait,
    create: () => new NativeCallContinuation(a, closePortraitWindowSequence(h, events, table)),
  });
  try {
    let pressed, finalShadow;
    function* sequence() {
      const result = yield* module.closeDialogSequence(h, events, table);
      pressed = mem.read16(PAD_PRESSED);
      finalShadow = mem.wram[HDMAEN_SHADOW];
      return result;
    }
    const result = finishTextWindow(side, sequence(), budget);
    result.wram.fill(0, 0x1e80, 0x1ef0);
    return { ...result, pressed, finalShadow };
  } finally {
    NATIVE_CALL_CONTINUATIONS.delete(portrait);
    NATIVE_CALL_CONTINUATIONS.delete(wait);
  }
}
for (const budget of [1, 7])
  for (const shadow of [0, 1, 0xfe, 0xff])
    for (const counter of [0, 0xffff])
      for (const held of [0, 0x8000, 0x000f])
        test(`dialog close: shadow ${shadow}, counter ${counter}, pad ${held}, budget ${budget}`, () => {
          const actual = runClose(direct, shadow, counter, held, budget);
          assert.deepEqual(actual, runClose(former, shadow, counter, held, budget));
          assert.equal(actual.calls.filter((call) => call[0] === 'frame').length, 12);
          assert.equal(actual.finalShadow, shadow & ~1);
          assert.equal(actual.wram[W.OAM_BUFFER + 5], 0xf0, 'unused sprite hidden');
          assert.equal(actual.wram[W.NMI_JOB_LISTS], 1, 'sprite upload counted');
          assert.equal(actual.writes.length, 17, 'OBJSEL and both complete font DMA setups');
        });

import * as live from '../src/game/main-upkeep.mjs';
import { dialogTextRoutines } from '../src/system/native-dialog-text.mjs';
import { DIALOG_TABLE, DIALOG_BANK_BASE } from '../src/data/portraits.mjs';
import { clearFixedColourRoutine, setWindowTextWidthRoutine } from '../src/game/dialog-talk.mjs';
import {
  GAME_OPTIONS,
  MUSIC,
  GLOVE_TARGET_TAG,
  NOTICE_WINDOWS,
  WINDOW_ACTIVE,
  WINDOW_NEXT_TILE,
  PORTRAIT_DMA_REQUEST,
  DIALOG_END,
  TOPIC_LIST,
  JAKE_ALTERNATE_PORTRAIT,
  SOUND_LOADED_SET,
} from '../src/data/wram.mjs';

// The former orchestrator keeps its dispatched call graph. Real live callees
// isolate composition from the NMI service; real music commands retain driver echo.
function runTalk(module, variant, budget, { alternate = 0, music = 0, mirror = 0, token = 0 } = {}) {
  const side = textWindowSide(),
    { h, mem, put, events } = side;
  h.ctx.s = 0x1eef;
  put(W.DRAW_LIST_INDEX, 0);
  put(W.DRAW_LIST, 0);
  put(W.OBJECT_VRAM_SLOT_COUNT, 1);
  put(W.OBJECT_FRAME_OFFSET, 2);
  put(W.VRAM_SLOT_NEXT, 0);
  put(0, 0x40);
  put(2, 0);
  put(GLOVE_TARGET_TAG, 0xffff);
  for (let slot = 0; slot < 6; slot += 2) put(NOTICE_WINDOWS + slot, 0xffff);
  put(WINDOW_ACTIVE, 0xffff);
  put(WINDOW_NEXT_TILE, 0x2000);
  put(GAME_OPTIONS, music ? 1 : 0);
  put(MUSIC, 0);
  mem.wram[W.APU_COMMAND_TOKEN] = token;
  mem.wram.set([0, 1, 2].map(n => mem.read8(0x98fffa + n)), W.AUDIO_DIRECTORY_POINTER);
  put(SOUND_LOADED_SET, mem.read16(0x80c4b3 + 0x4c));
  mem.wram[JAKE_ALTERNATE_PORTRAIT] = alternate;
  mem.wram.set(variant === 'empty topics' ? [0xff] : [2, 0xff], TOPIC_LIST);
  // Preserve the real partner portrait pointer, supply bounded text records.
  const read = mem.read8.bind(mem),
    record = mem.read16(DIALOG_TABLE),
    header = Array.from({ length: 3 }, (_, n) => read(DIALOG_BANK_BASE + record + n)),
    entry = (key, text, action = false) => [
      key,
      action ? 6 : 4,
      action ? 0x80 : 0,
      ...(action ? [0x34, 0x12] : []),
      text & 255,
      text >>> 8,
    ],
    bytes = [
      ...header,
      music | mirror,
      ...entry(0xff, 0x707d),
      ...entry(0xfe, 0x7077, variant === 'talk ends'),
      ...entry(2, 0x7074, variant === 'topic ends'),
      0xf8,
    ];
  mem.read8 = (address) =>
    address === DIALOG_TABLE
      ? 0
      : address === DIALOG_TABLE + 1
        ? 0x60
        : address >= 0x8d6000 && address < 0x8d6000 + bytes.length
          ? bytes[address - 0x8d6000]
          : read(address);
  events.text = dialogTextRoutines(events);
  events.text.topic = (callee) => {
    side.calls.push(['topic action', mem.read16(0x8d0000 + mem.read16(0x11) + callee.ctx.y)]);
    put(DIALOG_END, 0xffff);
  };
  const serviceUpload = events.interrupts.textWait;
  const pads = variant.startsWith('talk')
    ? [0x400, 0, 0x8000, 0, 0x8000]
    : variant.startsWith('topic') || variant === 'empty topics'
      ? [0x400, 0, 0x400, 0, 0x8000, 0, variant === 'topic cancel' ? 0x2000 : 0x8000, 0, 0x8000]
      : variant === 'cancel'
        ? [0x2000]
        : [0x8000];
  let frames = 0,
    input = 0,
    requests = 0;
  events.interrupts.textWait = (callee, frameEvents, status, pc) => {
    if (pc === 0x80ae0c) return true;
    if (pc === 0x80ae0f) {
      if (!mem.read16(W.NMI_JOB_LISTS)) return true;
      side.calls.push([
        'object tiles',
        mem.wram.slice(W.VRAM_UPLOAD_SOURCES, W.VRAM_UPLOAD_SOURCES + 6),
      ]);
      put(W.NMI_JOB_LISTS, 0);
      put(W.DP_VRAM_UPLOAD_INDEX, 0);
      return true;
    }
    if ([0x81b0a1, 0x81b0a5, 0x81b0ab].includes(pc)) return true;
    if (pc === 0x80901f) {
      requests++;
      side.calls.push([
        'portrait',
        mem.read16(PORTRAIT_DMA_REQUEST),
        mem.wram.slice(0x15250, 0x16250),
      ]);
      put(PORTRAIT_DMA_REQUEST, mem.read16(PORTRAIT_DMA_REQUEST) | 0x8000);
      return true;
    }
    if (pc !== 0x81b0a9) return serviceUpload(callee, frameEvents, status, pc);
    if (!(status & 2)) return true;
    frames++;
    // Opening is eleven frames, the greeting waits another sixty-one.
    if (mem.read16(0x7e0000 | (h.ctx.s + 1)) === 0xa6ec && input < pads.length)
      put(PAD_HELD, pads[input++]);
    else put(PAD_HELD, 0);
    assert.ok(frames < 140, 'bounded talk input');
    side.calls.push([
      'frame',
      frames,
      mem.read16(DIALOG_END),
      mem.wram.slice(DIALOG_HDMA_TABLE, DIALOG_HDMA_TABLE + 16),
    ]);
    put(RANDOM_STATE, mem.read16(RANDOM_STATE) + 1);
    return true;
  };
  const table = new Map([
    [0x80adf4, reloadObjectTiles],
    [0x80b8de, buildSpriteList],
    [0x81886a, clearFixedColourRoutine],
    [0x80fa92, setWindowTextWidthRoutine],
    [0x80bcb2, live.runPutGloveAway],
    [0x80ff79, live.runReleaseNoticeWindows],
    [0x80f963, live.runOpenWindow],
    [0x80fa3e, live.runReleaseWindow],
    [0x809f6d, liveUnpack],
    [0x808f20, liveShift],
    [0x809022, live.runUploadFirstPortrait],
    [0x80905e, live.runUploadSecondPortrait],
    [0x808f3a, live.runOpenPortraitWindow],
    [0x808f97, live.runClosePortraitWindow],
    [0x81b0a1, runFrameWait],
    [0x809e1a, runPadPresses],
    [0x809178, live.runDialogText],
    [0x8091e2, live.runDialogMenu],
    [0x809215, live.runDialogTopics],
    [0x81ef47, setMusicModeRoutine],
  ]);
  const result = finishTextWindow(side, module.talkSequence(h, events, ...(module === direct ? [] : [table])), budget);
  // Exclude only the relocated CPU stack from final and upload snapshots.
  result.wram.fill(0, 0x1e80, 0x1ef0);
  for (const [, wram] of result.uploads) wram.fill(0, 0x1e80 - 0x1cc, 0x1ef0 - 0x1cc);
  return { ...result, frames, input, requests };
}
import {
  unpackPortraitRoutine as liveUnpack,
  shiftPortraitRowsRoutine as liveShift,
} from '../src/game/portrait-upload.mjs';
for (const budget of [1, 7])
  for (const variant of ['exit', 'cancel', 'talk', 'topic'])
    test(`talk window composition: ${variant}, budget ${budget}`, () => {
      const actual = runTalk(direct, variant, budget);
      assert.deepEqual(actual, runTalk(former, variant, budget));
      assert.equal(actual.requests, 2);
      assert.ok(actual.frames >= 85, 'opening, greeting, menu and close all wait');
      assert.ok(actual.input > 0);
      assert.ok(actual.uploads.length > 4, 'both windows open, draw and release');
    });

for (const budget of [1, 7])
  for (const alternate of [0, 1])
    for (const music of [0, 1, 2])
      for (const mirror of [0, 0x80])
        test(`talk portraits: alternate ${alternate}, music ${music}, mirror ${mirror}, budget ${budget}`, () => {
          const options = { alternate, music, mirror },
            actual = runTalk(direct, 'exit', budget, options);
          assert.deepEqual(actual, runTalk(former, 'exit', budget, options));
          assert.equal(actual.requests, 2);
          assert.equal(actual.writes.filter(write => write === '8514,8224,2').length, music ? 2 : 0);
          assert.equal(actual.wram[0x3d12] | (actual.wram[0x3d13] << 8), mirror ? 0x7480 : 0x3480);
          assert.equal(actual.calls.filter((call) => call[0] === 'portrait')[0][1], 0);
          assert.equal(actual.calls.filter((call) => call[0] === 'portrait')[1][1], 0x800);
          assert.equal(
            actual.wram[MUSIC] | (actual.wram[MUSIC + 1] << 8),
            0,
          );
        });

for (const budget of [1, 7])
  for (const variant of ['empty topics', 'topic cancel', 'talk ends', 'topic ends'])
    test(`talk text/menu boundary: ${variant}, budget ${budget}`, () => {
      const actual = runTalk(direct, variant, budget);
      assert.deepEqual(actual, runTalk(former, variant, budget));
      assert.equal(
        actual.calls.filter((call) => call[0] === 'topic action').length,
        variant.endsWith('ends') ? 1 : 0,
      );
      if (variant.endsWith('ends'))
        assert.deepEqual(
          actual.calls.find((call) => call[0] === 'topic action'),
          ['topic action', 0x1234],
        );
    });

for (const budget of [1, 7])
  for (const token of [254, 255])
    test(`talk real music token wrap: ${token}, budget ${budget}`, () => {
      const options = { music: 1, token };
      assert.deepEqual(runTalk(direct, 'exit', budget, options), runTalk(former, 'exit', budget, options));
    });
