// Read-only inventory: equal word storage does not imply equal map semantics.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { auditPackedAssets } from './packed-asset-audit.mjs';
import { HEX_RADIX, WORD_HEX_DIGITS } from '../src/constants/bits.mjs';

const TITLE_ENTRY_WORDS = 3;
const DIRECT = {
  '81:F803': { role: 'intro-character-map', reader: '81:DDEE', destination: '7E:56A8' },
  '85:FD38': {
    role: 'credits-and-matrix-character-map',
    reader: '81:CE57 / 81:C3F2',
    destination: '7E:56A8 / 7F:0000',
  },
  '81:FF40': { role: 'window-relative-map', reader: '81:A9B2', destination: '7E:23A0' },
  '89:EC1B': { role: 'matrix-background', reader: '81:C3FF', destination: '7F:0216' },
  '89:E14E': { role: 'matrix-systems', reader: '81:C418', destination: '7F:0216' },
  '89:EB4B': { role: 'matrix-extra-map', reader: '81:C425', destination: '7F:8216' },
};
const json = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));

export function mapConsumerInventory(packed, assets, lists, tables, german, probe) {
  const title = tables.tables.find((t) => t.name === 'intro_unpacks');
  if (title?.address !== '81:D85C' || title.values.at(-1) !== '0000')
    throw new Error('Missing title unpack table');
  const titleRows = [];
  for (let i = 0; i < title.values.length - 1; i += TITLE_ENTRY_WORDS) {
    const [offset, bank, destination] = title.values.slice(i, i + TITLE_ENTRY_WORDS);
    titleRows.push({
      source: `${bank.slice(2)}:${offset}`,
      reader: '81:D83E',
      table: title.address,
      destination: `7E:${destination}`,
    });
  }
  const seen = new Set();
  return assets.streams
    .filter((s) => s.format === 'map')
    .map((source) => {
      if (seen.has(source.address)) throw new Error(`Duplicate map identity at ${source.address}`);
      seen.add(source.address);
      const words = source.words.join(' ').split(/\s+/).filter(Boolean);
      if (words.some((w) => !new RegExp(`^[0-9A-F]{${WORD_HEX_DIGITS}}$`).test(w)))
        throw new Error(`Invalid map words at ${source.address}`);
      const slot = packed.streams.find((s) => s.address === source.address);
      if (!slot || slot.format !== 'map' || slot.output_bytes !== 2 * words.length)
        throw new Error(`Map identity or output mismatch at ${source.address}`);
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
                    bytes_beyond_output: Math.max(
                      0,
                      parseInt(c.length, HEX_RADIX) - slot.output_bytes,
                    ),
                  },
                ]
              : [],
          ),
        ),
      );
      const direct = DIRECT[source.address] ?? null;
      const titleConsumers = titleRows.filter((row) => row.source === source.address);
      if (!commands.length && !direct && !titleConsumers.length)
        throw new Error(`Missing static map consumer at ${source.address}`);
      const translations = german.streams.filter((s) => s.english === source.address);
      if (translations.length > 1) throw new Error(`Duplicate German map at ${source.address}`);
      const observed = probe.streams.find((s) => s.source === source.address);
      // The probe labels outputs without a direct VRAM use as raw bytes.
      if (
        observed &&
        (!['map', 'bytes'].includes(observed.format) || observed.length !== slot.output_bytes)
      )
        throw new Error(`Map observation mismatch at ${source.address}`);
      return {
        ...slot,
        words: words.length,
        role: direct?.role ?? 'ppu-screen-map',
        scene_commands: commands,
        title_consumers: titleConsumers,
        direct_consumer: direct,
        language_policy: translations.length
          ? source.address === '81:FB0A'
            ? 'language-screen-map'
            : 'owned-packed-text-map'
          : 'shared-source',
        observed: observed
          ? {
              format: observed.format,
              entries: observed.entries,
              destinations: observed.destinations,
            }
          : null,
      };
    });
}

export async function auditMapStreams() {
  const streams = mapConsumerInventory(
    await auditPackedAssets(),
    json('assets/vm-lz.json'),
    json('assets/vm-scene-lists.json'),
    json('assets/vm-tables.json'),
    json('assets/vm-texts-de.json'),
    json('analysis/rom-vram.json'),
  );
  return {
    scope:
      'Original packed map identities and known static consumers. No edits, relocation, exclusive destination ownership or exhaustive route census.',
    streams,
    counts: {
      streams: streams.length,
      scene_sources: streams.filter((s) => s.scene_commands.length).length,
      title_sources: streams.filter((s) => s.title_consumers.length).length,
      direct_sources: streams.filter((s) => s.direct_consumer).length,
      scene_commands_beyond_output: streams
        .flatMap((s) => s.scene_commands)
        .filter((c) => c.bytes_beyond_output).length,
      language_maps: streams.filter((s) => s.language_policy !== 'shared-source').length,
      observed_sources: streams.filter((s) => s.observed).length,
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await auditMapStreams(), null, 2));
