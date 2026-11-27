// The script decompiler (docs/READABLE-GAME.md, phase 2): turns the 937 bytecode scripts
// of assets/scripts.json into readable generator functions in src/scripts/.
//
//   node tools/decompile-scripts.mjs          write src/scripts/
//   node tools/decompile-scripts.mjs --check  compare with src/scripts/ (exit 1 on drift)
//
// Each script becomes `function* scriptNNN(state, arg0, ...)`. Its local subroutines
// become nested functions, its operand stack becomes expressions, its locals variables,
// and its jumps structured code: the blocks of each function are laid out along their
// dominator tree, loops at back edges and labelled blocks before merge points
// (N. Ramsey, "Beyond Relooper", ICFP 2022). The scripts' control flow is reducible and
// no operand stack value lives across a jump (tools/decompile-scripts.test.mjs checks the
// output against the interpreter for every script).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import { decodeScript } from '../src/script/codec.mjs';
import { nativeTarget as nativeEntry } from '../src/script/natives.mjs';
import { nativeTarget as targetFunction } from '../src/script/native-targets.mjs';
import { NATIVE_POINTERS } from '../src/vm/layout.mjs';
import * as WRAM_NAMES from '../src/data/wram.mjs';
import { SCRIPT_NAMES } from './script-names.mjs';

const WORD_SUFFIX = '16';
const ROOT = new URL('../', import.meta.url);
const OUT = fileURLToPath(new URL('src/scripts/', ROOT));
const GROUP = 32;
const WAIT_NATIVE = 0xc401;
const HEX = 16,
  SCRIPT_DIGITS = 3,
  ADDRESS_DIGITS = 4,
  NATIVE_DIGITS = 2,
  STATE_END = 0x10000,
  DECIMAL_BELOW = 10,
  BYTE = 0xff,
  BYTE_SIGN = 0x80,
  SIGN_EXTEND = 0xff00;

const hex = (n, digits = SCRIPT_DIGITS) => n.toString(HEX).toUpperCase().padStart(digits, '0');
const scriptName = (id) => SCRIPT_NAMES[id] ?? `script${hex(id)}`;
if (new Set(Object.values(SCRIPT_NAMES)).size !== Object.keys(SCRIPT_NAMES).length)
  throw new Error('script names repeat');

// ---------------------------------------------------------------------------------------
// Names: natives from their lifted functions, state from the WRAM layout.

function nativeNames(mem, count) {
  // The names the native tables give their entries (factory-made functions have none).
  const special = new Map();
  for (const file of ['src/vm/special-natives.mjs', 'src/script/native-targets.mjs']) {
    const text = readFileSync(new URL(file, ROOT), 'utf8');
    for (const m of text.matchAll(/\[(0x80[0-9a-f]{4}),\s*(\w+)\]/g))
      if (!special.has(Number(m[1]))) special.set(Number(m[1]), m[2]);
  }
  const clean = (name) => {
    const bare = name
      .replace(/^lifted/, '')
      .replace(/(CallSequence|Sequence|Native|InPlace)$/, '')
      .replace(/^./, (c) => c.toLowerCase());
    return bare || name;
  };
  const names = [];
  const used = new Map();
  for (let id = 0; id < count; id++) {
    let name;
    if (mem.read16(NATIVE_POINTERS + 2 * id) === WAIT_NATIVE) name = 'wait';
    else {
      const entry = nativeEntry(mem, id),
        fn = targetFunction(entry);
      name = fn?.name ? clean(fn.name) : special.has(entry) ? clean(special.get(entry)) : null;
    }
    name ??= `native${hex(id, NATIVE_DIGITS)}`;
    if (used.has(name)) name = `${name}${hex(id, NATIVE_DIGITS)}`;
    used.set(name, id);
    names.push(name);
  }
  return names;
}

// State names: the exact WRAM layout names (the first in the file for an address).
const STATE_NAMES = new Map();
for (const [name, value] of Object.entries(WRAM_NAMES))
  if (typeof value === 'number' && value >= 0 && value < STATE_END && !STATE_NAMES.has(value))
    STATE_NAMES.set(value, name);
const stateRef = (address) =>
  STATE_NAMES.has(address)
    ? `'${STATE_NAMES.get(address)}'`
    : `0x${hex(address, ADDRESS_DIGITS).toLowerCase()}`;

// ---------------------------------------------------------------------------------------
// Expressions: { text, prec, pure (no call), constant (value or null), bool, deps }. The
// deps of a pure expression are the variables it reads: local names, 'locals' (the byte
// array) and STATE (the game state).

const ATOM = 100,
  UNARY = 15,
  RELATIONAL = 10,
  EQUALITY = 9,
  BIT_AND = 8,
  BIT_XOR = 7,
  BIT_OR = 6,
  LOGICAL_AND = 4,
  LOGICAL_OR = 3;
const STATE = '@state';
const union = (...es) => [...new Set(es.flatMap((e) => e.deps ?? []))];
// The variables the calls in expressions may change: STATE for game functions and
// scripts, ALL for local subroutines (they change locals too).
const ALL = '*';
const writesOf = (...es) => [...new Set(es.flatMap((e) => e.writes ?? []))];
const literal = (value) => ({
  text: value < DECIMAL_BELOW ? String(value) : `0x${value.toString(HEX)}`,
  prec: ATOM,
  pure: true,
  constant: value,
  deps: [],
});
const atom = (text, pure = true, deps = [], writes = []) => ({
  text,
  prec: ATOM,
  pure,
  constant: null,
  deps,
  writes,
});
const paren = (e, min) => (e.prec < min ? `(${e.text})` : e.text);
// A word value of an expression (a condition becomes truth(...)).
const value = (e) => (e.bool ? atom(`truth(${e.text})`, e.pure, e.deps, e.writes) : e);
const call = (fn, ...args) =>
  atom(
    `${fn}(${args.map((a) => value(a).text).join(', ')})`,
    args.every((a) => a.pure),
    union(...args),
    writesOf(...args),
  );
const binary = (op, prec, l, r, bool = false) => ({
  text: `${paren(value(l), prec)} ${op} ${paren(value(r), prec + 1)}`,
  prec,
  pure: l.pure && r.pure,
  constant: null,
  bool,
  deps: union(l, r),
  writes: writesOf(l, r),
});
// Two conditions joined by & or |: && and || when the right one has no effect to skip.
const logical = (op, prec, wordOp, wordPrec) => (l, r) =>
  l.bool && r.bool && r.pure
    ? {
        text: `${paren(l, prec)} ${op} ${paren(r, prec + 1)}`,
        prec,
        pure: l.pure,
        constant: null,
        bool: true,
        deps: union(l, r),
        writes: writesOf(l, r),
      }
    : binary(wordOp, wordPrec, l, r);
