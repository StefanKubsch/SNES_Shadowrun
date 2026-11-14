import { taskStop } from '../../src/task/plan.mjs';
import { randomBelow, randomBelowLong } from '../../src/task/native-random.mjs';
export { randomBelowLong };
import { routineCaller } from '../../src/task/routine-call.mjs';
import { setCarry } from '../../src/task/status-flags.mjs';
import { stepMatrixState } from './main-matrix-movement.mjs';
import { protectedJakeHealth } from '../../src/game/cheats.mjs';

import { MAP_ROW_WORDS, TEXT_BUFFER, TILE_NUMBER_MASK } from './main-scene-matrix.mjs';
import {
  DP_MAP,
  DP_OBJECT_KIND,
  DP_OBJECT_X,
  DP_OBJECT_Y,
  DP_OPENED,
  GRID_MASK,
  MATRIX_BITS,
  MATRIX_MAP_STEPS,
  MATRIX_SIDE_KINDS,
  MATRIX_SIDE_OFFSETS,
  MATRIX_SIDE_VALUES,
  MATRIX_SIDE_X,
  MATRIX_SIDE_Y,
  MATRIX_TILE_STEPS,
  NODE_COSTS_HEALTH,
  SIDES_BYTES,
  TILE_PIXELS,
} from './main-matrix-objects.mjs';
import {
  DECKER_COMPUTER_SKILL,
  DECKER_RECORD,
  MATRIX_ANIMATION,
  MATRIX_ANIMATION_CLOCK,
  MATRIX_ANIMATION_STEP,
  MATRIX_BLINK,
  MATRIX_CPU_BITS,
  MATRIX_DATA_BITS,
  MATRIX_DIRECTION,
  MATRIX_DOWNLOAD_BITS,
  MATRIX_FOUGHT_IC,
  MATRIX_HEALTH,
  MATRIX_IC_COUNTED,
  MATRIX_MEMORY,
  MATRIX_MEMORY_LIMIT,
  MATRIX_OBJECT_ANIMATING,
  MATRIX_OBJECT_FLAGS,
  MATRIX_PERSONA_X,
  MATRIX_PERSONA_Y,
  MATRIX_SPEED_X,
  MATRIX_SPEED_Y,
  MATRIX_STATE,
  MATRIX_STATE_CLOCK,
  MATRIX_STATE_CONTROL,
  MATRIX_STATE_FRAMES,
  MATRIX_STATE_HIT,
  PAD_A,
  PAD_B,
  PAD_PRESSED,
} from '../../src/task/wram.mjs';
import { BYTE_MASK, WORD_BITS, WORD_MASK } from '../../src/constants/bits.mjs';
import { FLAG_CARRY, FLAG_ZERO, FLAG_NEGATIVE } from '../../src/constants/cpu-flags.mjs';
import {
  APU_COMMAND_SOUND,
  APU_COMMAND_SOUND_LEVEL,
  APU_COMMAND_SOUND_VOICES,
} from '../../src/constants/sound-commands.mjs';
// Matrix control and actions, with real inner frames and fresh table reads.
// Waits, NMI callbacks and PPU values retain their separate contracts.

// Bank 81 tables (meanings in src/data/tables.mjs): damage range per IC, the step back
// after damage, one tile ahead, the memory cost of the nodes 10-17 and 18-1F and the
// eight neighbours that 81:B959 counts. The side, bit and step tables live in
// main-matrix-objects.mjs.
const MATRIX_DAMAGE = 0x81ba3e,
  MATRIX_PUSH_X = 0x81ba50,
  MATRIX_PUSH_Y = 0x81ba60,
  MATRIX_AHEAD_X = 0x81c23c,
  MATRIX_AHEAD_Y = 0x81c24c,
  MATRIX_AMOUNTS_10 = 0x81c330,
  MATRIX_AMOUNTS_18 = 0x81c396,
  MATRIX_NEIGHBOUR_OFFSETS = 0x81b9c0;
