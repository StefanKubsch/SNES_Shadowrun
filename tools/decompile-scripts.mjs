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
const scriptName = (id) => `script${hex(id)}`;

// ---------------------------------------------------------------------------------------
// Names: natives from their lifted functions, state from the WRAM layout.

function nativeNames(mem, count) {
  const special = new Map();
  const text = readFileSync(new URL('src/vm/special-natives.mjs', ROOT), 'utf8');
  for (const m of text.matchAll(/\[(0x80[0-9a-f]{4}),\s*(\w+)\]/g)) special.set(Number(m[1]), m[2]);
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
// Expressions: { text, prec, pure (no call), constant (value or null), bool }.

const ATOM = 100,
  UNARY = 15,
  RELATIONAL = 10,
  EQUALITY = 9,
  BIT_AND = 8,
  BIT_XOR = 7,
  BIT_OR = 6;
const literal = (value) => ({
  text: value < DECIMAL_BELOW ? String(value) : `0x${value.toString(HEX)}`,
  prec: ATOM,
  pure: true,
  constant: value,
});
const atom = (text, pure = true) => ({ text, prec: ATOM, pure, constant: null });
const paren = (e, min) => (e.prec < min ? `(${e.text})` : e.text);
// A word value of an expression (a condition becomes truth(...)).
const value = (e) => (e.bool ? atom(`truth(${e.text})`, e.pure) : e);
const call = (fn, ...args) =>
  atom(
    `${fn}(${args.map((a) => value(a).text).join(', ')})`,
    args.every((a) => a.pure),
  );
const binary = (op, prec, l, r, bool = false) => ({
  text: `${paren(value(l), prec)} ${op} ${paren(value(r), prec + 1)}`,
  prec,
  pure: l.pure && r.pure,
  constant: null,
  bool,
});
// A condition of an expression: a word is true when not zero.
const condition = (e) =>
  e.bool ? e : { ...binary('!==', EQUALITY, e, literal(0), true), op: '!==', l: e, r: literal(0) };
const INVERSE = { '===': '!==', '!==': '===', '<=': '>', '>': '<=' };
function negate(c) {
  if (c.op && INVERSE[c.op]) return { ...binary(INVERSE[c.op], c.prec, c.l, c.r, true) };
  return { text: `!${paren(c, UNARY)}`, prec: UNARY, pure: c.pure, constant: null, bool: true };
}
const comparison = (op, prec) => (l, r) => ({ ...binary(op, prec, l, r, true), op, l, r });
const helper = (name) => (l, r) => ({ ...call(name, l, r), bool: true });

const BINARY = {
  add: (l, r) => call('word', { ...binary('+', 12, value(l), value(r)) }),
  subtract: (l, r) => call('word', { ...binary('-', 12, value(l), value(r)) }),
  multiply_uu_handler: (l, r) => call('multiply', l, r),
  multiply_su_handler: (l, r) => call('multiplySignedLeft', l, r),
  multiply_us_handler: (l, r) => call('multiplySignedRight', l, r),
  multiply_ss_handler: (l, r) => call('multiplySigned', l, r),
  bit_and: (l, r) => binary('&', BIT_AND, l, r),
  bit_or: (l, r) => binary('|', BIT_OR, l, r),
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
  negate: (v) => call('word', { text: `-${paren(value(v), UNARY)}`, prec: UNARY, pure: v.pure }),
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
  'script',
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

class ScriptDecompiler {
  constructor(script, scripts, natives, nativeNames) {
    this.script = script;
    this.scripts = scripts;
    this.natives = natives;
    this.nativeNames = nativeNames;
    this.code = Uint8Array.from(script.bytecode);
    const decoded = decodeScript(this.code);
    this.ins = new Map(decoded.instructions.map((i) => [i.pc, i]));
    this.usedNatives = new Set();
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
  loadLocal(at, bytes, signedByte) {
    let e;
    if (this.plainLocals) e = atom(this.localName(at));
    else {
      e = atom(`${bytes === 2 ? 'localWord' : 'localByte'}(locals, ${at})`);
    }
    if (signedByte) {
      e = atom(`signed(${e.text})`);
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
    // Before a statement: evaluate the pending non-constant values in their order.
    const spill = () => {
      for (let n = 0; n < stack.length; n++) {
        const e = stack[n];
        if (e.constant !== null && e.constant !== undefined) continue;
        if (e.temp) continue;
        const name = `t${++this.temps}`;
        lines.push(`const ${name} = ${value(e).text.replace(/^\((yield\* .*)\)$/, '$1')};`);
        stack[n] = { ...atom(name), temp: true };
      }
    };
    const statement = (text) => {
      spill();
      lines.push(text);
    };
    // Arguments in the order the callee sees them (args[0] the top word); evaluated in
    // the original's push order when more than one of them could change state.
    const takeArguments = (count) => {
      const args = [];
      for (let n = 0; n < count; n++) args.push(pop());
      const calls = args.filter((a) => !a.pure).length;
      if (calls && args.filter((a) => a.constant === null || a.constant === undefined).length > 1) {
        stack.push(...args.slice().reverse());
        spill();
        args.length = 0;
        for (let n = 0; n < count; n++) args.push(pop());
      }
      return args;
    };
    const yieldExpr = (text) => ({
      text: `(${text})`,
      prec: ATOM,
      pure: false,
      constant: null,
      yields: text,
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
      else if (n === 'load_state_u8') stack.push(atom(`state.byte(${stateRef(i.operand)})`));
      else if (n === 'load_state_i8') {
        stack.push(atom(`signed(state.byte(${stateRef(i.operand)}))`));
      } else if (n === 'load_state_u16') stack.push(atom(`state.word(${stateRef(i.operand)})`));
      else if (n === 'store_local_u8' || n === 'store_local_u16') {
        const v = pop();
        statement(this.storeLocal(i.operand, n.endsWith('16') ? 2 : 1, v));
      } else if (n === 'store_state_u8' || n === 'store_state_u16') {
        const v = pop();
        statement(
          `state.${n.endsWith('16') ? 'setWord' : 'setByte'}(${stateRef(i.operand)}, 0, ${value(v).text});`,
        );
      } else if (n === 'duplicate') {
        const v = pop();
        if (v.constant === null || v.constant === undefined) {
          if (!v.temp && !(v.pure && v.local)) {
            stack.push(v);
            spill();
            stack.push(stack[stack.length - 1]);
          } else stack.push(v, v);
        } else stack.push(v, v);
      } else if (n === 'drop') {
        const v = pop();
        if (!v.pure) statement(`${v.yields ?? value(v).text};`);
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
        const text = `yield* game.${name}(${args.map((a) => value(a).text).join(', ')})`;
        if (info.returnBytes) stack.push(yieldExpr(text));
        else statement(`${text};`);
      } else if (n === 'call_script') {
        const info = this.scripts[i.operand],
          args = takeArguments(info.argumentBytes >>> 1);
        const text = `yield* script(0x${hex(i.operand)}${args.map((a) => `, ${value(a).text}`).join('')})`;
        if (info.returnBytes) stack.push(yieldExpr(text));
        else statement(`${text};`);
      } else if (n === 'call_local') {
        const sub = this.subs.get(i.operand),
          args = takeArguments(sub.inputs),
          name = `sub${i.operand}`;
        const text = `${sub.yields ? 'yield* ' : ''}${name}(${args.map((a) => value(a).text).join(', ')})`;
        if (sub.outputs === 0) statement(`${text};`);
        else if (sub.outputs === 1) stack.push(sub.yields ? yieldExpr(text) : atom(text, false));
        else {
          spill();
          const names = Array.from({ length: sub.outputs }, () => `t${++this.temps}`);
          lines.push(`const [${names.join(', ')}] = ${text};`);
          // The first output is the deepest.
          for (const name of names) stack.push({ ...atom(name), temp: true });
        }
      } else if (n === 'jump_if_zero' || n === 'jump_if_nonzero') {
        const c = condition(pop());
        spill();
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

    const labels = new Set();
    const out = [];
    const emit = (indent, text) => out.push({ indent, text });
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
        emit(indent, `if (${term.when.text}) {`);
        doBranch(x, next[0], context, indent + 1);
        emit(indent, '} else {');
        doBranch(x, next[1], context, indent + 1);
        emit(indent, '}');
        return;
      }
      doBranch(x, next[0], context, indent);
    };
    const doBranch = (from, to, context, indent) => {
      if (backward(from, to)) {
        labels.add(`loop${to}`);
        emit(indent, `continue loop${to};`);
      } else if (merge(to)) {
        labels.add(`block${to}`);
        emit(indent, `break block${to};`);
      } else doTree(to, context, indent);
    };
    doTree(entry, [], 0);
    return tidy(out, labels);
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
    return lines.join('\n');
  }
}

// Labels nobody jumps to go, with their braces when they wrap a block; an else whose
// then-branch ends in a jump becomes the code after the if. Lines carry their depth.
const JUMP = /^(break|continue|return|throw)\b/;
function tidy(out, labels) {
  let lines = out.slice();
  for (let changed = true; changed;) {
    changed = false;
    for (let n = 0; n < lines.length; n++) {
      const { indent, text } = lines[n];
      const label = /^(block\d+): \{$/.exec(text);
      const elseAfterJump = text === '} else {' && JUMP.test(lines[n - 1]?.text ?? '');
      if (!(label && !labels.has(label[1])) && !elseAfterJump) continue;
      const close = lines.findIndex((l, m) => m > n && l.indent === indent && l.text === '}');
      // The wrapped lines move out one level.
      for (let m = n + 1; m < close; m++) lines[m] = { ...lines[m], indent: lines[m].indent - 1 };
      lines.splice(close, 1);
      if (elseAfterJump) lines[n] = { indent, text: '}' };
      else lines.splice(n, 1);
      changed = true;
      break;
    }
  }
  return lines.map(({ indent, text }) => {
    const loop = /^(loop\d+): for \(;;\) \{$/.exec(text);
    return `${'  '.repeat(indent)}${loop && !labels.has(loop[1]) ? 'for (;;) {' : text}`;
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
  const files = new Map();
  const index = [];
  for (let first = 0; first < scripts.length; first += GROUP) {
    const group = scripts.slice(first, first + GROUP),
      bodies = [],
      used = new Set();
    for (const s of group) {
      const d = new ScriptDecompiler(s, scripts, natives, names);
      bodies.push(d.source());
      for (const id of d.usedNatives) used.add(id);
    }
    const file = `scripts-${hex(first)}.mjs`;
    // The runtime helpers the group's code names.
    const text = bodies.join('\n'),
      imports = HELPERS.filter((h) => new RegExp(`\\b${h}\\(`).test(text)).sort();
    const head = [
      `// Scripts ${hex(first)} to ${hex(first + group.length - 1)}, decompiled from the original`,
      '// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:',
      '// edit the decompiler, not this file.',
      imports.length ? `import { ${imports.join(', ')} } from './runtime.mjs';` : '',
      used.size ? "import { game } from './natives.mjs';" : '',
    ].filter(Boolean);
    files.set(file, await render(`${head.join('\n')}\n\n${bodies.join('\n\n')}`));
    for (const s of group) index.push([s.id, file]);
  }
  // The natives table.
  const nativeLines = [
    '// The game functions (natives) the scripts call, by name, generated by',
    '// tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). A call yields the',
    '// native number and its arguments to the scheduler.',
    "import { native } from './runtime.mjs';",
    '',
    'export const game = Object.freeze({',
    ...names.map(
      (name, id) => `  ${name}: (...args) => native(0x${hex(id, NATIVE_DIGITS)}, ...args),`,
    ),
    '});',
  ];
  files.set('natives.mjs', await render(nativeLines.join('\n')));
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
