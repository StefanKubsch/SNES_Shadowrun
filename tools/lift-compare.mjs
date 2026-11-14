// Live comparison of a lifted scene with its register-level reference
// (docs/MATRIX-LIFT.md): a plan of tools/explore-live.mjs runs once with the
// lifted code and once with the reference swapped into every routine table, and
// every NMI compares WRAM (outside the ignored scratch), VRAM, CGRAM, OAM, PPU
// registers and scroll, the number of PPU writes and the sound RAM.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cartridge } from './cartridge-harness.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { exploreLive } from './explore-live.mjs';
import { fnv1a } from '../src/data/fnv.mjs';

// The routine tables of src/task and src/vm (the main loop's) that hold any of the
// lifted functions.
export async function routineTables(lifted) {
  const maps = [];
  for (const folder of ['task', 'vm']) {
    const dir = fileURLToPath(new URL(`../src/${folder}/`, import.meta.url));
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.mjs')))
      for (const value of Object.values(
        await import(new URL(`../src/${folder}/${name}`, import.meta.url)),
      ))
        if (value instanceof Map && [...value.values()].some((run) => lifted.includes(run)))
          maps.push(value);
  }
  return maps;
}
// Swap in the reference entries (targets the table lacks or holds lifted); returns
// the undo.
export function useReference(maps, reference, lifted) {
  const saved = maps.map((map) => new Map(map));
  for (const map of maps)
    for (const [target, run] of reference)
      if (!map.has(target) || lifted.includes(map.get(target))) map.set(target, run);
  return () =>
    maps.forEach((map, n) => {
      map.clear();
      for (const [k, v] of saved[n]) map.set(k, v);
    });
}
const masked = (wram, ignored) => {
  const copy = wram.slice();
  for (const [from, to] of ignored) copy.fill(0, from, to);
  return copy;
};
function fingerprints(ignored, snapshotAt) {
  const frames = [],
    snapshots = [];
  return {
    frames,
    snapshots,
    onGame(game) {
      const onNmi = game.frames.onNmi;
      game.frames.onNmi = (k) => {
        const { ppu } = game.bus;
        frames.push(
          [
            fnv1a(masked(game.memory.wram, ignored)),
            fnv1a(ppu.vram),
            fnv1a(ppu.cgram),
            fnv1a(ppu.oam),
            fnv1a(ppu.registers),
            fnv1a(ppu.scroll),
            game.bus.ppuWrites,
            fnv1a(game.apu.ram),
          ].join(),
        );
        if (frames.length - 1 === snapshotAt || frames.length - 2 === snapshotAt)
          snapshots.push(masked(game.memory.wram, ignored));
        onNmi(k);
      };
    },
  };
}
// Differing WRAM bytes listed for diagnosis, written in hex.
const LISTED_BYTES = 40,
  HEX = 16;
const PARTS = ['wram', 'vram', 'cgram', 'oam', 'registers', 'scroll', 'ppuWrites', 'apu'];

// Run plan (from the save sram) lifted and with the reference. lifted: the lifted
// functions; reference: Map target -> reference routine; swap (optional) instead puts
// the reference in place itself and returns the undo. Returns
// { frames, first, parts } with the first differing NMI and its differing parts.
export async function compareLift({
  plan,
  sram = loadSave('apartment'),
  lifted,
  reference,
  ignored,
  snapshotAt = -1,
  swap = null,
}) {
  // A run ends with the live step in which its last command ended; the NMIs of that
  // step after the command (their number depends on the work the code uses) are cut.
  const run = (record) => {
    const { ends } = exploreLive(plan, { cartridge, sram, onGame: record.onGame });
    record.frames.length = Math.min(record.frames.length, ends[plan.length - 1] + 1);
  };
  const liftedRun = fingerprints(ignored, snapshotAt);
  run(liftedRun);
  const restore = swap?.() ?? useReference(await routineTables(lifted), reference, lifted),
    referenceRun = fingerprints(ignored, snapshotAt);
  try {
    run(referenceRun);
  } finally {
    restore();
  }
  const first = liftedRun.frames.findIndex((f, n) => f !== referenceRun.frames[n]);
  let parts = [];
  if (first !== -1) {
    const a = liftedRun.frames[first].split(','),
      b = (referenceRun.frames[first] ?? '').split(',');
    parts = PARTS.filter((_, n) => a[n] !== b[n]);
  }
  // Differing WRAM bytes at snapshotAt and the NMI after it (diagnosis).
  const bytes = liftedRun.snapshots.map((snapshot, s) => {
    const out = [];
    snapshot.forEach((v, i) => {
      const w = referenceRun.snapshots[s]?.[i];
      if (v !== w && out.length < LISTED_BYTES)
        out.push(`${i.toString(HEX)}:${v.toString(HEX)}/${w?.toString(HEX)}`);
    });
    return out.join(' ');
  });
  return {
    frames: liftedRun.frames.length,
    referenceFrames: referenceRun.frames.length,
    first,
    parts,
    bytes,
  };
}
