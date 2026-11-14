import test from 'node:test';
import assert from 'node:assert/strict';
import {VmFault} from '../src/vm/memory.mjs';
import {STOP_RETURNED, STOP_NATIVE} from '../src/vm/scheduler.mjs';
import {prng} from './vm-differential.mjs';
import {initialState, snapshot, compareVisit, compareAppend, get16, set16, OUTER_RETURN} from './vm-scheduler-differential.mjs';

const tally = results => results.reduce((t, r) => (t[r] = (t[r] ?? 0) + 1, t), {});

test('$C1A6 legt Freiliste, leere Taskliste und einen freien Heapblock an', () => {
  const {wram, vm} = initialState(prng(1), []);
  assert.equal(get16(wram, 0x24E), 0);
  for (const offset of [0x24C, 0x250, 0x372]) assert.equal(get16(wram, offset), 0xFFFF);
  for (let x = 0; x < 0x5E; x += 2) assert.equal(get16(wram, 0x312 + x), x + 2);
  assert.equal(get16(wram, 0x312 + 0x5E), 0xFFFF);
  assert.equal(get16(wram, 0x3D2), 0x07CC);
  assert.equal(get16(wram, 0x3D4), 0);
  assert.equal(vm.pc, (OUTER_RETURN + 1) & 0xFFFF);
});

test('Taskverwaltung, Scheduler, Scriptaufrufe und Native-Warten gleichen den bewiesenen Kompositionen', () => {
  const results = [], stats = {};
  for (let k = 0; k < 12; k++) {
    const rnd = prng(1000 + k), ids = Array.from({length: 1 + ((rnd() * 3) | 0)}, () => (rnd() * 937) | 0);
    const before = initialState(rnd, ids.slice(0, -1));
    results.push('append:' + compareAppend(snapshot(before, 0, before.vm.p & 0xC7), ids.at(-1), `append ${k}`));
    const sim = initialState(prng(1000 + k), ids);
    for (let round = 0; round < 6; round++) {
      const status = (rnd() * 256) & 0xC7;
      for (const entry of [0xC1CA, 0xC1F9]) {
        const state = snapshot(sim, 0, status), head = get16(state.wram, 0x24C);
        if (entry === 0xC1F9) { if (head & 0x8000) continue; set16(state.wram, 0x250, head); state.context.x = head; }
        results.push(entry.toString(16) + ':' + compareVisit(state, entry, 40, `${k}/${round}/${entry.toString(16)}`, stats));
      }
      // Zustand mit einer echten Runde ($C1E3) weiterentwickeln.
      let stop;
      try { stop = sim.enter(0xC1E3, 200); } catch (error) { if (error instanceof VmFault) break; throw error; }
      if (stop !== STOP_RETURNED) break;
    }
  }
  const t = tally(results);
  const allowed = r => r.endsWith(':equal') || r.endsWith(':equal-opcodes') || r === 'c1ca:skipped:wait-resume-entry';
  assert.deepEqual(Object.keys(t).filter(r => !allowed(r)), [], JSON.stringify(t));
  // Jeder Ablauf kommt vor: Kindtask, Ende mit Freigabe, Elternfortsetzung, Warten und Fortsetzung.
  for (const key of ['script-call', 'end', 'postrun', 'script-resume', 'native', 'wait-equal', 'wait-resume'])
    assert.ok(stats[key] > 0, `${key}: ${JSON.stringify(stats)}`);
});

test('$C1E3 besucht alle Tasks und setzt den Cursor auf den Listenkopf zurück', () => {
  // Drei Scripts, die allein eine Runde ohne fehlendes Native durchlaufen.
  const round = ids => {
    const sim = initialState(prng(7), ids);
    set16(sim.wram, 0x250, get16(sim.wram, 0x24C));
    try { return {sim, stop: sim.enter(0xC1E3, 1000)}; } catch (error) { if (error instanceof VmFault) return {sim, stop: null}; throw error; }
  };
  const ids = [];
  for (let id = 0; ids.length < 3; id++) if (round([id]).stop === STOP_RETURNED) ids.push(id);
  const {sim, stop} = round(ids);
  assert.equal(stop, STOP_RETURNED);
  assert.equal(get16(sim.wram, 0x250), get16(sim.wram, 0x24C));
  assert.equal(sim.vm.dbr, 0x80);
  assert.equal(sim.vm.pc, (OUTER_RETURN + 1) & 0xFFFF);
});

test('Nicht umgesetzte Natives halten den Scheduler an; zyklische Heaplisten werden gemeldet', () => {
  // Script mit nicht zugelassenem Native suchen und bis dorthin laufen lassen.
  let stopped = false;
  for (let id = 0; id < 937 && !stopped; id++) {
    const sim = initialState(prng(id), [id]);
    set16(sim.wram, 0x250, get16(sim.wram, 0x24C));
    try { stopped = sim.enter(0xC1E3, 500) === STOP_NATIVE; } catch (error) { if (!(error instanceof VmFault)) throw error; }
    if (stopped) { assert.equal(sim.vm.pc, 0xF4F6); assert.equal(sim.scheduler.resume(10), STOP_NATIVE); }
  }
  assert.ok(stopped);
  const sim = initialState(prng(3), []);
  set16(sim.wram, 0x3D2, 0x8010); set16(sim.wram, 0x3D4, 0x0010);
  set16(sim.wram, 0x3D2 + 0x10, 0x8010); set16(sim.wram, 0x3D4 + 0x10, 0x0000 + 0x10);
  sim.vm.x = 0; sim.vm.d = 0; sim.vm.dbr = 0x80;
  assert.throws(() => sim.enter(0xC34A), error => error instanceof VmFault && error.reason === 'original_endless_loop');
});
