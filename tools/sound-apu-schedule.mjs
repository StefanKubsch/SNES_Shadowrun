// Ereignisfolgen für den Vergleich des nativen Soundprozessors (nur Werkzeug/Test).
//   ['w', port, value, width]  CPU schreibt 2140+port
//   ['f']                      ein Bild Audiozeit (NMI)
//   ['cmd', befehl, parameter] F007-Protokoll: Parameter an Port 2/3, Befehl an
//                              Port 1, nächstes Token an Port 0 (Echo wird geprüft)
//   ['pair', a, b]             F03A-Paar: Port 1, Port 2, nächstes Token
//   ['reply']                  nächstes Token für eine Antwort an Port 1
//   ['entries', erste, vorlage, einträge]  Klangeinträge über Befehl 10
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {ObservedRoom} from '../proof/video/room-observed.mjs';
import {soundCatalog, romReader} from './sound-catalog.mjs';

const romFile = new URL('../Shadowrun (E).smc', import.meta.url);
// Der CPU-Portverkehr und die NMIs des aufgezeichneten Raumlaufs (Boot bis erster Raum).
export function roomSchedule(rom) {
  const bundle = JSON.parse(gunzipSync(readFileSync(new URL('../assets/room-observations.json.gz', import.meta.url))));
  const room = new ObservedRoom(rom, bundle), events = [];
  room.apu = room.devices.apu = {cpuWrite: (port, value, width) => events.push(['w', port, value, width]), frame: () => events.push(['f'])};
  room.finish();
  return events;
}
// F130/F03A: Befehl 10 mit der Abschnittslänge, dann Zielwort und Bytes paarweise.
function upload(out, item, reader) {
  let at = item.destination;
  for (const c of item.chunks) {
    out.push(['cmd', 0x10, c.bytes]);
    const bytes = c.kind === 'data' ? c.data : c.kind === 'raw' ? Array.from(reader.bytes(c.source, c.bytes))
      : Array.from({length: c.bytes}, (_, n) => c.word >> 8 * (n & 1) & 255);
    out.push(['pair', at & 255, at >> 8]);
    for (let n = 0; n < bytes.length; n += 2) out.push(['pair', bytes[n], bytes[n + 1] ?? 0]);
    at += c.bytes;
  }
}
const word = w => [w & 255, w >> 8];
// Synthetisches Lied 13 an $F800 mit eigenen Klangeinträgen $BB-$BE für die
// Pfade, die die Spieldaten nicht enthalten: Tempoliste mit F8 und Rampen bis
// zur Sättigung, C0-Beugung, E0-Musterende, Loslassen ohne Release-ADSR,
// Gleitmodi 1-3 (auch abwärts über Note 0) und Wiederholung nach dem Ende aller Spuren.
function syntheticSong(out, reader) {
  const block = (destination, data) => upload(out, {destination, chunks: [{kind: 'data', bytes: data.length, data}]}, reader);
  const song = 0xF800, tempo = 0xF880, lists = 0xF8A0, patterns = 0xF900;
  const p0 = [0x81, 0x30, 0x01, 0x04, 0xA1, 0x30, 0x02, 0x82, 0x40, 0x02, 0x03, 0x82, 0x3B, 0x02, 0x03, 0xC3, 0x40, 0x03, 0xC5, 0xC0, 0x02, 0xE0];
  const p1 = [0x83, 0x34, 0x03, 0x05, 0x83, 0x52, 0x03, 0x06, 0x84, 0x20, 0x04, 0x02, 0xA4, 0x20, 0x01, 0xFF];
  const p2 = [0x81, 0x20, 0x01, 0x7F, 0x7F, 0x7F, 0x80, 0x45, 0x02, 0x08, 0xFF];
  const at0 = patterns, at1 = at0 + p0.length, at2 = at1 + p1.length;
  const list0 = lists, list1 = lists + 6, end = lists + 10;
  const listBytes = [...word(at0), ...word(at1), 0, 0, ...word(at2), 0, 0, 0, 0];
  const tempoBytes = [0x02, 0xF8, 0x30, 0x01, 0x80, 0x40, 0x50, 0x89, 0x7F, 0x7F, 0x03, 0x8A, 0x81, 0x81, 0x04, 0x00, 0xFF];
  const header = [0x20, ...word(list0), ...word(list1), ...Array(6).fill(0).flatMap(() => word(end)), ...word(tempo),
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x60, 0x50, 0x40, 0x30, 0x70, 0x70, 0x70, 0x70,
    0x60, 0x50, 0x40, 0x30, 0x70, 0x70, 0x70, 0x70, 0x10, 0xBB, 0xBC, 0xBD, 0xBE, ...Array(27).fill(0x10)];
  block(song, header); block(tempo, tempoBytes); block(lists, listBytes); block(patterns, [...p0, ...p1, ...p2]);
  const entry = (flags, release) => [0, 0x60, 0x00, 0x10, 0x00, 0x8F, 0xE0, 0x00, release, 0x40, 0x00, flags, 0x10, 0x00, 0x00, 0x00];
  out.push(['entries', 0xBB, 0x10, [entry(0x04, 0x00), entry(0x44, 0x1F), entry(0x84, 0x1F), entry(0xC4, 0x1F)]]);
  block(0xD07F, word(song)); // Liedtabelle [$18] Eintrag 13
}
// Feste Befehlsfolge nach dem Raumverkehr: alle Lieder (Einträge FF-n) mit
// Wiederholung, Klangsätze, Klänge 00-BF mit Noten und Lautstärken, Klangfolgen
// ab $C3, alle übrigen Befehle samt Antworten, das synthetische Lied und zuletzt
// Befehl 00 zurück ins IPL.
export function syntheticSchedule(rom = readFileSync(romFile)) {
  const catalog = soundCatalog(rom), reader = romReader(rom), out = [];
  const item = id => catalog[0].items.find(i => i.id === id);
  const frames = n => { for (let k = 0; k < n; k++) out.push(['f']); };
  const command = (cmd, param = 0) => out.push(['cmd', cmd, param]);
  const reply = () => out.push(['reply']);
  command(0x14, 0x00);                       // $0E Bit 7 frei: Mittelung L/R ($07FD)
  for (let song = 1; song <= 12; song++) { upload(out, item(0xFF - song), reader); command(0x04, song | 0x100); frames(150); }
  for (const id of [0x2F, 0x33, 0x37]) upload(out, item(id), reader);
  command(0x04, 3); frames(40);
  for (let id = 0; id < 0xC0; id++) {
    command(0x06, 0x7F7F - id * 0x0101 & 0x7F7F);
    command(0x05, (id & 1 ? 0xFF : (0x20 + (id * 7 & 0x3F)) | (id & 2 ? 0x0F : 0)) << 8 | id);
    frames(id % 5 === 0 ? 6 : 1);
  }
  for (let id = 0xC3; id <= 0xFF; id++) { command(0x05, 0xFF00 | id); frames(id < 0xCA ? 50 : 2); }
  for (let id = 0; id < 0x30; id++) { command(0x07, (id * 0x37 & 0xFF) << 8 | id); command(0x0F, 1 << (id & 7)); frames(2); }
  command(0x0F, 0xFF);
  command(0x0E, 0x9A00 | 0x10); command(0x0E, 0x0300 | 0x11);
  for (let t = 0; t < 8; t++) command(0x12, (t * 0x21 & 0xFF) << 8 | t);
  command(0x12, 0x4075);                     // X = $75: $79+X = $EE, $81+X = $F6 (Port 2)
  command(0x13, 0x00); reply(); command(0x13, 0x40); reply();
  command(0x15, 0x02); command(0x16, 0x0C); command(0x04, 2); frames(60);
  command(0x16, 0x40); command(0x04, 4); frames(30); command(0x16, 0x0A);
  command(0x17, 0x2060); command(0x14, 0x80); command(0x17, 0x2060); command(0x18, 0x1234);
  command(0x19, 0xA5); frames(20); command(0x19, 0xFF); frames(20);
  command(0x09); command(0x0A); command(0x0B);
  command(0x02, 0x3030); command(0x03, 0x0303); frames(80); command(0x02, 0x7F7F); command(0x03, 0x0505); frames(80);
  command(0x08, 0x5060); command(0x03, 0xFFFF); command(0x02, 0x0000); frames(20);
  command(0x0D, 0x8040); command(0x04, 5 | 0x100); frames(200);
  command(0x11); for (let n = 0; n < 16; n++) reply();
  command(0x0C); frames(10);
  syntheticSong(out, reader); command(0x04, 13 | 0x100); frames(700);
  command(0x00); frames(2);
  return out;
}
// Spielt eine Folge auf mehreren Einheiten gleich ab.
export function runSchedule(apus, schedule, reader = romReader(readFileSync(romFile))) {
  for (const e of schedule) {
    if (e[0] === 'f') { for (const a of apus) a.frame(); continue; }
    if (e[0] === 'w') { for (const a of apus) a.cpuWrite(e[1], e[2], e[3]); continue; }
    if (e[0] === 'entries') {
      const r = apus[0].ram, table = r[0x14] | r[0x15] << 8, from = table + e[2] * 16, data = [];
      for (const bytes of e[3]) { const b = [...bytes]; b[4] = r[from + 4]; b[14] = r[from + 14]; b[15] = r[from + 15]; data.push(...b); }
      const out = []; upload(out, {destination: table + e[1] * 16, chunks: [{kind: 'data', bytes: data.length, data}]}, reader);
      runSchedule(apus, out, reader); continue;
    }
    for (const a of apus) {
      const token = a.io.cpuIn[0] + 1 & 255;
      if (e[0] === 'cmd') { a.cpuWrite(2, e[2], 2); a.cpuWrite(1, e[1]); }
      else if (e[0] === 'pair') { a.cpuWrite(1, e[1]); a.cpuWrite(2, e[2]); }
      a.cpuWrite(0, token);
      if (e[0] === 'cmd' && e[1] === 0) continue; // zurück ins IPL: AA/BB statt Echo
      if (a.cpuRead(0) !== token) throw Error('apu_echo_missing ' + JSON.stringify(e) + ' state ' + a.state);
    }
  }
}
