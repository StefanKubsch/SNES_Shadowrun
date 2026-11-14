// M5 oracle (tool and test only): Mesen replays the input plan of the room
// recording up to its stop point 80:96C3 and then gives one pad word per NMI. It
// returns the interrupted positions of all live NMIs, the pad polls, the state at
// the rounds-th return to 80:96C3 after the stop point and the picture of the next
// NMI. With sound also the DSP envelopes per live NMI (env) and the KON/KOF writes
// (keys). shots names live NMIs k whose preceding picture is returned as well; with
// shotPpu each picture also carries the emulator's PPU state (picture.ppu) for the
// pure renderer comparison (mesen-ppu-state.mjs).
// With livePlan, Mesen chooses the pad words from live NMI livePlanFrom on itself
// from the plan commands (rules as tools/live-plan-driver.mjs on the original's
// WRAM); ends[i] is [k, slot, x, y, rounds]: the live NMI k at which command i ends,
// the player figure there and the live rounds completed so far; the run ends at the
// return after the plan's end if that comes before the rounds-th. track > 0 returns
// the player figure every track live NMIs (positions: k, slot, word $0E28/$0E80+slot).
// shotEnds also returns the picture before live NMI k + 1 of each command end.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { prepareScript, runMesen } from './mesen.mjs';
import { BOOT_PPU_OVERRIDES } from './mesen-boot-prefix.mjs';
import { SPECIAL_NATIVES } from '../src/vm/special-natives.mjs';

const ROM_PATH = fileURLToPath(new URL('../Shadowrun (E).smc', import.meta.url));
const luaValue = (value) =>
  Array.isArray(value)
    ? `{${value.map(luaValue).join(', ')}}`
    : typeof value === 'string'
      ? JSON.stringify(value)
      : String(value);
const hexBytes = (hex) => Uint8Array.from(hex.match(/../g), (h) => parseInt(h, 16));
export async function recordLiveRoom(
  exe,
  pads,
  rounds,
  {
    timeoutMs = 900000,
    sound = false,
    shots = [],
    shotPpu = false,
    liveSram = null,
    livePlan = null,
    livePlanFrom = 0,
    track = 0,
    shotEnds = false,
  } = {},
) {
  assert.ok(liveSram === null || liveSram.length === 0x2000, '8 KiB live SRAM');
  assert.ok(shots.every((k) => Number.isSafeInteger(k) && k > 0));
  assert.ok(Number.isSafeInteger(rounds) && rounds > 0);
  assert.ok(
    pads.every((w) => Number.isInteger(w) && w >= 0 && w <= 0xffff && !(w & 15)),
    'standard pad words',
  );
  const script = prepareScript('trace-live-room.lua', {
    SOUND: sound,
    LIVE_ROUNDS: rounds,
    PADS: '{' + pads.join(',') + '}',
    NATIVE_TARGETS:
      '{' + [...SPECIAL_NATIVES.keys()].map((pc) => '[' + pc + ']=true').join(',') + '}',
    SHOTS: '{' + shots.map((k) => '[' + k + ']=true').join(',') + '}',
    SHOT_PPU: shotPpu,
    LIVE_SRAM: liveSram ? '"' + Buffer.from(liveSram).toString('hex') + '"' : 'nil',
    LIVE_PLAN: livePlan ? luaValue(livePlan) : 'nil',
    LIVE_PLAN_FROM: livePlanFrom,
    TRACK: track,
    SHOT_ENDS: shotEnds,
  });
  const nmis = [],
    polls = [],
    env = [],
    keys = [],
    ends = [],
    positions = [],
    memory = {
      FW: new Uint8Array(0x20000),
      FM: new Uint8Array(0x2000),
      PPUV: new Uint8Array(65536),
      PPUC: new Uint8Array(512),
      PPUO: new Uint8Array(544),
    };
  let received = 0,
    announced = null,
    stop = null,
    context = null,
    frame = null,
    damage = null,
    last = null;
  const pictures = new Map();
  const picture = (t) => ({
    k: Number(t[0]),
    scanline: Number(t[1]),
    width: Number(t[2]),
    height: Number(t[3]),
    rgb: Uint8Array.from(
      t[4]
        .match(/.{6}/g)
        .flatMap((h) => [
          parseInt(h.slice(0, 2), 16),
          parseInt(h.slice(2, 4), 16),
          parseInt(h.slice(4), 16),
        ]),
    ),
  });
  const result = await runMesen(
    exe,
    ROM_PATH,
    script,
    (raw) => {
      if (damage || announced !== null) return;
      if (raw.startsWith('N ')) {
        announced = Number(raw.slice(2));
        return;
      }
      if (!/^(S|H|Q|E|K|C|P|F|FW|FM|PPUV|PPUC|PPUO|FRAME|SHOT|SP|SV|SC|SO) /.test(raw)) return;
      try {
        const match = / #(\d+)$/.exec(raw);
        assert.ok(match, 'unsequenced live record');
        assert.equal(Number(match[1]), ++received, 'damaged live record sequence');
        const [tag, ...t] = raw.slice(0, match.index).split(' ');
        if (tag === 'S') stop = { nmis: Number(t[0]), frame: Number(t[1]) };
        else if (tag === 'H')
          nmis.push({
            k: Number(t[0]),
            pc: parseInt(t[1], 16),
            s: parseInt(t[2], 16),
            frame: Number(t[3]),
          });
        else if (tag === 'C') ends[Number(t[0])] = t.slice(1).map(Number);
        else if (tag === 'P') positions.push(t.map(Number));
        else if (tag === 'E') env[Number(t[0])] = t.slice(1).map(Number);
        else if (tag === 'K')
          keys.push({ k: Number(t[0]), register: parseInt(t[1], 16), value: parseInt(t[2], 16) });
        else if (tag === 'Q')
          polls.push({ k: Number(t[0]), frame: Number(t[1]), inNmi: t[2] === '1' });
        else if (tag === 'F') {
          const v = t.map((x) => parseInt(x, 16));
          context = {
            e: Number(t[8]),
            programBank: v[7] >>> 16,
            pc: v[7] & 65535,
            a: v[0],
            x: v[1],
            y: v[2],
            s: v[3],
            d: v[4],
            bank: v[5],
            status: v[6],
          };
          context.nmis = Number(t[9]);
        } else if (tag === 'FRAME') frame = picture(t);
        else if (tag === 'SHOT') {
          const o = picture(t);
          pictures.set(o.k, o);
          last = o;
        } else if (tag === 'SP') {
          assert.equal(Number(t[0]), last?.k, 'PPU state after its picture');
          last.ppu = {
            fields: Object.fromEntries(t.slice(1).map((x) => x.split('='))),
            vram: new Uint8Array(65536),
            cgram: new Uint8Array(512),
            oam: new Uint8Array(544),
          };
        } else if (tag === 'SV' || tag === 'SC' || tag === 'SO')
          last.ppu[{ SV: 'vram', SC: 'cgram', SO: 'oam' }[tag]].set(hexBytes(t[1]), Number(t[0]));
        else memory[tag].set(hexBytes(t[1]), Number(t[0]));
      } catch (error) {
        damage = error;
      }
    },
    {
      timeoutMs,
      overrides: BOOT_PPU_OVERRIDES,
      keep: () => !damage && announced !== null && announced === received,
    },
  );
  if (damage) throw damage;
  assert.equal(result.code, 0, 'Mesen live room run');
  assert.equal(announced, received, 'complete live record');
  assert.ok(stop && context && frame, 'live stop, final state and frame');
  const requested = new Set([...shots, ...(shotEnds ? ends.map((e) => e[0] + 1) : [])]);
  assert.deepEqual(
    [...pictures.keys()].sort((x, y) => x - y),
    [...requested].sort((x, y) => x - y),
    'every requested live picture',
  );
  return {
    stop,
    nmis,
    polls,
    env,
    keys,
    ends,
    positions,
    context,
    frame,
    pictures,
    wram: memory.FW,
    sram: memory.FM,
    vram: memory.PPUV,
    cgram: memory.PPUC,
    oam: memory.PPUO,
  };
}

