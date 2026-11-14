// Mouse and back key (user decisions 2026-10-30). Runs in the worker at the
// NMI where the original reads the pad word (LiveGame pad); ROM evidence in
// docs/CONTROLS.md.
//
// Free play (the player control 80:E014 ran in the last frame) or an open
// glove: a mouse movement opens the glove, which then sits directly under
// the mouse (position set, not steered there via the D-pad). A direction
// from the keyboard or the back key closes it, so that WASD moves Jake.
// The mouse buttons give their mapping (L/R).
// Otherwise (title, dialog, menu): the mouse wheel gives up/down, the left
// mouse button B, the right mouse button and back give Select. B confirms
// everywhere: A6A5 lists D0C0, text wait F953 E0C0, target choice 9BC6 C0C0,
// title menu 81:E14A 9000 (not A there). Cancelling uses Select (A6A5 lists,
// EA6E). In the title menu, however, Select means 'down' (2400) and there is
// no back: before the player first takes control (intro, title, save game
// choice), back and the right mouse button do nothing (user finding 2026-10-30).
//
// 80:E014: with the glove closed (01D8 = 0), B, L or R open the glove at
// Jake (BC67, 01D8 = FFFF). Open: A or X close it without an action
// (E18D -> BCB2) as long as no crosshair is active (1D5D/1D5F); with the
// crosshair, A shoots and B closes there (E19A, A/X not held).
//
// Crosshair and spell (user decision 2026-10-30): because the mouse keeps the
// hand open almost all the time, A (F) or X from the keyboard would only close
// it. On the open hand they therefore toggle: key until closed, one frame
// released, key until the crosshair (FFFE) or spell (FFFD) is open; the held
// key only counts again after it is released (no unintended shot). In the
// crosshair or spell the left mouse button fires (A) and the right one ends like
// back; the mouse only moves. The gamepad keeps the original behaviour. Ending
// (right mouse button in the crosshair, back in the game) is queued: after a
// shot E014 does not run for 10 to 30 frames, and a short press would otherwise
// be lost. 80:BE6D moves 01D4/01D6 (8.8, pixel in the high byte) with speed
// 01D0/01D2 and clamps to X 3..239, Y 3..206.
//
// 80:BCBE (hit test, only without a held direction, BF25): when the glove hits
// a new object, 01DA records it (object) and 01E0/01E2 (object minus glove
// position, pixels); for the same object BE38 sets the position every frame to
// the object minus this offset (follows moving objects).
import { PAD_BIT, DIRECTIONS } from './controls.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { OBJECT_TASK } from '../task/wram.mjs';
import { TASK_PREVIOUS, TASK_WAIT } from '../vm/layout.mjs';

const HAND = 0xffff,
  OPEN = 0x01d8,
  SLOT = 0x01de,
  SPEED_X = 0x01d0,
  SPEED_Y = 0x01d2,
  GLOVE_X = 0x01d4,
  GLOVE_Y = 0x01d6,
  AIM = 0x1d5d,
  SPELL = 0x1d5f,
  TARGET = 0x01da,
  OFFSET_X = 0x01e0,
  OFFSET_Y = 0x01e2;
// Glove position range of 80:BE6D in pixels.
const RANGE_X = [3, 239],
  RANGE_Y = [3, 206];
const { B, A, X, R, Select: SELECT, Up: UP, Down: DOWN } = PAD_BIT,
  HOLD = 4;
// One mouse wheel step: two frames pressed, two frames released (every menu poll sees the new key).
const PULSE_ON = 2,
  PULSE_FRAMES = 4,
  WHEEL_QUEUE = 8,
  PLAYING = 6;
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Math.round(v)));
// Wait words of the object's task chain (see useEvent): any of ACTION_EVENTS
// offers an action, USE_EVENTS selects the event of R, and USE_NONE alone is none.
const ACTION_EVENTS = 0x67f2,
  USE_EVENTS = 0x0610,
  USE_NONE = 0x0600,
  // Upper bound of the chain walk (more than the 48 task slots).
  MAX_CHAIN = 64;
