// Main game frame phases, in the source order of 80:96AB-96F2.
// Control returns as values; program counters and return words belong only to
// the remaining boot/native compatibility adapters, never to frame decisions.
import { readStateWord } from '../state/objects.mjs';
import { gloveMove } from './glove-move.mjs';
import { sceneRequestSequence } from './scene-request.mjs';
import { shakeHitPlayer } from './player-hit.mjs';
import { recordFormationStep } from './formation-trail.mjs';
import { moveAndAnimateInPlace } from './object-motion.mjs';
import { noticeTimeoutSequence } from './notice-timeout.mjs';
import { timeLimitSequence } from './time-limit.mjs';
import { gloveActionSequence } from './glove-action.mjs';
import { playerZonesSequence } from './player-zones.mjs';
import { buildSpritesInPlace } from './sprite-list.mjs';
import { updateTileBuffers } from './camera-scroll.mjs';
import { followPlayerWithCamera } from './camera-follow.mjs';
import { advancePaletteCycles } from './palette-cycles.mjs';
import { applyColourEffect } from './fixed-colour.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { MAIN_LOOP_EXIT, MAIN_LOOP_RELOAD } from '../data/wram.mjs';

import { waitForCounterWord } from '../system/frame-wait.mjs';
import { takePad } from '../system/live-input-calls.mjs';

export function* update(h, events) {
  const { wram } = h.a.mem;
  const zones = {};
  yield* playerZonesSequence(h, events, zones);
  if (zones.changed) return null;
  const request = {};
  yield* sceneRequestSequence(h, events, request);
  if (request.taken) return null;
  yield () => shakeHitPlayer(wram);
  yield () => moveAndAnimateInPlace(h);
  yield () => recordFormationStep(h.a.mem);
  yield () => followPlayerWithCamera(h.a.mem, wram);
  yield () => updateTileBuffers(wram);
  yield () => buildSpritesInPlace(h);
  yield* noticeTimeoutSequence(h, events);
  yield* timeLimitSequence(h, events);
  if (readStateWord(wram, MAIN_LOOP_EXIT)) return 'exit';
  if (readStateWord(wram, MAIN_LOOP_RELOAD)) return 'reload';
  return null;
}

// Wait for the next frame, then prepare input, palettes and the glove before tasks.
// The optional wait is the legacy test adapter's framed call; live use has no JSL.
export function* endOfFrame(h, events, wait = waitForCounterWord) {
  const { wram } = h.a.mem;
  yield* wait(h, events);
  yield () => applyColourEffect(sceneRuntime(h));
  yield () => advancePaletteCycles(wram);
  yield () => takePad(h, events);
  yield* gloveMove(h, events);
  yield* gloveActionSequence(h, events);
}
