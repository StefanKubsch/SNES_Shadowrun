// Read-only consumer inventory. Observed WRAM destinations are route evidence,
// not unique VRAM ownership or permission to move a packed source.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { auditPackedAssets } from './packed-asset-audit.mjs';
import { VRAM_FORMATS, VRAM_SHEET_WIDTH } from '../src/data/vram-tiles.mjs';
import { TILE_SIZE } from '../src/constants/ppu.mjs';
import {
  HEX_RADIX,
  BYTE_VALUES,
  BYTE_HEX_DIGITS,
  WORD_HEX_DIGITS,
} from '../src/constants/bits.mjs';

// 80:9F6D portrait output: 64 OBJ characters (src/data/portraits.mjs).
const PORTRAIT_TILES = 64;
// Direct callers in main-initialize.mjs and main-frontend-menu.mjs.
const DIRECT_CONSUMERS = {
  '80:FF98': {
    reader: '81:AA9C',
    pointer_table: '80:FFAD',
    unpacker: '80:9F49',
    destination: '7E:23A0',
  },
  '84:DAF2': { reader: '81:D60F', unpacker: '80:F2A0', destination: '7E:46A8' },
  '87:D71A': { call: '81:E1A3', unpacker: '80:F2A4', destination: '7F:0018' },
  '84:F9E8': { call: '81:E1B0', unpacker: '80:F2A4', destination: '7F:8018' },
};

const json = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));

export function characterConsumerInventory(packed, assets, probe, lists, portraits, german) {
  const rowByFormat = {};
  return assets.streams
    .filter((s) => VRAM_FORMATS[s.format])
    .map((source) => {
      const slot = packed.streams.find((s) => s.address === source.address);
      const outputBytes = source.tiles * VRAM_FORMATS[source.format] * TILE_SIZE;
      if (!slot || slot.format !== source.format || slot.output_bytes !== outputBytes)
        throw new Error(`Character identity or output mismatch at ${source.address}`);
      const sheetRow = rowByFormat[source.format] ?? 0;
      rowByFormat[source.format] =
        sheetRow + Math.ceil(source.tiles / (VRAM_SHEET_WIDTH / TILE_SIZE));
      const commands = lists.runs.flatMap((run) =>
        run.lists.flatMap((list) =>
          list.commands.flatMap((c, index) =>
            c.unpack === source.address
              ? [
                  {
                    list: list.address,
                    command_index: index,
                    vram_word: c.vram,
                    dma_bytes: parseInt(c.length, HEX_RADIX),
                    bytes_beyond_output: Math.max(0, parseInt(c.length, HEX_RADIX) - outputBytes),
                  },
                ]
              : [],
          ),
        ),
      );
      const records = portraits.portraits
        .filter((p) => p.stream === source.address)
        .map((p) => p.address);
      const observation = probe.streams.find((p) => p.source === source.address);
      if (
        observation &&
        (observation.length !== outputBytes || observation.format !== source.format)
      )
        throw new Error(`Character observation mismatch at ${source.address}`);
      const direct = DIRECT_CONSUMERS[source.address] ?? null;
      if (!commands.length && !records.length && !direct)
        throw new Error(`Missing static character consumer at ${source.address}`);
      if (records.length && (source.format !== 'obj4' || source.tiles !== PORTRAIT_TILES))
        throw new Error(`Portrait character layout mismatch at ${source.address}`);
      const translated = german.streams.filter((s) => s.english === source.address);
      if (translated.length > 1) throw new Error(`Duplicate German source at ${source.address}`);
      const translatedBytes = translated[0]?.bytes;
      const germanOutput = translatedBytes
        ? parseInt(translatedBytes.slice(0, BYTE_HEX_DIGITS), HEX_RADIX) +
          BYTE_VALUES * parseInt(translatedBytes.slice(BYTE_HEX_DIGITS, WORD_HEX_DIGITS), HEX_RADIX)
        : null;
      return {
        ...slot,
        tiles: source.tiles,
        sheet: assets.sheets[source.format],
        sheet_pixel_y: sheetRow * TILE_SIZE,
        scene_commands: commands,
        portrait_records: records,
        direct_consumer: direct,
        observed: observation
          ? { entries: observation.entries, destinations: observation.destinations }
          : null,
        language: translatedBytes
          ? {
              policy: 'separate-font-contract',
              german_output_bytes: germanOutput,
              german_packed_bytes: translatedBytes.length / 2,
            }
          : { policy: 'shared-source' },
      };
    });
}

export async function auditCharacterStreams() {
  const streams = characterConsumerInventory(
    await auditPackedAssets(),
    json('assets/vm-lz.json'),
    json('analysis/rom-vram.json'),
    json('assets/vm-scene-lists.json'),
    json('assets/vm-portraits.json'),
    json('assets/vm-texts-de.json'),
  );
  return {
    scope:
      'Original character identities, static consumers and historical route observations. VRAM addresses are contextual and may be reused. No edits or relocation.',
    streams,
    counts: {
      streams: streams.length,
      shared_sources: streams.filter((s) => s.language.policy === 'shared-source').length,
      language_fonts: streams.filter((s) => s.language.policy === 'separate-font-contract').length,
      portrait_sources: streams.filter((s) => s.portrait_records.length).length,
      portrait_records: streams.reduce((n, s) => n + s.portrait_records.length, 0),
      scene_sources: streams.filter((s) => s.scene_commands.length).length,
      scene_commands_beyond_output: streams
        .flatMap((s) => s.scene_commands)
        .filter((c) => c.bytes_beyond_output).length,
      observed_sources: streams.filter((s) => s.observed).length,
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await auditCharacterStreams(), null, 2));
