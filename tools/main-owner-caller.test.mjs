import { GameLoop } from '../src/script/game-loop.mjs';
import { FRONTEND_ROUTINES } from '../src/system/main-frontend.mjs';
import { nativeOpcodeTargets } from '../src/data/native-opcode-targets.mjs';
import { nativeTarget } from '../src/script/native-targets.mjs';
import { toWram } from '../proof/state/to-wram.mjs';
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
import { gameOwnerSequence, GAME_OWNER_RESUME } from './owner-entry-adapter.mjs';
import { gameOwnerSequence as dispatchedOwner } from '../proof/frontend-caller/game-owner.mjs';
import { FRONTEND_ROUTINES as dispatchedRoutines } from '../proof/script/live-frontend.mjs';
import { mainStartContinuation } from '../proof/system/main-start.mjs';
import { mainStartContinuation as dispatchedStart } from '../proof/caller/main-start.mjs';
import { MainLoopContinuation as DispatchedLoop } from '../proof/caller/main-loop.mjs';
import { MainLoopContinuation, MAIN_LOOP_ROUND } from './main-frame-adapter.mjs';
import { MAIN_LOOP_EXIT, MAIN_LOOP_RELOAD, NMI_SAVED_A } from '../src/data/wram.mjs';
import { ROUND } from '../src/script/natives.mjs';
import { withSchedulerFrames } from './scheduler-frame-adapter.mjs';

// Inject the same JS loop explicitly for the frozen reference side. LiveGame keeps
// its reference WRAM views for injected loops; the shipped default owns detached fields.
const referenceLoop = (game) =>
  new GameLoop(game.vm, {
    devices: game.devices,
    routines: FRONTEND_ROUTINES,
    admitted: nativeOpcodeTargets,
    implementation: nativeTarget,
  });

// The same JS scheduler and devices on both sides isolate caller composition.
// Game state only (user decision 2026-11-17): the lifted side keeps no register values
// and no stack-kept values, so A, X, Y, P, S, the CPU stacks (main 7E:0100-01C9, NMI
// 7E:1C7C-1CBB) and the interrupted A and S the NMI saves (7E:1C78, 1C7A) are left out; every
// other byte is compared without scratch masks.
const CPU_STACKS = [
  [0x0100, 0x01ca],
  [NMI_SAVED_A, 0x1cbc],
];
const MAX_PENDING_STATES = 4;
// Compare every value without constructing a multi-megabyte nested assertion diff.
// A state mismatch must name its first byte, rather than exhaust the test process.
function compareSnapshots(actual, expected, key) {
  assert.deepEqual(actual.context, expected.context, `${key}: context`);
  assert.equal(actual.writes, expected.writes, `${key}: PPU writes`);
  const arrays = (a, b, name) => {
    assert.equal(a.length, b.length, `${key}: ${name} length`);
    for (let index = 0; index < a.length; index++)
      if (a[index] !== b[index])
        assert.fail(`${key}: ${name}[0x${index.toString(16)}]: ${a[index]} != ${b[index]}`);
  };
  for (const name of ['wram', 'sram', 'sound']) arrays(actual[name], expected[name], name);
  for (const name of Object.keys(actual.video))
    arrays(actual.video[name], expected.video[name], `video.${name}`);
}
function snapshot(game, inFrame = false) {
  const { ppu } = game.bus,
    { a, x, y, status, s, pc, programBank, ...context } = game.loop.accessor.ctx,
    wram = toWram(game.memory);
  // Live frames leave the caller's PC alone; the reference reports its wait
  // branch. Keep the PC comparison at each completed caller boundary.
  if (!inFrame) Object.assign(context, { pc, programBank });
  for (const [from, to] of CPU_STACKS) wram.fill(0, from, to);
  return {
    context,
    wram,
    sram: game.memory.sram.slice(),
    video: Object.fromEntries(
      ['vram', 'cgram', 'oam', 'registers', 'scroll'].map((key) => [key, ppu[key].slice()]),
    ),
    writes: game.bus.ppuWrites,
    sound: game.apu.ram.slice(),
  };
}

// The register-level owner reads the original's A = 1 of the startup at A139.
function* registerOwner(h, events, routines) {
  if (h.ctx.pc === 0xa139) h.ctx.a = 1;
  return yield* dispatchedOwner(h, events, routines);
}

