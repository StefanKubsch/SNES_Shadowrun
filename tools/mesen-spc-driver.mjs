// Mesen-Orakel des Soundprozessors (nur Werkzeug/Test): liest die Zeilen von
// tools/mesen/trace-spc-driver.lua. Ergebnis in kompakten Feldern:
//   events  Int32Array-Folge [kind, pc, address, value, extra, cycle]
//           kind 1 = Lesen, 2 = Schreiben, 3 = Abbild (value = Abbildindex)
//   snapshots [{frame, cycle, aram, dsp}], voices [{cycle, voices:[[mode,env,hidden,delay]], counter, everyOther}]
//   inner [{cycle, voices:[[...VOICE_FIELDS, sampleBuffer0-11]], global:[...GLOBAL_FIELDS, echoHistory0-15]}]
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {prepareScript, runMesen} from './mesen.mjs';
import {decodeSpc700} from './spc700-decode.mjs';
import {SpcIo as SpcIoBase} from '../src/apu/spc-io.mjs';

const ROM_PATH = fileURLToPath(new URL('../Shadowrun (E).smc', import.meta.url));
export const READ = 1, WRITE = 2, SNAPSHOT = 3;
// Felder der X-Zeilen in der Reihenfolge von trace-spc-driver.lua.
export const VOICE_FIELDS = ['brrAddress', 'brrOffset', 'bufferPos', 'interpolationPos', 'envOut'];
export const GLOBAL_FIELDS = ['outSamples0', 'outSamples1', 'echoIn0', 'echoIn1', 'echoOut0', 'echoOut1', 'echoHistoryPos',
  'echoOffset', 'echoLength', 'echoPointer', 'echoRingBufferAddress', 'noiseLfsr', 'voiceOutput', 'outRegBuffer',
  'envRegBuffer', 'voiceEndBuffer', 'looped', 'pitch', 'brrData', 'brrHeader', 'brrNextAddress', 'sourceNumber',
  'sampleAddress', 'dirSampleTableAddress', 'echoOn', 'noiseOn', 'pitchModulationOn', 'keyOn', 'keyOff', 'newKeyOn',
  'adsr1', 'step', 'echoEnabled'];
export async function recordSpcDriver(exe, {frames = 2400, snap = 200, timeoutMs = 900000} = {}) {
  const script = prepareScript('trace-spc-driver.lua', {FRAMES: frames, SNAP: snap});
  let events = new Int32Array(1 << 20), used = 0, received = 0, announced = null, damage = null, aram = null, dspFrame = null, dspCycle = null;
  const snapshots = [], voices = [], inner = [];
  const push = (kind, pc, address, value, extra, cycle, count) => {
    for (let k = 0; k < count; k++) {
      if (used + 6 > events.length) { const grown = new Int32Array(events.length * 2); grown.set(events); events = grown; }
      events.set([kind, pc, address, value, extra, cycle], used); used += 6;
    }
  };
  const result = await runMesen(exe, ROM_PATH, script, raw => {
    if (damage || announced !== null) return;
    if (raw.startsWith('N ')) { announced = Number(raw.slice(2)); return; }
    if (!/^[RWDAGVX] /.test(raw)) return;
    try {
      const match = / #(\d+)$/.exec(raw); assert.ok(match, 'unsequenced SPC record');
      assert.equal(Number(match[1]), ++received, 'damaged SPC record sequence');
      let body = raw.slice(0, match.index), count = 1;
      const rep = / \*(\d+)$/.exec(body); if (rep) { count = Number(rep[1]); body = body.slice(0, rep.index); }
      const [tag, ...t] = body.split(' ');
      if (tag === 'R') { const v = t.map(x => parseInt(x, 16)); push(READ, v[0], v[1], v[2], 0, v[3] ?? -1, count); }
      else if (tag === 'W') { const v = t.map(x => parseInt(x, 16)); push(WRITE, v[0], v[1], v[2], v[3] ?? -1, v[4] ?? -1, count); }
      else if (tag === 'D') { dspFrame = Number(t[0]); dspCycle = parseInt(t[1], 16); aram = new Uint8Array(65536); }
      else if (tag === 'A') aram.set(Uint8Array.from(t[1].match(/../g), h => parseInt(h, 16)), Number(t[0]));
      else if (tag === 'G') {
        snapshots.push({frame: dspFrame, cycle: dspCycle, aram, dsp: Uint8Array.from(t[0].match(/../g), h => parseInt(h, 16))});
        push(SNAPSHOT, 0, 0, snapshots.length - 1, 0, -1, 1); aram = null;
      } else if (tag === 'V') voices.push({cycle: parseInt(t[0], 16), voices: t.slice(1, 9).map(x => x.split('/').map(Number)),
        counter: Number(t[9]), everyOther: Number(t[10])});
      else if (tag === 'X') inner.push({cycle: parseInt(t[0], 16), voices: t.slice(1, 9).map(x => x.split('/').map(Number)), global: t[9].split('/').map(Number)});
    } catch (error) { damage = error; }
  }, {timeoutMs, keep: () => !damage && announced !== null && announced === received});
  if (damage) throw damage;
  assert.equal(result.code, 0, 'Mesen SPC run'); assert.equal(announced, received, 'complete SPC record');
  return {events: events.subarray(0, used), snapshots, voices, inner};
}
// Mesen liest das Ziel mancher Schreibbefehle vorher (Blindlesung ohne Wirkung
// auf $F3-$F7). Der native Treiber liest dort nicht.
const STORES = new Set([0x8F, 0xC4, 0xC5, 0xC9, 0xCB, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xDA]);
export function dummyRead(aram, pc, address) {
  const d = decodeSpc700(aram, 0, pc), op = d.op;
  if (op === 0xFA) return d.bytes[2] === address && d.bytes[1] !== address;
  if (!STORES.has(op)) return false;
  return op === 0x8F ? d.bytes[2] === address : true;
}

