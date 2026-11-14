// Game data without the ROM (docs/ROM-FREE.md): assembles the ROM address
// view for VmMemory from the data package named by assets/vm-cartridge.json.
// present marks the bytes that exist; the 65816 code is absent, and reading
// it is an error (rom_byte_absent), not an invented value.
// All content lives in its own files and is written to its addresses: the
// last bytes in original form from vm-raw.json (src/data/raw.mjs), scripts from scripts.json (src/data/scripts.mjs), texts from
// vm-texts.json (src/data/texts.mjs), room tiles from vm-tiles.json and the
// BMP sheets (src/data/tiles.mjs), palettes from vm-palettes.json
// (src/data/palettes.mjs), VRAM characters from vm-vram.json and its BMP
// sheets (src/data/vram-tiles.mjs), packed streams from vm-lz.json and its
// sheets (src/data/lz-streams.mjs) with the scene records from
// vm-scenes.json (src/data/scenes.mjs), tilesets from vm-tilesets.json
// (src/data/tilesets.mjs), object types from vm-objects.json
// (src/data/object-types.mjs), their part graphics from
// vm-object-graphics.json (src/data/object-graphics.mjs) and the scene
// command lists from vm-scene-lists.json (src/data/scene-lists.mjs) and the
// menu texts from vm-menu-texts.json (src/data/menu-texts.mjs), the palette
// cycles from vm-palette-cycles.json (src/data/palette-cycles.mjs) and the
// rooms from vm-rooms.json (src/data/rooms.mjs) and the actor table from
// vm-actors.json (src/data/actors.mjs) and the kinds from vm-kinds.json
// (src/data/kinds.mjs) with their action lists from vm-actions.json
// (src/data/actions.mjs) and the object pictures from vm-pictures.json
// (src/data/pictures.mjs), the dialog topics from vm-topics.json
// (src/data/topics.mjs) and the sound data from vm-sound.json with
// one WAV per sample in vm-samples/ (src/data/sound.mjs, src/data/brr.mjs)
// and the dialog portraits from
// vm-portraits.json (src/data/portraits.mjs) with the dialog records from
// vm-dialogs.json (src/data/dialogs.mjs) and the runner table from
// vm-runners.json (src/data/runners.mjs) and the SPC700 sound driver from
// vm-spc-driver.json (src/data/spc-driver.mjs) and the lookup tables from
// vm-tables.json (src/data/tables.mjs) and the matrix texts from
// vm-matrix-texts.json (src/data/matrix-texts.mjs) and the text font from
// vm-font.bmp (src/data/font.mjs) and the cartridge header from
// vm-header.json (src/data/header.mjs) and the unreferenced scripts from
// vm-orphan-scripts.json (src/data/orphan-scripts.mjs) and the filler bytes
// from vm-fillers.json (src/data/fillers.mjs).
// readFile(name) returns the content of a file in assets/ as a Uint8Array
// (browser: fetch, Node: fs).
import { ROM_SIZE, VmFault } from '../vm/memory.mjs';
import { placeScripts } from './scripts.mjs';
import { placeTexts } from './texts.mjs';
import { placeTiles, readBmp } from './tiles.mjs';
import { placePalettes } from './palettes.mjs';
import { placeVramTiles } from './vram-tiles.mjs';
import { placeLzStreams } from './lz-streams.mjs';
import { placeTilesets } from './tilesets.mjs';
import { placeObjectTypes } from './object-types.mjs';
import { placeObjectGraphics } from './object-graphics.mjs';
import { placeSceneLists } from './scene-lists.mjs';
import { placeMenuTexts } from './menu-texts.mjs';
import { placePaletteCycles } from './palette-cycles.mjs';
import { placeRooms } from './rooms.mjs';
import { placeActors } from './actors.mjs';
import { placeKinds } from './kinds.mjs';
import { placeActions } from './actions.mjs';
import { placePictures } from './pictures.mjs';
import { placeTopics } from './topics.mjs';
import { placeSound } from './sound.mjs';
import { readWav } from './brr.mjs';
import { placePortraits } from './portraits.mjs';
import { placeDialogs } from './dialogs.mjs';
import { placeRunners } from './runners.mjs';
import { placeSpcDriver } from './spc-driver.mjs';
import { placeTables } from './tables.mjs';
import { placeMatrixTexts } from './matrix-texts.mjs';
import { placeFont } from './font.mjs';
import { placeHeader } from './header.mjs';
import { placeOrphanScripts } from './orphan-scripts.mjs';
import { placeFillers } from './fillers.mjs';
import { placeRaw } from './raw.mjs';
import { buildTextEdits, TEXT_EDITS_FILE } from './text-edits.mjs';
import { applyRoomTileEdits, ROOM_TILE_EDITS_FILE } from './room-tile-edits.mjs';
import { applyCharacterEdits, CHARACTER_EDITS_FILE } from './character-edits.mjs';
import { applyMapEdits, MAP_EDITS_FILE } from './map-edits.mjs';
import { applySceneEdits, SCENE_EDITS_FILE } from './scene-edits.mjs';

