import test from 'node:test';
import assert from 'node:assert/strict';
import {findMesen} from './mesen.mjs';
import {recordTrace, compareTrace, instructionPc, sequencedLine, ORACLE_WINDOWS, SAVES, loadSave} from './mesen-f390-oracle.mjs';
import {ORACLE_NATIVES} from '../proof/vm/oracle-natives.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';

test('Mesen is found only through MESEN_PATH (folder or Mesen.exe), otherwise with a reason', () => {
  assert.deepEqual(findMesen({}), {exe: null, reason: 'MESEN_PATH not set'});
  assert.equal(findMesen({MESEN_PATH: 'Z:/missing/Mesen.exe'}).exe, null);
});

test('recorder lines carry a sequence number; gaps, duplicates and torn lines are damaged output', () => {
  assert.equal(sequencedLine('S 1 2 w 12=34 #7', 7), 'S 1 2 w 12=34');
  assert.equal(sequencedLine('E #9', 9), 'E');
  assert.equal(sequencedLine('Mesen reports something', 3), null);
  for (const [line, expected] of [['S 1 2 #7', 8], ['S 1 2 #7', 6], ['S 1 2 w 12=3', 4]])
    assert.throws(() => sequencedLine(line, expected), /Mesen output damaged/);
});

test('device read: instruction address from Mesen\'s PC behind the operands', () => {
  // $81:F046 CMP $2140 (sound acknowledgement in $C46E), $80:C566 LDA $2137 (random).
  assert.equal(instructionPc({address: 0x802140, pcAfter: 0x81F049}), 0x81F046);
  assert.equal(instructionPc({address: 0x802137, pcAfter: 0x80C569}), 0x80C566);
  assert.equal(instructionPc({address: 0x802140, pcAfter: 0x81F04A}), -1);
});

test('saved games lie in the repository with a checksum; a foreign file or an unknown name is an error', () => {
  for (const name of Object.keys(SAVES)) assert.equal(loadSave(name).length, 0x2000);
  assert.throws(() => loadSave('missing'), /Unknown saved game/);
});

test('$E014 is a statically proved special native since 2026-10-14; the oracle list is empty', () => {
  assert.equal(ORACLE_NATIVES.size, 0);
  assert.ok(SPECIAL_NATIVES.has(0x80E014));
});

// Without an emulator explicitly skipped, never counted as passed.
const {exe, reason} = findMesen();
// All recordings are queued; the recorder limits parallel Mesen processes.
const [recorded, door, exit, street, southwest, alley, fight, dialog, dog, status, select, items, bed, shades, desk, badge, ...short] = exe
  ? await Promise.all(Object.values(ORACLE_WINDOWS).map(w => recordTrace(exe, w))) : [];

test('Mesen2: every opcode and every scheduler round in the first room equals the real game run', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(recorded);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.ok(report.counts.equal >= 3000, JSON.stringify(report.counts));
  assert.ok(report.counts['equal-native'] >= 300, JSON.stringify(report.counts));
  assert.ok(report.nativesEqual['$80CA3A'] > 0);
  assert.ok(report.nativesEqual['$80E014'] >= 50 && report.nativesEqual['$80E262'] >= 50, JSON.stringify(report.nativesEqual));
  // Scene set-up at frame 2655: $A1E6 (create an object) and $DE7E; no native stays unbound.
  assert.equal(report.nativesEqual['$80A1E6'], 1, JSON.stringify(report.nativesEqual));
  assert.deepEqual(report.missingNatives, {});
  // Exits continue through the TaskScheduler: round start, native wait, round end.
  for (const key of ['equal-scheduler-round', 'equal-scheduler-native-call', 'equal-round-end'])
    assert.ok(report.counts[key] >= 30, `${key}: ${JSON.stringify(report.counts)}`);
  // NMI intervals are compared: $FEC1 (frame 2651) waits over frames, wait observations 0.
  assert.ok(report.counts['equal-with-nmi'] >= 1 && report.nativesEqual['$80FEC1'] >= 1, JSON.stringify(report.counts));
  assert.deepEqual(report.faults, []);
});

test('Mesen2: an altered recording is reported as a difference', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const steps = recorded.steps.map(s => ({...s, writes: s.writes.map(w => [...w])}));
  const k = steps.findIndex((s, n) => n > 0 && !s.interrupted && s.writes.length > 0);
  steps[k].writes[0][1] ^= 1;
  const report = compareTrace({...recorded, steps});
  assert.ok(report.counts.mismatch >= 1);
  assert.equal(report.mismatches[0].index, k - 1);
});

