// Live comparison of the lifted jobs of the game NMI handler 80:C152
// (src/game/game-nmi.mjs) with the register-level jobs (GAME_NMI_ROUTINES in
// src/task/main-game-nmi.mjs; docs/MAIN-LOOP-LIFT.md). The session is the alley plan
// of tools/live-alley-plan.mjs (from the title and the apartment save into the alley,
// with fades, the orc's shots, notices and the Beretta); every NMI must give the same
// WRAM, VRAM, CGRAM, OAM, PPU registers, scroll, PPU write count and sound RAM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { PLAN } from './live-alley-plan.mjs';
import { CUTSCENE_IGNORED_WRAM } from './live-cutscene-plan.mjs';
import { GAME_NMI_LIFTED_JOBS } from '../src/game/game-nmi.mjs';
import { GAME_NMI_ROUTINES } from '../src/task/main-game-nmi.mjs';
import { INIDISP_SHADOW } from '../src/task/wram.mjs';

// The cutscene scratch and stacks, but not the screen shadows 7E:01BC-01C9 above the
// main stack, which the brightness fade steps.
const IGNORED = CUTSCENE_IGNORED_WRAM.map(([from, to]) =>
  from === 0x0100 ? [from, INIDISP_SHADOW] : [from, to],
);
// Diagnosis: GAME_NMI_LIFT_FRAME=n lists the differing WRAM bytes at NMI n.
const snapshotAt = Number(process.env.GAME_NMI_LIFT_FRAME ?? -1);

test(
  'game NMI: the lifted jobs give the same frames as the reference',
  { timeout: 1800000 },
  async () => {
    const result = await compareLift({
      plan: PLAN,
      lifted: [...GAME_NMI_LIFTED_JOBS.values()],
      reference: new Map(
        [...GAME_NMI_LIFTED_JOBS.keys()].map((t) => [t, GAME_NMI_ROUTINES.get(t)]),
      ),
      ignored: IGNORED,
      snapshotAt,
    });
    if (snapshotAt >= 0) console.log(result.bytes.join('\n'));
    assert.equal(result.frames, result.referenceFrames, 'frame count');
    assert.equal(result.first, -1, `NMI ${result.first}: ${result.parts.join(', ')} differ`);
    assert.ok(result.frames > 8000, 'frames compared: ' + result.frames);
  },
);
