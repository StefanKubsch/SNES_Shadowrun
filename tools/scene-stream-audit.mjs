// Read-only scene ownership and dependency inventory; no authoring admission.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { auditPackedAssets } from './packed-asset-audit.mjs';
import { encodeScene } from '../src/data/scenes.mjs';
import { SCENES } from '../src/data/lz-streams.mjs';

const SCENE_HEADER_BYTES = 4;
const OBJECT_BYTES = 5;
const LINE_BYTES = 4;
const RECT_BYTES = 5;
const LAYERS = ['objects_76a8', 'objects_46a8'];
const json = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));

export function sceneConsumerInventory(
  packed,
  assets,
  scenes,
  rooms,
  types,
  tilesets,
  graphics,
  probe,
  german,
) {
  if (
    [scenes, rooms, types, tilesets, graphics].some(
      (input) => input.source_rom_sha256 !== assets.source_rom_sha256,
    )
  )
    throw new Error('Scene audit inputs must belong to the same European ROM');
  const streams = assets.streams.filter((s) => s.format === 'scene');
  if (
    streams.length !== SCENES ||
    scenes.scenes.length !== SCENES ||
    new Set(streams.map((s) => s.address)).size !== SCENES ||
    new Set(scenes.scenes.map((s) => s.address)).size !== SCENES
  )
    throw new Error('Scene identities must cover the original table');
  for (const [index, room] of rooms.rooms.entries())
    if (!Number.isInteger(room.scene) || room.scene < 0 || room.scene >= SCENES)
      throw new Error(`Invalid scene in room header ${index}`);
  for (const [index, entry] of rooms.entries.entries())
    if (entry.room !== null && (!Number.isInteger(entry.room) || !rooms.rooms[entry.room]))
      throw new Error(`Invalid room entry ${index}`);
  return scenes.scenes.map((scene, index) => {
    const slot = packed.streams.find((s) => s.address === scene.address);
    const source = streams.find((s) => s.address === scene.address);
    const data = encodeScene(scene);
    if (!source || !slot || slot.format !== 'scene' || slot.output_bytes !== data.length)
      throw new Error(`Scene identity or output mismatch at ${scene.address}`);
    if (!Number.isInteger(scene.tileset) || !tilesets.tilesets[scene.tileset])
      throw new Error(`Invalid scene tileset at ${scene.address}`);
    let offset =
      SCENE_HEADER_BYTES +
      scene.shapes.reduce((n, s) => n + (s.kind === 'rect' ? RECT_BYTES : LINE_BYTES), 0);
    const firstList = offset;
    const layers = Object.fromEntries(
      LAYERS.map((name) => {
        const countOffset = offset++;
        const objects = scene[name];
        const typeCounts = new Map();
        let collisionCandidates = 0,
          collisionBoxes = 0;
        for (const object of objects) {
          const definition = types.types[object.type];
          if (!definition) throw new Error(`Invalid scene object type at ${scene.address}`);
          for (const part of definition.parts)
            if (!Number.isInteger(part.graphic) || !graphics.graphics[part.graphic])
              throw new Error(`Invalid object graphic for type ${object.type}`);
          typeCounts.set(object.type, (typeCounts.get(object.type) ?? 0) + 1);
          // 81:84DE skips either negative planar coordinate or a negative z.
          if (object.x >= 0 && object.y >= 0 && object.z >= 0) {
            collisionCandidates++;
            collisionBoxes += definition.boxes.length;
          }
        }
        offset += OBJECT_BYTES * objects.length;
        return [
          name,
          {
            count_offset: countOffset,
            objects: objects.length,
            type_counts: [...typeCounts]
              .sort(([a], [b]) => a - b)
              .map(([type, count]) => ({ type, count })),
            collision_candidates: collisionCandidates,
            collision_definition_boxes: collisionBoxes,
          },
        ];
      }),
    );
    if (offset !== data.length)
      throw new Error(`Scene section layout mismatch at ${scene.address}`);
    const headers = rooms.rooms.flatMap((r, n) => (r.scene === index ? [n] : []));
    const entries = rooms.entries.flatMap((e, n) =>
      e.room !== null && headers.includes(e.room) ? [n] : [],
    );
    const observed = probe.streams.find((s) => s.source === scene.address);
    if (observed && observed.length !== data.length)
      throw new Error(`Scene observation mismatch at ${scene.address}`);
    if (german.streams.some((s) => s.english === scene.address))
      throw new Error(`Unexpected scene language replacement at ${scene.address}`);
    return {
      ...slot,
      scene_index: index,
      reader: '81:A117',
      unpack_call: '81:A13B -> 80:9F69 -> 80:9F6D',
      destination: '7F:DA14',
      room_header_indices: headers,
      room_entry_indices: entries,
      backdrop: scene.backdrop,
      tileset: scene.tileset,
      tileset_blocks: tilesets.tilesets[scene.tileset].blocks.length,
      shapes: {
        count: scene.shapes.length,
        lines: scene.shapes.filter((s) => s.kind === 'line').length,
        rectangles: scene.shapes.filter((s) => s.kind === 'rect').length,
        bordered_rectangles: scene.shapes.filter((s) => s.kind === 'rect' && s.border).length,
        zero_counter_operands: scene.shapes.filter((s) =>
          s.kind === 'line' ? s.length === 0 : s.width === 0 || s.height === 0,
        ).length,
      },
      object_lists_offset: firstList,
      layers,
      language_policy: 'shared-source',
      observed: observed
        ? { entries: observed.entries, destinations: observed.destinations }
        : null,
    };
  });
}

