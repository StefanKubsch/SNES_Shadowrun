// The RTS of the lifted sequences that register-level test callers enter with JSR. Until
// 2026-11-27 these src sequences took outerReturn (default true) and ended with the RTS;
// now they end without a CPU frame, and rtsForm adds the return as the step after the
// sequence (the RTS result is returned, as before).
const RTS_SEQUENCES = new Set([
  'askYesNoSequence',
  'chooseObjectNumberSequence',
  'chooseObjectUnderGloveSequence',
  'choosePlaceWithGloveSequence',
  'chooseScriptActionSequence',
  'chooseSpellSequence',
  'controlPlayerSequence',
  'hitObjectsInBlastSequence',
  'liftedBlastSequence',
  'liftedChooseNumberSequence',
  'liftedChoosePlaceSequence',
  'liftedChooseUnderGloveSequence',
  'liftedConfirmKeySequence',
  'liftedFightListRemoveSequence',
  'liftedMainMenuSequence',
  'liftedNoticeSequence',
  'liftedPlayerControlSequence',
  'liftedQuestionSequence',
  'liftedReleaseGloveSequence',
  'liftedScriptActionSequence',
  'liftedScriptChooseNumberSequence',
  'liftedScriptChooseObjectSequence',
  'liftedShootAtGloveTargetSequence',
  'liftedShootAtObjectSequence',
  'liftedShootWithOwnWeaponSequence',
  'liftedSpellChoiceSequence',
  'liftedSpellGloveTargetSequence',
  'liftedSpellMenuSequence',
  'liftedSpendMagicSequence',
  'liftedStatusScreenSequence',
  'liftedTalkSequence',
  'liftedTopicTextSequence',
  'liftedWindowTextSequence',
  'mainMenuSequence',
  'openSpellMenuSequence',
  'printTopicTextSequence',
  'printWindowTextSequence',
  'raiseStateCountSequence',
  'redrawDialogWindowListSequence',
  'releaseGloveSequence',
  'releaseNoticeWindowsCallSequence',
  'removeFromFightListSequence',
  'restoreRunnersSequence',
  'scriptChooseObjectNumberSequence',
  'scriptChooseObjectSequence',
  'shootAtGloveTargetSequence',
  'shootAtObjectSequence',
  'shootWithOwnWeaponSequence',
  'showNoticeSequence',
  'spellGloveTargetSequence',
  'spendMagicPointsSequence',
  'statusScreenSequence',
  'talkSequence',
  'waitForConfirmKeySequence',
]);

export function rtsForm(sequence) {
  const form = function* (h, ...args) {
    yield* sequence(h, ...args);
    let result;
    yield () => {
      result = h.rts();
    };
    return result;
  };
  // Callers that tell the sequences apart by name see the lifted one's.
  return Object.defineProperty(form, 'name', { value: sequence.name });
}

// A module of lifted sequences with the RTS forms of those that had one.
export function withRts(module) {
  const forms = { ...module };
  for (const name of Object.keys(module))
    if (RTS_SEQUENCES.has(name)) forms[name] = rtsForm(module[name]);
  return forms;
}