test('Mesen2: a wrong round end is reported as a difference', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const k = recorded.steps.findIndex(s => s.kind === 'R' && !s.interrupted);
  const steps = recorded.steps.map((s, n) => n === k ? {...s, s: (s.s + 2) & 0xFFFF} : s);
  const report = compareTrace({...recorded, steps});
  // The falsified point is the end of the round and the start of the main loop, which is now compared too.
  assert.equal(report.counts.mismatch, 2);
  assert.deepEqual(report.mismatches.map(m => m.index), [k - 1, k]);
  assert.equal(report.mismatches[1].scheduled, 'main-loop');
  assert.ok(report.mismatches[1].differences.some(d => d.startsWith('s VM')));
});

test('Mesen2: opening the door in the morgue, $8371 identical', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(door);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.equal(report.nativesEqual['$808371'], 1, JSON.stringify(report.nativesEqual));
  // Glove on and active: oracle-checked $E014 paths, no native stays unbound.
  assert.deepEqual(report.missingNatives, {});
});

test('Mesen2: leaving the morgue, $DE7E identical', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(exit);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.equal(report.nativesEqual['$80DE7E'], 1, JSON.stringify(report.nativesEqual));
  assert.deepEqual(report.missingNatives, {});
});

test('Mesen2: entering the street, scene set-up with $C716 identical', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(street);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.ok(report.nativesEqual['$80C716'] >= 1, JSON.stringify(report.nativesEqual));
  assert.deepEqual(report.missingNatives, {});
});

test('Mesen2: south-west, target choice $8BC5 with random and line of sight identical', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(southwest);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.deepEqual(report.faults, []);
  assert.ok(report.nativesEqual['$808BC5'] >= 2, JSON.stringify(report.nativesEqual));
  assert.deepEqual(report.missingNatives, {});
});

test('Mesen2: alley, shot of the orc assassin $8AB5, fight list $8521 with fight music and $CF93 identical', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(alley);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.deepEqual(report.faults, []);
  // $866F (649 calls) lies only in frames 7800-8600 (node tools/mesen-f390-oracle.mjs 7800 8600 alley).
  for (const native of ['$808AB5', '$808521', '$80CF93'])
    assert.ok(report.nativesEqual[native] >= 1, native + ' ' + JSON.stringify(report.nativesEqual));
  assert.deepEqual(report.missingNatives, {});
});

test('Mesen2: end of the fight in the alley, $855E with music change $EF47 identical', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(fight);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.deepEqual(report.faults, []);
  assert.equal(report.nativesEqual['$80855E'], 1, JSON.stringify(report.nativesEqual));
  // Jake shoots ($8A51 with weapon $8860) after aiming in $E014 ($E13E); no native stays unbound.
  assert.ok(report.nativesEqual['$808A51'] >= 1 && report.nativesEqual['$80E014'] >= 10, JSON.stringify(report.nativesEqual));
  assert.deepEqual(report.missingNatives, {});
});

test('Mesen2: punk dialog $936C identical over 256 frames (counters, wait loops and joypad observed)', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(dialog);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.deepEqual(report.faults, []);
  assert.equal(report.nativesEqual['$80936C'], 1, JSON.stringify(report.nativesEqual));
  // The dialog interval contains an NMI; $91D7 (RTS of $9178) is not a round end.
  assert.ok(report.counts['equal-with-nmi'] >= 1, JSON.stringify(report.counts));
  assert.deepEqual(report.frontiers, {});
  assert.deepEqual(report.missingNatives, {});
});

test('Mesen2: dog dialog with topic action, round $C1CA from $936C at C and R identical', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(dog);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.deepEqual(report.faults, []);
  // One call of $936C, split at JSR $C1CA ($91D4) and its return ($91D7); in between the appended
  // task $396 (growl through $C46E) runs as intervals of its own.
  assert.equal(report.nativesEqual['$80936C'], 1, JSON.stringify(report.nativesEqual));
  assert.equal(report.nativesEqual['$80C46E'], 1, JSON.stringify(report.nativesEqual));
  assert.equal(report.counts['equal-native-round-start'], 1, JSON.stringify(report.counts));
  assert.equal(report.counts['equal-native-round-end'], 1, JSON.stringify(report.counts));
  assert.deepEqual(report.frontiers, {});
  assert.deepEqual(report.missingNatives, {});
  // Counter-checks: a falsified point at the round start (C) and at the end of the native (after R) is a difference.
  const round = dog.steps.findIndex(step => step.kind === 'C' && step.pc === 0x91D4);
  const end = dog.steps.findIndex(step => step.kind === 'R' && step.pc === 0x91D7);
  assert.ok(round > 0 && end > round, `${round} ${end}`);
  for (const [at, kind] of [[round, 'native-round-start'], [end + 1, null]]) {
    const steps = dog.steps.slice();
    steps[at] = {...steps[at], y: steps[at].y ^ 1};
    const tampered = compareTrace({...dog, steps});
    assert.ok(tampered.mismatches.some(m => m.native === '$80936C' && m.scheduled === kind && m.differences.some(d => d.startsWith('y '))),
      JSON.stringify(tampered.mismatches.map(m => [m.index, m.native, m.scheduled, m.differences])));
  }
});

