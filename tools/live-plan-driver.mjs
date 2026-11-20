// Drive a recorded Mesen route with one pad word per native live NMI. Commands
// steer the glove or player towards a target; optional round counts use main loop
// returns instead of NMIs so original lag frames do not change the route.
// Each completed command records its NMI, player slot, position and round count.
import { readStateWord, readStateByte } from '../src/state/objects.mjs';
import { PLAYER_OBJECT, OBJECT_X, OBJECT_Y, GLOVE_X, GLOVE_Y } from '../src/data/wram.mjs';
import { BYTE_MASK, WORD_SIGN } from '../src/constants/bits.mjs';

const PRESS_FRAMES = 6,
  DEFAULT_PRESS_LENGTH = 12,
  SCENE_JUMP_DISTANCE = 32,
  WALK_TIMEOUT = 2000,
  AIM_TIMEOUT = 120,
  GLOVE_TIMEOUT = 600,
  STEERING_COLUMNS = 3,
  THIRD_ARGUMENT = 3,
  FOURTH_ARGUMENT = 4,
  FIFTH_ARGUMENT = 5;
const BITS = {
  b: 0x8000,
  y: 0x4000,
  select: 0x2000,
  start: 0x1000,
  up: 0x0800,
  down: 0x0400,
  left: 0x0200,
  right: 0x0100,
  a: 0x80,
  x: 0x40,
  l: 0x20,
  r: 0x10,
};
// Player world axes: up+left adds X, down+right subtracts X; up+right adds Y, down+left subtracts Y.
const STEER = [
  BITS.down,
  BITS.down | BITS.right,
  BITS.right,
  BITS.down | BITS.left,
  0,
  BITS.up | BITS.right,
  BITS.left,
  BITS.up | BITS.left,
  BITS.up,
];
const keys = (text) => text.split('+').reduce((word, key) => word | BITS[key], 0);
export function livePlanDriver(plan, wram, rounds = () => 0) {
  let index = 0,
    start = null,
    startRounds = 0,
    jumped = false,
    last = null;
  const pads = [],
    ends = [],
    word = (at) => readStateWord(wram, at);
  const player = () => {
    const slot = word(PLAYER_OBJECT);
    return slot < WORD_SIGN ? [word(OBJECT_X + slot) >> 2, word(OBJECT_Y + slot) >> 2] : null;
  };
  const step = (k) => {
    for (;;) {
      const command = plan[index];
      if (!command) return 0;
      if (start === null) {
        start = k;
        startRounds = rounds();
      }
      const t = k - start,
        [kind] = command;
      let input = 0,
        done = false;
      const r = rounds() - startRounds;
      if (kind === 'hold') {
        input = t < command[2] ? keys(command[1]) : 0;
        done = t + 1 >= command[2];
      } else if (kind === 'press') {
        input = t < PRESS_FRAMES ? keys(command[1]) : 0;
        done =
          command[THIRD_ARGUMENT] === undefined
            ? t + 1 >= (command[2] ?? DEFAULT_PRESS_LENGTH)
            : t >= PRESS_FRAMES && r >= command[THIRD_ARGUMENT];
      } else if (kind === 'wait')
        done = command[2] === undefined ? t + 1 >= command[1] : r >= command[2];
      else if (kind === 'walk' || kind === 'exit') {
        const p = player();
        if (t === 0) {
          jumped = false;
          last = p;
        }
        if (
          p &&
          last &&
          (Math.abs(p[0] - last[0]) > SCENE_JUMP_DISTANCE ||
            Math.abs(p[1] - last[1]) > SCENE_JUMP_DISTANCE)
        )
          jumped = true;
        if (p) last = p;
        if (t > WALK_TIMEOUT) throw Error(`${kind} target not reached: command ${index} at ${p}`);
        if (kind === 'exit') jumped ? (done = true) : (input = keys(command[1]));
        else if (p) {
          const sx = Math.sign(command[2] - p[0]),
            sy = Math.sign(command[THIRD_ARGUMENT] - p[1]);
          if (!sx && !sy) done = true;
          else input = STEER[(sx + 1) * STEERING_COLUMNS + sy + 1];
        }
      } else if (kind === 'glove' || kind === 'aim') {
        const x = readStateByte(wram, GLOVE_X + 1),
          y = readStateByte(wram, GLOVE_Y + 1);
        const [tx, ty] =
          kind === 'glove'
            ? [command[1], command[2]]
            : [
                ((word(command[2]) >> 2) + command[FOURTH_ARGUMENT]) & BYTE_MASK,
                ((word(command[THIRD_ARGUMENT]) >> 2) + command[FIFTH_ARGUMENT]) & BYTE_MASK,
              ];
        if ((Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1) || (kind === 'aim' && t > AIM_TIMEOUT))
          done = true;
        else {
          if (t > GLOVE_TIMEOUT)
            throw Error(`glove target not reached: command ${index} at ${x},${y}`);
          if (x < tx - 1) input |= BITS.right;
          else if (x > tx + 1) input |= BITS.left;
          if (y < ty - 1) input |= BITS.down;
          else if (y > ty + 1) input |= BITS.up;
        }
      } else throw Error('unknown plan command ' + kind);
      if (done) {
        const slot = word(PLAYER_OBJECT) & (WORD_SIGN - 1);
        ends[index] = [
          k,
          word(PLAYER_OBJECT),
          word(OBJECT_X + slot),
          word(OBJECT_Y + slot),
          rounds(),
        ];
        index++;
        start = null;
        if (kind !== 'hold' && kind !== 'press' && kind !== 'wait') continue;
      }
      return input;
    }
  };
  return {
    pads,
    ends,
    pad: (k) => {
      pads[k] ??= step(k);
      return pads[k];
    },
    done: () => index >= plan.length,
  };
}
