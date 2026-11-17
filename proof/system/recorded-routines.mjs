// Register-level versions of lifted routines for instruction-level startup
// recordings (startupInterrupts). Importing this module installs them into
// src/system/recorded-routines.mjs; the producers of such recordings import it.
import { installRecordedRoutine } from '../../src/system/recorded-routines.mjs';
import { stepObjectAnimation } from './native-scene-tiles.mjs';

// 80:AC2F: the animation step of object X, with an interrupt step at each
// observed instruction.
installRecordedRoutine('object-animation', stepObjectAnimation);
