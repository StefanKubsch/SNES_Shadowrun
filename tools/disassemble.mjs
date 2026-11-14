import { cpuToOffset, cpuLabel, hex } from './rom.mjs';

// Opcode/addressing matrix checked against WDC W65C816S datasheet, table 5-4.
// M and X immediate widths are derived from the caller's explicit CPU state.
const rows = [
  'BRK:imm8 ORA:dix COP:imm8 ORA:sr TSB:dp ORA:dp ASL:dp ORA:dil PHP:i ORA:immM ASL:A PHD:i TSB:abs ORA:abs ASL:abs ORA:long',
  'BPL:rel8 ORA:diy ORA:di ORA:siy TRB:dp ORA:dpx ASL:dpx ORA:dily CLC:i ORA:absy INC:A TCS:i TRB:abs ORA:absx ASL:absx ORA:longx',
  'JSR:abs AND:dix JSL:long AND:sr BIT:dp AND:dp ROL:dp AND:dil PLP:i AND:immM ROL:A PLD:i BIT:abs AND:abs ROL:abs AND:long',
  'BMI:rel8 AND:diy AND:di AND:siy BIT:dpx AND:dpx ROL:dpx AND:dily SEC:i AND:absy DEC:A TSC:i BIT:absx AND:absx ROL:absx AND:longx',
  'RTI:i EOR:dix WDM:imm8 EOR:sr MVP:block EOR:dp LSR:dp EOR:dil PHA:i EOR:immM LSR:A PHK:i JMP:abs EOR:abs LSR:abs EOR:long',
  'BVC:rel8 EOR:diy EOR:di EOR:siy MVN:block EOR:dpx LSR:dpx EOR:dily CLI:i EOR:absy PHY:i TCD:i JML:long EOR:absx LSR:absx EOR:longx',
  'RTS:i ADC:dix PER:rel16 ADC:sr STZ:dp ADC:dp ROR:dp ADC:dil PLA:i ADC:immM ROR:A RTL:i JMP:ind ADC:abs ROR:abs ADC:long',
  'BVS:rel8 ADC:diy ADC:di ADC:siy STZ:dpx ADC:dpx ROR:dpx ADC:dily SEI:i ADC:absy PLY:i TDC:i JMP:indx ADC:absx ROR:absx ADC:longx',
  'BRA:rel8 STA:dix BRL:rel16 STA:sr STY:dp STA:dp STX:dp STA:dil DEY:i BIT:immM TXA:i PHB:i STY:abs STA:abs STX:abs STA:long',
  'BCC:rel8 STA:diy STA:di STA:siy STY:dpx STA:dpx STX:dpy STA:dily TYA:i STA:absy TXS:i TXY:i STZ:abs STA:absx STZ:absx STA:longx',
  'LDY:immX LDA:dix LDX:immX LDA:sr LDY:dp LDA:dp LDX:dp LDA:dil TAY:i LDA:immM TAX:i PLB:i LDY:abs LDA:abs LDX:abs LDA:long',
  'BCS:rel8 LDA:diy LDA:di LDA:siy LDY:dpx LDA:dpx LDX:dpy LDA:dily CLV:i LDA:absy TSX:i TYX:i LDY:absx LDA:absx LDX:absy LDA:longx',
  'CPY:immX CMP:dix REP:imm8 CMP:sr CPY:dp CMP:dp DEC:dp CMP:dil INY:i CMP:immM DEX:i WAI:i CPY:abs CMP:abs DEC:abs CMP:long',
  'BNE:rel8 CMP:diy CMP:di CMP:siy PEI:di CMP:dpx DEC:dpx CMP:dily CLD:i CMP:absy PHX:i STP:i JML:ind CMP:absx DEC:absx CMP:longx',
  'CPX:immX SBC:dix SEP:imm8 SBC:sr CPX:dp SBC:dp INC:dp SBC:dil INX:i SBC:immM NOP:i XBA:i CPX:abs SBC:abs INC:abs SBC:long',
  'BEQ:rel8 SBC:diy SBC:di SBC:siy PEA:word SBC:dpx INC:dpx SBC:dily SED:i SBC:absy PLX:i XCE:i JSR:indx SBC:absx INC:absx SBC:longx',
];
export const opcodes = rows.flatMap(row => row.split(' ').map(entry => {
  const [mnemonic, mode] = entry.split(':');
  return { mnemonic, mode };
}));
const fixedLengths = {
  i: 1, A: 1, imm8: 2, dp: 2, dpx: 2, dpy: 2, dix: 2, diy: 2, di: 2, dil: 2, dily: 2, sr: 2, siy: 2,
  abs: 3, absx: 3, absy: 3, ind: 3, indx: 3, word: 3, block: 3, rel8: 2, rel16: 3, long: 4, longx: 4,
};

function validateState(state) {
  for (const flag of ['e', 'm', 'x']) if (![0, 1].includes(state[flag])) throw new Error(`Explicit ${flag} flag required (0 or 1)`);
  if (state.e && (!state.m || !state.x)) throw new Error('Emulation mode requires M=X=1');
}

