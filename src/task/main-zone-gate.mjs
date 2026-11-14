import { taskStop } from './plan.mjs';
import { appendScriptTask } from './task-append.mjs';
import { enterRoom } from './main-transition.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from './native-call-continuation.mjs';

import {
  PLAYER_OBJECT,
  OBJECT_X,
  OBJECT_Y,
  OBJECT_HEIGHT,
  DP_ZONE_LIST,
  DP_ZONE_X,
  DP_ZONE_Y,
  DP_ZONE_HEIGHT,
  DP_ZONE_LIST_INDEX,
  DP_ZONE_COUNT,
} from './wram.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';
// Bytes still to consume after the failed bound comparison, including the data word.
const ZONE_SKIP_BYTES = { xMin: 14, yMin: 12, zMin: 10, xMax: 8, yMax: 6, zMax: 4 };
const APPEND_RETURN_WORD = 0x80a7;
const ZONE_CHECK_ENTRY = 0x803b;
const ZONE_CHECK_CALL = 0x8029;
const ZONE_CHECK_RETURN_WORD = 0x802b;
const ZONE_CHECK_RESUME = ZONE_CHECK_RETURN_WORD + 1;
// Main loop $80:8000 with helper $803B: position of the player figure (slot $0CC2, words $0E28/$0E80/$0ED8 divided by 4
// to DP0E/11/14) against two zone lists from [$9D]. Each list starts with a count byte; each zone has six
// limit words (bottom x/y/z, top x/y/z) and a data word. If the figure lies in a zone of the first list (DP17 = 0),
// $C34A appends a task (X = data word, script ID) and the search continues; in the second list
// $A4BF starts the scene change with A = data word, then SEC/RTS. Without a player figure (slot negative) CLC/RTS.
// routines: call targets outside the own code, each with a real return frame: c34a
// takes the accessor, a4bf is the routine table entry of 80:A4BF (h, events, routines).
export const GATE_ROUTINES = {
  c34a: (a) => appendScriptTask(a, false),
  a4bf: enterRoom,
};
export function checkPlayerZones(h, events, routines = GATE_ROUTINES) {
  return drainNativeSequence(mainGateSequence(h, events, routines));
}
function* mainGateSequence(h, events, routines) {
  const { a, ctx } = h;
  const transition = new Map([[0x80a4bf, routines.a4bf]]);
  const clc = () => {
      ctx.status &= ~FLAG_CARRY;
    },
    sec = () => {
      ctx.status |= FLAG_CARRY;
    };
  const zone = () => h.read(h.indirect(DP_ZONE_LIST, ctx.y));
  const iny = () => h.index('y', ctx.y + 1);
  // $803B: check the zones of the current list, counter DP1A.
  const zones = function* () {
    for (;;) {
      yield () => h.modify(DP_ZONE_COUNT, 'dec', true);
      if (ctx.status & FLAG_NEGATIVE) {
        yield () => {
          clc();
          h.rts();
        };
        return;
      }
      // Bottom: DP value >= limit, top: limit >= DP value; otherwise skip the remaining words of the zone.
      let skip = 0;
      yield () => {
        h.load(h.dp(DP_ZONE_X));
        h.cmp(zone());
        if (!(ctx.status & FLAG_CARRY)) skip = ZONE_SKIP_BYTES.xMin;
        else {
          iny();
          iny();
          h.load(h.dp(DP_ZONE_Y));
          h.cmp(zone());
          if (!(ctx.status & FLAG_CARRY)) skip = ZONE_SKIP_BYTES.yMin;
          else {
            iny();
            iny();
            h.load(h.dp(DP_ZONE_HEIGHT));
            h.cmp(zone());
            if (!(ctx.status & FLAG_CARRY)) skip = ZONE_SKIP_BYTES.zMin;
            else {
              iny();
              iny();
              h.load(zone());
              h.cmp(h.dp(DP_ZONE_X));
              if (!(ctx.status & FLAG_CARRY)) skip = ZONE_SKIP_BYTES.xMax;
              else {
                iny();
                iny();
                h.load(zone());
                h.cmp(h.dp(DP_ZONE_Y));
                if (!(ctx.status & FLAG_CARRY)) skip = ZONE_SKIP_BYTES.yMax;
                else {
                  iny();
                  iny();
                  h.load(zone());
                  h.cmp(h.dp(DP_ZONE_HEIGHT));
                  if (!(ctx.status & FLAG_CARRY)) skip = ZONE_SKIP_BYTES.zMax;
                }
              }
            }
          }
        }
      };
      if (skip) {
        yield () => {
          h.load(ctx.y);
          h.adc(skip);
          h.index('y', ctx.a);
        };
        continue;
      }
      // $8099: hit.
      yield () => {
        iny();
        iny();
        h.load(h.dp(DP_ZONE_LIST_INDEX));
      };
      if (!(ctx.status & FLAG_ZERO)) {
        yield () => h.load(zone());
        yield* nativeCallSequence(h, events, transition, 0x8080ad, 0x80a4bf, false, false);
        yield () => {
          sec();
          h.rts();
        };
        return;
      }
      yield () => {
        h.load(zone());
        h.index('x', ctx.a);
        iny();
        iny();
        h.phy();
        a.pushWord(APPEND_RETURN_WORD);
        const append = routines.c34a(a);
        if (append.rawReturnWord !== APPEND_RETURN_WORD)
          taskStop('task_native_helper_return_required', {
            actual: append.rawReturnWord,
            expected: APPEND_RETURN_WORD,
          });
        h.ply();
      };
    }
  };
  let result;
  yield () => h.index('y', h.read(h.abs(PLAYER_OBJECT)));
  if (ctx.status & FLAG_NEGATIVE) {
    yield () => {
      clc();
      result = h.rts();
    };
    return result;
  }
  yield () => {
    h.load(h.read(h.abs(OBJECT_X + ctx.y)));
    h.lsr();
    h.lsr();
    h.dpWrite(DP_ZONE_X, ctx.a);
    h.load(h.read(h.abs(OBJECT_Y + ctx.y)));
    h.lsr();
    h.lsr();
    h.dpWrite(DP_ZONE_Y, ctx.a);
    h.load(h.read(h.abs(OBJECT_HEIGHT + ctx.y)));
    h.lsr();
    h.lsr();
    h.dpWrite(DP_ZONE_HEIGHT, ctx.a);
    h.index('y', 0);
    h.dpWrite(DP_ZONE_LIST_INDEX, 0);
  };
  for (;;) {
    yield () => {
      h.load(zone());
      iny();
      h.load(ctx.a & BYTE_MASK);
    };
    if (!(ctx.status & FLAG_ZERO)) {
      yield () => {
        h.dpWrite(DP_ZONE_COUNT, ctx.a);
        a.pushWord(ZONE_CHECK_RETURN_WORD);
        ctx.pc = ZONE_CHECK_ENTRY;
      };
      yield* zones();
      yield () => {
        if (ctx.programBank !== CODE_BANK || ctx.pc !== ZONE_CHECK_RESUME)
          taskStop('task_native_helper_return_required', {
            pc: ZONE_CHECK_CALL,
            target: 0x80803b,
            bank: ctx.programBank,
            returnPc: ctx.pc,
          });
      };
      if (ctx.status & FLAG_CARRY) {
        yield () => {
          result = h.rts();
        };
        return result;
      }
    }
    yield () => {
      h.load(h.dp(DP_ZONE_LIST_INDEX));
      h.load(ctx.a + 1);
      h.dpWrite(DP_ZONE_LIST_INDEX, ctx.a);
      h.cmp(1);
    };
    if (!(ctx.status & FLAG_ZERO)) break;
  }
  yield () => {
    clc();
    result = h.rts();
  };
  return result;
}
NATIVE_CALL_CONTINUATIONS.set(0x808000, {
  run: checkPlayerZones,
  // gateRoutines: other call targets for proofs (the register-level room entry).
  create: ({ h, events, gateRoutines = GATE_ROUTINES }) =>
    new NativeCallContinuation(h.a, mainGateSequence(h, events, gateRoutines)),
});
