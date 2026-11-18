// The text of a game fault for the page (game-worker.mjs posts it, start.mjs shows it).
// A VmFault carries its message (such as rom_byte_absent with its address). A task stop
// (src/system/task-stop.mjs) is a plain object without a message: its reason and its
// numeric details (hexadecimal) are named instead, since an empty text would stop the
// game without any notice on the page.
import { HEX_RADIX } from '../constants/bits.mjs';

export function faultText(error) {
  if (typeof error?.message === 'string' && error.message) return error.message;
  if (typeof error?.reason !== 'string') return String(error);
  const details = Object.entries(error)
    .filter(([key, value]) => key !== 'reason' && Number.isInteger(value))
    .map(([key, value]) => `${key} ${value.toString(HEX_RADIX).toUpperCase()}`);
  return details.length ? `${error.reason} (${details.join(', ')})` : error.reason;
}
