import test from 'node:test';
import assert from 'node:assert/strict';
import { createSide } from './lift-function-harness.mjs';
import { updateGameFrame } from '../src/game/game-nmi.mjs';
import { updateMatrixFrame } from '../src/matrix/matrix-scene.mjs';
import { updateCutsceneFrame } from '../src/cutscene/cutscene-scene.mjs';
import { updateIntroFrame } from '../src/intro/intro-scene.mjs';
import {
  updatePrologueFrame,
  updateTitleObjectsFrame,
  updateTitlePanFrame,
  updateTitleScrollFrame,
} from '../src/frontend/title.mjs';
import { updateStartMenuFrame } from '../src/frontend/start-menu.mjs';

for (const run of [
  updateGameFrame,
  updateMatrixFrame,
  updateCutsceneFrame,
  updateIntroFrame,
  updatePrologueFrame,
  updateTitleObjectsFrame,
  updateTitlePanFrame,
  updateTitleScrollFrame,
  updateStartMenuFrame,
]) {
  test(`${run.name} needs no CPU context or return frame`, () => {
    const side = createSide({ seed: 1, wram: new Uint8Array(0x20000) }, new Map());
    const context = { ...side.a.ctx };
    const h = { a: side.a };
    // Frame jobs may use memory and devices, but cannot select a CPU return.
    run(h, 1);
    assert.deepEqual(side.a.ctx, context);
  });
}