const NEIGHBOUR_LAST = 0xe;
// Matrix texts that 81:B282 queues (X address, Y bank; src/data/matrix-texts.mjs).
const QUEUE_TEXT = 0x81b282,
  TEXT_ATTACKED = 0x81c5c0, // ATTACKED BY IC
  TEXT_COMBAT = 0x81c5d2, // EXEC. COMBAT.EXE
  TEXT_COMBAT_WON = 0x81c5e6, // COMBAT SUCCESSFUL
  TEXT_COMBAT_LOST = 0x81c5fb, // COMBAT FAILED!
  TEXT_TRANSFER = 0x81c642, // EXEC. TRANSFER.EXE
  TEXT_PHONEBOOK = 0x81c658, // PHONEBOOK RECEIVED.
  TEXT_DATA_RECEIVED = 0x81c66f, // DATA RECEIVED.
  TEXT_PROGRAM_MODIFIED = 0x81c681, // PROGRAM MODIFIED.
  TEXT_GUARD_DESTROYED = 0x81c696, // GUARD IC DESTROYED...
  TEXT_LINES_OPENED = 0x81c6b1, // LINES OPENED..
  TEXT_PASSWORD = 0x81c6c3, // PASSWORD NEEDED..
  TEXT_OUT_OF_STORAGE = 0x81c6d8; // ERROR : OUT OF STORAGE
// Map values (docs/ROM-FREE.md "Matrix rules seen"): IC 08-0F;
// data nodes 10-17 and 18-1F; the CPU node 20 with gates, 21-27 need a password; a data
// node 10-17 taken becomes 40, B on 40 makes 41 (guard IC destroyed), a download 42.
// Map words written to VRAM carry palette 4 (BG tile word bits 10-12).
const IC_FIRST = 8,
  IC_END = 0x10,
  DATA_FIRST = 0x10,
  DATA_END = 0x18,
  DOWNLOAD_FIRST = 0x18,
  DOWNLOAD_END = 0x20,
  NODE_CPU = 0x20,
  PASSWORD_FIRST = 0x21,
  CPU_END = 0x28,
  NODE_DATA_TAKEN = 0x40,
  NODE_GUARD_DOWN = 0x41,
  NODE_DOWNLOADED = 0x42,
  NODE_PALETTE = 0x1000;
const MAP_ROW_BYTES = MAP_ROW_WORDS * 2;
// COMBAT.EXE wins when a draw of 0-6 lies below the Computer skill. An IC strike sets the
// hit state for 15 blink steps and plays sound 12 through 81:B1C6.
const COMBAT_RANGE = 7,
  HIT_BLINK_STEPS = 0xf,
  IC_ATTACK_SOUND = 0x12;
// Memory: at most 40 (64, the gauge width); the CPU nodes 20-27 cost 0A.
const MEMORY_MAX = 0x40,
  CPU_PROGRAM_MEMORY = 0xa;
// 81:B959 writes the IC count as a digit over the X of "FOUND X IC!" (byte 8 of the
// copy) and plays sound 16 on voices 0-3 at full level, its high byte 50 + 2 per IC.
const DIGIT_ZERO_AND_SPACE = 0x2030,
  FOUND_IC_DIGIT = TEXT_BUFFER + 8,
  FOUND_IC_VOICES = 0xf,
  FOUND_IC_LEVELS = 0x7f7f,
  FOUND_IC_SOUND_BASE = 0x50,
  FOUND_IC_SOUND = 0x16;
// Direct page: 80:F2A8 draws below DP00 and returns the draw there.
const DP_RANDOM = 0,
  DP_DAMAGE = 0xe,
  DP_SKILL = 0xe,
  DP_ICS = 0xe;
// 81:B71F: IC destroyed, the area's left X, current X and Y, columns and rows.
const DP_CLEARED = 0xe,
  DP_LEFT_X = 0x10,
  DP_X = 0x12,
  DP_Y = 0x14,
  DP_COLUMNS = 0x16,
  DP_ROWS = 0x18;