export function decode(bytes, cpu, state) {
  validateState(state);
  const offset = cpuToOffset(cpu, bytes.length);
  const opcode = bytes[offset];
  const { mnemonic, mode } = opcodes[opcode];
  const length = mode === 'immM' ? (state.m ? 2 : 3) : mode === 'immX' ? (state.x ? 2 : 3) : fixedLengths[mode];
  const raw = Buffer.alloc(length);
  // Fetch wraps the PC within the current program bank, rather than reading
  // adjacent file bytes at $xx:FFFF.
  for (let i = 0; i < length; i++) raw[i] = bytes[cpuToOffset((cpu & 0xFF0000) | ((cpu + i) & 0xFFFF), bytes.length)];
  const value = length === 1 ? 0 : raw.readUIntLE(1, length - 1);
  const dollar = `$${hex(value, (length - 1) * 2)}`;
  const next = (cpu & 0xFF0000) | ((cpu + length) & 0xFFFF);
  let target;
  if (mode === 'rel8' || mode === 'rel16') {
    const delta = mode === 'rel8' ? raw.readInt8(1) : raw.readInt16LE(1);
    target = (cpu & 0xFF0000) | ((next + delta) & 0xFFFF);
  } else if (['JSR', 'JSL', 'JMP', 'JML'].includes(mnemonic) && ['abs', 'long'].includes(mode)) {
    target = mode === 'abs' ? (cpu & 0xFF0000) | value : value;
  }
  const operands = {
    i: '', A: 'A', dp: dollar, dpx: `${dollar},X`, dpy: `${dollar},Y`,
    dix: `(${dollar},X)`, diy: `(${dollar}),Y`, di: `(${dollar})`, dil: `[${dollar}]`, dily: `[${dollar}],Y`,
    sr: `${dollar},S`, siy: `(${dollar},S),Y`, abs: dollar, absx: `${dollar},X`, absy: `${dollar},Y`,
    ind: `[${dollar}]`, indx: `(${dollar},X)`, word: dollar,
    block: `$${hex(raw[2] ?? 0, 2)},$${hex(raw[1] ?? 0, 2)}`,
    rel8: target === undefined ? '' : `$${cpuLabel(target)}`, rel16: target === undefined ? '' : `$${cpuLabel(target)}`,
    long: dollar, longx: `${dollar},X`, imm8: `#${dollar}`, immM: `#${dollar}`, immX: `#${dollar}`,
  };
  if (mnemonic === 'JMP' && mode === 'ind') operands.ind = `(${dollar})`;
  return { cpu, offset, opcode, mnemonic, mode, length, raw, value, operand: operands[mode], next, target, state: { ...state } };
}

export function disassembleBlock(bytes, entry, initialState, limit = 256) {
  let cpu = entry;
  let state = { ...initialState };
  const instructions = [];
  const references = [];
  let stop = 'Instruction limit';
  for (let i = 0; i < limit; i++) {
    const instruction = decode(bytes, cpu, state);
    instructions.push(instruction);
    const { mnemonic, value, target, mode } = instruction;
    if (target !== undefined) references.push({ from: cpuLabel(cpu), to: cpuLabel(target), kind: mnemonic });
    if (['JSR', 'JSL', 'JMP', 'JML', 'BRA', 'BRL', 'RTS', 'RTL', 'RTI', 'BRK', 'COP', 'STP', 'WAI', 'PLP'].includes(mnemonic)) {
      stop = ['JSR', 'JSL'].includes(mnemonic) ? 'Call boundary: return CPU state not inferred' : `${mnemonic} boundary`;
      break;
    }
    if (mnemonic === 'REP' || mnemonic === 'SEP') {
      const set = mnemonic === 'SEP' ? 1 : 0;
      if (value & 0x20) state.m = state.e ? 1 : set;
      if (value & 0x10) state.x = state.e ? 1 : set;
      if (value & 1) state.c = set;
    } else if (mnemonic === 'CLC') state.c = 0;
    else if (mnemonic === 'SEC') state.c = 1;
    else if (mnemonic === 'XCE') {
      if (![0, 1].includes(state.c)) { stop = 'XCE boundary: incoming carry unknown'; break; }
      [state.e, state.c] = [state.c, state.e];
      if (state.e) state.m = state.x = 1;
    } else if (['ADC', 'SBC', 'CMP', 'CPX', 'CPY', 'ASL', 'LSR', 'ROL', 'ROR'].includes(mnemonic)) state.c = null;
    // Listings continue only along the conditional branch fallthrough. The
    // taken path is recorded as a reference, not asserted to be decoded.
    if (mode === 'rel8' && mnemonic === 'BCC') state.c = 1;
    if (mode === 'rel8' && mnemonic === 'BCS') state.c = 0;
    cpu = instruction.next;
  }
  return { entry, initialState, instructions, references, stop };
}

export function formatBlock(block) {
  const lines = [
    `; Entry $${cpuLabel(block.entry)}; initial E=${block.initialState.e} M=${block.initialState.m} X=${block.initialState.x}`,
    '; Static fallthrough listing; conditional taken paths are references only.',
    '; CPU address | ROM offset | bytes | instruction | incoming mode',
  ];
  for (const ins of block.instructions) {
    lines.push(`${cpuLabel(ins.cpu)}  ${hex(ins.offset)}  ${ins.raw.toString('hex').toUpperCase().match(/../g).join(' ').padEnd(11)}  ${(ins.mnemonic + ' ' + ins.operand).trim().padEnd(23)} ; E${ins.state.e} M${ins.state.m} X${ins.state.x}`);
  }
  lines.push(`; Stop: ${block.stop}`, '');
  return lines.join('\n');
}
