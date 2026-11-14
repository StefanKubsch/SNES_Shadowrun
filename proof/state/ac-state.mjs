import { BYTE_MASK, BYTE_BITS, WORD_MASK } from '../../src/constants/bits.mjs';
import {
  FIGHT_LIST_INDEX,
  FIGHT_MUSIC,
  FIGHT_KARMA,
  FIGHT_FIRST_REMOVAL,
  FIGHT_UNREAD,
  HARMLESS_HITS,
  GAME_OPTIONS,
  MUSIC_FIGHT,
  EMPTY_LIST,
} from '../../src/task/wram.mjs';
import { SCRIPT_NATIVE } from '../script/task.mjs';
import { isWord } from '../script/runtime.mjs';

const FIGHT_WINDOW_BYTES = GAME_OPTIONS - FIGHT_LIST_INDEX + 2;
const KARMA_FIGHT_SHIFT = 3;
const NO_FIGHT_MUSIC = WORD_MASK;

const instances = new WeakSet();
export const isACState = (state) => instances.has(state);
const base = FIGHT_LIST_INDEX;
const byteLength = FIGHT_WINDOW_BYTES; // Explicit data window through the word at 1FD6.

// Data operations from $80:8511 and native $AC. This window is not a queue
// capacity or a WRAM bus. Bytes overlap normally, including odd-index writes.
export function createACState() {
  const bytes = Array(byteLength).fill(null);
  let word1CDE = null; // Source 1CDE, not written by the initializer.
  const read = (offset) =>
    bytes[offset] === null || bytes[offset + 1] === null
      ? null
      : bytes[offset] | (bytes[offset + 1] << BYTE_BITS);
  const write = (offset, value) => {
    bytes[offset] = value & BYTE_MASK;
    bytes[offset + 1] = value >>> BYTE_BITS;
  };
  const initialize = () => {
    write(0, EMPTY_LIST);
    for (const address of [FIGHT_FIRST_REMOVAL, FIGHT_UNREAD, HARMLESS_HITS])
      write(address - base, 0);
  };
  initialize();
  const state = {
    initialize,
    seed(offset, values) {
      if (
        !Number.isInteger(offset) ||
        offset < 0 ||
        !(Array.isArray(values) || values instanceof Uint8Array) ||
        values.length < 1 ||
        offset + values.length > byteLength ||
        Array.from(values).some(
          (value) => !Number.isInteger(value) || value < 0 || value > BYTE_MASK,
        )
      )
        throw new Error('Invalid AC data seed');
      for (let index = 0; index < values.length; index++) bytes[offset + index] = values[index];
    },
    seedWord1CDE(value) {
      if (!isWord(value)) throw new Error('Invalid AC 1CDE source');
      word1CDE = value;
    },
    snapshot: () => ({ base: '1FB0', byteLength, bytes: [...bytes], word1CDE }),
    applyNative(request, { readWord3C11 = null } = {}) {
      if (request?.nativeId !== SCRIPT_NATIVE.AC_STATE)
        return { handled: false, reason: 'native_implementation_required' };
      if (
        !Array.isArray(request.args) ||
        request.args.length !== 1 ||
        !isWord(request.args[0]) ||
        request.returnBytes !== 0
      )
        throw new Error('AC native ABI mismatch');
      const cursor = read(0);
      if (cursor === null) return { handled: false, reason: 'ac_source_required' };
      const next = (cursor + 2) & WORD_MASK;
      const target = 2 + next;
      if (target + 1 >= byteLength) return { handled: false, reason: 'ac_window_required' };
      let shiftedWord;
      if (next === 0) {
        if (readWord3C11 === null) return { handled: false, reason: 'ac_3c11_source_required' };
        if (typeof readWord3C11 !== 'function') throw new Error('Invalid AC 3C11 source');
        const source = readWord3C11();
        if (!source?.handled)
          return { handled: false, reason: source?.reason ?? 'ac_3c11_source_required' };
        if (!isWord(source.value)) throw new Error('Invalid AC 3C11 source');
        shiftedWord = source.value >>> KARMA_FIGHT_SHIFT;
        const flags = read(GAME_OPTIONS - base);
        if (flags === null) return { handled: false, reason: 'ac_source_required' };
        if (flags & 1) {
          if (word1CDE === null) return { handled: false, reason: 'ac_1cde_source_required' };
          if (word1CDE !== MUSIC_FIGHT)
            return { handled: false, reason: 'ac_audio_helper_required' };
        }
      }
      // Source coverage is checked before writes. This port preflight does
      // not claim a rollback in the original, which writes before its reads.
      write(0, next);
      write(target, request.args[0]);
      if (next === 0) {
        write(FIGHT_KARMA - base, shiftedWord);
        write(FIGHT_MUSIC - base, NO_FIGHT_MUSIC);
      }
      return { handled: true, value: null, workspaceWords: [...request.args] };
    },
  };
  instances.add(state);
  return state;
}
