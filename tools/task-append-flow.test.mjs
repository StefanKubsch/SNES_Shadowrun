import test from 'node:test';
import assert from 'node:assert/strict';
import { startDialogScript } from '../src/game/dialog-text.mjs';
import { spellMenu } from '../src/game/member-spell-menu.mjs';
import { SPELL_SLOT_FIRST } from '../src/data/native-member-spell-menu.mjs';
import { JsTasks, tasksOf, argumentWords } from '../src/script/task-api.mjs';
import { Scheduler, NONE } from '../src/script/scheduler.mjs';
import { scriptInfo } from '../src/script/tasks.mjs';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { textWindowSide } from './text-window-caller-harness.mjs';
import * as W from '../src/data/wram.mjs';
import * as V from '../src/vm/layout.mjs';

const RECORD = 0x6000,
  RECORD_BANK = 0x7e,
  DP_RECORD = 0x11,
  DP_RECORD_BANK = 0x13,
  DP_OBJECT = 0x26,
  ACTION_OFFSET = 4,
  OBJECT = 0x40,
  SCRIPT = 0x80,
  OTHER_SCRIPT = 0x10f,
  STACK_START = 0x1e80,
  STACK_END = 0x1ef0,
  STEP_LIMIT = 10000,
  SCRIPT_VISIT = 0x80c1ca,
  FRAME_BRANCH = 0x81b0a9,
  SOUND_TABLE = 0x80c4b3,
  CONFIRM_SOUND = 0x4c,
  ENDED = 0xffff;

function fixture(js) {
  const side = textWindowSide(),
    { h, a, mem, events } = side;
  tasksOf(a).reset();
  if (js) a.tasks = new JsTasks(new Scheduler(mem));
  h.ctx.s = STACK_END - 1;
  const context = { ...h.ctx },
    stack = mem.wram.slice(STACK_START, STACK_END);
  const unchanged = () => {
    assert.deepEqual(h.ctx, context);
    assert.deepEqual(mem.wram.slice(STACK_START, STACK_END), stack);
  };
  const forbidden = () => assert.fail('direct task creation must not use CPU frames');
  h.push = h.pushByte = h.rts = h.rtl = a.pushWord = a.pullWord = forbidden;
  events.frameJobs = () => assert.fail('fixture services each live frame');
  events.valueRounds = true;
  return { ...side, unchanged, js };
}

function checkTask(side, script, args) {
  const { a, mem, js } = side,
    info = scriptInfo(mem, script);
  assert.equal(tasksOf(a).code(0), info.code);
  if (js) {
    const scheduler = a.tasks.scheduler;
    assert.equal(scheduler.head, 0);
    assert.equal(scheduler.slots[0].next, NONE);
    assert.equal(scheduler.free, 1, 'exactly one task was appended');
    assert.deepEqual(scheduler.slots[0].task.stack.slice().reverse(), args);
  } else {
    assert.equal(mem.read16(V.TASK_LIST_HEAD), 0);
    assert.equal(mem.read16(V.TASK_NEXT), ENDED);
    assert.equal(mem.read16(V.TASK_FREE_LIST), 2, 'exactly one task was appended');
    const frame = mem.read16(V.TASK_FRAME),
      top = mem.read16(frame + V.FRAME_OPERAND_STACK);
    assert.deepEqual(
      args.map((_, n) => mem.read16(top + 1 + 2 * n)),
      args,
    );
  }
}

function finish(side, sequence) {
  const runner = new SequenceRunner(sequence),
    before = side.mem.wram.slice();
  assert.equal(runner.run(0), WAIT_PAUSED);
  assert.deepEqual(side.mem.wram, before);
  let steps = 0;
  while (!runner.done) {
    runner.run(1);
    side.unchanged();
    assert.ok(++steps < STEP_LIMIT, 'bounded direct graph');
  }
  const completed = side.mem.wram.slice();
  runner.run(STEP_LIMIT);
  assert.deepEqual(side.mem.wram, completed);
}