export async function auditSceneStreams() {
  const streams = sceneConsumerInventory(
    await auditPackedAssets(),
    json('assets/vm-lz.json'),
    json('assets/vm-scenes.json'),
    json('assets/vm-rooms.json'),
    json('assets/vm-objects.json'),
    json('assets/vm-tilesets.json'),
    json('assets/vm-object-graphics.json'),
    json('analysis/rom-vram.json'),
    json('assets/vm-texts-de.json'),
  );
  const rooms = json('assets/vm-rooms.json');
  const types = json('assets/vm-objects.json');
  const graphics = json('assets/vm-object-graphics.json');
  const usedTypes = [
    ...new Set(
      streams.flatMap((s) => LAYERS.flatMap((l) => s.layers[l].type_counts.map((t) => t.type))),
    ),
  ].sort((a, b) => a - b);
  return {
    scope:
      'Original packed scene identities, known static room aliases and object/tileset dependencies. Collision counts describe definition expansion, not runtime capacity or reachability. No edits or relocation.',
    streams,
    object_type_dependencies: usedTypes.map((type) => ({
      type,
      parts: types.types[type].parts.length,
      collision_boxes: types.types[type].boxes.length,
      graphics: [...new Set(types.types[type].parts.map((p) => p.graphic))]
        .sort((a, b) => a - b)
        .map((index) => ({
          index,
          attribute: graphics.graphics[index].attribute,
          depth: graphics.graphics[index].depth,
        })),
    })),
    counts: {
      streams: streams.length,
      output_bytes: streams.reduce((n, s) => n + s.output_bytes, 0),
      packed_bytes: streams.reduce((n, s) => n + s.packed_slot_bytes, 0),
      word_read_margins: streams.reduce((n, s) => n + s.word_read_margin_bytes, 0),
      room_headers: rooms.rooms.length,
      room_entries: rooms.entries.filter((e) => e.room !== null).length,
      headers_without_entry: rooms.rooms.flatMap((_, n) =>
        rooms.entries.some((e) => e.room === n) ? [] : [n],
      ),
      scenes_without_header: streams.filter((s) => !s.room_header_indices.length).length,
      observed_sources: streams.filter((s) => s.observed).length,
      shapes: streams.reduce((n, s) => n + s.shapes.count, 0),
      objects: streams.reduce((n, s) => n + LAYERS.reduce((m, l) => m + s.layers[l].objects, 0), 0),
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await auditSceneStreams(), null, 2));
