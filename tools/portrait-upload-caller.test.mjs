import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import * as lifted from '../src/game/portrait-upload.mjs';
import * as former from '../proof/caller/portrait-upload.mjs';
import { uploadFirstPortraitJsr, uploadSecondPortraitJsr } from '../proof/caller/jsr-forms.mjs';
import { uploadPortraitTilesSequence } from '../proof/caller/portrait-routines.mjs';

useLiftVectors(import.meta.url);

// The lifted uploads; the DMA job's register form takes the VRAM address in X.
// The lifted uploads in their RTS forms (proof/caller/jsr-forms.mjs), named as the former.
const direct = {
  ...lifted,
  uploadPortraitTilesSequence,
  uploadFirstPortraitSequence: uploadFirstPortraitJsr,
  uploadSecondPortraitSequence: uploadSecondPortraitJsr,
};
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
} from '../src/system/native-call-continuation.mjs';
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';
import {
  DIALOG_RECORD_FLAGS,
  NMI_JOB_LISTS,
  PORTRAIT_DMA_REQUEST,
  PORTRAIT_PALETTE_START,
} from '../src/data/wram.mjs';

function run(module, name, { mirror = 0, jobs = 0, destination = 0, delay = 1 }, budget) {
  const side = textWindowSide(),
    { h, a, mem, put, events } = side;
  put(DIALOG_RECORD_FLAGS, mirror);
  put(NMI_JOB_LISTS, jobs);
  put(PORTRAIT_DMA_REQUEST, 0x1234);
  h.ctx.x = destination;
  for (let n = 0; n < 0x1000; n++) mem.wram[0x15250 + n] = (n * 17 + 23) & 0xff;
  let waits = 0;
  events.interrupts.textWait = (_h, _events, _status, pc) => {
    assert.equal(pc, 0x80901f, 'only the portrait DMA request blocks');
    side.calls.push([
      mem.read16(PORTRAIT_DMA_REQUEST),
      mem.read16(PORTRAIT_PALETTE_START),
      mem.wram.slice(0x15250, 0x16250),
    ]);
    if (++waits === delay) put(PORTRAIT_DMA_REQUEST, mem.read16(PORTRAIT_DMA_REQUEST) | 0x8000);
    assert.ok(waits <= delay, 'bounded DMA service');
    return true;
  };
  const upload = () => assert.fail('former upload must use its continuation'),
    routines = new Map([[0x808ff5, upload]]);
  NATIVE_CALL_CONTINUATIONS.set(upload, {
    run: upload,
    create: () => new NativeCallContinuation(a, former.uploadPortraitTilesSequence(h, events)),
  });
  let request, palette;
  function* sequence() {
    const result = yield* module[name](h, events, routines);
    request = mem.read16(PORTRAIT_DMA_REQUEST);
    palette = mem.read16(PORTRAIT_PALETTE_START);
    return result;
  }
  try {
    return { ...finishTextWindow(side, sequence(), budget), request, palette, waits };
  } finally {
    NATIVE_CALL_CONTINUATIONS.delete(upload);
  }
}

for (const budget of [1, 7]) {
  for (const mirror of [0, 0x80])
    for (const jobs of [0, 0x7fff, 0xffff])
      for (const name of ['uploadFirstPortraitSequence', 'uploadSecondPortraitSequence'])
        test(`direct ${name}: mirror ${mirror}, jobs ${jobs}, budget ${budget}`, () => {
          const options = { mirror, jobs, delay: 3 },
            actual = run(direct, name, options, budget),
            first = name.startsWith('uploadFirst');
          assertFrozenRun(actual);
          assert.equal(actual.waits, 3, 'DMA completion can span repeated waits');
          assert.equal(actual.request, first ? 0x8000 : 0x8800);
          const word = (at) => actual.wram[at] | (actual.wram[at + 1] << 8);
          assert.equal(actual.palette, first ? 0x91 : 0xa1);
          assert.equal(word(NMI_JOB_LISTS), first ? jobs : (jobs + 1) & 0xffff);
          if (!first) assert.equal(word(0x3d12), mirror ? 0x7480 : 0x3480);
        });
  for (const destination of [0, 0x800, 0x7fff, 0x8000, 0xffff])
    test(`direct portrait DMA: destination ${destination}, budget ${budget}`, () => {
      const options = { destination },
        actual = run(direct, 'uploadPortraitTilesSequence', options, budget);
      assertFrozenRun(actual);
      assert.equal(actual.request, destination | 0x8000);
      assert.equal(actual.waits, destination & 0x8000 ? 0 : 1);
      assert.equal(actual.writes.length, 6, 'complete DMA channel setup');
    });
}