// Beobachtungsgerät für den nativen Soundprozessor: Lesungen kommen in der
// Reihenfolge des Originals (gleiche Befehlsadresse und Adresse), ausgelassene
// Leerlauflesungen liefern den zuletzt gesehenen Portwert bzw. Zähler 0.
// Jeder Schreibzugriff muss dem nächsten des Originals gleichen. Abbilder
// werden am Durchlaufbeginn ($FD-Lesung an 0244) verglichen.
const IPL_STORES = new Map([[0xFFC9, 0xF4], [0xFFCC, 0xF5], [0xFFE0, 0xF4], [0xFFF5, 0xF4]]);
export function observedEvents(events, driver) {
  const aram = new Uint8Array(65536); aram.set(driver, 0x0200);
  const out = [];
  for (let n = 0; n < events.length; n += 6) {
    const kind = events[n], pc = events[n + 1], address = events[n + 2];
    if (kind === READ && (pc >= 0xFFC0 ? IPL_STORES.get(pc) === address : pc >= 0x0200 && dummyRead(aram, pc, address))) continue;
    out.push(n);
  }
  return out;
}
export class ObservedSpcIo extends SpcIoBase {
  constructor(dsp, events, order, {onSnapshot}) {
    super(dsp); this.events = events; this.order = order; this.at = 0; this.onSnapshot = onSnapshot; this.reads = 0; this.writes = 0;
  }
  get done() { return this.at >= this.order.length; }
  peek() { return this.done ? -1 : this.order[this.at]; }
  read(address, pc) {
    if (address === 0xFD && pc === 0x0244) for (let e = this.peek(); e >= 0 && this.events[e] === SNAPSHOT; e = this.peek()) { this.at++; this.onSnapshot(this.events[e + 3]); }
    const e = this.peek();
    if (e >= 0 && this.events[e] === READ && this.events[e + 1] === pc && this.events[e + 2] === address) {
      this.at++; this.reads++;
      const value = this.events[e + 3];
      if (address >= 0xF4 && address <= 0xF7) this.cpuIn[address - 0xF4] = value;
      if (address >= 0xFD) { this.counters[address - 0xFD] = 0; if (value) this.counterTicks++; }
      return value;
    }
    if (address === 0xF4) return this.cpuIn[0];
    if ((address === 0xFD && pc === 0x0244) || (address === 0xFE && pc === 0x025F)) return 0;
    throw new SpcObservationMismatch('read', {address, pc, next: this.describe(e)});
  }
  write(address, value, pc) {
    const e = this.peek();
    const ok = e >= 0 && this.events[e] === WRITE && this.events[e + 2] === address && this.events[e + 3] === value &&
      (address !== 0xF3 || this.events[e + 4] === this.dspAddress);
    if (!ok) throw new SpcObservationMismatch('write', {address, value, dsp: this.dspAddress, pc, next: this.describe(e)});
    this.at++; this.writes++;
    super.write(address, value, pc);
  }
  describe(e) { return e < 0 ? 'end' : Array.from(this.events.subarray(e, e + 6), v => v.toString(16)).join(' '); }
}
export class SpcObservationMismatch extends Error {
  constructor(kind, details) { super(`spc_observation_${kind}_mismatch ${JSON.stringify(details)}`); this.details = details; }
}