// A condition of an expression: a word is true when not zero.
const condition = (e) =>
  e.bool ? e : { ...binary('!==', EQUALITY, e, literal(0), true), op: '!==', l: e, r: literal(0) };
const INVERSE = { '===': '!==', '!==': '===', '<=': '>', '>': '<=' };
function negate(c) {
  if (c.op && INVERSE[c.op])
    return { ...binary(INVERSE[c.op], c.prec, c.l, c.r, true), op: INVERSE[c.op], l: c.l, r: c.r };
  if (c.negated) return c.negated;
  return {
    negated: c,
    text: `!${paren(c, UNARY)}`,
    prec: UNARY,
    pure: c.pure,
    constant: null,
    bool: true,
    deps: c.deps,
    writes: c.writes,
  };
}
const comparison = (op, prec) => (l, r) => ({ ...binary(op, prec, l, r, true), op, l, r });
const helper = (name) => (l, r) => ({ ...call(name, l, r), bool: true });

// The task events a wait ends on (src/scripts/runtime.mjs, EVENT).
const WAIT_NAME = 'wait';
const EVENT_NAMES = [
  [0x1, 'TIMER'],
  [0x2, 'TALK'],
  [0x4, 'ARRIVED'],
  [0x8, 'ANIMATION_END'],
  [0x10, 'PICK_UP'],
  [0x20, 'BUY'],
  [0x40, 'GIVE'],
  [0x80, 'EXAMINE'],
  [0x100, 'USE'],
  [0x200, 'OPEN'],
  [0x400, 'CLOSE'],
  [0x800, 'HIT'],
  [0x2000, 'TARGET'],
  [0x4000, 'MOVE_TO'],
];
function events(e) {
  if (e.constant === null || e.constant === undefined || e.constant === 0) return e;
  let rest = e.constant;
  const parts = [];
  for (const [bit, name] of EVENT_NAMES)
    if (rest & bit) {
      parts.push(`EVENT.${name}`);
      rest &= ~bit;
    }
  if (rest) parts.push(`0x${rest.toString(HEX)}`);
  return { ...e, text: parts.join(' | '), prec: parts.length > 1 ? BIT_OR : ATOM };
}

const BINARY = {
  add: (l, r) => call('word', { ...binary('+', 12, value(l), value(r)) }),
  subtract: (l, r) => call('word', { ...binary('-', 12, value(l), value(r)) }),
  multiply_uu_handler: (l, r) => call('multiply', l, r),
  multiply_su_handler: (l, r) => call('multiplySignedLeft', l, r),
  multiply_us_handler: (l, r) => call('multiplySignedRight', l, r),
  multiply_ss_handler: (l, r) => call('multiplySigned', l, r),
  // The events of a wait's result read by name.
  bit_and: (l, r) => logical('&&', LOGICAL_AND, '&', BIT_AND)(l, l.waits ? events(r) : r),
  bit_or: logical('||', LOGICAL_OR, '|', BIT_OR),
  bit_xor: (l, r) => binary('^', BIT_XOR, l, r),
  shift_left: (l, r) => call('shiftLeft', l, r),
  shift_right: (l, r) => call('shiftRight', l, r),
  compare_8a_handler: helper('less'),
  compare_a2_handler: helper('less'),
  compare_8c_handler: helper('lessSignedLeft'),
  compare_8e_handler: helper('lessSignedRight'),
  compare_92_handler: comparison('<=', RELATIONAL),
  compare_94_handler: helper('lessOrEqualSignedLeft'),
  compare_96_handler: helper('lessOrEqualSignedRight'),
  compare_9a_handler: comparison('>', RELATIONAL),
  compare_9c_handler: helper('greaterSignedLeft'),
  compare_9e_handler: helper('greaterSignedRight'),
  compare_a4_handler: helper('greaterOrEqualSignedLeft'),
  compare_a6_handler: helper('greaterOrEqualSignedRight'),
  equal: comparison('===', EQUALITY),
  equal_alias: comparison('===', EQUALITY),
  compare_ac_handler: helper('notEqualSignedLeft'),
  compare_ae_handler: helper('rightNotNegative'),
  not_equal: comparison('!==', EQUALITY),
  not_equal_alias: comparison('!==', EQUALITY),
  compare_b4_handler: helper('notEqualOrNegativeLeft'),
  compare_b6_handler: helper('notEqualOrNegativeRight'),
};
// The '+'/'-' inside word(...) need no word wrap of their own operands.
const UNARY_OPS = {
  negate: (v) =>
    call('word', {
      text: `-${paren(value(v), UNARY)}`,
      prec: UNARY,
      pure: v.pure,
      deps: union(v),
      writes: writesOf(v),
    }),
  bit_not: (v) => binary('^', BIT_XOR, v, literal(0xffff)),
  increment: (v) => call('word', binary('+', 12, value(v), literal(1))),
  decrement: (v) => call('word', binary('-', 12, value(v), literal(1))),
  boolean: (v) => condition(v),
};
const HELPERS = [
  'word',
  'signed',
  'truth',
  'multiply',
  'multiplySignedLeft',
  'multiplySignedRight',
  'multiplySigned',
  'shiftLeft',
  'shiftRight',
  'less',
  'lessSignedLeft',
  'lessSignedRight',
  'lessOrEqualSignedLeft',
  'lessOrEqualSignedRight',
  'greaterSignedLeft',
  'greaterSignedRight',
  'greaterOrEqualSignedLeft',
  'greaterOrEqualSignedRight',
  'notEqualSignedLeft',
  'rightNotNegative',
  'notEqualOrNegativeLeft',
  'notEqualOrNegativeRight',
  'localByte',
  'localWord',
  'setLocalWord',
  'ScriptEnd',
];

// ---------------------------------------------------------------------------------------
// One script.

