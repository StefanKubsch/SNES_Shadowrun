// Analyse des Soundtreibers (nur Werkzeug). Quelle: F07F lädt mit Y=8000,
// A=97, X=0C55 über EFA5 (IPL-Protokoll, Book I Anhang D, PDF 237/238) 0C55
// Bytes aus ROM 97:8000 nach ARAM $0200 und startet dort (Port 2/3 = 0200).
// Die Befehlsverteilung patcht den Operanden von CALL $02C2 aus den Tabellen
// $02C8+Y (Low) und $02E2+Y (High); diese 52 Bytes sind Daten, kein Code.
import {readFileSync} from 'node:fs';
import {decodeSpc700,SPC700_OPS} from './spc700-decode.mjs';

export const DRIVER = Object.freeze({romBank: 0x97, romOffset: 0x8000, length: 0x0C55, aram: 0x0200, entry: 0x0200,
  dispatchCall: 0x02C2, dispatchLow: 0x02C8, dispatchHigh: 0x02E2, commands: 26});
const romFile = new URL('../Shadowrun (E).smc', import.meta.url);
export function driverBytes(rom = readFileSync(romFile)) {
  const at = ((DRIVER.romBank & 0x7F) * 0x8000) + (DRIVER.romOffset - 0x8000);
  return Uint8Array.from(rom.subarray(at, at + DRIVER.length));
}
export function dispatchTargets(bytes) {
  const at = a => bytes[a - DRIVER.aram];
  return Array.from({length: DRIVER.commands}, (_, y) => at(DRIVER.dispatchLow + y) | at(DRIVER.dispatchHigh + y) << 8);
}
const isData = pc => pc >= DRIVER.dispatchLow && pc < DRIVER.dispatchHigh + DRIVER.commands;
// Rekursiver Abstieg ab dem Eintritt und allen Befehlszielen. PCALL/TCALL
// zeigen in die obere Seite bzw. Vektoren; sie werden gesondert gemeldet.
export function decodeDriver(bytes = driverBytes()) {
  const end = DRIVER.aram + bytes.length, seen = new Map(), queue = [DRIVER.entry, ...dispatchTargets(bytes)], external = new Set();
  while (queue.length) {
    let pc = queue.pop();
    for (;;) {
      if (seen.has(pc)) break;
      if (pc < DRIVER.aram || pc >= end || isData(pc)) { external.add(pc); break; }
      const d = decodeSpc700(bytes, DRIVER.aram, pc); seen.set(pc, d);
      const mnemonic = SPC700_OPS[d.op].split(' ')[0];
      if (d.target !== null && pc !== DRIVER.dispatchCall && !/^(PCALL|TCALL)$/.test(mnemonic)) queue.push(d.target);
      if (/^(BRA|RET|RETI|STOP|SLEEP|BRK)$/.test(mnemonic) || /^JMP/.test(d.text)) break;
      pc += d.length;
    }
  }
  return {instructions: [...seen.values()].sort((a, b) => a.pc - b.pc), external: [...external].sort((a, b) => a - b)};
}
