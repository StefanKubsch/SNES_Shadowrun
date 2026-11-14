import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_PROFILES,
  DEFAULT_AUDIO_PROFILE,
  getAudioProfile,
  PAL_1CHIP_AUDIO,
} from '../src/browser/audio-profiles.mjs';

test('named profiles retain evidence and units for every parameter without claiming measured PAL internals', () => {
  assert.equal(getAudioProfile().id, DEFAULT_AUDIO_PROFILE);
  assert.deepEqual(getAudioProfile().parameters, PAL_1CHIP_AUDIO);
  for (const definition of Object.values(AUDIO_PROFILES)) {
    assert.equal(getAudioProfile(definition.id), definition);
    assert.ok(Object.isFrozen(definition) && Object.isFrozen(definition.parameters));
    assert.ok(Object.isFrozen(definition.evidence) && Object.isFrozen(definition.unresolved));
    assert.ok(definition.unresolved.length > 0);
    assert.deepEqual(Object.keys(definition.evidence), Object.keys(definition.parameters));
    for (const entry of Object.values(definition.evidence)) {
      assert.ok(Object.isFrozen(entry));
      assert.ok(entry.unit && entry.category && entry.note);
      if (['pal-reconstruction', 'related-board-assumption', 'derived'].includes(entry.category))
        assert.ok(entry.source, 'component or derived evidence identifies its source');
    }
    assert.equal(definition.evidence.inputResistanceOhm.category, 'model-choice');
    assert.equal(definition.evidence.mixerGain.category, 'model-choice');
    assert.equal(definition.evidence.outputShuntF.category, 'related-board-assumption');
    assert.equal(definition.evidence.loadResistanceOhm.category, 'listening-setup');
    assert.throws(() => {
      definition.parameters.mixerGain = 2.2;
    }, TypeError);
  }
  const experimental = getAudioProfile('pal_1chip_optional_lp12k');
  assert.equal(experimental.category, 'experimental-hypothesis');
  assert.equal(experimental.evidence.mixerLowPassHz.category, 'hypothesis');
  assert.equal(getAudioProfile().parameters.mixerLowPassHz, 0);
  assert.equal(
    getAudioProfile('pal_1chip_reference_150n_100k').evidence.inputCapacitanceF.category,
    'related-board-assumption',
  );
  for (const id of ['missing', 'toString', '__proto__', null, {}, 0])
    assert.throws(() => getAudioProfile(id), RangeError);
});
