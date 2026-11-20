// The WRAM addresses the script bytecode reads or writes itself (opcodes load_state_*
// and store_state_*, src/script/opcodes.mjs), over all scripts of assets/scripts.json.
// Everything else the scripts touch goes through natives. docs/STATE-MODEL-REBUILD.md:
// these addresses stay a named byte store when the rest of the state leaves WRAM.
//   node tools/script-state-addresses.mjs [--json]
import { readFileSync } from 'node:fs';
import { decodeScript } from '../src/script/codec.mjs';

const STATE_OPCODE = /^(load|store)_state_(u8|i8|u16)$/,
  HEX = 16,
  ADDRESS_DIGITS = 4,
  WORD_BYTES = 2;

export function scriptStateAddresses(scripts) {
  const addresses = new Map();
  for (const script of scripts) {
    const { instructions } = decodeScript(Uint8Array.from(script.bytecode));
    for (const ins of instructions.values()) {
      const match = STATE_OPCODE.exec(ins.name);
      if (!match) continue;
      const entry = addresses.get(ins.operand) ?? {
        address: ins.operand,
        bytes: 1,
        reads: 0,
        writes: 0,
        scripts: new Set(),
      };
      if (match[2] === 'u16') entry.bytes = WORD_BYTES;
      entry[match[1] === 'load' ? 'reads' : 'writes']++;
      entry.scripts.add(script.id);
      addresses.set(ins.operand, entry);
    }
  }
  return [...addresses.values()]
    .sort((a, b) => a.address - b.address)
    .map((e) => ({ ...e, scripts: e.scripts.size }));
}

if (import.meta.url === `file:///${process.argv[1].replaceAll('\\', '/')}`) {
  const { scripts } = JSON.parse(
    readFileSync(new URL('../assets/scripts.json', import.meta.url), 'utf8'),
  );
  const list = scriptStateAddresses(scripts);
  if (process.argv.includes('--json')) console.log(JSON.stringify(list, null, 1));
  else {
    for (const e of list)
      console.log(
        `7E:${e.address.toString(HEX).toUpperCase().padStart(ADDRESS_DIGITS, '0')} ` +
          `${e.bytes === WORD_BYTES ? 'word' : 'byte'} reads ${e.reads} writes ${e.writes} in ${e.scripts} scripts`,
      );
    console.log(`${list.length} addresses in ${scripts.length} scripts`);
  }
}
