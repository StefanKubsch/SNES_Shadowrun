// Exercise the actual game entries in the existing independent original scene
// comparisons, including tables that retain former caller functions for replay.
import { compareLift, routineTables, useReference } from './lift-compare.mjs';
import * as live from '../proof/caller/scene-entries.mjs';
import * as former from '../proof/replay/main-scene.mjs';

const ENTRIES = [
  [0x81cdf8, 'playCutscene'],
  [0x81dfe7, 'playIntro'],
  [0x81c3ca, 'playMatrixScene'],
];

export async function compareSceneEntry(options) {
  const previous = ENTRIES.map(([, name]) => former[name]),
    actual = ENTRIES.map(([, name]) => live[name]),
    tables = await routineTables(previous),
    restore = useReference(
      tables,
      new Map(ENTRIES.map(([target, name]) => [target, live[name]])),
      previous,
    );
  try {
    return await compareLift({
      ...options,
      lifted: [...actual, ...options.lifted.filter((run) => !previous.includes(run))],
    });
  } finally {
    restore();
  }
}
