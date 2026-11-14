// Authoring rules are independent of the lossless original-byte encoder.
import { VmFault } from '../vm/memory.mjs';
import { BYTE_MASK, HEX_RADIX } from '../constants/bits.mjs';
import { encodeMatrixText } from './matrix-texts.mjs';

export const MATRIX_EDIT_COLUMNS = 29;
// Includes the terminator, with a separate zero byte for WORD read-ahead.
// Bounds parsing, a palette-only writer batch and retained queue content.
export const MATRIX_EDIT_STREAM_LIMIT = 1024;
export const MATRIX_COUNT_TEXT = 0x81c60d;
const NEWLINE = 4,
  WAIT = 5,
  BACK = 6,
  COUNT_PLACEHOLDER = 0x30;
const GLYPH = /^[ A-Za-z0-9!\-.:?]$/;

function compile(text, id) {
  if (typeof text !== 'string') throw new VmFault('matrix_edit_text_required');
  const bytes = [];
  let column = null,
    pending = false,
    countIndex = -1;
  for (let at = 0; at < text.length;) {
    const c = text[at];
    let value;
    if (c === '\n') {
      value = NEWLINE;
      at++;
    } else if (c === '{') {
      const token =
        /^\{(?<control>palette (?<palette>[0-2])|wait (?<wait>[0-9]{1,3})|back|count)\}/.exec(
          text.slice(at),
        );
      if (!token) throw new VmFault('matrix_edit_control_required');
      at += token[0].length;
      const { control, palette, wait } = token.groups;
      if (palette !== undefined) value = Number(palette) + 1;
      else if (wait !== undefined) {
        const delay = Number(wait);
        if (delay < 1 || delay > BYTE_MASK) throw new VmFault('matrix_edit_wait_required');
        bytes.push(WAIT);
        value = delay;
        pending = false;
        // Operand values are data, not another control or a glyph.
        bytes.push(value);
        if (bytes.length >= MATRIX_EDIT_STREAM_LIMIT)
          throw new VmFault('matrix_edit_stream_required');
        continue;
      } else if (control === 'back') value = BACK;
      else {
        if (id !== MATRIX_COUNT_TEXT || countIndex !== -1)
          throw new VmFault('matrix_edit_count_required');
        countIndex = bytes.length;
        value = COUNT_PLACEHOLDER;
      }
    } else {
      if (!GLYPH.test(c)) throw new VmFault('matrix_edit_character_required');
      value = c.charCodeAt(0);
      at++;
    }
    if (value === NEWLINE) {
      column = 0;
      pending = false;
    } else if (value === BACK) {
      if (column === null || column === 0) throw new VmFault('matrix_edit_back_required');
      column--;
      pending = false;
    } else if (value > BACK) {
      if (column === null) throw new VmFault('matrix_edit_line_start_required');
      if (++column > MATRIX_EDIT_COLUMNS) throw new VmFault('matrix_edit_row_required');
      pending = true;
    }
    bytes.push(value);
    if (bytes.length >= MATRIX_EDIT_STREAM_LIMIT) throw new VmFault('matrix_edit_stream_required');
  }
  // Streams share a cursor. Requiring a known left margin at both ends
  // prevents one valid edit from spilling when followed by another message.
  if (text && (pending || column !== 0)) throw new VmFault('matrix_edit_line_end_required');
  if (text && id === MATRIX_COUNT_TEXT && countIndex === -1)
    throw new VmFault('matrix_edit_count_required');
  return { bytes: Uint8Array.from([...bytes, 0, 0]), countIndex };
}

export function buildMatrixTextEdits(asset, originals) {
  const identities = new Map(
    originals.map(({ address, text }) => {
      const id = parseInt(address.replace(':', ''), HEX_RADIX);
      return [address, { id, originalEnd: id + encodeMatrixText(text).length - 1 }];
    }),
  );
  const result = { en: new Map(), de: new Map() };
  for (const code of ['en', 'de']) {
    for (const entry of asset[code]) {
      const identity = identities.get(entry?.address);
      if (identity === undefined) continue; // Other domains are validated by the caller.
      const { id, originalEnd } = identity;
      if (result[code].has(id)) throw new VmFault('matrix_edit_identity_required');
      result[code].set(id, { ...compile(entry.text, id), originalEnd });
    }
  }
  return result;
}

export function resolveMatrixTextEdits(edits, language) {
  if (!edits) return null;
  const result = new Map([...edits.en, ...(language ? edits.de : [])]);
  return result.size ? result : null;
}