// 81:B1B5: subtract the damage in A from the matrix health, not below zero.
function subtractMatrixHealth(h) {
  h.dpWrite(DP_DAMAGE, h.ctx.a);
  setCarry(h, true);
  h.load(h.read(h.abs(MATRIX_HEALTH)));
  h.sbc(h.dp(DP_DAMAGE));
  if (!(h.ctx.status & FLAG_CARRY)) h.load(0);
  if (h.a.vm?.cheats) h.load(protectedJakeHealth(h.a, h.read(h.abs(DECKER_RECORD)), h.ctx.a));
  h.write(h.abs(MATRIX_HEALTH), h.ctx.a);
  return h.rts();
}
// 81:B8AD: start persona animation A unless it is already running.
function setPersonaAnimation(h) {
  const { ctx } = h;
  h.cmp(h.read(h.abs(MATRIX_ANIMATION)));
  if (!(ctx.status & FLAG_ZERO)) {
    h.write(h.abs(MATRIX_ANIMATION), ctx.a);
    h.write(h.abs(MATRIX_ANIMATION_STEP), 0);
    h.load(1);
    h.write(h.abs(MATRIX_ANIMATION_CLOCK), ctx.a);
    h.load(h.read(h.abs(MATRIX_OBJECT_FLAGS)));
    h.load(ctx.a | MATRIX_OBJECT_ANIMATING);
    h.write(h.abs(MATRIX_OBJECT_FLAGS), ctx.a);
  }
  return h.rts();
}
// 81:B609: add a gate object at each side of the persona whose map tile matches the side value;
// returns their count.
function openGatesAroundPersona(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.dpWrite(DP_OPENED, 0);
  h.index('x', 0);
  h.index('y', 0);
  do {
    h.load(h.read(h.abs(MATRIX_SIDE_OFFSETS & WORD_MASK) + ctx.y));
    call(0x81b614, 0x81b69d);
    h.cmp(h.read(h.abs(MATRIX_SIDE_VALUES & WORD_MASK) + ctx.y));
    if (ctx.status & FLAG_ZERO) {
      h.modify(DP_OPENED, 'inc', true);
      setCarry(h, false);
      h.load(h.read(h.abs(MATRIX_PERSONA_X)));
      h.adc(h.read(h.abs(MATRIX_SIDE_X & WORD_MASK) + ctx.y));
      h.dpWrite(DP_OBJECT_X, ctx.a);
      setCarry(h, false);
      h.load(h.read(h.abs(MATRIX_PERSONA_Y)));
      h.adc(h.read(h.abs(MATRIX_SIDE_Y & WORD_MASK) + ctx.y));
      h.dpWrite(DP_OBJECT_Y, ctx.a);
      h.load(h.read(h.abs(MATRIX_SIDE_KINDS & WORD_MASK) + ctx.y));
      h.dpWrite(DP_OBJECT_KIND, ctx.a);
      call(0x81b635, 0x81b8c8);
    }
    h.index('y', ctx.y + 1);
    h.index('y', ctx.y + 1);
    h.cpy(SIDES_BYTES);
  } while (!(ctx.status & FLAG_ZERO));
  h.load(h.dp(DP_OPENED));
  return h.rts();
}
// 81:B71F: find the room around the persona and add an object for each IC tile in it; returns their count.
export function placeRoomIcObjects(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.dpWrite(DP_CLEARED, 0);
  h.index('x', 0);
  h.load(0);
  call(0x81b727, 0x81b66a);
  h.load(h.read(h.abs(MATRIX_PERSONA_X)));
  h.dpWrite(DP_X, ctx.a);
  h.load(h.read(h.abs(MATRIX_PERSONA_Y)));
  h.dpWrite(DP_Y, ctx.a);
  const edge = () => {
    h.load(h.read(h.indirect(DP_MAP)));
    h.load(ctx.a & TILE_NUMBER_MASK);
    for (const v of [0, 1, 2]) {
      h.cmp(v);
      if (ctx.status & FLAG_ZERO) return true;
    }
    return false;
  };
  while (!edge()) {
    h.modify(DP_MAP, 'dec', true);
    h.modify(DP_MAP, 'dec', true);
    setCarry(h, true);
    h.load(h.dp(DP_X));
    h.sbc(TILE_PIXELS);
    h.dpWrite(DP_X, ctx.a);
  }
  h.modify(DP_MAP, 'inc', true);
  h.modify(DP_MAP, 'inc', true);
  setCarry(h, false);
  h.load(h.dp(DP_X));
  h.adc(TILE_PIXELS);
  h.dpWrite(DP_X, ctx.a);
  while (!edge()) {
    setCarry(h, true);
    h.load(h.dp(DP_MAP));
    h.sbc(MAP_ROW_BYTES);
    h.dpWrite(DP_MAP, ctx.a);
    setCarry(h, true);
    h.load(h.dp(DP_Y));
    h.sbc(TILE_PIXELS);
    h.dpWrite(DP_Y, ctx.a);
  }
  setCarry(h, false);
  h.load(h.dp(DP_MAP));
  h.adc(MAP_ROW_BYTES);
  h.dpWrite(DP_MAP, ctx.a);
  setCarry(h, false);
  h.load(h.dp(DP_Y));
  h.adc(TILE_PIXELS);
  h.dpWrite(DP_Y, ctx.a);
  h.dpWrite(DP_COLUMNS, 0);
  h.index('y', 0);
  for (;;) {
    h.load(h.read(h.indirect(DP_MAP, ctx.y)));
    h.load(ctx.a & TILE_NUMBER_MASK);
    h.cmp(0);
    if (ctx.status & FLAG_ZERO) break;
    h.index('y', ctx.y + 1);
    h.index('y', ctx.y + 1);
    h.modify(DP_COLUMNS, 'inc', true);
  }
  h.dpWrite(DP_ROWS, 0);
  h.index('y', 0);
  for (;;) {
    h.load(h.read(h.indirect(DP_MAP, ctx.y)));
    h.load(ctx.a & TILE_NUMBER_MASK);
    h.cmp(0);
    if (ctx.status & FLAG_ZERO) break;
    h.load(ctx.y);
    setCarry(h, false);
    h.adc(MAP_ROW_BYTES);
    h.index('y', ctx.a);
    h.modify(DP_ROWS, 'inc', true);
  }
  h.load(h.dp(DP_X));
  h.dpWrite(DP_LEFT_X, ctx.a);
  do {
    h.load(h.dp(DP_LEFT_X));
    h.dpWrite(DP_X, ctx.a);
    h.index('y', 0);
    h.index('x', h.dp(DP_COLUMNS, 2));
    do {
      h.load(h.read(h.indirect(DP_MAP, ctx.y)));
      h.load(ctx.a & TILE_NUMBER_MASK);
      h.cmp(IC_FIRST);
      if (ctx.status & FLAG_CARRY) {
        h.cmp(IC_END);
        if (!(ctx.status & FLAG_CARRY)) {
          h.load(h.dp(DP_X));
          h.dpWrite(DP_OBJECT_X, ctx.a);
          h.load(h.dp(DP_Y));
          h.dpWrite(DP_OBJECT_Y, ctx.a);
          h.load(2);
          h.dpWrite(DP_OBJECT_KIND, ctx.a);
          call(0x81b7ef, 0x81b8c8);
          h.modify(DP_CLEARED, 'inc', true);
        }
      }
      setCarry(h, false);
      h.load(h.dp(DP_X));
      h.adc(TILE_PIXELS);
      h.dpWrite(DP_X, ctx.a);
      h.index('y', ctx.y + 1);
      h.index('y', ctx.y + 1);
      h.index('x', ctx.x - 1);
    } while (!(ctx.status & FLAG_ZERO));
    setCarry(h, false);
    h.load(h.dp(DP_MAP));
    h.adc(MAP_ROW_BYTES);
    h.dpWrite(DP_MAP, ctx.a);
    setCarry(h, false);
    h.load(h.dp(DP_Y));
    h.adc(TILE_PIXELS);
    h.dpWrite(DP_Y, ctx.a);
    h.modify(DP_ROWS, 'dec', true);
  } while (!(ctx.status & FLAG_ZERO));
  h.load(h.dp(DP_CLEARED));
  return h.rts();
}
// 81:B959: count the IC around the persona and announce them once with text and sound.
function announceNearbyIcs(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.dpWrite(DP_ICS, 0);
  h.index('x', 0);
  h.index('y', NEIGHBOUR_LAST);
  do {
    h.load(h.read(h.abs(MATRIX_NEIGHBOUR_OFFSETS & WORD_MASK) + ctx.y));
    call(0x81b964, 0x81b69d);
    h.cmp(IC_FIRST);
    if (ctx.status & FLAG_CARRY) {
      h.cmp(IC_END);
      if (!(ctx.status & FLAG_CARRY)) h.modify(DP_ICS, 'inc', true);
    }
    h.index('y', ctx.y - 1);
    h.index('y', ctx.y - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.index('y', h.dp(DP_ICS, 2));
  h.cpy(0);
  if (ctx.status & FLAG_ZERO) return h.rts();
  h.load(h.read(h.abs(MATRIX_IC_COUNTED)));
  if (!(ctx.status & FLAG_ZERO)) return h.rts();
  h.load(ctx.y);
  setCarry(h, false);
  h.adc(DIGIT_ZERO_AND_SPACE);
  h.write(FOUND_IC_DIGIT, ctx.a);
  h.index('x', TEXT_BUFFER & WORD_MASK);
  h.index('y', TEXT_BUFFER >>> WORD_BITS);
  call(0x81b992, 0x81b282);
  h.modify(h.abs(MATRIX_IC_COUNTED), 'inc');
  h.index('x', FOUND_IC_VOICES);
  h.load(APU_COMMAND_SOUND_VOICES);
  call(0x81b99e, 0x81f007, true);
  h.index('x', FOUND_IC_LEVELS);
  h.load(APU_COMMAND_SOUND_LEVEL);
  call(0x81b9a8, 0x81f007, true);
  h.load(h.dp(DP_ICS));
  h.asl();
  setCarry(h, false);
  h.adc(FOUND_IC_SOUND_BASE);
  h.xba();
  h.load(ctx.a | FOUND_IC_SOUND);
  h.index('x', ctx.a);
  h.load(APU_COMMAND_SOUND);
  call(0x81b9bb, 0x81f007, true);
  return h.rts();
}
// 81:B9D0: when the persona stands on IC, take random damage, push it back, start the hit state and
// show the attack text.
function takeIcAttack(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.index('x', 0);
  h.load(0);
  call(0x81b9d6, 0x81b69d);
  h.cmp(IC_FIRST);
  if (!(ctx.status & FLAG_CARRY)) return h.rts();
  h.cmp(IC_END);
  if (ctx.status & FLAG_CARRY) return h.rts();
  h.write(h.abs(MATRIX_IC_COUNTED), 0);
  setCarry(h, true);
  h.sbc(IC_FIRST);
  h.asl();
  h.index('y', ctx.a);
  h.load(h.read(h.abs(MATRIX_DAMAGE & WORD_MASK) + ctx.y));
  h.dpWrite(DP_RANDOM, ctx.a);
  call(0x81b9f2, 0x80f2a8, true);
  h.load(h.dp(DP_RANDOM));
  h.load(ctx.a + 1);
  call(0x81b9f9, 0x81b1b5);
  h.index('y', h.read(h.abs(MATRIX_DIRECTION), 2));
  h.load(h.read(h.abs(MATRIX_PERSONA_X)));
  setCarry(h, false);
  h.adc(h.read(h.abs(MATRIX_PUSH_X & WORD_MASK) + ctx.y));
  h.write(h.abs(MATRIX_PERSONA_X), ctx.a);
  h.load(h.read(h.abs(MATRIX_PERSONA_Y)));
  setCarry(h, false);
  h.adc(h.read(h.abs(MATRIX_PUSH_Y & WORD_MASK) + ctx.y));
  h.write(h.abs(MATRIX_PERSONA_Y), ctx.a);
  h.load(1);
  h.write(h.abs(MATRIX_STATE_CLOCK), ctx.a);
  h.write(h.abs(MATRIX_STATE_FRAMES), ctx.a);
  h.load(MATRIX_STATE_HIT);
  h.write(h.abs(MATRIX_STATE), ctx.a);
  h.load(HIT_BLINK_STEPS);
  h.write(h.abs(MATRIX_BLINK), ctx.a);
  h.write(h.abs(MATRIX_SPEED_X), 0);
  h.write(h.abs(MATRIX_SPEED_Y), 0);
  h.index('x', TEXT_ATTACKED & WORD_MASK);
  h.index('y', TEXT_ATTACKED >>> WORD_BITS);
  call(0x81ba34, 0x81b282);
  h.load(IC_ATTACK_SOUND);
  call(0x81ba3a, 0x81b1c6);
  return h.rts();
}

// 81:C108: queue the combat text (tail jump into 81:B282).
function queueCombatText(h, e, r) {
  h.index('x', TEXT_COMBAT & WORD_MASK);
  h.index('y', TEXT_COMBAT >>> WORD_BITS);
  const run = r.get(0x81b282);
  if (!run) taskStop('main_loop_frontier', { target: 0x81b282 });
  h.ctx.pc = QUEUE_TEXT & WORD_MASK;
  return run(h, e, r);
}
// 81:C111: on a grid point in the control state, B acts on the node ahead: health cost, CPU gates,
// password check, IC combat or a destroyed guard.
function useNodeAhead(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.load(h.read(h.abs(MATRIX_STATE)));
  h.cmp(MATRIX_STATE_CONTROL);
  if (!(ctx.status & FLAG_ZERO)) return h.rts();
  h.load(h.read(h.abs(MATRIX_PERSONA_X)));
  h.load(ctx.a & GRID_MASK);
  if (!(ctx.status & FLAG_ZERO)) return h.rts();
  h.load(h.read(h.abs(MATRIX_PERSONA_Y)));
  h.load(ctx.a & GRID_MASK);
  if (!(ctx.status & FLAG_ZERO)) return h.rts();
  h.load(h.read(h.abs(PAD_PRESSED)));
  h.load(ctx.a & PAD_B);
  if (ctx.status & FLAG_ZERO) return h.rts();
  h.index('x', 0);
  h.index('y', h.read(h.abs(MATRIX_DIRECTION), 2));
  h.load(h.read(h.abs(MATRIX_MAP_STEPS & WORD_MASK) + ctx.y));
  call(0x81c13a, 0x81b69d);
  h.cmp(NODE_COSTS_HEALTH);
  if (ctx.status & FLAG_ZERO) {
    h.load(1);
    call(0x81c145, 0x81b1b5);
    return h.rts();
  }
  h.cmp(NODE_CPU);
  if (ctx.status & FLAG_ZERO) {
    call(0x81c171, 0x81b609);
    if (!(ctx.status & FLAG_ZERO)) {
      call(0x81c176, 0x81c108);
      h.index('x', TEXT_LINES_OPENED & WORD_MASK);
      h.index('y', TEXT_LINES_OPENED >>> WORD_BITS);
      call(0x81c17f, 0x81b282);
    }
    return h.rts();
  }
  h.cmp(PASSWORD_FIRST);
  if (ctx.status & FLAG_CARRY) {
    h.cmp(CPU_END);
    if (!(ctx.status & FLAG_CARRY)) {
      setCarry(h, true);
      h.sbc(NODE_CPU);
      h.asl();
      h.index('x', ctx.a);
      h.load(h.read(h.abs(MATRIX_CPU_BITS)));
      h.load(ctx.a & h.read(MATRIX_BITS + ctx.x));
      if (ctx.status & FLAG_ZERO) {
        h.index('x', TEXT_PASSWORD & WORD_MASK);
        h.index('y', TEXT_PASSWORD >>> WORD_BITS);
        call(0x81c16d, 0x81b282);
      }
      return h.rts();
    }
  }
  h.cmp(IC_FIRST);
  if (ctx.status & FLAG_CARRY) {
    h.cmp(IC_END);
    if (!(ctx.status & FLAG_CARRY)) {
      h.write(h.abs(MATRIX_FOUGHT_IC), ctx.a);
      call(0x81c190, 0x81c108);
      h.load(COMBAT_RANGE);
      h.dpWrite(DP_RANDOM, ctx.a);
      call(0x81c198, 0x80f2a8, true);
      h.load(h.read(h.abs(DECKER_COMPUTER_SKILL)));
      h.load(ctx.a & BYTE_MASK);
      h.dpWrite(DP_SKILL, ctx.a);
      h.load(h.dp(DP_RANDOM));
      setCarry(h, true);
      h.sbc(h.dp(DP_SKILL));
      if (ctx.status & FLAG_NEGATIVE) {
        h.index('y', h.read(h.abs(MATRIX_DIRECTION), 2));
        h.load(h.read(h.abs(MATRIX_PERSONA_X)));
        setCarry(h, false);
        h.adc(h.read(h.abs(MATRIX_AHEAD_X & WORD_MASK) + ctx.y));
        h.dpWrite(DP_OBJECT_X, ctx.a);
        h.load(h.read(h.abs(MATRIX_PERSONA_Y)));
        setCarry(h, false);
        h.adc(h.read(h.abs(MATRIX_AHEAD_Y & WORD_MASK) + ctx.y));
        h.dpWrite(DP_OBJECT_Y, ctx.a);
        h.load(2);
        h.dpWrite(DP_OBJECT_KIND, ctx.a);
        call(0x81c1c5, 0x81b8c8);
        h.index('x', TEXT_COMBAT_WON & WORD_MASK);
        h.index('y', TEXT_COMBAT_WON >>> WORD_BITS);
        call(0x81c1ce, 0x81b282);
        return h.rts();
      }
      setCarry(h, true);
      h.load(h.read(h.abs(MATRIX_FOUGHT_IC)));
      h.sbc(IC_FIRST);
      h.asl();
      h.index('y', ctx.a);
      h.load(h.read(h.abs(MATRIX_DAMAGE & WORD_MASK) + ctx.y));
      h.dpWrite(DP_RANDOM, ctx.a);
      call(0x81c1e0, 0x80f2a8, true);
      h.load(h.dp(DP_RANDOM));
      h.load(ctx.a + 1);
      call(0x81c1e7, 0x81b1b5);
      h.index('x', TEXT_COMBAT_LOST & WORD_MASK);
      h.index('y', TEXT_COMBAT_LOST >>> WORD_BITS);
      call(0x81c1f0, 0x81b282);
      return h.rts();
    }
  }
  h.cmp(NODE_DATA_TAKEN);
  let action = Boolean(ctx.status & FLAG_ZERO);
  if (!action) {
    h.cmp(DATA_FIRST);
    if (!(ctx.status & FLAG_CARRY)) return h.rts();
    h.cmp(DATA_END);
    action = !(ctx.status & FLAG_CARRY);
  }
  if (!action) return h.rts();
  setCarry(h, true);
  h.sbc(DATA_FIRST);
  h.asl();
  h.index('y', ctx.a);
  h.load(h.read(h.abs(MATRIX_DATA_BITS)));
  h.load(ctx.a | h.read(h.abs(MATRIX_BITS & WORD_MASK) + ctx.y));
  h.write(h.abs(MATRIX_DATA_BITS), ctx.a);
  h.index('y', h.read(h.abs(MATRIX_DIRECTION), 2));
  h.load(h.read(h.abs(MATRIX_MAP_STEPS & WORD_MASK) + ctx.y));
  h.index('y', NODE_GUARD_DOWN);
  call(0x81c21b, 0x81b696);
  h.index('y', h.read(h.abs(MATRIX_DIRECTION), 2));
  h.load(h.read(h.abs(MATRIX_TILE_STEPS & WORD_MASK) + ctx.y));
  h.index('y', NODE_PALETTE | NODE_GUARD_DOWN);
  call(0x81c227, 0x81b6a6);
  call(0x81c22a, 0x81c108);
  call(0x81c22d, 0x81b71f);
  if (!(ctx.status & FLAG_ZERO)) {
    h.index('x', TEXT_GUARD_DESTROYED & WORD_MASK);
    h.index('y', TEXT_GUARD_DESTROYED >>> WORD_BITS);
    call(0x81c238, 0x81b282);
  }
  return h.rts();
}
// 81:C25C: add the size in A to the deck memory; when it is full, show "out of storage" and return carry set.
export function storeDownloadedData(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.phx();
  setCarry(h, false);
  h.load(ctx.a & BYTE_MASK);
  h.adc(h.read(h.abs(MATRIX_MEMORY)));
  h.cmp(h.read(h.abs(MATRIX_MEMORY_LIMIT)));
  if (ctx.status & FLAG_CARRY) h.load(MEMORY_MAX);
  h.cmp(MEMORY_MAX);
  if (ctx.status & FLAG_CARRY) {
    h.index('x', TEXT_OUT_OF_STORAGE & WORD_MASK);
    h.index('y', TEXT_OUT_OF_STORAGE >>> WORD_BITS);
    call(0x81c277, 0x81b282);
    h.plx();
    setCarry(h, true);
    return h.rts();
  }
  h.write(h.abs(MATRIX_MEMORY), ctx.a);
  h.index('x', TEXT_TRANSFER & WORD_MASK);
  h.index('y', TEXT_TRANSFER >>> WORD_BITS);
  call(0x81c286, 0x81b282);
  h.plx();
  setCarry(h, false);
  return h.rts();
}
// 81:C28C: on a grid point in the control state, A reads the CPU memory or downloads the data of
// the node ahead; a download can open lines.
function downloadFromNodeAhead(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.load(h.read(h.abs(MATRIX_STATE)));
  h.cmp(MATRIX_STATE_CONTROL);
  if (!(ctx.status & FLAG_ZERO)) return h.rts();
  h.load(h.read(h.abs(MATRIX_PERSONA_X)));
  h.load(ctx.a & GRID_MASK);
  if (!(ctx.status & FLAG_ZERO)) return h.rts();
  h.load(h.read(h.abs(MATRIX_PERSONA_Y)));
  h.load(ctx.a & GRID_MASK);
  if (!(ctx.status & FLAG_ZERO)) return h.rts();
  h.load(h.read(h.abs(PAD_PRESSED)));
  h.load(ctx.a & PAD_A);
  if (ctx.status & FLAG_ZERO) return h.rts();
  h.index('x', 0);
  h.index('y', h.read(h.abs(MATRIX_DIRECTION), 2));
  h.load(h.read(h.abs(MATRIX_MAP_STEPS & WORD_MASK) + ctx.y));
  call(0x81c2b5, 0x81b69d);
  h.cmp(NODE_CPU);
  let target = Boolean(ctx.status & FLAG_CARRY);
  if (target) {
    h.cmp(CPU_END);
    target = !(ctx.status & FLAG_CARRY);
  }
  if (target) {
    h.load(CPU_PROGRAM_MEMORY);
    call(0x81c2c5, 0x81c25c);
    if (!(ctx.status & FLAG_CARRY)) {
      h.index('x', TEXT_PHONEBOOK & WORD_MASK);
      h.index('y', TEXT_PHONEBOOK >>> WORD_BITS);
      call(0x81c2d0, 0x81b282);
    }
    return h.rts();
  }
  h.cmp(DATA_FIRST);
  if (!(ctx.status & FLAG_CARRY)) return h.rts();
  h.cmp(DATA_END);
  if (!(ctx.status & FLAG_CARRY)) {
    setCarry(h, true);
    h.sbc(DATA_FIRST);
    h.index('y', ctx.a);
    h.asl();
    h.index('x', ctx.a);
    h.load(h.read(h.abs(MATRIX_DATA_BITS)));
    h.load(ctx.a | h.read(MATRIX_BITS + ctx.x));
    h.write(h.abs(MATRIX_DATA_BITS), ctx.a);
    setCarry(h, false);
    h.load(h.read(h.abs(MATRIX_AMOUNTS_10 & WORD_MASK) + ctx.y));
    call(0x81c303, 0x81c25c);
    if (ctx.status & FLAG_CARRY) return h.rts();
    h.index('y', h.read(h.abs(MATRIX_DIRECTION), 2));
    h.load(h.read(h.abs(MATRIX_MAP_STEPS & WORD_MASK) + ctx.y));
    h.index('y', NODE_DATA_TAKEN);
    h.index('x', 0);
    call(0x81c314, 0x81b696);
    h.index('y', h.read(h.abs(MATRIX_DIRECTION), 2));
    h.load(h.read(h.abs(MATRIX_TILE_STEPS & WORD_MASK) + ctx.y));
    h.index('y', NODE_PALETTE | NODE_DATA_TAKEN);
    h.index('x', 0);
    call(0x81c323, 0x81b6a6);
    h.index('x', TEXT_PROGRAM_MODIFIED & WORD_MASK);
    h.index('y', TEXT_PROGRAM_MODIFIED >>> WORD_BITS);
    call(0x81c32c, 0x81b282);
    return h.rts();
  }
  h.cmp(DOWNLOAD_FIRST);
  if (!(ctx.status & FLAG_CARRY)) return h.rts();
  h.cmp(DOWNLOAD_END);
  if (ctx.status & FLAG_CARRY) return h.rts();
  setCarry(h, true);
  h.sbc(DOWNLOAD_FIRST);
  h.index('y', ctx.a);
  h.asl();
  h.index('x', ctx.a);
  h.load(h.read(h.abs(MATRIX_DOWNLOAD_BITS)));
  h.load(ctx.a | h.read(MATRIX_BITS + ctx.x));
  h.write(h.abs(MATRIX_DOWNLOAD_BITS), ctx.a);
  setCarry(h, false);
  h.load(h.read(h.abs(MATRIX_AMOUNTS_18 & WORD_MASK) + ctx.y));
  call(0x81c358, 0x81c25c);
  if (ctx.status & FLAG_CARRY) return h.rts();
  h.load(h.read(h.abs(MATRIX_BITS & WORD_MASK) + ctx.x));
  call(0x81c360, 0x81b56f);
  if (!(ctx.status & FLAG_ZERO)) {
    h.index('x', TEXT_LINES_OPENED & WORD_MASK);
    h.index('y', TEXT_LINES_OPENED >>> WORD_BITS);
    call(0x81c36b, 0x81b282);
  }
  h.index('y', h.read(h.abs(MATRIX_DIRECTION), 2));
  h.load(h.read(h.abs(MATRIX_MAP_STEPS & WORD_MASK) + ctx.y));
  h.index('y', NODE_DOWNLOADED);
  h.index('x', 0);
  call(0x81c37a, 0x81b696);
  h.index('y', h.read(h.abs(MATRIX_DIRECTION), 2));
  h.load(h.read(h.abs(MATRIX_TILE_STEPS & WORD_MASK) + ctx.y));
  h.index('y', NODE_PALETTE | NODE_DOWNLOADED);
  h.index('x', 0);
  call(0x81c389, 0x81b6a6);
  h.index('x', TEXT_DATA_RECEIVED & WORD_MASK);
  h.index('y', TEXT_DATA_RECEIVED >>> WORD_BITS);
  call(0x81c392, 0x81b282);
  return h.rts();
}
export const MATRIX_CONTROL_ROUTINES = new Map([
  [0x80f2a8, randomBelowLong],
  [0x80c51f, (h) => randomBelow(h.a, false)],
  ...[
    [0x81b1b5, subtractMatrixHealth],
    [0x81b609, openGatesAroundPersona],
    [0x81b71f, placeRoomIcObjects],
    [0x81b8ad, setPersonaAnimation],
    [0x81b959, announceNearbyIcs],
    [0x81b9d0, takeIcAttack],
    [0x81bd44, stepMatrixState],
    [0x81c108, queueCombatText],
    [0x81c111, useNodeAhead],
    [0x81c25c, storeDownloadedData],
    [0x81c28c, downloadFromNodeAhead],
  ],
]);
