import test from 'node:test';
import assert from 'node:assert/strict';
import { GameLoop } from '../src/script/game-loop.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { resetWithEntryContext, startupWithEntryContext } from './startup-entry-adapter.mjs';
import { gameOwnerSequence, GAME_OWNER_RESUME } from './owner-entry-adapter.mjs';
import { gameStartSequence } from '../proof/caller/game-start.mjs';
import { processSceneRequest } from '../proof/caller/scene-request.mjs';
import { MainLoopContinuation } from '../proof/caller/main-loop.mjs';
import { MAIN_LOOP_ROUND } from './main-frame-adapter.mjs';
import { ROUND } from '../src/script/natives.mjs';
import { FRONTEND_ROUTINES } from '../src/system/main-frontend.mjs';
import { FRONTEND_ROUTINES as formerRoutines } from '../proof/script/live-frontend.mjs';
import { nativeOpcodeTargets } from '../src/data/native-opcode-targets.mjs';
import { nativeTarget } from '../src/script/native-targets.mjs';
import { fnv1a } from '../src/data/fnv.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { exploreLive } from './explore-live.mjs';
import { SNES_VIDEO } from '../src/video/live-game.mjs';
import { CUTSCENE_PLAN } from './live-cutscene-plan.mjs';
import { PLAN as MATRIX_PLAN } from './live-matrix-plan.mjs';
import { withSchedulerFrames } from './scheduler-frame-adapter.mjs';

// Same JS tasks and devices, with the previous caller on the reference side.
// The loop ends only after the plan; no game-over route is asserted here.
class PreviousCallerLoop extends GameLoop {
  *game() {
    const a = this.accessor,
      h = dialogAccess(a);
    let events = this.interval(0x80e382);
    yield () => resetWithEntryContext(a);
    yield* startupWithEntryContext(h, events);
    for (;;) {
      const ownerReturn = a.ctx.s;
      yield* gameOwnerSequence(h, events, this.routines);
      this.ownsGame = true;
      yield* gameStartSequence(h, events, this.routines);
      for (;;) {
        yield {
          continuation: new MainLoopContinuation(a, {
            events,
            routines: this.routines,
            returnToOwner: true,
          }),
        };
        this.closeInterval(events);
        if (a.ctx.pc !== MAIN_LOOP_ROUND) break;
        a.pushWord(MAIN_LOOP_ROUND + 2);
        yield { continuation: this.round(ROUND) };
        this.rounds++;
        events = this.interval(0x800000 | a.ctx.pc);
      }
      assert.equal(a.ctx.pc, GAME_OWNER_RESUME, 'return to owner');
      assert.equal(a.ctx.s, ownerReturn, 'owner frame returned');
      this.ownsGame = false;
      events = this.interval(0x800000 | GAME_OWNER_RESUME);
    }
  }
}

const ROOM_PLAN = [
  ...CUTSCENE_PLAN.slice(0, 5),
  ...[0xd2, 0x159, 3].flatMap((room) => [
    ['poke', 0x2de2, room],
    ['poke', 0x1ce9, 0x7fff],
    ['wait', 600],
  ]),
];

function run(plan, budget, previous) {
  const frames = [];
  const result = exploreLive(plan, {
    cartridge,
    sram: loadSave('apartment'),
    // The runs compare PPU registers and write counts: the SNES back end.
    video: SNES_VIDEO,
    loop: (game) => {
      const Type = previous ? PreviousCallerLoop : GameLoop;
      const loop = new Type(game.vm, {
        devices: game.devices,
        routines: previous
          ? new Map([...formerRoutines, ...FRONTEND_ROUTINES, [0x80cc4b, processSceneRequest]])
          : FRONTEND_ROUTINES,
        admitted: nativeOpcodeTargets,
        implementation: nativeTarget,
      });
      return previous ? withSchedulerFrames(loop) : loop;
    },
    onGame(game) {
      const step = game.step.bind(game);
      game.step = () => step({ budget });
      const onNmi = game.frames.onNmi;
      game.frames.onNmi = (k) => {
        onNmi(k);
        // Compare all direct-page bytes too; only CPU stack storage and saved
        // interrupt registers are excluded from game state.
        const wram = game.memory.wram.slice();
        wram.fill(0, 0x100, 0x1ca);
        wram.fill(0, 0x1c78, 0x1cbc);
        const ppu = game.bus.ppu;
        frames.push(
          [
            wram,
            game.memory.sram,
            ppu.vram,
            ppu.cgram,
            ppu.oam,
            ppu.registers,
            ppu.scroll,
            game.apu.ram,
          ]
            .map(fnv1a)
            .join(',') +
            ',' +
            game.bus.ppuWrites,
        );
      };
    },
  });
  frames.length = Math.min(frames.length, result.ends[plan.length - 1] + 1);
  return frames;
}

for (const budget of [1, 7])
  for (const [name, plan, minimum] of [
    ['room changes', ROOM_PLAN, 5000],
    ['cutscenes', CUTSCENE_PLAN, 15000],
    ['matrix', MATRIX_PLAN, 20000],
  ])
    test(
      `direct transitions match former callers: ${name}, budget ${budget}`,
      { timeout: 1800000 },
      () => {
        const before = run(plan, budget, true),
          after = run(plan, budget, false);
        assert.ok(before.length > minimum, 'full plan sampled');
        assert.equal(after.length, before.length, 'frame count');
        const first = after.findIndex((frame, n) => frame !== before[n]);
        assert.equal(first, -1, `first differing NMI ${first}`);
      },
    );