// Read and branch of each lag-free wait loop. An original NMI elsewhere in the
// same loop, or in the same loop at another S (lifted code need not reproduce the
// stack depth, docs/MATRIX-LIFT.md), changes only CPU bookkeeping on the stack; any
// other place is an original lag frame, which the lag-free model does not reproduce.
const LOOPS = [
  [0x81b0a5, 0x81b0a9],
  [0x81eecd, 0x81eed1],
  [0x81acaf, 0x81acb2],
  [0x81acbd, 0x81acc0],
  [0x81acc3, 0x81acc6],
  [0x81acc9, 0x81accc],
  [0x81cf4c, 0x81cf4f],
  [0x80901c, 0x80901f],
  [0x80ae0c, 0x80ae0f],
  [0x80ae5e, 0x80ae61],
];
export function alignLiveNmis(original, native) {
  const frameBytes = new Set(),
    moved = [],
    lag = [];
  for (const o of original) {
    const n = native[o.k];
    if (!n) {
      lag.push({ ...o, reason: 'native_nmi_missing' });
      continue;
    }
    if (o.pc === n.pc && o.s === n.s) continue;
    if (o.pc !== n.pc && !LOOPS.some((loop) => loop.includes(o.pc) && loop.includes(n.pc))) {
      lag.push({ ...o, native: n, reason: 'position' });
      continue;
    }
    moved.push(o);
    for (let b = 0; b < 4; b++) {
      frameBytes.add(o.s - b);
      frameBytes.add(n.s - b);
    }
  }
  return { frameBytes, moved, lag };
}

// Game state comparisons (docs/MATRIX-LIFT.md, user 2026-11-14): the CPU stacks (main
// 7E:0100-01C9, NMI 7E:1C7C-1CBB) hold only return words and saved registers, and A, X,
// Y and P at a resting point are no game state; the rest of the context must match.
const CPU_STACKS = [
  [0x0100, 0x01ca],
  [0x1c7c, 0x1cbc],
];
export const inCpuStack = (address) =>
  CPU_STACKS.some(([from, to]) => address >= from && address < to);
export const gameContext = ({ a, x, y, status, ...context }) => context;