test('Mesen2: status screen through $E014 with weapon choice and round from $E4F3 identical', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(status);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.deepEqual(report.faults, []);
  assert.equal(report.counts['equal-native-round-start'], 1, JSON.stringify(report.counts));
  assert.equal(report.counts['equal-native-round-end'], 1, JSON.stringify(report.counts));
  assert.ok(report.nativesEqual['$80E014'] >= 50, JSON.stringify(report.nativesEqual));
  assert.deepEqual(report.missingNatives, {});
});

test('Mesen2: Select overview through $E014/$ED3C with the mask words of $FB39 read by the NMI identical', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(select);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.deepEqual(report.faults, []);
  assert.ok(report.nativesEqual['$80E014'] >= 20, JSON.stringify(report.nativesEqual));
  assert.deepEqual(report.missingNatives, {});
  // Counter-check: a falsified mask word (observation after $81:ACC9) is a difference in the mask lines.
  const at = select.steps.findIndex(step => step.queue.some(token => token.startsWith('n81acc9:2ae2=')));
  assert.ok(at > 0, 'no mask observation in the window');
  const steps = select.steps.slice();
  steps[at] = {...steps[at], queue: steps[at].queue.map(token => token.startsWith('n81acc9:2ae2=') ? 'n81acc9:2ae2=0' : token)};
  const tampered = compareTrace({...select, steps});
  assert.ok(tampered.mismatches.some(m => m.native === '$80E014' && m.differences.some(d => d.startsWith('WRAM $7E2AE2'))),
    JSON.stringify(tampered.mismatches.map(m => [m.index, m.native, m.differences])));
});

// Return word of a JSR in the writes of an interval: first the high byte, then the low byte one stack place lower.
const pushesReturn = (step, word) => step.writes.some(([a, v], i) => a < 0x2000 && v === word >> 8
  && step.writes[i + 1]?.[0] === a - 1 && step.writes[i + 1][1] === (word & 0xFF));

test('Mesen2: item list through $E014/$EA8E (Y) identical', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(items);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.deepEqual(report.faults, []);
  assert.ok(report.nativesEqual['$80E014'] >= 20, JSON.stringify(report.nativesEqual));
  assert.deepEqual(report.missingNatives, {});
  // The path lies in the window: JSR $EA8E at $E037 pushes $E039 (not with Select).
  assert.ok(items.steps.some(step => pushesReturn(step, 0xE039)), 'JSR $EA8E not in the window');
  assert.ok(!select.steps.some(step => pushesReturn(step, 0xE039)));
});

test('Mesen2: bed in apartment 6, $CE6D with saving to SRAM and karma menu identical', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(bed);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.deepEqual(report.faults, []);
  assert.equal(report.nativesEqual['$80CE6D'], 1, JSON.stringify(report.nativesEqual));
  assert.equal(report.nativesEqual['$80D079'], 1, JSON.stringify(report.nativesEqual));
  assert.deepEqual(report.missingNatives, {});
  // It really saves: SRAM writes appear behind the WRAM in the write lists.
  const at = bed.steps.findIndex(step => step.writes.some(([a]) => a >= 0x20000));
  assert.ok(at > 0 && bed.steps[at].writes.filter(([a]) => a >= 0x20000).length > 1000, 'no saving in the window');
  // Counter-check: a falsified SRAM byte is a difference in $CE6D.
  const steps = bed.steps.slice();
  steps[at] = {...steps[at], writes: steps[at].writes.map(([a, v, n]) => [a, a === 0x20010 ? v ^ 1 : v, n])};
  const tampered = compareTrace({...bed, steps});
  assert.ok(tampered.mismatches.some(m => m.native === '$80CE6D' && m.differences.some(d => d.startsWith('SRAM $700010'))),
    JSON.stringify(tampered.mismatches.map(m => [m.native, m.differences])));
});

test('Mesen2: picking up the shades in apartment 6 ($D16D) and using them through Y (round at $E545) identical', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(shades);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.deepEqual(report.faults, []);
  assert.ok(report.nativesEqual['$80D16D'] >= 1 && report.nativesEqual['$80A835'] >= 1, JSON.stringify(report.nativesEqual));
  assert.equal(report.counts['equal-native-round-start'], 1, JSON.stringify(report.counts));
  assert.deepEqual(report.missingNatives, {});
});

