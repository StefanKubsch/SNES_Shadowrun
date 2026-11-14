// Katalog der Sounddaten, die die CPU in den Soundtreiber lädt (nur Werkzeug).
// Quelle ist der Lesepfad der Originalroutinen, nicht ein angenommenes Format:
// F092: Verzeichnis = 24-Bit-Zeiger an 98:FFFA+X; Basisliste über [Verz.+2]
//       mit Treiberbefehl 01. F130: Einträge ab Verz.+5 je 4 Bytes (Nummer,
//       24-Bit-Zeiger) bis Nummer FF, übertragen mit Treiberbefehl 10.
// Blockliste: WORD Gesamtlänge+2, WORD ARAM-Ziel, dann Abschnitte bis die
// Restlänge 0 ist: WORD n < 8000 mit 24-Bit-Quelle (n Rohbytes) oder
// WORD 8000|n mit WORD Füllwert (n Wörter, F1B9/F1E8).
import {readFileSync} from 'node:fs';

const romFile = new URL('../Shadowrun (E).smc', import.meta.url);
export function romReader(rom = readFileSync(romFile)) {
  const offset = address => {
    const bank = (address >>> 16) & 0x7F, low = address & 0xFFFF;
    if (low < 0x8000) throw Error('sound_catalog_rom_address_required ' + address.toString(16));
    return bank * 0x8000 + (low - 0x8000);
  };
  const byte = address => rom[offset(address)];
  return {byte, word: address => byte(address) | byte(address + 1) << 8,
    long: address => byte(address) | byte(address + 1) << 8 | byte(address + 2) << 16,
    bytes: (address, length) => Uint8Array.from({length}, (_, n) => byte(address + n))};
}
// The list pointer is a long pointer; offsets advance inside its bank (LDA [$89],Y).
export function readBlockList(r, list) {
  const at = n => (list & 0xFF0000) | ((list + n) & 0xFFFF);
  let remaining = r.word(at(0)) - 2, y = 2;
  const destination = r.word(at(y)); y += 2;
  const chunks = [];
  while (remaining !== 0) {
    if (remaining < 0) throw Error('sound_catalog_length_mismatch ' + list.toString(16));
    const head = r.word(at(y));
    if (head & 0x8000) {
      const count = head & 0x7FFF, word = r.word(at(y + 2));
      chunks.push({kind: 'fill', count, word, bytes: count * 2}); remaining -= count * 2; y += 4;
    } else {
      const source = r.long(at(y + 2));
      chunks.push({kind: 'raw', source, bytes: head}); remaining -= head; y += 5;
    }
  }
  return {list, destination, chunks, bytes: chunks.reduce((n, c) => n + c.bytes, 0)};
}
export function soundCatalog(rom) {
  const r = romReader(rom), directories = [];
  for (let x = 0; x <= 3; x += 3) {
    const directory = r.long(0x98FFFA + x);
    const base = readBlockList(r, r.long((directory & 0xFF0000) | ((directory + 2) & 0xFFFF)));
    const items = [];
    for (let y = 5; ; y += 4) {
      const id = r.byte((directory & 0xFF0000) | ((directory + y) & 0xFFFF));
      if (id === 0xFF) break;
      items.push({id, ...readBlockList(r, r.long((directory & 0xFF0000) | ((directory + y + 1) & 0xFFFF)))});
    }
    directories.push({x, directory, base, items});
  }
  return directories;
}