// Context-dependent right mouse button (user decision 2026-10-30): after 80:BF3B,
// R ('Use') only acts when the object under the hand has a use event:
// slot 01DE, task 1350+Y, chain 0BA2+X (negative: continue with 0372+X); flag&67F2
// zero means no action at all, otherwise flag&0610 is the event of R (exactly
// 0600 counts as none). Without an event the button opens the action list (B),
// for example for people; this way a click opens, takes or uses directly.
export function useEvent(wram) {
  const read = (a) => wram[a] | (wram[a + 1] << BYTE_BITS);
  let task = read(OBJECT_TASK + read(SLOT));
  for (let n = 0; n < MAX_CHAIN && !(task & WORD_SIGN); n++) {
    const flags = read(TASK_WAIT + task);
    if (!(flags & WORD_SIGN)) {
      if (!(flags & ACTION_EVENTS)) return 0;
      const use = flags & USE_EVENTS;
      return use === USE_NONE ? 0 : use;
    }
    task = read(TASK_PREVIOUS + task);
  }
  return 0;
}
export class MouseControl {
  constructor(game) {
    this.game = game;
    this.seen = 0;
    this.move = null;
    this.held = 0;
    this.want = false;
    this.frames = 0;
    this.open = false;
    this.menu = false;
    this.buttons = [undefined, undefined];
    this.back = null;
    this.wheelSeen = 0;
    this.wheelQueue = 0;
    this.pulse = 0;
    this.keysBefore = 0;
    this.muted = 0;
    this.queue = [];
    this.closing = false;
  }
  // k: NMI of the read. word: pad word of the page; keyDirections: directions from
  // the keyboard alone; keyButtons: A and X from the keyboard alone; mouse {seq,x,y}: pixels, seq counts movements;
  // mouseBits: share of the mouse buttons in the pad word; buttons: bit 0 left, bit 1
  // right held; back: back key held; wheel: sum of the wheel steps (+ = down).
  pad(
    k,
    {
      word = 0,
      keyDirections = 0,
      keyButtons = 0,
      mouse = null,
      mouseBits = 0,
      buttons = 0,
      back: backHeld = false,
      wheel = 0,
    } = {},
  ) {
    const wram = this.game.memory.wram,
      read = (a) => wram[a] | (wram[a + 1] << BYTE_BITS),
      write = (a, v) => {
        wram[a] = v & BYTE_MASK;
        wram[a + 1] = (v >> BYTE_BITS) & BYTE_MASK;
      };
    // control: E014 ran in the last frame (condition for injected keys). For the
    // meaning of the keys a window counts, because E014 skips single frames in free
    // play (for example while the glove opens).
    const open = (this.open = read(OPEN) !== 0),
      control = this.game.controlNmi >= k,
      playing = this.game.controlNmi >= k - PLAYING;
    // Open hand without player control: target choice (9BC6, the mouse steers the glove) or
    // action list 99EB (a menu with mouse wheel, click and back; LiveGame choosing).
    // With fluidControls the crosshair and the spell pointer are never a menu: after a
    // shot the player control pauses for 10 to 30 frames, and the mouse keeps moving them.
    const aiming = open && read(OPEN) !== HAND,
      fluidAim = aiming && this.game.gameplay?.fluidControls === true,
      choosing = !playing && open && !fluidAim && this.game.choosing !== false,
      menu = (this.menu = !playing && !choosing && !fluidAim),
      back = this.game.controlNmi >= 0 ? SELECT : 0;
    const pressed = keyButtons & ~this.keysBefore;
    this.keysBefore = keyButtons;
    if (mouse && mouse.seq !== this.seen) {
      this.seen = mouse.seq;
      this.move = { x: mouse.x, y: mouse.y };
    }
    // The meaning of a mouse button and of the back key holds from the press until the release:
    // in the crosshair or spell left is A (fire), right nothing (ending is queued); otherwise in the game the
    // mapping (zero; right with R over an object R, or B according to useEvent), in the menu B/Select,
    // in the target choice (9C40) left B.
    const context = playing && open && !aiming && !(read(TARGET) & WORD_SIGN) && mouseBits & R;
    for (let b = 0; b < 2; b++) {
      const down = (buttons >> b) & 1;
      if (!down) this.buttons[b] = undefined;
      else if (this.buttons[b] === undefined) {
        this.buttons[b] = aiming
          ? b
            ? 0
            : A
          : menu
            ? b
              ? back
              : B
            : choosing
              ? b
                ? 0
                : B
              : b && context
                ? useEvent(wram)
                  ? R
                  : B
                : null;
        if (aiming && b) this.closing = true;
      }
    }
    if (this.buttons.some((v) => v !== null && v !== undefined))
      word =
        (word & ~mouseBits) |
        (this.buttons[0] ?? (buttons & 1 ? mouseBits & ~R : 0)) |
        (this.buttons[1] ?? 0);
    if (!backHeld) this.back = null;
    else if (this.back === null) {
      this.back = menu ? back : 0;
      if (open && (playing || aiming)) this.closing = true;
    }
    if (!open) this.closing = false;
    word |= this.back ?? 0;
    word |= this.wheel(wheel, menu);
    // After a toggle, a held A/X key of the keyboard only counts after it is released.
    this.muted &= keyButtons | this.queue.reduce((m, b) => m | b, 0) | this.held;
    word &= ~this.muted;
    // An injected key stays until the glove has toggled (at most HOLD frames).
    if (this.held) {
      if (open !== this.want && ++this.frames < HOLD) return word | this.held;
      this.held = 0;
    }
    // Toggling from the hand: after closing, one frame without a key, then until open.
    if (this.queue.length) {
      const next = this.queue.shift();
      return next ? this.inject(next, true, word) : word;
    }
    if (read(OPEN) === HAND && control && pressed) {
      const button = pressed & A || X;
      this.muted |= button;
      this.queue = [0, button];
      this.move = null;
      return this.inject(button, false, word);
    }
    if (open && control && (this.closing || keyDirections & DIRECTIONS)) {
      this.closing = false;
      this.move = null;
      return this.inject(read(AIM) | read(SPELL) ? B : A, false, word);
    }
    if (!open) {
      // A movement from a dialog or menu, or while WASD is held, opens nothing later.
      if (this.move && control && !(keyDirections & DIRECTIONS)) return this.inject(B, true, word);
      this.move = null;
      return word;
    }
    // In an action list the hand stands still; mouse movements there are dropped.
    if (menu) this.move = null;
    if (this.move) {
      const x = clamp(this.move.x, RANGE_X),
        y = clamp(this.move.y, RANGE_Y);
      // Over an object (01DA not negative) BCBE sets the position to the object minus the
      // recorded offset 01E0/01E2; the offset moves along, otherwise the glove snaps in.
      if (!(read(TARGET) & WORD_SIGN)) {
        write(OFFSET_X, (read(OFFSET_X) + wram[GLOVE_X + 1] - x) & WORD_MASK);
        write(OFFSET_Y, (read(OFFSET_Y) + wram[GLOVE_Y + 1] - y) & WORD_MASK);
      }
      write(GLOVE_X, x << BYTE_BITS);
      write(GLOVE_Y, y << BYTE_BITS);
      write(SPEED_X, 0);
      write(SPEED_Y, 0);
      this.move = null;
    }
    return word;
  }
  // Wheel steps only in the menu; outside it they are dropped.
  wheel(total, menu) {
    const steps = total - this.wheelSeen;
    this.wheelSeen = total;
    if (!menu) {
      this.wheelQueue = 0;
      this.pulse = 0;
      return 0;
    }
    this.wheelQueue = Math.max(-WHEEL_QUEUE, Math.min(WHEEL_QUEUE, this.wheelQueue + steps));
    if (!this.pulse) {
      if (!this.wheelQueue) return 0;
      this.pulse = Math.sign(this.wheelQueue) * PULSE_FRAMES;
      this.wheelQueue -= Math.sign(this.wheelQueue);
    }
    const left = Math.abs(this.pulse),
      direction = this.pulse > 0 ? DOWN : UP;
    this.pulse -= Math.sign(this.pulse);
    return left > PULSE_FRAMES - PULSE_ON ? direction : 0;
  }
  inject(button, want, word) {
    this.held = button;
    this.want = want;
    this.frames = 0;
    return word | button;
  }
}