const CARTRIDGE_MANIFEST = 'vm-cartridge.json';
// Each placement includes its supporting files and lossless reconstruction.
const CARTRIDGE_LOAD_STAGES = 34;

export async function loadCartridge(readFile, onProgress = () => {}) {
  let completed = 0;
  onProgress(completed, CARTRIDGE_LOAD_STAGES);
  const place = (assemble, ...args) => {
    assemble(...args);
    onProgress(++completed, CARTRIDGE_LOAD_STAGES);
  };
  const manifest = JSON.parse(new TextDecoder().decode(await readFile(CARTRIDGE_MANIFEST)));
  if (manifest.format !== 'shadowrun-cartridge-data-v2' || manifest.rom_size !== ROM_SIZE)
    throw new VmFault('cartridge_format_required');
  const rom = new Uint8Array(ROM_SIZE),
    present = new Uint8Array(ROM_SIZE);
  const text = async (name) => JSON.parse(new TextDecoder().decode(await readFile(name)));
  place(placeRaw, rom, present, await text(manifest.raw.file));
  // The lookup tables first: the tile and stream encoders read the bit
  // lengths 80:A033 from the address view.
  place(placeTables, rom, present, await text(manifest.tables.file));
  const scripts = await text(manifest.scripts.file);
  place(placeScripts, rom, present, manifest.scripts, scripts);
  const originalTexts = await text(manifest.texts.file);
  place(placeTexts, rom, present, originalTexts);
  const originalMenus = await text(manifest.menu_texts.file);
  const originalMatrix = await text(manifest.matrix_texts.file);
  const textEdits = buildTextEdits(
    await text(TEXT_EDITS_FILE),
    originalTexts.texts,
    originalMenus.texts,
    originalMatrix.texts,
  );
  const tiles = await text(manifest.tiles.file);
  place(
    placeTiles,
    rom,
    present,
    tiles,
    await Promise.all(tiles.sheets.map(async (name) => readBmp(await readFile(name)).pixels)),
  );
  place(placePalettes, rom, present, await text(manifest.palettes.file));
  const vram = await text(manifest.vram.file),
    sheets = {};
  for (const [format, name] of Object.entries(vram.sheets))
    sheets[format] = readBmp(await readFile(name));
  place(placeVramTiles, rom, present, vram, sheets);
  const lz = await text(manifest.lz.file),
    lzSheets = {};
  for (const [format, name] of Object.entries(lz.sheets))
    lzSheets[format] = readBmp(await readFile(name));
  const scenes = await text(manifest.scenes.file);
  place(placeLzStreams, rom, present, lz, lzSheets, scenes);
  place(placeTilesets, rom, present, await text(manifest.tilesets.file));
  place(placeObjectTypes, rom, present, await text(manifest.objects.file));
  place(placeObjectGraphics, rom, present, await text(manifest.object_graphics.file));
  place(placeSceneLists, rom, present, await text(manifest.scene_lists.file));
  place(placeMenuTexts, rom, present, originalMenus);
  place(placePaletteCycles, rom, present, await text(manifest.palette_cycles.file));
  place(placeRooms, rom, present, await text(manifest.rooms.file));
  place(placeActors, rom, present, await text(manifest.actors.file));
  place(placeKinds, rom, present, await text(manifest.kinds.file));
  place(placeActions, rom, present, await text(manifest.actions.file));
  place(placePictures, rom, present, await text(manifest.pictures.file));
  place(placeTopics, rom, present, await text(manifest.topics.file));
  const sound = await text(manifest.sound.file);
  const samples = {};
  for (const d of sound.data)
    if (d.file) samples[d.file] = readWav(await readFile(d.file), d.address);
  place(placeSound, rom, present, sound, samples);
  place(placePortraits, rom, present, await text(manifest.portraits.file));
  place(placeDialogs, rom, present, await text(manifest.dialogs.file));
  place(placeRunners, rom, present, await text(manifest.runners.file));
  place(placeSpcDriver, rom, present, await text(manifest.spc_driver.file));
  place(placeMatrixTexts, rom, present, originalMatrix);
  place(placeFont, rom, present, readBmp(await readFile(manifest.font.file)));
  place(placeHeader, rom, present, (await text(manifest.header.file)).header);
  place(
    placeOrphanScripts,
    rom,
    present,
    await text(manifest.orphan_scripts.file),
    manifest.scripts,
    scripts,
  );
  place(placeFillers, rom, present, await text(manifest.fillers.file));
  place(applyRoomTileEdits, rom, present, await text(ROOM_TILE_EDITS_FILE), tiles);
  place(applyCharacterEdits, rom, present, await text(CHARACTER_EDITS_FILE), lz, lzSheets);
  place(applyMapEdits, rom, present, await text(MAP_EDITS_FILE), lz);
  place(applySceneEdits, rom, present, await text(SCENE_EDITS_FILE), lz, scenes);
  return { rom, present, textEdits };
}