const POPS = {
  push_u8: 0,
  push_i8: 0,
  push_u16: 0,
  push_zero: 0,
  load_local_u8: 0,
  load_local_i8: 0,
  load_local_u16: 0,
  load_local0_u8: 0,
  load_state_u8: 0,
  load_state_i8: 0,
  load_state_u16: 0,
  store_local_u8: 1,
  store_local_u16: 1,
  store_state_u8: 1,
  store_state_u16: 1,
  jump_if_zero: 1,
  jump_if_nonzero: 1,
  jump: 0,
  return_local: 0,
  end: 0,
  duplicate: 1,
  drop: 1,
};
const PUSHES = { duplicate: 2 };
const LOADS = new Set([
  'push_u8',
  'push_i8',
  'push_u16',
  'push_zero',
  'load_local_u8',
  'load_local_i8',
  'load_local_u16',
  'load_local0_u8',
  'load_state_u8',
  'load_state_i8',
  'load_state_u16',
]);

// Game function arguments that are text or topic numbers (notice: left, top, columns,
// rows, attributes, text, frames) or object kinds.
const NOTED_ARGUMENTS = Object.freeze({
  notice: { 5: 'text' },
  windowText: { 0: 'text' },
  topicText: { 0: 'text' },
  addTopic: { 0: 'topic' },
  markTopic: { 0: 'topic' },
  isTopicKnown: { 0: 'topic' },
  createObject: { 0: 'kind' },
});
const NO_NOTES = { text: () => null, topic: () => null, kind: () => null };
const NOTE_LENGTH = 60;
// The texts by number, the topics and the kind names, as comments.
function textNotes() {
  const asset = (name) => JSON.parse(readFileSync(new URL(`assets/${name}`, ROOT), 'utf8'));
  const texts = new Map(asset('vm-texts.json').texts.map((t) => [t.address, t.text]));
  const numbers = asset('vm-tables.json').tables.find((t) => t.name === 'text_numbers').values;
  const topics = asset('vm-topics.json').topics;
  const kinds = asset('vm-kinds.json').kinds;
  const note = (address) => {
    const text = texts.get(address);
    if (!text) return null;
    const flat = text.replace(/\s+/g, ' ').replace(/\*\//g, '* /').trim();
    return JSON.stringify(flat.length > NOTE_LENGTH ? `${flat.slice(0, NOTE_LENGTH)}...` : flat);
  };
  return {
    text: (n) => note(numbers[n]),
    topic: (n) => note(topics[n & BYTE]),
    kind: (n) => note(kinds[n]?.name),
  };
}

class ScriptDecompiler {
  constructor(script, scripts, natives, nativeNames, notes = NO_NOTES) {
    this.notes = notes;
    this.script = script;
    this.scripts = scripts;
    this.natives = natives;
    this.nativeNames = nativeNames;
    this.code = Uint8Array.from(script.bytecode);
    const decoded = decodeScript(this.code);
    this.ins = new Map(decoded.instructions.map((i) => [i.pc, i]));
    this.usedNatives = new Set();
    this.usedScripts = new Set();
    this.temps = 0;
    this.locals();
  }

  error(message, pc) {
    throw new Error(`script ${hex(this.script.id)} at ${pc}: ${message}`);
  }

  // Locals: variables when each offset has one width and no word overlaps another
  // offset; else the byte array.
  locals() {
    const widths = new Map();
    for (const i of this.ins.values()) {
      const m = /^(load|store)_local(?<zero>0)?_[ui](?<bits>8|16)$/.exec(i.name);
      if (!m) continue;
      const at = m.groups.zero ? 0 : i.operand,
        bytes = m.groups.bits === WORD_SUFFIX ? 2 : 1;
      if (at + bytes > this.script.localBytes) this.error('local outside the frame', i.pc);
      (widths.get(at) ?? widths.set(at, new Set()).get(at)).add(bytes);
    }
    let plain = true;
    for (const [at, ws] of widths)
      if (ws.size > 1 || (ws.has(2) && widths.has(at + 1))) plain = false;
    this.localWidths = widths;
    this.plainLocals = plain;
  }
  localName(at) {
    return `local${at}`;
  }
  // The variable a local lives in (for the deps of expressions).
  localVariable(at) {
    return this.plainLocals ? this.localName(at) : 'locals';
  }
  loadLocal(at, bytes, signedByte) {
    const deps = [this.localVariable(at)];
    let e;
    if (this.plainLocals) e = atom(this.localName(at), true, deps);
    else {
      e = atom(`${bytes === 2 ? 'localWord' : 'localByte'}(locals, ${at})`, true, deps);
    }
    if (signedByte) {
      e = atom(`signed(${e.text})`, true, deps);
    }
    return { ...e, local: true };
  }
  storeLocal(at, bytes, v) {
    const text = value(v).text;
    if (this.plainLocals) {
      const masked =
        bytes === 1 && v.constant === null ? `${paren(value(v), BIT_AND + 1)} & 0xff` : text;
      return `${this.localName(at)} = ${bytes === 1 && v.constant !== null ? String(v.constant & BYTE) : masked};`;
    }
    if (bytes === 2) {
      return `setLocalWord(locals, ${at}, ${text});`;
    }
    return `locals[${at}] = ${paren(value(v), BIT_AND + 1)} & 0xff;`;
  }

  // An argument of a game function; a constant text or topic number carries its text,
  // a wait's mask names its events.
  noted(name, n, a) {
    if (name === WAIT_NAME && n === 0) return events(a).text;
    const v = value(a).text;
    const kind = NOTED_ARGUMENTS[name]?.[n];
    if (!kind || a.constant === null || a.constant === undefined) return v;
    const note = this.notes[kind](a.constant);
    return note ? `${v} /* ${note} */` : v;
  }

  // The functions: main (entry 0) and the local subroutines.
  functions() {
    const entries = [0];
    for (const i of [...this.ins.values()].sort((a, b) => a.pc - b.pc))
      if (i.name === 'call_local' && !entries.includes(i.operand)) entries.push(i.operand);
    // Inputs and outputs of the subroutines, resolved until stable.
    this.subs = new Map();
    for (let round = 0; round < entries.length + 1; round++)
      for (const entry of entries.slice(1)) {
        if (this.subs.has(entry)) continue;
        const r = this.depths(entry);
        if (r) this.subs.set(entry, r);
      }
    for (const entry of entries.slice(1))
      if (!this.subs.has(entry)) this.error('subroutine effect unresolved', entry);
    // Whether a subroutine (or one it calls) yields.
    const yields = (entry, seen = new Set()) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      for (const pc of this.reach(entry)) {
        const i = this.ins.get(pc);
        if (i.name === 'call_native' || i.name === 'call_script') return true;
        if (i.name === 'call_local' && yields(i.operand, seen)) return true;
      }
      return false;
    };
    for (const [entry, sub] of this.subs) sub.yields = yields(entry);
    return entries;
  }
  // The pcs of a function, not following local calls into their targets.
  reach(entry) {
    const seen = new Set([entry]),
      work = [entry];
    while (work.length) {
      const pc = work.pop();
      for (const next of this.successors(this.ins.get(pc)))
        if (!seen.has(next)) {
          seen.add(next);
          work.push(next);
        }
    }
    return seen;
  }
  successors(i) {
    const out = [];
    if (i.flow === 'jump' || i.flow === 'conditional') out.push(i.operand);
    if (i.flow === 'next' || i.flow === 'conditional' || i.flow === 'local_call')
      out.push(i.nextPc);
    return out;
  }
  effect(i) {
    if (i.name in POPS) return [POPS[i.name], PUSHES[i.name] ?? (LOADS.has(i.name) ? 1 : 0)];
    if (i.name === 'call_native') {
      const n = this.natives[i.operand];
      return [n.argumentWords, n.returnBytes ? 1 : 0];
    }
    if (i.name === 'call_script') {
      const s = this.scripts[i.operand];
      if (s.argumentBytes & 1) this.error('odd argument bytes', i.pc);
      return [s.argumentBytes >>> 1, s.returnBytes ? 1 : 0];
    }
    if (i.name === 'call_local') {
      const sub = this.subs.get(i.operand);
      return sub ? [sub.inputs, sub.outputs] : null;
    }
    if (i.name in BINARY) return [2, 1];
    if (i.name in UNARY_OPS) return [1, 1];
    this.error(`opcode ${i.name} unused by the original`, i.pc);
  }
  // Depths relative to a subroutine's entry: its inputs (deepest read below the entry)
  // and outputs (above the base after its inputs). Null while a callee is unresolved.
  depths(entry) {
    const depth = new Map([[entry, 0]]),
      work = [entry];
    let low = 0,
      out = null;
    while (work.length) {
      const pc = work.pop(),
        i = this.ins.get(pc),
        e = this.effect(i);
      if (!e) return null;
      const d = depth.get(pc) - e[0];
      low = Math.min(low, d);
      const after = d + e[1];
      if (i.name === 'return_local') {
        if (out !== null && out !== after) this.error('subroutine effects differ', pc);
        out = after;
        continue;
      }
      for (const next of this.successors(i)) {
        if (depth.has(next)) {
          if (depth.get(next) !== after) this.error('stack depth differs at a join', next);
        } else {
          depth.set(next, after);
          work.push(next);
        }
      }
    }
    return { inputs: -low, outputs: (out ?? 0) - low };
  }

  // Basic blocks of a function: leaders are the entry, jump targets and the
  // instructions after a branch.
  blocks(entry) {
    const pcs = [...this.reach(entry)].sort((a, b) => a - b),
      inFunction = new Set(pcs),
      leaders = new Set([entry]);
    for (const pc of pcs) {
      const i = this.ins.get(pc);
      if (i.flow === 'jump' || i.flow === 'conditional') {
        leaders.add(i.operand);
        if (inFunction.has(i.nextPc)) leaders.add(i.nextPc);
      }
    }
    const blocks = new Map();
    for (const leader of leaders) {
      const body = [];
      let pc = leader;
      for (;;) {
        const i = this.ins.get(pc);
        body.push(i);
        if (['jump', 'conditional', 'end', 'return'].includes(i.flow)) break;
        pc = i.nextPc;
        if (leaders.has(pc)) break;
      }
      const last = body[body.length - 1];
      let next = [];
      if (last.flow === 'conditional') next = [last.operand, last.nextPc];
      else if (last.flow === 'jump') next = [last.operand];
      else if (last.flow === 'next' || last.flow === 'local_call') next = [last.nextPc];
      blocks.set(leader, { pc: leader, body, next });
    }
    return blocks;
  }

  // The statements of one block from its symbolic stack; the start stack is given.
  translate(block, startStack) {
    const lines = [],
      stack = [...startStack];
    const pop = () => {
      if (!stack.length) this.error('operand stack underflow', block.pc);
      return stack.pop();
    };
    // Whether `writes` may change a variable that `deps` reads.
    const touches = (writes, deps = []) =>
      deps.length > 0 && (writes.includes(ALL) || deps.some((d) => writes.includes(d)));
    // Before a statement that may change `writes`: evaluate, in their order, the pending
    // values with a call and the pure ones that the statement or a pending call above them
    // may change (and the top value when `forceTop`).
    const spill = (writes, forceTop = false) => {
      const above = new Array(stack.length);
      let pending = writes;
      for (let n = stack.length - 1; n >= 0; n--) {
        above[n] = pending;
        if (!stack[n].pure) pending = [...pending, ...(stack[n].writes ?? [ALL])];
      }
      for (let n = 0; n < stack.length; n++) {
        const e = stack[n];
        if (e.constant !== null && e.constant !== undefined) continue;
        if (e.temp) continue;
        if (e.pure && !touches(above[n], e.deps) && !(forceTop && n === stack.length - 1)) continue;
        const name = `t${++this.temps}`;
        lines.push(`const ${name} = ${value(e).text.replace(/^\((yield\* .*)\)$/, '$1')};`);
        stack[n] = { ...atom(name), temp: true };
      }
    };
    const statement = (text, writes) => {
      spill(writes);
      lines.push(text);
    };
    // Arguments in the order the callee sees them (args[0] the top word). The text
    // evaluates them in that order, the original in the reverse: they are evaluated
    // first in the original's order when that could change a result.
    const takeArguments = (count) => {
      const args = [];
      for (let n = 0; n < count; n++) args.push(pop());
      const calls = args.filter((a) => !a.pure).length;
      const hazard =
        calls > 1 ||
        args.some(
          (a, i) =>
            !a.pure && args.some((b, j) => j > i && b.pure && touches(a.writes ?? [ALL], b.deps)),
        );
      if (hazard) {
        stack.push(...args.slice().reverse());
        spill([]);
        args.length = 0;
        for (let n = 0; n < count; n++) args.push(pop());
      }
      return args;
    };
    const yieldExpr = (text, writes) => ({
      text: `(${text})`,
      prec: ATOM,
      pure: false,
      constant: null,
      yields: text,
      deps: [],
      writes,
    });
    let terminator = null;
    for (const i of block.body) {
      const n = i.name;
      if (n === 'push_u8' || n === 'push_u16') stack.push(literal(i.operand));
      else if (n === 'push_zero') stack.push(literal(0));
      else if (n === 'push_i8')
        stack.push(literal(i.operand & BYTE_SIGN ? SIGN_EXTEND | i.operand : i.operand));
      else if (n === 'load_local_u8') stack.push(this.loadLocal(i.operand, 1, false));
      else if (n === 'load_local_i8') stack.push(this.loadLocal(i.operand, 1, true));
      else if (n === 'load_local_u16') stack.push(this.loadLocal(i.operand, 2, false));
      else if (n === 'load_local0_u8') stack.push(this.loadLocal(0, 1, false));
      else if (n === 'load_state_u8')
        stack.push(atom(`state.byte(${stateRef(i.operand)})`, true, [STATE]));
      else if (n === 'load_state_i8') {
        stack.push(atom(`signed(state.byte(${stateRef(i.operand)}))`, true, [STATE]));
      } else if (n === 'load_state_u16')
        stack.push(atom(`state.word(${stateRef(i.operand)})`, true, [STATE]));
      else if (n === 'store_local_u8' || n === 'store_local_u16') {
        const v = pop(),
          bytes = n.endsWith('16') ? 2 : 1;
        // A word stored and kept (x = x - 1, then tested) reads back from the local.
        const kept = bytes === 2 && stack[stack.length - 1] === v && pop();
        statement(this.storeLocal(i.operand, bytes, v), [this.localVariable(i.operand)]);
        if (kept) stack.push(this.loadLocal(i.operand, 2, false));
      } else if (n === 'store_state_u8' || n === 'store_state_u16') {
        const v = pop();
        statement(
          `state.${n.endsWith('16') ? 'setWord' : 'setByte'}(${stateRef(i.operand)}, 0, ${value(v).text});`,
          [STATE],
        );
      } else if (n === 'duplicate') {
        const v = pop();
        if (v.constant === null || v.constant === undefined) {
          if (!v.pure) {
            stack.push(v);
            spill([], true);
            stack.push(stack[stack.length - 1]);
          } else stack.push(v, v);
        } else stack.push(v, v);
      } else if (n === 'drop') {
        const v = pop();
        if (!v.pure) statement(`${v.yields ?? value(v).text};`, v.writes ?? [ALL]);
      } else if (n in BINARY) {
        const r = pop(),
          l = pop();
        const e = BINARY[n](l, r);

        stack.push(e);
      } else if (n in UNARY_OPS) {
        const e = UNARY_OPS[n](pop());

        stack.push(e);
      } else if (n === 'call_native') {
        const info = this.natives[i.operand],
          args = takeArguments(info.argumentWords),
          name = this.nativeNames[i.operand];
        this.usedNatives.add(i.operand);
        const text = `yield* game.${name}(${args.map((a, n) => this.noted(name, n, a)).join(', ')})`;
        if (info.returnBytes)
          stack.push({ ...yieldExpr(text, [STATE]), waits: name === WAIT_NAME });
        else statement(`${text};`, [STATE]);
      } else if (n === 'call_script') {
        const info = this.scripts[i.operand],
          args = takeArguments(info.argumentBytes >>> 1);
        this.usedScripts.add(i.operand);
        const text = `yield* run.${scriptName(i.operand)}(${args.map((a) => value(a).text).join(', ')})`;
        if (info.returnBytes) stack.push(yieldExpr(text, [STATE]));
        else statement(`${text};`, [STATE]);
      } else if (n === 'call_local') {
        const sub = this.subs.get(i.operand),
          args = takeArguments(sub.inputs),
          name = `sub${i.operand}`;
        const text = `${sub.yields ? 'yield* ' : ''}${name}(${args.map((a) => value(a).text).join(', ')})`;
        if (sub.outputs === 0) statement(`${text};`, [ALL]);
        else if (sub.outputs === 1)
          stack.push(sub.yields ? yieldExpr(text, [ALL]) : atom(text, false, [], [ALL]));
        else {
          spill([ALL]);
          const names = Array.from({ length: sub.outputs }, () => `t${++this.temps}`);
          lines.push(`const [${names.join(', ')}] = ${text};`);
          // The first output is the deepest.
          for (const name of names) stack.push({ ...atom(name), temp: true });
        }
      } else if (n === 'jump_if_zero' || n === 'jump_if_nonzero') {
        const c = condition(pop());
        spill([]);
        terminator = { kind: 'branch', when: n === 'jump_if_zero' ? negate(c) : c };
      } else if (n === 'jump') terminator = { kind: 'goto' };
      else if (n === 'end' || n === 'return_local') {
        terminator = { kind: n, stack: stack.splice(0) };
      } else this.error(`opcode ${n}`, i.pc);
    }
    if (stack.length && !terminator?.stack) {
      if (!terminator || terminator.kind !== 'branch') this.error('values cross a block', block.pc);
    }
    if (stack.length && terminator?.kind !== 'end' && terminator?.kind !== 'return_local')
      this.error('values cross a block', block.pc);
    return { lines, terminator: terminator ?? { kind: 'goto' } };
  }

  // A function's code: blocks laid out along the dominator tree.
  functionCode(entry, isMain) {
    const blocks = this.blocks(entry);
    // Reverse postorder.
    const order = [],
      seen = new Set();
    const visit = (pc) => {
      seen.add(pc);
      for (const next of blocks.get(pc).next) if (!seen.has(next)) visit(next);
      order.push(pc);
    };
    visit(entry);
    order.reverse();
    const rpo = new Map(order.map((pc, n) => [pc, n]));
    const preds = new Map(order.map((pc) => [pc, []]));
    for (const pc of order) for (const next of blocks.get(pc).next) preds.get(next).push(pc);
    // Immediate dominators (Cooper, Harvey, Kennedy).
    const idom = new Map([[entry, entry]]);
    const intersect = (a, b) => {
      while (a !== b) {
        while (rpo.get(a) > rpo.get(b)) a = idom.get(a);
        while (rpo.get(b) > rpo.get(a)) b = idom.get(b);
      }
      return a;
    };
    for (let changed = true; changed;) {
      changed = false;
      for (const pc of order.slice(1)) {
        let d = null;
        for (const p of preds.get(pc)) if (idom.has(p)) d = d === null ? p : intersect(p, d);
        if (idom.get(pc) !== d) {
          idom.set(pc, d);
          changed = true;
        }
      }
    }
    const children = new Map(order.map((pc) => [pc, []]));
    for (const pc of order.slice(1)) children.get(idom.get(pc)).push(pc);
    const backward = (from, to) => rpo.get(to) <= rpo.get(from);
    const loopHeader = new Set();
    for (const pc of order)
      for (const next of blocks.get(pc).next) if (backward(pc, next)) loopHeader.add(next);
    const forwardPreds = (pc) => preds.get(pc).filter((p) => !backward(p, pc)).length;
    const merge = (pc) => forwardPreds(pc) >= 2;

    // The translated blocks.
    const stackAt = new Map();
    const inputs = isMain
      ? Array.from({ length: this.script.argumentBytes >>> 1 }, (_, n) => atom(`arg${n}`)).reverse()
      : Array.from({ length: this.subs.get(entry).inputs }, (_, n) => atom(`in${n}`)).reverse();
    stackAt.set(entry, inputs);
    const translated = new Map();
    for (const pc of order) {
      const t = this.translate(blocks.get(pc), stackAt.get(pc) ?? []);
      translated.set(pc, t);
      for (const next of blocks.get(pc).next) if (!stackAt.has(next)) stackAt.set(next, []);
    }

    const out = [];
    const emit = (indent, text, extra = {}) => out.push({ indent, text, ...extra });
    const doTree = (x, context, indent) => {
      const ys = children
        .get(x)
        .filter(merge)
        .sort((a, b) => rpo.get(b) - rpo.get(a));
      if (loopHeader.has(x)) {
        emit(indent, `loop${x}: for (;;) {`);
        nodeWithin(x, ys, [{ loop: x }, ...context], indent + 1);
        emit(indent, '}');
      } else nodeWithin(x, ys, context, indent);
    };
    const nodeWithin = (x, ys, context, indent) => {
      if (ys.length) {
        const [y, ...rest] = ys;
        emit(indent, `block${y}: {`);
        nodeWithin(x, rest, [{ follows: y }, ...context], indent + 1);
        emit(indent, '}');
        doTree(y, context, indent);
        return;
      }
      const t = translated.get(x);
      for (const line of t.lines) emit(indent, line);
      const term = t.terminator,
        next = blocks.get(x).next;
      if (term.kind === 'end' || term.kind === 'return_local') {
        const rest = term.stack;
        // Pending values below the result are evaluated for their effects.
        const kept = term.kind === 'end' ? (rest.length ? 1 : 0) : this.subs.get(entry).outputs;
        for (const e of rest.slice(0, rest.length - kept))
          if (!e.pure) emit(indent, `${e.yields ?? value(e).text};`);
        const results = rest.slice(rest.length - kept).map((e) => e.yields ?? value(e).text);
        if (term.kind === 'end' && !isMain) {
          emit(indent, `throw new ScriptEnd(${results[0] ?? 'null'});`);
        } else if (term.kind === 'end') emit(indent, `return ${results[0] ?? 'null'};`);
        else if (kept === 0) emit(indent, 'return;');
        else if (kept === 1) emit(indent, `return ${results[0]};`);
        else emit(indent, `return [${results.join(', ')}];`);
        return;
      }
      if (term.kind === 'branch') {
        emit(indent, `if (${term.when.text}) {`, { negated: `if (${negate(term.when).text}) {` });
        doBranch(x, next[0], context, indent + 1);
        emit(indent, '} else {');
        doBranch(x, next[1], context, indent + 1);
        emit(indent, '}');
        return;
      }
      doBranch(x, next[0], context, indent);
    };
    const doBranch = (from, to, context, indent) => {
      if (backward(from, to)) emit(indent, `continue loop${to};`);
      else if (merge(to)) emit(indent, `break block${to};`);
      else doTree(to, context, indent);
    };
    doTree(entry, [], 0);
    return tidy(out, !isMain);
  }

  source() {
    const entries = this.functions();
    const s = this.script;
    const args = Array.from({ length: s.argumentBytes >>> 1 }, (_, n) => `arg${n}`);
    const lines = [];
    const desc = [
      args.length ? `${args.length} argument${args.length > 1 ? 's' : ''}` : 'no arguments',
      s.returnBytes ? 'returns a word' : null,
    ].filter(Boolean);
    lines.push(`// Script ${hex(s.id)}: ${desc.join(', ')}.`);
    lines.push(`export function* ${scriptName(s.id)}(${['state', ...args].join(', ')}) {`);
    if (this.plainLocals) {
      const names = [...this.localWidths.keys()]
        .sort((a, b) => a - b)
        .map((at) => `${this.localName(at)} = 0`);
      if (names.length) lines.push(`let ${names.join(', ')};`);
    } else lines.push(`const locals = new Uint8Array(${s.localBytes});`);
    for (const entry of entries.slice(1)) {
      const sub = this.subs.get(entry),
        params = Array.from({ length: sub.inputs }, (_, n) => `in${n}`);
      lines.push(`function${sub.yields ? '*' : ''} sub${entry}(${params.join(', ')}) {`);
      lines.push(...this.functionCode(entry, false));
      lines.push('}');
    }
    lines.push(...this.functionCode(0, true));
    lines.push('}');
    return nameLocals(lines.join('\n'));
  }
}

