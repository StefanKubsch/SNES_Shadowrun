import {
  SCRIPT_VARIABLES,
  OBJECT_KIND,
  KARMA,
  SCENE_REQUEST_ROOM_ONLY,
} from '../../src/task/wram.mjs';
import { SCRIPT_NATIVE } from '../script/task.mjs';
import { isWord } from '../script/runtime.mjs';
import { createScriptWordState, isScriptWordState, isScriptWordNative } from './script-words.mjs';
import { isSlotState } from './slots.mjs';
import { isACState } from './ac-state.mjs';

const SLOT_STATE_WINDOW_BYTES = OBJECT_KIND - SCRIPT_VARIABLES;
const KARMA_WORD_OFFSET = KARMA - SCRIPT_VARIABLES;

const instances = new WeakSet();
const slotStates = new WeakMap();
const acStates = new WeakSet();
export const isScriptState = (state) => instances.has(state) || isScriptWordState(state);
export const isScriptStateNative = (state, id) =>
  isScriptWordNative(id) ||
  (instances.has(state) &&
    (id === SCRIPT_NATIVE.WRITE_ACTION_WORDS ||
      (id === SCRIPT_NATIVE.AC_STATE && acStates.has(state)) ||
      ([
        SCRIPT_NATIVE.READ_SLOT_RECORD_FLAGS,
        SCRIPT_NATIVE.READ_SLOT_X,
        SCRIPT_NATIVE.READ_SLOT_Y,
        SCRIPT_NATIVE.READ_SLOT_Z,
        SCRIPT_NATIVE.WRITE_SLOT_COORDINATES,
        SCRIPT_NATIVE.RESET_MOTION_PREFIX,
        SCRIPT_NATIVE.SET_SLOT_INDEX,
        SCRIPT_NATIVE.SELECT_SLOT_AND_SET_INDEX,
        SCRIPT_NATIVE.TARGET_MOTION,
        SCRIPT_NATIVE.OR_SLOT_FLAGS,
        SCRIPT_NATIVE.RELEASE_SLOT,
        SCRIPT_NATIVE.CREATE_SLOT,
      ].includes(id) &&
        slotStates.has(state))));

// Five base actions, plus covered slot actions and supplied AC data paths.
// Native $56 stores ROOM and requests a room-only scene change, as documented
// by src/task/native-room-change.mjs; the proof API retains its original field names.
// These are game-state fields, not an emulated memory bus.
export function createScriptState({ byteLength, slotState = null, acState = null } = {}) {
  if (slotState !== null && !isSlotState(slotState)) throw new Error('Invalid slot state');
  if (acState !== null && !isACState(acState)) throw new Error('Invalid AC state');
  // The word window at $7E:3BBB must stop before the modeled slot columns at
  // $7E:3F28. Overlapping storage requires a future shared-data implementation.
  if (slotState && byteLength > SLOT_STATE_WINDOW_BYTES)
    throw new Error('Script word window overlaps slot state');
  const scriptWords = createScriptWordState({ byteLength });
  let argumentWord = null; // Source $7E:2DE2, unknown until written.
  let markerWord = null; // Source $1CE9 (native ABI DBR=$80).
  const state = {
    observeNativeDispatch(nativeId) {
      if (slotState) slotState.observeNativeDispatch(nativeId);
    },
    seed(offset, values) {
      scriptWords.seed(offset, values);
    },
    snapshot() {
      return {
        scriptWords: scriptWords.snapshot(),
        action56: { argumentWord, markerWord },
        ...(slotState ? { slots: slotState.snapshot() } : {}),
        ...(acState ? { ac: acState.snapshot() } : {}),
      };
    },
    applyNative(request, context = {}) {
      if (request?.nativeId === SCRIPT_NATIVE.AC_STATE && acState)
        return acState.applyNative(request, {
          readWord3C11: () =>
            scriptWords.applyNative({
              nativeId: SCRIPT_NATIVE.READ_STATE_WORD,
              args: [KARMA_WORD_OFFSET],
              returnBytes: 2,
            }),
        });
      if (
        [
          SCRIPT_NATIVE.READ_SLOT_RECORD_FLAGS,
          SCRIPT_NATIVE.READ_SLOT_X,
          SCRIPT_NATIVE.READ_SLOT_Y,
          SCRIPT_NATIVE.READ_SLOT_Z,
          SCRIPT_NATIVE.WRITE_SLOT_COORDINATES,
          SCRIPT_NATIVE.RESET_MOTION_PREFIX,
          SCRIPT_NATIVE.SET_SLOT_INDEX,
          SCRIPT_NATIVE.SELECT_SLOT_AND_SET_INDEX,
          SCRIPT_NATIVE.TARGET_MOTION,
          SCRIPT_NATIVE.OR_SLOT_FLAGS,
          SCRIPT_NATIVE.RELEASE_SLOT,
          SCRIPT_NATIVE.CREATE_SLOT,
        ].includes(request?.nativeId) &&
        slotState
      )
        return slotState.applyNative(request, context);
      if (request?.nativeId !== SCRIPT_NATIVE.WRITE_ACTION_WORDS)
        return scriptWords.applyNative(request);
      if (
        !Array.isArray(request.args) ||
        request.args.length !== 1 ||
        !isWord(request.args[0]) ||
        request.returnBytes !== 0
      )
        throw new Error('State native ABI mismatch');
      argumentWord = request.args[0];
      markerWord = SCENE_REQUEST_ROOM_ONLY;
      return { handled: true, value: null };
    },
  };
  instances.add(state);
  if (slotState) slotStates.set(state, slotState);
  if (acState) acStates.add(state);
  return state;
}