test('Mesen2: file cabinet ($CCDB), note ($E1B3) and video phone in apartment 6 identical', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(desk);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.deepEqual(report.faults, []);
  assert.equal(report.nativesEqual['$80CCDB'], 1, JSON.stringify(report.nativesEqual));
  assert.equal(report.nativesEqual['$80E1B3'], 1, JSON.stringify(report.nativesEqual));
  assert.deepEqual(report.missingNatives, {});
  // Counter-check: a falsified amount of money (20 nuyen in $7E3C0D) is a difference in $CCDB.
  const at = desk.steps.findIndex(step => step.writes.some(([a, v]) => a === 0x3C0D && v === 0x14));
  assert.ok(at > 0, 'no money in the window');
  const steps = desk.steps.slice();
  steps[at] = {...steps[at], writes: steps[at].writes.map(([a, v, n]) => [a, a === 0x3C0D ? v ^ 1 : v, n])};
  const tampered = compareTrace({...desk, steps});
  assert.ok(tampered.mismatches.some(m => m.native === '$80CCDB' && m.differences.some(d => d.startsWith('WRAM $7E3C0D'))),
    JSON.stringify(tampered.mismatches.map(m => [m.native, m.differences])));
});

test('Mesen2: purchase offer of the business man (script $04D: $933A, $CD43, $CD20) identical', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const report = compareTrace(badge);
  assert.equal(report.selfCheck, 'equal');
  assert.deepEqual(report.mismatches, []);
  assert.deepEqual(report.faults, []);
  for (const target of ['$80933A', '$80CD43', '$80CD20']) assert.ok(report.nativesEqual[target] >= 1, `${target} ${JSON.stringify(report.nativesEqual)}`);
  assert.deepEqual(report.missingNatives, {});
  // Counter-check: with 200 instead of 20 nuyen in $7E3C0D the money check passes in the VM, Mesen refuses: a difference in $CD20.
  assert.equal(badge.initial[0x3C0D], 20);
  const initial = badge.initial.slice();
  initial[0x3C0D] = 200;
  const tampered = compareTrace({...badge, initial});
  assert.ok(tampered.mismatches.some(m => m.native === '$80CD20'), JSON.stringify(tampered.mismatches.map(m => [m.native, m.differences])));
});

// Short windows from the coverage measurement: each calls its native in an equal interval.
const SHORT_WINDOW_NATIVES = {morgue: ['$809D6A'], fridge: ['$80CBF7', '$809DEC'], punk: ['$80D1D2'], random: ['$80C51F', '$80CAA2'],
  arch: ['$80D134'], rail: ['$80CCB9', '$80CCCC'], afterdog: ['$809159'], doorkey: ['$80FF79', '$809BC6'],
  sleep: ['$80CD9D'],
  // Start from the saved game: scene set-up after loading.
  loaded: ['$80DE7E']};
test('Mesen2: short coverage windows ($CBF7, $C51F, $9BC6, $FF79, $CD9D and leaves) identical', {skip: exe ? false : `Mesen not available: ${reason}`}, () => {
  const names = Object.keys(ORACLE_WINDOWS).slice(-short.length);
  assert.deepEqual(names, Object.keys(SHORT_WINDOW_NATIVES));
  names.forEach((name, i) => {
    const report = compareTrace(short[i]);
    assert.equal(report.selfCheck, 'equal', name);
    assert.deepEqual(report.mismatches, [], name);
    assert.deepEqual(report.faults, [], name);
    assert.deepEqual(report.missingNatives, {}, name);
    // The whole R->C pass including camera, sprites and the observed loop head.
    if (name === 'arch') {
      assert.deepEqual(report.mainLoopStops, {});
      assert.equal(report.counts['equal-main-loop'], 5);
      const trace=short[i],at=trace.steps.findIndex((s,k)=>k>0&&s.kind==='C'&&s.pc===0x96C0
        &&trace.steps[k-1].kind==='R'&&trace.steps[k-1].pc===0x96C3);
      assert.ok(at>0);
      const end=trace.steps[at],changed=end.writes.findLastIndex(([a,,nmi])=>a===0xCC8&&!nmi);
      assert.ok(changed>=0,'camera velocity write missing');
      const steps=trace.steps.slice();
      steps[at]={...end,writes:end.writes.map((w,j)=>j===changed?[w[0],w[1]^1,w[2]]:w)};
      const tampered=compareTrace({...trace,steps});
      assert.ok(tampered.mismatches.some(m=>m.scheduled==='main-loop'&&m.differences.some(d=>d.startsWith('WRAM $7E0CC8'))));
      // An additional counter observation stays unused: this interval must not count as equal.
      steps[at]={...end,queue:[...end.queue,'b0']};
      const unused=compareTrace({...trace,steps});
      assert.equal(unused.counts['equal-main-loop'],4);
      assert.equal(unused.mainLoopStops['fault main_loop_observation_unused'],1);
    }
    for (const target of SHORT_WINDOW_NATIVES[name]) assert.ok(report.nativesCalled[target] >= 1, `${name} ${target} ${JSON.stringify(report.nativesCalled)}`);
  });
});