// Game functions whose first argument is an object (beyond the names with "Object").
const OBJECT_FIRST = new Set([
  'setSpriteMode',
  'getSpriteMode',
  'appendToFightList',
  'fightListRemove',
  'isInFightList',
  'talk',
  'faceRoomDirection',
  'updateObjectDepthMode',
]);
const NOT_OBJECT_FIRST = new Set([
  'createObject',
  'addSceneObject',
  'getPlayerObject',
  'getPlayerObjectCopy',
  'getPlayerObjectAfterBreak',
  'getPreviousFightObject',
]);
const takesObject = (name) =>
  !NOT_OBJECT_FIRST.has(name) && (OBJECT_FIRST.has(name) || /Object(?!s)/.test(name));
// The parameter names of the most used game functions, as their code reads them.
export const PARAMETERS = Object.freeze({
  wait: ['events', 'frames'],
  notice: ['left', 'top', 'columns', 'rows', 'attributes', 'text', 'frames'],
  topicText: ['text'],
  windowText: ['text'],
  createObject: ['kind', 'x', 'y', 'height', 'script'],
  setObjectActionAndDirection: ['object', 'action', 'direction'],
  setObjectAnimation: ['object', 'animation'],
  setObjectDirection: ['object', 'direction'],
  getObjectDirection: ['object'],
  setObjectVelocity: ['object', 'dx', 'dy', 'dz'],
  setObjectPosition: ['object', 'x', 'y', 'height'],
  playSoundEffect: ['object', 'effect', 'level', 'voices'],
  setSpriteMode: ['object', 'mode'],
  setObjectDialog: ['object', 'dialog'],
  talk: ['object', 'dialog'],
  moveObjectToWaypoint: ['object', 'waypoint'],
  moveObjectStraightToWaypoint: ['object', 'waypoint'],
  placeObjectOnWaypoint: ['object', 'waypoint'],
  turnObjectToObject: ['object', 'target'],
  setObjectFlagBits: ['object', 'bits'],
  keepObjectFlagBits: ['object', 'mask'],
  setObjectRecordFlagBits: ['object', 'bits'],
  keepObjectRecordFlagBits: ['object', 'mask'],
  setObjectArmour: ['object', 'armour'],
  changeRoom: ['room'],
  getScriptVariable: ['variable'],
  setScriptVariable: ['variable', 'value'],
  setScriptVariableBits: ['variable', 'bits'],
  keepScriptVariableBits: ['variable', 'mask'],
  getActorStateFlags: ['actor'],
  setActorStateFlagBits: ['actor', 'bits'],
  keepActorStateFlagBits: ['actor', 'mask'],
  addNuyen: ['nuyen'],
  payNuyen: ['nuyen'],
  addKarma: ['karma'],
  randomBelow: ['limit'],
});
// The calls of game functions in a function's text: name and argument texts.
function* gameCalls(text) {
  for (const m of text.matchAll(/game\.(\w+)\(/g)) {
    const args = [];
    let depth = 0,
      start = m.index + m[0].length;
    for (let at = start; at < text.length; at++) {
      const c = text[at];
      if (c === '/' && text[at + 1] === '*') {
        at = text.indexOf('*/', at) + 1;
        continue;
      }
      if (c === '(') depth++;
      else if (c === ')' && depth-- === 0) {
        args.push(text.slice(start, at).trim());
        break;
      } else if (c === ',' && depth === 0) {
        args.push(text.slice(start, at).trim());
        start = at + 1;
      }
    }
    yield { name: m[1], args: args.filter(Boolean) };
  }
}
// Locals named by their use: an object (the first argument of a game function on objects;
// the one from the first argument is `object`, one from createObject `created`) or a
// counter that counts down (`count`). The rest keep localN.
function nameLocals(text) {
  const objects = new Set();
  for (const m of text.matchAll(/game\.(\w+)\((local\d+)[,)]/g))
    if (takesObject(m[1])) objects.add(m[2]);
  const fromArgument = new Map(
    [...text.matchAll(/(local\d+) = arg(\d+)(?: & 0xff)?;/g)].map((m) => [m[1], Number(m[2])]),
  );
  // The script's own object (its first argument as a byte) handed first to another script.
  for (const m of text.matchAll(/(local\d+) = arg0 & 0xff;/g))
    if (new RegExp(`run\\.\\w+\\(${m[1]}[,)]`).test(text)) objects.add(m[1]);
  const created = new Set(
    [...text.matchAll(/(local\d+) = \(yield\* game\.createObject\(/g)].map((m) => m[1]),
  );
  const names = new Map(),
    taken = new Set();
  const give = (local, base) => {
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base}${n}`;
    taken.add(name);
    names.set(local, name);
  };
  const order = [...objects].sort(
    (a, b) => (fromArgument.get(a) ?? Infinity) - (fromArgument.get(b) ?? Infinity),
  );
  for (const local of order) give(local, created.has(local) ? 'created' : 'object');
  for (const m of text.matchAll(/(local\d+) = word\(\1 - 1\);/g))
    if (!names.has(m[1])) give(m[1], 'count');
  // A local handed to a named parameter of a game function takes the parameter's name
  // (the first such use).
  for (const { name, args } of gameCalls(text))
    args.forEach((arg, n) => {
      const parameter = PARAMETERS[name]?.[n];
      if (parameter && /^local\d+$/.test(arg) && !names.has(arg)) give(arg, parameter);
    });
  return names.size ? text.replace(/\blocal\d+\b/g, (local) => names.get(local) ?? local) : text;
}

// Tidying of a function's lines (each with its depth), until nothing changes:
// - a jump that falls through to where it leads goes (a break at the end of its block, a
//   continue at the end of its loop, a plain return at the end of a subroutine);
// - an else whose then-branch ends in a jump becomes the code after the if;
// - labels nobody jumps to go, with their braces when they wrap a block.
const JUMP = /^(break|continue|return|throw)\b/;
const OPENER = /\{$/;
const NAMED_JUMP = /^(break|continue) (\w+);$/;
function tidy(out, isSub) {
  const lines = out.slice();
  // The line that opens the construct line `close` closes.
  const openerOf = (close) => {
    for (let m = close - 1; m >= 0; m--)
      if (lines[m].indent === lines[close].indent && OPENER.test(lines[m].text)) return m;
    return -1;
  };
  // The closing line of the if-else whose else starts at `at`.
  const endOfElse = (at) =>
    lines.findIndex((l, m) => m > at && l.indent === lines[at].indent && l.text === '}');
  // Whether jump line n leads where falling through would go.
  const fallsThrough = (n) => {
    const jump = NAMED_JUMP.exec(lines[n].text);
    if (!jump && !(isSub && lines[n].text === 'return;')) return false;
    for (let m = n + 1; ; m++) {
      if (m === lines.length) return !jump;
      const { text } = lines[m];
      if (text === '} else {') {
        m = endOfElse(m);
        continue;
      }
      if (text !== '}') return false;
      const opener = lines[openerOf(m)].text;
      const label = /^(\w+): /.exec(opener)?.[1];
      const loop = / for \(;;\) \{$/.test(opener);
      if (jump && label === jump[2]) return jump[1] === (loop ? 'continue' : 'break');
      if (loop) return false;
    }
  };
  const usedLabels = () => new Set(lines.map((l) => NAMED_JUMP.exec(l.text)?.[2]).filter(Boolean));
  for (let changed = true; changed;) {
    changed = false;
    const used = usedLabels();
    for (let n = 0; n < lines.length && !changed; n++) {
      const { indent, text } = lines[n];
      if (fallsThrough(n)) {
        lines.splice(n, 1);
        changed = true;
        break;
      }
      // An empty branch of an if-else goes (the condition turns for an empty then).
      const nextLine = lines[n + 1];
      if (nextLine?.indent === indent && lines[n].negated && nextLine.text === '} else {') {
        lines[n] = { indent, text: lines[n].negated };
        lines.splice(n + 1, 1);
        changed = true;
        break;
      }
      if (text === '} else {' && nextLine?.indent === indent && nextLine.text === '}') {
        lines.splice(n, 1);
        changed = true;
        break;
      }
      const label = /^(block\d+): \{$/.exec(text);
      const elseAfterJump = text === '} else {' && JUMP.test(lines[n - 1]?.text ?? '');
      if (!(label && !used.has(label[1])) && !elseAfterJump) continue;
      const close = lines.findIndex((l, m) => m > n && l.indent === indent && l.text === '}');
      // The wrapped lines move out one level.
      for (let m = n + 1; m < close; m++) lines[m] = { ...lines[m], indent: lines[m].indent - 1 };
      lines.splice(close, 1);
      if (elseAfterJump) lines[n] = { indent, text: '}' };
      else lines.splice(n, 1);
      changed = true;
    }
  }
  const used = usedLabels();
  return lines.map(({ indent, text }) => {
    const loop = /^(loop\d+): for \(;;\) \{$/.exec(text);
    return `${'  '.repeat(indent)}${loop && !used.has(loop[1]) ? 'for (;;) {' : text}`;
  });
}

// ---------------------------------------------------------------------------------------

async function render(text) {
  try {
    return await format(text, {
      parser: 'babel',
      ...JSON.parse(readFileSync(new URL('.prettierrc.json', ROOT), 'utf8')),
    });
  } catch (error) {
    // Keep the unformatted text for a look at the fault.
    writeFileSync(new URL('.cache/decompile-failed.mjs', ROOT), text);
    throw error;
  }
}

export async function decompileAll(mem) {
  const assets = JSON.parse(readFileSync(new URL('assets/scripts.json', ROOT), 'utf8'));
  const { scripts, nativeFunctions: natives } = assets;
  const names = nativeNames(mem, natives.length);
  const notes = textNotes();
  const files = new Map();
  const index = [];
  const allUsed = new Set(),
    allStarted = new Set();
  for (let first = 0; first < scripts.length; first += GROUP) {
    const group = scripts.slice(first, first + GROUP),
      bodies = [],
      used = new Set(),
      started = new Set();
    for (const s of group) {
      const d = new ScriptDecompiler(s, scripts, natives, names, notes);
      bodies.push(d.source());
      for (const id of d.usedNatives) (used.add(id), allUsed.add(id));
      for (const id of d.usedScripts) (started.add(id), allStarted.add(id));
    }
    const file = `scripts-${hex(first)}.mjs`;
    // The runtime helpers the group's code names.
    const text = bodies.join('\n'),
      imports = [
        ...HELPERS.filter((h) => new RegExp(`\\b${h}\\(`).test(text)),
        ...(/\bEVENT\./.test(text) ? ['EVENT'] : []),
      ].sort();
    const head = [
      `// Scripts ${hex(first)} to ${hex(first + group.length - 1)}, decompiled from the original`,
      '// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:',
      '// edit the decompiler, not this file.',
      imports.length ? `import { ${imports.join(', ')} } from './runtime.mjs';` : '',
      used.size ? "import { game } from './natives.mjs';" : '',
      started.size ? "import { run } from './started.mjs';" : '',
    ].filter(Boolean);
    files.set(file, await render(`${head.join('\n')}\n\n${bodies.join('\n\n')}`));
    for (const s of group) index.push([s.id, file]);
  }
  // The natives table: the game functions some script calls.
  const nativeLines = [
    '// The game functions (natives) the scripts call, by name, generated by',
    '// tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). A call yields the',
    '// native number and its arguments to the scheduler.',
    "import { native } from './runtime.mjs';",
    '',
    'export const game = Object.freeze({',
    ...[...allUsed]
      .sort((a, b) => a - b)
      .map((id) => {
        const params = PARAMETERS[names[id]]?.join(', ');
        return params
          ? `  ${names[id]}: (${params}) => native(0x${hex(id, NATIVE_DIGITS)}, ${params}),`
          : `  ${names[id]}: (...args) => native(0x${hex(id, NATIVE_DIGITS)}, ...args),`;
      }),
    '});',
  ];
  files.set('natives.mjs', await render(nativeLines.join('\n')));
  // The scripts that scripts start, by name.
  const startedLines = [
    '// The scripts that other scripts start, by name, generated by tools/decompile-scripts.mjs',
    '// (names in tools/script-names.mjs). A start yields the script number and its',
    '// arguments to the scheduler, which runs it as a child task and resumes with its result.',
    "import { script } from './runtime.mjs';",
    '',
    'export const run = Object.freeze({',
    ...[...allStarted]
      .sort((a, b) => a - b)
      .map((id) => `  ${scriptName(id)}: (...args) => script(0x${hex(id)}, ...args),`),
    '});',
  ];
  files.set('started.mjs', await render(startedLines.join('\n')));
  // The index: script number to function.
  const byFile = new Map();
  for (const [id, file] of index) (byFile.get(file) ?? byFile.set(file, []).get(file)).push(id);
  const indexLines = [
    '// The decompiled scripts by number, generated by tools/decompile-scripts.mjs',
    '// (docs/READABLE-GAME.md, phase 2).',
    ...[...byFile.keys()].map((file, n) => `import * as group${n} from './${file}';`),
    '',
    'export const SCRIPTS = Object.freeze([',
    ...[...byFile.entries()].flatMap(([, ids], n) =>
      ids.map((id) => `  group${n}.${scriptName(id)},`),
    ),
    ']);',
  ];
  files.set('index.mjs', await render(indexLines.join('\n')));
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { cartridge } = await import('./cartridge-harness.mjs');
  const { VmMemory } = await import('../src/vm/memory.mjs');
  const files = await decompileAll(new VmMemory(cartridge.rom, undefined, null, cartridge.present));
  const check = process.argv.includes('--check');
  let drift = 0;
  if (!check) {
    mkdirSync(OUT, { recursive: true });
    for (const name of readdirSync(OUT))
      if (/^scripts-[0-9A-F]{3}\.mjs$/.test(name) && !files.has(name)) rmSync(OUT + name);
  }
  for (const [name, text] of files) {
    if (check) {
      let old = null;
      try {
        old = readFileSync(OUT + name, 'utf8');
      } catch {
        /* missing */
      }
      if (old !== text) {
        drift++;
        console.log(`drift: src/scripts/${name}`);
      }
    } else writeFileSync(OUT + name, text);
  }
  console.log(`${files.size} files${check ? `, ${drift} drifting` : ' written'}`);
  if (drift) process.exitCode = 1;
}