// Complete the first owner, enter the selected game, and exercise the real main
// loop RTS back to A157. Exit and reload requests are fixtures, not game-over routes.
function* session(game, owner, routines, boundary, resume, side, request) {
  const loop = game.loop,
    a = loop.accessor,
    h = dialogAccess(a),
    events = loop.interval(0x80e382),
    Loop = side === 0 ? DispatchedLoop : MainLoopContinuation;
  yield () => runMainReset(a);
  yield* mainStartupSequence(h, events);
  yield* owner(h, events, routines);
  yield () => boundary('first owner');
  yield {
    continuation:
      side === 0
        ? dispatchedStart(a, events, routines)
        : mainStartContinuation(a, events, routines),
  };
  yield () => boundary('game start');
  yield {
    continuation: new Loop(a, { events, routines, returnToOwner: true }),
  };
  yield () => {
    assert.equal(a.ctx.pc, MAIN_LOOP_ROUND);
    a.pushWord(MAIN_LOOP_ROUND + 2);
  };
  yield { continuation: loop.round(ROUND) };
  yield () => {
    loop.closeInterval(events);
    game.memory.write16(0x7e0000 + request, 1);
  };
  const returning = loop.interval(0x8096c3);
  yield {
    continuation: new Loop(a, {
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
      `direct owner, game start and main loop match dispatch: session ${index}, budget ${budget}`,
      { timeout: 300000 },
      () => {
        // The no-input plan covers two attract games; then choose New Game.
        const plan = index === 0 ? [...originalPlan, ['press', 'b', 800]] : originalPlan;
        const pending = [new Map(), new Map()];
        const counts = { frames: 0, boundaries: 0 };
        const compare = (side, key, game) => {
          const mine = snapshot(game, typeof key === 'number'),
            other = pending[1 - side];
          if (!other.has(key)) pending[side].set(key, mine);
          else {
            compareSnapshots(mine, other.get(key), key);
            other.delete(key);
            if (typeof key === 'number') counts.frames++;
            else counts.boundaries++;
          }
        };
        const games = [0, 1].map((side) => {
          let driver,
            resumeAt = null;
          const game = new LiveGame(cartridge, {
            ...(side === 0 ? { loop: referenceLoop } : {}),
            sram: loadSave('apartment'),
            pad: (k) => {
              if (resumeAt !== null) return (k - resumeAt) % 40 < 6 ? 0x8000 : 0;
              driver ??= livePlanDriver(plan, game.memory.wram);
              return driver.pad(k);
            },
          });
          withSchedulerFrames(game.loop);
          const onNmi = game.frames.onNmi;
          game.frames.onNmi = (k) => {
            onNmi(k);
            compare(side, k, game);
          };
          const sequence = session(
            game,
            side === 0 ? registerOwner : gameOwnerSequence,
            side === 0 ? dispatchedRoutines : game.loop.routines,
            (key) => compare(side, key, game),
            () => (resumeAt = game.nmis),
            side,
            index % 2 ? MAIN_LOOP_RELOAD : MAIN_LOOP_EXIT,
          );
          game.loop.work = new NativeCallContinuation(game.loop.accessor, sequence);
          return game;
        });
        const done = [false, false];
        while (!done.every(Boolean))
          for (const [side, game] of games.entries()) {
            if (done[side]) continue;
            // Let the slower side catch up before retaining more full snapshots.
            // Each side keeps its work budget, and every frame is still compared.
            if (
              !done[1 - side] &&
              pending[side].size > MAX_PENDING_STATES &&
              pending[side].size > pending[1 - side].size
            )
              continue;
            game.loop.accessor.resetAccessBudget();
            done[side] = game.loop.work.run(budget) === WAIT_RETURNED;
            assert.ok(game.nmis < 20000, 'session must finish');
          }
        assert.equal(counts.boundaries, 4);
        assert.ok(counts.frames > 1000, `NMIs compared: ${counts.frames}`);
        assert.deepEqual([...pending[0].keys(), ...pending[1].keys()], []);
        compareSnapshots(snapshot(games[0]), snapshot(games[1]), 'final return');
      },
    );