for (const js of [false, true])
  for (const nested of [false, true])
    for (const script of [SCRIPT, OTHER_SCRIPT])
      test(`dialog task append preserves arguments and caller: JS ${js}, nested ${nested}, script ${script}`, () => {
        const side = fixture(js),
          { h, mem, put, events } = side;
        put(DP_RECORD, RECORD);
        mem.write8(DP_RECORD_BANK, RECORD_BANK);
        put(RECORD + ACTION_OFFSET, script);
        put(DP_OBJECT, OBJECT);
        let visits = 0;
        const expected = argumentWords(mem, script);
        if (expected.length) expected[0] = OBJECT;
        const visit = () => {
          side.unchanged();
          assert.equal(mem.read16(0), OBJECT);
          checkTask(side, script, expected);
          visits++;
        };
        if (nested)
          events.nestedRound = (target) => {
            assert.equal(target, SCRIPT_VISIT);
            return new SequenceRunner(
              (function* () {
                yield visit;
                yield () => checkTask(side, script, expected);
              })(),
            );
          };
        else
          events.round = (target) => {
            assert.equal(target, SCRIPT_VISIT);
            visit();
            return { wait: [script], input: [OBJECT] };
          };
        finish(side, startDialogScript(h, events, script));
        assert.equal(visits, 1);
        checkTask(side, script, expected);
        if (!nested) {
          assert.deepEqual(events.values, [script]);
          assert.deepEqual(events.inputs, [OBJECT]);
          assert.ok(Object.isFrozen(events.values) && Object.isFrozen(events.inputs));
        }
      });

for (const js of [false, true])
  test(`member spell graph appends before nested execution without CPU frames, JS ${js}`, () => {
    const side = fixture(js),
      { h, mem, put, events } = side;
    put(W.DP_MEMBER_RECORD, RECORD);
    mem.write8(W.DP_MEMBER_RECORD_BANK, RECORD_BANK);
    mem.wram[RECORD + SPELL_SLOT_FIRST] = 1;
    put(W.PLAYER_OBJECT, 2);
    put(W.MEMBER_OBJECT, OBJECT);
    put(W.WINDOW_ACTIVE, ENDED);
    put(W.SOUND_LOADED_SET, mem.read16(SOUND_TABLE + CONFIRM_SOUND));
    const service = events.interrupts.textWait,
      pads = [W.PAD_DOWN, 0, W.PAD_B];
    let input = 0,
      visits = 0;
    events.interrupts.textWait = (...args) => {
      side.unchanged();
      if (args[3] !== FRAME_BRANCH) return service(...args);
      assert.ok(input < pads.length);
      put(W.PAD_HELD, pads[input++]);
      put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
      return true;
    };
    events.nestedRound = (target) => {
      assert.equal(target, SCRIPT_VISIT);
      return new SequenceRunner(
        (function* () {
          yield () => {
            side.unchanged();
            const script = mem.read16(W.SPELL_MENU_SCRIPTS + 2);
            checkTask(side, script, argumentWords(mem, script));
            assert.equal(mem.read16(W.MEMBER_PORTRAIT_REDRAW), 0);
            visits++;
          };
          yield () => put(W.DIALOG_END, ENDED);
        })(),
      );
    };
    finish(side, spellMenu(h, events));
    assert.equal(visits, 1);
    assert.equal(input, pads.length);
    assert.equal(mem.read16(W.DIALOG_END), ENDED);
  });

for (const js of [false, true])
  test(`dialog task hook failure preserves caller and prevents a second append, JS ${js}`, () => {
    const side = fixture(js),
      { h, mem, put, events } = side,
      failure = new Error('visit failed');
    put(DP_RECORD, RECORD);
    mem.write8(DP_RECORD_BANK, RECORD_BANK);
    put(RECORD + ACTION_OFFSET, SCRIPT);
    put(DP_OBJECT, OBJECT);
    events.round = () => {
      throw failure;
    };
    const runner = new SequenceRunner(startDialogScript(h, events, SCRIPT));
    assert.throws(
      () => runner.run(STEP_LIMIT),
      (error) => error === failure,
    );
    side.unchanged();
    const args = argumentWords(mem, SCRIPT);
    checkTask(side, SCRIPT, args);
    assert.throws(
      () => runner.run(1),
      (error) => error.reason === 'native_call_failed',
    );
    checkTask(side, SCRIPT, args);
  });
