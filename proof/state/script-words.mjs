import { BYTE_MASK, BYTE_BITS, BANK_SIZE } from '../../src/constants/bits.mjs';
import { SCRIPT_VARIABLES } from '../../src/task/wram.mjs';
import { SCRIPT_NATIVE } from '../script/task.mjs';
import { isWord } from '../script/runtime.mjs';

const MAX_SCRIPT_WINDOW_BYTES = BANK_SIZE - SCRIPT_VARIABLES;

const profiles = new Map([
  [SCRIPT_NATIVE.AND_STATE_WORD, { argumentWords: 2, returnBytes: 0, operation: 'and' }],
  [SCRIPT_NATIVE.WRITE_STATE_WORD, { argumentWords: 2, returnBytes: 0, operation: 'write' }],
  [SCRIPT_NATIVE.READ_STATE_WORD, { argumentWords: 1, returnBytes: 2, operation: 'read' }],
  [SCRIPT_NATIVE.OR_STATE_WORD, { argumentWords: 2, returnBytes: 0, operation: 'or' }],
]);
const instances = new WeakSet();
export const isScriptWordState = (state) => instances.has(state);
export const isScriptWordNative = (id) => profiles.has(id);

// Game-data slice accessed by four European natives, originating at $7E:3BBB.
// No CPU, address bus or WRAM emulator. The caller explicitly selects a window;
// accesses outside it remain unsupported. Its complete in-game extent and
// initial contents have not been recovered. Unknown bytes are never read as 0.
export function createScriptWordState({ byteLength } = {}) {
  // Keep this first slice within source bank $7E. Cross-bank indexed accesses
  // are outside the ported data window, not claimed to be invalid in the game.
  if (!Number.isInteger(byteLength) || byteLength < 2 || byteLength > MAX_SCRIPT_WINDOW_BYTES)
    throw new Error('Invalid state window length');
  const bytes = new Uint8Array(byteLength);
  const known = new Uint8Array(byteLength);
  const covered = (offset) => offset + 1 < byteLength;
  const read = (offset) => bytes[offset] | (bytes[offset + 1] << BYTE_BITS);
  const write = (offset, value) => {
    bytes[offset] = value & BYTE_MASK;
    bytes[offset + 1] = value >>> BYTE_BITS;
    known[offset] = known[offset + 1] = 1;
  };
  const state = {
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
        throw new Error('Invalid state seed');
      bytes.set(values, offset);
      known.fill(1, offset, offset + values.length);
    },
    snapshot() {
      return {
        byteLength,
        bytes: Array.from(bytes, (value, index) => (known[index] ? value : null)),
      };
    },
    applyNative(request) {
      const profile = profiles.get(request?.nativeId);
      if (!profile) return { handled: false, reason: 'native_implementation_required' };
      if (
        !Array.isArray(request.args) ||
        request.args.length !== profile.argumentWords ||
        Array.from(request.args).some((value) => !isWord(value)) ||
        request.returnBytes !== profile.returnBytes
      )
        throw new Error('State native ABI mismatch');
      const [offset, operand] = request.args; // Original native pop order.
      if (!covered(offset)) return { handled: false, reason: 'state_window_required' };
      if (profile.operation !== 'write' && (!known[offset] || !known[offset + 1]))
        return { handled: false, reason: 'state_source_required' };
      if (profile.operation === 'read') return { handled: true, value: read(offset) };
      const value =
        profile.operation === 'write'
          ? operand
          : profile.operation === 'and'
            ? read(offset) & operand
            : read(offset) | operand;
      write(offset, value);
      return { handled: true, value: null };
    },
  };
  instances.add(state);
  return state;
}
