import { nativeOpcodeComposition } from './native-combat-opcode.mjs';
import { releaseGloveObserved } from '../../src/task/native-glove-release.mjs';
import { chooseSpellObserved } from '../../src/task/native-spell-choice.mjs';
import {
  targetWithSpellGloveObserved,
  scriptChooseObjectWithGloveObserved,
  scriptChooseObjectNumberWithGloveObserved,
  choosePlaceWithGloveObserved,
} from '../../src/task/native-glove-target.mjs';
import { native936CDevices } from './native-936c-opcode.mjs';
import { panSongLevelToObjectReference as panSongLevelToObject } from '../apu-reference/sound-stereo.mjs';
import { validateGloveTaskOptions } from '../../src/task/native-glove-target.mjs';
import { fec1Registers } from '../../src/task/native-notice.mjs';
import { taskAudioDevices } from '../../src/task/native-audio-compose.mjs';
import { taskMenuDevices } from '../../src/task/native-menu-compose.mjs';
import { taskListDevices } from '../../src/task/native-list-prerequisites.mjs';
import { raiseMemberStateCountObserved } from '../../src/task/native-state-count-raise.mjs';
import { openWeaponMenuObserved } from '../../src/task/native-member-spell-menu.mjs';
import { showStatusScreenObserved } from '../../src/task/native-status-screen.mjs';
import { openMainMenuObserved } from '../../src/task/native-main-menu.mjs';
import { controlPlayerObserved } from '../../src/task/native-player-control.mjs';
import { restoreAllRunnersObserved } from '../../src/task/native-runners-restore.mjs';
import {
  raiseStateCountRegisters,
  restoreRunnersRegisters,
} from '../game-reference/runner-state.mjs';
import { validateDialogTaskOptions } from '../../src/task/native-dialog.mjs';
// Devices of E1CF: windows (FEC1/F963 family), list and menu A6C7.
const e1cfDevices = Object.freeze(
  Object.fromEntries(
    ['writes', 'reads', 'observationPcs'].map((key) => [
      key,
      Object.freeze([
        ...new Set([...fec1Registers[key], ...taskListDevices[key], ...taskMenuDevices[key]]),
      ]),
    ]),
  ),
);
// Small special natives through the shared composition: 45/CD9D (no argument, no result), 8A/E1CF, BD/9BD3
// and C1/9C33 (no argument, result), 52/C461 and 27/CECB (two argument words, no result; APU handshake reads
// as in C46E, CECB draws the window list as CD9D), 01/F254 (one argument word, result; weapon menu with the
// portrait and DMA writes of 936C and its nested round), 20/D079 (no argument, no result; window list),
// A8/C724 (one argument word, no result; glove as 9BD3), B0/EA6E (one argument word, no result; status screen
// with the devices of 936C and nested rounds), 3C/CE6D (no argument, no result; main menu with saving),
// D0/E014 (no argument, result; player control with the menus, SRAM camera read in DEC7).
export const SMALL_SPECIAL_CALLEES = Object.freeze({
  0x45: {
    entry: 0x80cd9d,
    metadataWord: 0x0100,
    result: false,
    run: (a, o) => releaseGloveObserved(a, o, false),
    devices: fec1Registers,
    validate: validateGloveTaskOptions,
  },
  0x8a: {
    entry: 0x80e1cf,
    metadataWord: 0x0000,
    run: (a, o) => chooseSpellObserved(a, o, false),
    devices: e1cfDevices,
    validate: validateGloveTaskOptions,
  },
  // 9BD3 can close the dialog (92C5 with its PPU/DMA writes): devices of 936C.
  0xbd: {
    entry: 0x809bd3,
    metadataWord: 0x0100,
    run: (a, o) => targetWithSpellGloveObserved(a, o, false),
    devices: native936CDevices,
    validate: validateGloveTaskOptions,
  },
  0xc1: {
    entry: 0x809c33,
    metadataWord: 0x0000,
    run: (a, o) => scriptChooseObjectWithGloveObserved(a, o, false),
    devices: fec1Registers,
    validate: validateGloveTaskOptions,
  },
  0x8f: {
    entry: 0x809bb9,
    metadataWord: 0x0100,
    run: (a, o) => scriptChooseObjectNumberWithGloveObserved(a, o, false),
    devices: fec1Registers,
    validate: validateGloveTaskOptions,
  },
  0x27: {
    entry: 0x80cecb,
    metadataWord: 0x0002,
    result: false,
    run: (a, o) => raiseMemberStateCountObserved(a, o, false, raiseStateCountRegisters),
    devices: fec1Registers,
    validate: validateGloveTaskOptions,
  },
  0xa8: {
    entry: 0x80c724,
    metadataWord: 0x0501,
    result: false,
    run: (a, o) => choosePlaceWithGloveObserved(a, o, false),
    devices: fec1Registers,
    validate: validateGloveTaskOptions,
  },
  0xd0: {
    entry: 0x80e014,
    metadataWord: 0x0200,
    run: (a, o) => controlPlayerObserved(a, o, false),
    devices: native936CDevices,
    validate: validateDialogTaskOptions,
  },
  0x3c: {
    entry: 0x80ce6d,
    metadataWord: 0x0500,
    result: false,
    run: (a, o) => openMainMenuObserved(a, o, false),
    devices: native936CDevices,
    validate: validateDialogTaskOptions,
  },
  0xb0: {
    entry: 0x80ea6e,
    metadataWord: 0x0201,
    result: false,
    run: (a, o) => showStatusScreenObserved(a, o, false),
    devices: native936CDevices,
    validate: validateDialogTaskOptions,
  },
  0x20: {
    entry: 0x80d079,
    metadataWord: 0x0100,
    result: false,
    run: (a, o) => restoreAllRunnersObserved(a, o, false, restoreRunnersRegisters),
    devices: fec1Registers,
    validate: validateGloveTaskOptions,
  },
  0x01: {
    entry: 0x80f254,
    metadataWord: 0x0101,
    run: (a, o) => openWeaponMenuObserved(a, o, false),
    devices: native936CDevices,
    validate: validateDialogTaskOptions,
  },
  0x52: {
    entry: 0x80c461,
    metadataWord: 0x0202,
    result: false,
    run: (a) => panSongLevelToObject(a, false),
    devices: taskAudioDevices,
  },
});
export const prepareTaskNativeOpcodeSmall = nativeOpcodeComposition(SMALL_SPECIAL_CALLEES);
