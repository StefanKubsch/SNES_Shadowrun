// Controls: keyboard, mouse and gamepad together make up the pad word of the
// original (twelve buttons, bit layout after Book I PDF 148). No DOM, so that
// tools/browser-controls.test.mjs checks the bindings in Node.
//
// A binding is a list of inputs per SNES button:
//   code:<KeyboardEvent.code>  key by its position (WASD, arrows, Escape)
//   key:<letter>               key by its label (Y on QWERTZ is code KeyZ)
//   mouse:<button>             mouse button on the game picture (0 left, 1 middle, 2 right)
import { PAD_BUTTONS as PAD_BUTTON_BITS } from '../vm/frame-events.mjs';

// An analogue button (trigger) counts as pressed above half travel.
const ANALOG_PRESS = 0.5;
export const BUTTONS = [
  ['B', 0x8000],
  ['Y', 0x4000],
  ['Select', 0x2000],
  ['Start', 0x1000],
  ['Up', 0x0800],
  ['Down', 0x0400],
  ['Left', 0x0200],
  ['Right', 0x0100],
  ['A', 0x0080],
  ['X', 0x0040],
  ['L', 0x0020],
  ['R', 0x0010],
];
// Back is no SNES button: Select in menus; in free play it closes the glove (mouse-control.mjs).
export const BACK = 'Back';
export const BINDABLE = [...BUTTONS.map(([name]) => name), BACK];
// User default 2026-10-30; Esc is Back. Mouse in the game: left L (examine),
// right R, which acts by context over an object (mouse-control.mjs: Use where
// it has an effect, otherwise the action list B, as with people), middle B.
export const DEFAULT_BINDINGS = {
  B: ['key:b', 'mouse:1'],
  Y: ['key:y'],
  Select: ['key:g'],
  Start: ['key:e'],
  Up: ['code:KeyW', 'code:ArrowUp'],
  Down: ['code:KeyS', 'code:ArrowDown'],
  Left: ['code:KeyA', 'code:ArrowLeft'],
  Right: ['code:KeyD', 'code:ArrowRight'],
  A: ['key:f'],
  X: ['key:x'],
  L: ['mouse:0', 'key:q'],
  R: ['mouse:2'],
  Back: ['code:Escape'],
};
// P pauses the game and F9 toggles the CRT picture; so neither can be bound.
export const RESERVED = new Set(['code:KeyP', 'key:p', 'code:F9']);
// Pad bit of each SNES button by name, and the four directions together.
export const PAD_BIT = Object.freeze(Object.fromEntries(BUTTONS));
export const DIRECTIONS = PAD_BIT.Up | PAD_BIT.Down | PAD_BIT.Left | PAD_BIT.Right;
const VALID = /^(code:[A-Za-z0-9]+|key:[a-z0-9]|mouse:[0-4])$/;

// Inputs of a key press: always the position, the label for letters and digits.
export function keyInputs({ code, key }) {
  const inputs = code ? ['code:' + code] : [],
    label = typeof key === 'string' ? key.toLowerCase() : '';
  if (/^[a-z0-9]$/.test(label)) inputs.push('key:' + label);
  return inputs;
}
// When rebinding, letters and digits count by their label, everything else by position.
export const captureInput = (event) => keyInputs(event).at(-1) ?? null;
export function bitsFor(bindings, inputs) {
  let word = 0;
  for (const [name, bit] of BUTTONS)
    if (bindings[name]?.some((input) => inputs.includes(input))) word |= bit;
  return word;
}
// The D-pad cannot press opposite directions at once; both are dropped.
export function cleanPad(word) {
  const vertical = PAD_BIT.Up | PAD_BIT.Down,
    horizontal = PAD_BIT.Left | PAD_BIT.Right;
  if ((word & vertical) === vertical) word &= ~vertical;
  if ((word & horizontal) === horizontal) word &= ~horizontal;
  return word & PAD_BUTTON_BITS;
}
// Gamepad with standard mapping (W3C Gamepad, "standard"): buttons by their
// position as on the SNES pad, bottom B, right A, left Y, top X; left stick as D-pad.
const PAD_BUTTONS = [
  [0, 'B'],
  [1, 'A'],
  [2, 'Y'],
  [3, 'X'],
  [4, 'L'],
  [5, 'R'],
  [6, 'L'],
  [7, 'R'],
  [8, 'Select'],
  [9, 'Start'],
  [12, 'Up'],
  [13, 'Down'],
  [14, 'Left'],
  [15, 'Right'],
];
const STICK = 0.5;
export function gamepadBits(pad) {
  if (!pad?.connected) return 0;
  let word = 0;
  for (const [index, name] of PAD_BUTTONS) {
    const b = pad.buttons[index];
    if (b && (b.pressed || b.value > ANALOG_PRESS)) word |= PAD_BIT[name];
  }
  const [x = 0, y = 0] = pad.axes ?? [];
  if (x <= -STICK) word |= PAD_BIT.Left;
  if (x >= STICK) word |= PAD_BIT.Right;
  if (y <= -STICK) word |= PAD_BIT.Up;
  if (y >= STICK) word |= PAD_BIT.Down;
  return word;
}
// Stored bindings: unknown or reserved inputs are dropped, missing buttons get the default.
export function parseBindings(text) {
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {}
  const result = {};
  for (const name of BINDABLE) {
    const list = Array.isArray(data?.[name])
      ? data[name].filter(
          (input) => typeof input === 'string' && VALID.test(input) && !RESERVED.has(input),
        )
      : null;
    result[name] = list ?? [...DEFAULT_BINDINGS[name]];
  }
  return result;
}
// An input belongs to at most one SNES button: binding it removes it from the others.
export function bind(bindings, name, input) {
  if (!VALID.test(input) || RESERVED.has(input) || !BINDABLE.includes(name)) return bindings;
  const result = {};
  for (const other of BINDABLE) result[other] = bindings[other].filter((i) => i !== input);
  result[name] = [input];
  return result;
}
const NAMES = {
  Escape: 'Esc',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: 'Space',
  Enter: 'Enter',
  ShiftLeft: 'Left Shift',
  ShiftRight: 'Right Shift',
  ControlLeft: 'Left Ctrl',
  ControlRight: 'Right Ctrl',
  Tab: 'Tab',
  Backspace: 'Backspace',
};
const MOUSE = [
  'left mouse button',
  'middle mouse button',
  'right mouse button',
  'mouse button 4',
  'mouse button 5',
];
export function inputLabel(input) {
  const [kind, value] = input.split(/:(.*)/);
  if (kind === 'key') return value.toUpperCase();
  if (kind === 'mouse') return MOUSE[value];
  return NAMES[value] ?? value.replace(/^(Key|Digit|Numpad)/, '');
}
export const bindingsText = (bindings) =>
  BINDABLE.map((name) => `${name}=${bindings[name].map(inputLabel).join('/') || '–'}`).join(', ');
