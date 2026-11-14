// SPC700 instruction text (docs/SOUND-DRIVER.md). Instruction set: Nintendo
// Book I, appendix C, PDF 227-236 (tables C-4 to C-20: mnemonic, operand,
// code, bytes). Operands as in the manual: d = direct page, !a = absolute,
// #i = immediate, r = relative branch, m.b = 13-bit address with bit number,
// u = upper page (PCALL). Only text decoding and assembling: the product never
// executes SPC700 code, the driver is ported natively (src/apu).
import { hex } from './rom-bytes.mjs';
import {
  WORD_MASK,
  HIGH_BYTE_MASK,
  BYTE_MASK,
  BYTE_BITS,
  HEX_RADIX,
  BYTE_HEX_DIGITS,
  WORD_HEX_DIGITS,
  BYTE_SIGN,
  INT8_MAX,
  INT8_MIN,
  WORD_SIGN,
} from '../constants/bits.mjs';

// m.b operands: a 13-bit address and the bit index in bits 13-15.
const MEMBIT_ADDRESS_MASK = 0x1fff,
  MEMBIT_BIT_SHIFT = 13;
const ROWS = [
  'NOP|TCALL 0|SET1 d.0|BBS d.0,r|OR A,d|OR A,!a|OR A,(X)|OR A,[d+X]|OR A,#i|OR dd,ds|OR1 C,m.b|ASL d|ASL !a|PUSH PSW|TSET1 !a|BRK',
  'BPL r|TCALL 1|CLR1 d.0|BBC d.0,r|OR A,d+X|OR A,!a+X|OR A,!a+Y|OR A,[d]+Y|OR d,#i|OR (X),(Y)|DECW d|ASL d+X|ASL A|DEC X|CMP X,!a|JMP [!a+X]',
  'CLRP|TCALL 2|SET1 d.1|BBS d.1,r|AND A,d|AND A,!a|AND A,(X)|AND A,[d+X]|AND A,#i|AND dd,ds|OR1 C,/m.b|ROL d|ROL !a|PUSH A|CBNE d,r|BRA r',
  'BMI r|TCALL 3|CLR1 d.1|BBC d.1,r|AND A,d+X|AND A,!a+X|AND A,!a+Y|AND A,[d]+Y|AND d,#i|AND (X),(Y)|INCW d|ROL d+X|ROL A|INC X|CMP X,d|CALL !a',
  'SETP|TCALL 4|SET1 d.2|BBS d.2,r|EOR A,d|EOR A,!a|EOR A,(X)|EOR A,[d+X]|EOR A,#i|EOR dd,ds|AND1 C,m.b|LSR d|LSR !a|PUSH X|TCLR1 !a|PCALL u',
  'BVC r|TCALL 5|CLR1 d.2|BBC d.2,r|EOR A,d+X|EOR A,!a+X|EOR A,!a+Y|EOR A,[d]+Y|EOR d,#i|EOR (X),(Y)|CMPW YA,d|LSR d+X|LSR A|MOV X,A|CMP Y,!a|JMP !a',
  'CLRC|TCALL 6|SET1 d.3|BBS d.3,r|CMP A,d|CMP A,!a|CMP A,(X)|CMP A,[d+X]|CMP A,#i|CMP dd,ds|AND1 C,/m.b|ROR d|ROR !a|PUSH Y|DBNZ d,r|RET',
  'BVS r|TCALL 7|CLR1 d.3|BBC d.3,r|CMP A,d+X|CMP A,!a+X|CMP A,!a+Y|CMP A,[d]+Y|CMP d,#i|CMP (X),(Y)|ADDW YA,d|ROR d+X|ROR A|MOV A,X|CMP Y,d|RETI',
  'SETC|TCALL 8|SET1 d.4|BBS d.4,r|ADC A,d|ADC A,!a|ADC A,(X)|ADC A,[d+X]|ADC A,#i|ADC dd,ds|EOR1 C,m.b|DEC d|DEC !a|MOV Y,#i|POP PSW|MOV d,#i',
  'BCC r|TCALL 9|CLR1 d.4|BBC d.4,r|ADC A,d+X|ADC A,!a+X|ADC A,!a+Y|ADC A,[d]+Y|ADC d,#i|ADC (X),(Y)|SUBW YA,d|DEC d+X|DEC A|MOV X,SP|DIV YA,X|XCN A',
  'EI|TCALL 10|SET1 d.5|BBS d.5,r|SBC A,d|SBC A,!a|SBC A,(X)|SBC A,[d+X]|SBC A,#i|SBC dd,ds|MOV1 C,m.b|INC d|INC !a|CMP Y,#i|POP A|MOV (X)+,A',
  'BCS r|TCALL 11|CLR1 d.5|BBC d.5,r|SBC A,d+X|SBC A,!a+X|SBC A,!a+Y|SBC A,[d]+Y|SBC d,#i|SBC (X),(Y)|MOVW YA,d|INC d+X|INC A|MOV SP,X|DAS A|MOV A,(X)+',
  'DI|TCALL 12|SET1 d.6|BBS d.6,r|MOV d,A|MOV !a,A|MOV (X),A|MOV [d+X],A|CMP X,#i|MOV !a,X|MOV1 m.b,C|MOV d,Y|MOV !a,Y|MOV X,#i|POP X|MUL YA',
  'BNE r|TCALL 13|CLR1 d.6|BBC d.6,r|MOV d+X,A|MOV !a+X,A|MOV !a+Y,A|MOV [d]+Y,A|MOV d,X|MOV d+Y,X|MOVW d,YA|MOV d+X,Y|DEC Y|MOV A,Y|CBNE d+X,r|DAA A',
  'CLRV|TCALL 14|SET1 d.7|BBS d.7,r|MOV A,d|MOV A,!a|MOV A,(X)|MOV A,[d+X]|MOV A,#i|MOV X,!a|NOT1 m.b|MOV Y,d|MOV Y,!a|NOTC|POP Y|SLEEP',
  'BEQ r|TCALL 15|CLR1 d.7|BBC d.7,r|MOV A,d+X|MOV A,!a+X|MOV A,!a+Y|MOV A,[d]+Y|MOV X,d|MOV X,d+Y|MOV dd,ds|MOV Y,d+X|INC Y|MOV Y,A|DBNZ Y,r|STOP',
];
export const SPC700_OPS = ROWS.flatMap((row) => row.split('|'));
// Operand bytes per placeholder, in encoding order (dd,ds: source first; d,#i:
// immediate first; branches: direct page first, displacement last).
const SIZES = [
  [/m\.b/, 2],
  [/!a/, 2],
  [/dd,ds/, 2],
  [/d,#i/, 2],
  [/d(\.\d)?,r|d\+X,r/, 2],
  [/\bd\b|\[d|\bu\b|#i|\br\b/, 1],
];
export function spc700Length(op) {
  const text = SPC700_OPS[op];
  for (const [pattern, size] of SIZES) if (pattern.test(text)) return 1 + size;
  return 1;
}
// One instruction at pc from bytes (ARAM image starting at base).
export function decodeSpc700(bytes, base, pc) {
  const at = pc - base,
    op = bytes[at],
    length = spc700Length(op),
    b1 = bytes[at + 1],
    b2 = bytes[at + 2];
  let text = SPC700_OPS[op],
    target = null;
  const rel = (v) => (pc + length + (((v & BYTE_MASK) ^ BYTE_SIGN) - BYTE_SIGN)) & WORD_MASK;
  if (/m\.b/.test(text)) {
    const w = b1 | (b2 << BYTE_BITS);
    text = text.replace(
      'm.b',
      `$${hex(w & MEMBIT_ADDRESS_MASK, WORD_HEX_DIGITS)}.${w >> MEMBIT_BIT_SHIFT}`,
    );
  } else if (/dd,ds/.test(text))
    text = text.replace('dd,ds', `$${hex(b2, BYTE_HEX_DIGITS)},$${hex(b1, BYTE_HEX_DIGITS)}`);
  else if (/d,#i/.test(text))
    text = text.replace('d,#i', `$${hex(b2, BYTE_HEX_DIGITS)},#$${hex(b1, BYTE_HEX_DIGITS)}`);
  else if (/,r$/.test(text) && /d/.test(text.split(' ')[1] ?? '')) {
    target = rel(b2);
    text = text.replace(
      /d(\.\d|\+X)?,r/,
      (m, s) => `$${hex(b1, BYTE_HEX_DIGITS)}${s ?? ''},$${hex(target, WORD_HEX_DIGITS)}`,
    );
  } else if (/!a/.test(text)) {
    const w = b1 | (b2 << BYTE_BITS);
    text = text.replace('!a', `$${hex(w, WORD_HEX_DIGITS)}`);
    if (/^(CALL|JMP !a)/.test(SPC700_OPS[op])) target = w;
  } else if (/\br$/.test(text)) {
    target = rel(b1);
    text = text.replace(/\br$/, `$${hex(target, WORD_HEX_DIGITS)}`);
  } else if (/#i/.test(text)) text = text.replace('#i', `#$${hex(b1, BYTE_HEX_DIGITS)}`);
  else if (/\bu\b/.test(text)) {
    target = HIGH_BYTE_MASK | b1;
    text = text.replace(/\bu\b/, `$${hex(b1, BYTE_HEX_DIGITS)}`);
  } else if (/\bd\b|\[d/.test(text)) text = text.replace(/\bd\b/, `$${hex(b1, BYTE_HEX_DIGITS)}`);
  return { pc, op, length, text, target, bytes: Array.from(bytes.subarray(at, at + length)) };
}

// Assembler, the inverse of decodeSpc700: each template becomes a pattern for
// the same text, with the placeholders in the order the decoder fills them.
// A line must match exactly one opcode.
const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const H2 = '\\$([0-9A-F]{2})',
  H4 = '\\$([0-9A-F]{4})';
const word = (w) => [w & BYTE_MASK, w >> BYTE_BITS];
// [marker in the template, pattern for it, operand bytes from the groups].
function operand(text) {
  const branch = /d(\.\d|\+X)?,r/.exec(text);
  if (/m\.b/.test(text))
    return [
      /m\.b/,
      `${H4}\\.([0-7])`,
      ([a, b]) =>
        parseInt(a, HEX_RADIX) > MEMBIT_ADDRESS_MASK
          ? null
          : word(parseInt(a, HEX_RADIX) | (b << MEMBIT_BIT_SHIFT)),
    ];
  if (/dd,ds/.test(text))
    return [/dd,ds/, `${H2},${H2}`, ([d, s]) => [parseInt(s, HEX_RADIX), parseInt(d, HEX_RADIX)]];
  if (/d,#i/.test(text))
    return [/d,#i/, `${H2},#${H2}`, ([d, i]) => [parseInt(i, HEX_RADIX), parseInt(d, HEX_RADIX)]];
  if (/,r$/.test(text) && branch && /d/.test(text.split(' ')[1] ?? ''))
    return [branch, `${H2}${escape(branch[1] ?? '')},${H4}`, ([d, t], rel) => rel(t, d)];
  if (/!a/.test(text)) return [/!a/, H4, ([w]) => word(parseInt(w, HEX_RADIX))];
  if (/\br$/.test(text)) return [/\br$/, H4, ([t], rel) => rel(t)];
  if (/#i/.test(text)) return [/#i/, `#${H2}`, ([i]) => [parseInt(i, HEX_RADIX)]];
  if (/\bu\b/.test(text)) return [/\bu\b/, H2, ([u]) => [parseInt(u, HEX_RADIX)]];
  if (/\bd\b/.test(text)) return [/\bd\b/, H2, ([d]) => [parseInt(d, HEX_RADIX)]];
  return null;
}
const TEMPLATES = SPC700_OPS.map((text) => {
  const found = operand(text);
  if (!found) return { pattern: new RegExp(`^${escape(text)}$`), encode: () => [] };
  const [marker, groups, encode] = found,
    m = marker instanceof RegExp ? marker.exec(text) : marker;
  return {
    pattern: new RegExp(
      `^${escape(text.slice(0, m.index))}${groups}${escape(text.slice(m.index + m[0].length))}$`,
    ),
    encode,
  };
});
// The bytes of one instruction text at pc, or null when no single opcode
// gives exactly this text.
export function assembleSpc700(text, pc) {
  const found = [];
  TEMPLATES.forEach((t, op) => {
    const m = t.pattern.exec(text);
    if (m) found.push([op, m.slice(1)]);
  });
  if (found.length !== 1) return null;
  const [[op, groups]] = found,
    length = spc700Length(op);
  const rel = (target, d) => {
    const v = ((parseInt(target, HEX_RADIX) - (pc + length) + WORD_SIGN) & WORD_MASK) - WORD_SIGN;
    if (v < INT8_MIN || v > INT8_MAX) return null;
    return d === undefined ? [v & BYTE_MASK] : [parseInt(d, HEX_RADIX), v & BYTE_MASK];
  };
  const bytes = TEMPLATES[op].encode(groups, rel);
  return bytes && bytes.length === length - 1 ? [op, ...bytes] : null;
}
