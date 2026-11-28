// Shared decoder and width workspace. The source bank word deliberately overlaps
// the source pointer; byte fields preserve the other byte of their word aliases.
import { workspaceMemory, scratchWord } from './workspace.mjs';
import { windowManagerState } from './windows.mjs';
import { WINDOW_TEXT_FIELDS, windowsText } from './windows-text.mjs';
import { stateField } from './named-fields.mjs';
import { readStateByte, writeStateByte } from './objects.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';
const DECODER_SCRATCH = {
  sourcePointer: 0xcf,
  sourceBankWord: 0xd0,
  characterPair: 0xd2,
  width: 0xba,
  textArgument: 2,
  widthTextArgument: 0,
};
const SOURCE_BANK = 0xd1;
const states = new WeakMap();
export function textDecodingState(wram) {
  let state = states.get(wram);
  if (state) return state;
  const mem = workspaceMemory(wram),
    descriptors = {};
  for (const [name, at] of Object.entries(DECODER_SCRATCH))
    descriptors[name] = scratchWord(mem, at);
  for (const name of ['bitsRemaining', 'bitBuffer'])
    descriptors[name] = stateField(mem, WINDOW_TEXT_FIELDS, windowsText, name);
  descriptors.sourceBank = {
    get: () => readStateByte(wram, SOURCE_BANK),
    set: (value) => writeStateByte(wram, SOURCE_BANK, value & BYTE_MASK),
  };
  state = Object.defineProperties({ buffer: windowManagerState(mem) }, descriptors);
  states.set(wram, state);
  return state;
}
