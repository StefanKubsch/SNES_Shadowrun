// Portable browser backups: original SRAM plus content-bound slot metadata.
// The versioned UTF-8 JSON file needs no archive library or server support.
import { importSave, saveToText, saveFromText } from './save-file.mjs';
import { describeSaveSlots } from './save-details.mjs';

const BUNDLE_FORMAT = 'shadowrun-save',
  BUNDLE_VERSION = 1;
export const SAVE_BUNDLE_NAME = 'shadowrun-saves.shadowrun';
// Four bounded PNG data URLs, exact slot identities and a 16 KiB SRAM fit here.
export const MAX_SAVE_IMPORT_BYTES = 512000;

function invalid(code = 'saveBundleInvalid') {
  const error = new Error(code);
  error.code = code;
  return error;
}

const metadata = (slot) =>
  slot
    ? {
        identity: slot.identity,
        savedAt: slot.savedAt,
        preview: slot.preview,
      }
    : null;

export function exportSaveBundle(sram, details) {
  const save = importSave(sram);
  return new TextEncoder().encode(
    JSON.stringify({
      format: BUNDLE_FORMAT,
      version: BUNDLE_VERSION,
      sram: saveToText(save),
      slots: describeSaveSlots(save, details).map(metadata),
    }),
  );
}

export function importSaveBundle(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length > MAX_SAVE_IMPORT_BYTES) throw invalid();
  let bundle;
  try {
    bundle = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw invalid();
  }
  if (!bundle || bundle.format !== BUNDLE_FORMAT) throw invalid();
  if (bundle.version !== BUNDLE_VERSION) throw invalid('saveBundleVersion');
  const save = typeof bundle.sram === 'string' ? saveFromText(bundle.sram) : null;
  if (!save || saveToText(save) !== bundle.sram || !Array.isArray(bundle.slots)) throw invalid();
  const slots = describeSaveSlots(save, bundle.slots);
  if (bundle.slots.length !== slots.length) throw invalid();
  for (let index = 0; index < slots.length; index++) {
    const raw = bundle.slots[index],
      slot = slots[index];
    if (slot === null) {
      if (raw !== null) throw invalid();
    } else if (
      !raw ||
      raw.identity !== slot.identity ||
      raw.savedAt !== slot.savedAt ||
      raw.preview !== slot.preview
    )
      throw invalid();
  }
  return { save, details: slots.map(metadata) };
}

export function importSaveFile(bytes, filename) {
  if (bytes.length > MAX_SAVE_IMPORT_BYTES) throw invalid();
  // The filename disambiguates even a damaged bundle with exactly 8/16 KiB.
  if (/\.srm$/i.test(filename)) return { save: importSave(bytes), details: null };
  if (/\.shadowrun$/i.test(filename)) return importSaveBundle(bytes);
  throw invalid('saveImportFormat');
}
