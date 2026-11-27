// The jobs of the lifted game NMI handler (src/game/game-nmi.mjs) as routine table entries
// for register-level callers and the function tests (moved from src/game/game-nmi.mjs; the
// live routine table binds only the handler 80:C152, the one entry the live NMI looks up):
// 80:999A, 80:8FBA and 80:C06B are called with JSR, 81:8949, 81:A9E1, 81:80C4, 81:A919,
// 81:A958, 81:A98E and 81:B0D1 with JSL.
import {
  clearTextTiles,
  stepBrightnessFade,
  uploadGlove,
  uploadObjectPalettes,
  uploadOam,
  uploadPaletteCycleStep,
  uploadPortraitGraphics,
  uploadReadyMapEdges,
  uploadScenePalettes,
  uploadVramRecords,
} from '../../src/game/game-nmi.mjs';
import { accessorPort } from '../../src/system/hardware-port.mjs';
import { handleGameNmiJsl } from './jsr-forms.mjs';
import { sceneRuntime } from '../../src/system/scene-runtime.mjs';

// A job on WRAM and the hardware port, returning by RTS or RTL.
const shortJob = (job) => (h) => {
  job(h.a.mem.wram, accessorPort(h.a));
  return h.rts();
};
const longJob = (job) => (h) => {
  job(h.a.mem.wram, accessorPort(h.a));
  return h.rtl();
};

// The lifted jobs by their entries (the tests and recorded runs call these).
export const GAME_NMI_LIFTED_ROUTINES = new Map([
  [0x80999a, shortJob(uploadScenePalettes)],
  [0x8180c4, longJob(uploadPaletteCycleStep)],
  [0x81a919, longJob(uploadObjectPalettes)],
  [0x81a958, longJob(uploadVramRecords)],
  [0x81a98e, longJob(uploadOam)],
  [0x81b0d1, longJob((wram) => stepBrightnessFade(wram))],
  [0x808fba, shortJob(uploadPortraitGraphics)],
  [0x80c06b, shortJob(uploadGlove)],
  [
    0x818949,
    (h) => {
      uploadReadyMapEdges(h.a.mem.wram, sceneRuntime(h).video);
      return h.rtl();
    },
  ],
  [0x81a9e1, longJob(clearTextTiles)],
  [0x80c152, handleGameNmiJsl],
]);
