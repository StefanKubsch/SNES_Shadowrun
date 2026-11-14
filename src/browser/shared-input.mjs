// Shared memory between the page (start.mjs) and the worker (game-worker.mjs),
// Int32 words: pad word, frames shown, directions and A/X from the keyboard
// alone (directions close the glove, A/X switch from the hand to the crosshair
// or the spell), mouse (counter<<16 | y<<8 | x), mouse buttons (pad bits |
// left<<16 | right<<17 | back<<18), sum of the wheel steps. Without shared
// memory the page sends the same values by message (recording.mjs unpacks them).
// A separate cheat mask follows the raw inputs and is recorded as page events.
export const SHARED_PAD = 0,
  SHARED_SHOWN = 1,
  SHARED_KEYS = 2,
  SHARED_MOUSE = 3,
  SHARED_BUTTONS = 4,
  SHARED_WHEEL = 5,
  SHARED_CHEATS = 6,
  SHARED_WORDS = 7;
// The raw input of one pad read in the order of the recording.
export const INPUT_WORDS = [SHARED_PAD, SHARED_KEYS, SHARED_MOUSE, SHARED_BUTTONS, SHARED_WHEEL];
// Packed mouse word: movement counter (15 bits) above y and x bytes.
export const MOUSE_COUNTER_SHIFT = 16,
  MOUSE_COUNTER_MASK = 0x7fff,
  MOUSE_Y_SHIFT = 8;
// Mouse button bits above the 16 pad bits of the buttons word.
export const MOUSE_BUTTON_SHIFT = 16,
  MOUSE_BUTTONS_MASK = 3;
export const MOUSE_LEFT = 1 << MOUSE_BUTTON_SHIFT,
  MOUSE_RIGHT = 1 << (MOUSE_BUTTON_SHIFT + 1),
  BACK_HELD = 1 << (MOUSE_BUTTON_SHIFT + 2);
