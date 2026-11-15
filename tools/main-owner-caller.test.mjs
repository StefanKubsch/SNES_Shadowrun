import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveGame } from '../src/video/live-game.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { livePlanDriver } from './live-plan-driver.mjs';
import { TITLE_CYCLE_PLANS } from './live-title-cycle-plan.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { NativeCallContinuation } from '../src/system/native-call-continuation.mjs';
import { WAIT_RETURNED } from '../src/system/native-wait-continuation.mjs';
import { runMainReset } from '../src/system/main-reset.mjs';
import { mainStartupSequence } from '../src/system/main-startup.mjs';
import { gameOwnerSequence, GAME_OWNER_RESUME } from '../src/frontend/game-owner.mjs';
import { gameOwnerSequence as dispatchedOwner } from '../proof/frontend-caller/game-owner.mjs';
import { FRONTEND_ROUTINES as dispatchedRoutines } from '../proof/script/live-frontend.mjs';
import { gameStartSequence } from '../src/game/game-start.mjs';
import { MainLoopContinuation, MAIN_LOOP_ROUND } from '../src/vm/main-loop.mjs';
import { MAIN_LOOP_EXIT } from '../src/data/wram.mjs';
import { ROUND } from '../src/script/natives.mjs';

// The same JS scheduler and devices on both sides isolate caller composition.
// Compare every byte, including inactive stack bytes, without scratch masks.
function snapshot(game) {
  const { ppu } = game.bus;
  return {
    context: { ...game.loop.accessor.ctx },
    wram: game.memory.wram.slice(),
    sram: game.memory.sram.slice(),
    video: Object.fromEntries(
      ['vram', 'cgram', 'oam', 'registers', 'scroll'].map((key) => [key, ppu[key].slice()]),
    ),
    writes: game.bus.ppuWrites,
    sound: game.apu.ram.slice(),
  };
}

// Complete the first owner, enter the selected game, and exercise the real main
// loop RTS back to A157. The exit request is a fixture, not a game-over route.
function* session(game, owner, routines, boundary, resume) {
  const loop = game.loop,
    a = loop.accessor,
    h = dialogAccess(a),
    events = loop.interval(0x80e382);
  yield () => runMainReset(a);
  yield* mainStartupSequence(h, events);
  yield* owner(h, events, routines);
  yield () => boundary('first owner');
  yield* gameStartSequence(h, events, routines);
  yield {
    continuation: new MainLoopContinuation(a, { events, routines, returnToOwner: true }),
  };
  yield () => {
    assert.equal(a.ctx.pc, MAIN_LOOP_ROUND);
    a.pushWord(MAIN_LOOP_ROUND + 2);
  };
  yield { continuation: loop.round(ROUND) };
  yield () => {
    loop.closeInterval(events);
    game.memory.wram[MAIN_LOOP_EXIT] = 1;
    game.memory.wram[MAIN_LOOP_EXIT + 1] = 0;
  };
  const returning = loop.interval(0x8096c3);
  yield {
    continuation: new MainLoopContinuation(a, {
      events: returning,
      routines,
      returnToOwner: true,
    }),
  };
  yield () => {
    assert.equal(a.ctx.pc, GAME_OWNER_RESUME);
    assert.equal(a.ctx.s, 0x13f);
    boundary('game return');
    resume();
  };
  yield* owner(h, loop.interval(0x80a157), routines);
  yield () => boundary('resumed owner');
}

for (const budget of [1, 7])
  for (const [index, originalPlan] of TITLE_CYCLE_PLANS.entries())
    test(
      `direct owner matches dispatch: session ${index}, budget ${budget}`,
      { timeout: 300000 },
      () => {
        // The no-input plan covers two attract games; then choose New Game.
        const plan = index === 0 ? [...originalPlan, ['press', 'b', 800]] : originalPlan;
        const pending = [new Map(), new Map()];
        const counts = { frames: 0, boundaries: 0 };
        const compare = (side, key, game) => {
          const mine = snapshot(game),
            other = pending[1 - side];
          if (!other.has(key)) pending[side].set(key, mine);
          else {
            assert.deepEqual(mine, other.get(key), key);
            other.delete(key);
            if (typeof key === 'number') counts.frames++;
            else counts.boundaries++;
          }
        };
        const games = [0, 1].map((side) => {
          let driver,
            resumeAt = null;
          const game = new LiveGame(cartridge, {
            sram: loadSave('apartment'),
            pad: (k) => {
              if (resumeAt !== null) return (k - resumeAt) % 40 < 6 ? 0x8000 : 0;
              driver ??= livePlanDriver(plan, game.memory.wram);
              return driver.pad(k);
            },
          });
          const onNmi = game.frames.onNmi;
          game.frames.onNmi = (k) => {
            onNmi(k);
            compare(side, k, game);
          };
          const sequence = session(
            game,
            side === 0 ? dispatchedOwner : gameOwnerSequence,
            side === 0 ? dispatchedRoutines : game.loop.routines,
            (key) => compare(side, key, game),
            () => (resumeAt = game.nmis),
          );
          game.loop.work = new NativeCallContinuation(game.loop.accessor, sequence);
          return game;
        });
        const done = [false, false];
        while (!done.every(Boolean))
          for (const [side, game] of games.entries()) {
            if (done[side]) continue;
            game.loop.accessor.resetAccessBudget();
            done[side] = game.loop.work.run(budget) === WAIT_RETURNED;
            assert.ok(game.nmis < 20000, 'session must finish');
          }
        assert.equal(counts.boundaries, 3);
        assert.ok(counts.frames > 1000, `NMIs compared: ${counts.frames}`);
        assert.deepEqual([...pending[0].keys(), ...pending[1].keys()], []);
        assert.deepEqual(snapshot(games[0]), snapshot(games[1]), 'final return');
      },
    );
