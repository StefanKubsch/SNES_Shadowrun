// Register-level versions of lifted routines for instruction-level startup
// recordings (startupInterrupts). Importing this module installs them into
// src/system/recorded-routines.mjs; the producers of such recordings import it.
import { installRecordedRoutine } from '../../src/system/recorded-routines.mjs';
import { stepObjectAnimation } from './native-scene-tiles.mjs';
import { unpackPortrait } from './native-dialog-portrait.mjs';

// 80:AC2F: the animation step of the object slot (taken in X), with an interrupt step
// at each observed instruction.
installRecordedRoutine('object-animation', (h, events, slot) => {
  h.ctx.x = slot;
  return stepObjectAnimation(h, events);
});
// 80:9F6D: the portrait unpacker into bank 7F.
installRecordedRoutine('portrait-unpack', unpackPortrait);
