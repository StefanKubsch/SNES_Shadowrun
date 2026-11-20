// Combat, targeting, party formation and runner equipment storage.
// Equipment rows keep their odd weapon words and byte ratings. Saved fields are
// serialized through the shared byte boundary; no second WRAM copy is maintained.
// Fight/party indices outside these storage spans retain their original aliases.
import * as W from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';
const field = (base, count = 1, bytes = 2, stride = bytes) =>
  Object.freeze({ base, count, bytes, stride });
export const COMBAT_FIELDS = Object.freeze({
  playerIdle: field(W.PLAYER_IDLE),
  aimingWeapon: field(W.AIMING_WEAPON),
  aimingSpell: field(W.AIMING_SPELL),
  aimTarget: field(W.AIM_TARGET_OBJECT),
  aimAction: field(W.AIM_ACTION_NEXT),
  leaderOnly: field(W.GROUP_LEADER_ONLY),
  scriptGloveChoice: field(W.SCRIPT_GLOVE_CHOICE),
  spellTarget: field(W.SPELL_TARGET_OBJECT),
  fightIndex: field(W.FIGHT_LIST_INDEX),
  fightMusic: field(W.FIGHT_MUSIC),
  fightKarma: field(W.FIGHT_KARMA),
  firstRemoval: field(W.FIGHT_FIRST_REMOVAL),
  harmlessHits: field(W.HARMLESS_HITS),
  fightUnread: field(W.FIGHT_UNREAD),
  hitFrames: field(W.PLAYER_HIT_FRAMES),
  groupIndex: field(W.GROUP_INDEX),
  formationIndex: field(W.FORMATION_INDEX),
  formationUnmoved: field(W.FORMATION_UNMOVED),
  spellScript: field(W.SELECTED_SPELL_SCRIPT),
  spellName: field(W.SELECTED_SPELL_NAME),
  spellLevelPointer: field(W.SELECTED_SPELL_LEVEL_POINTER),
  gloveSpeedX: field(W.GLOVE_SPEED_X),
  gloveSpeedY: field(W.GLOVE_SPEED_Y),
  gloveX: field(W.GLOVE_X),
  gloveY: field(W.GLOVE_Y),
  gloveKind: field(W.GLOVE_KIND),
  gloveTarget: field(W.GLOVE_TARGET_TAG),
  gloveObject: field(W.GLOVE_TARGET_OBJECT),
  gloveSnapX: field(W.GLOVE_SNAP_X),
  gloveSnapY: field(W.GLOVE_SNAP_Y),
  gloveBaseX: field(W.GLOVE_BASE_X),
  gloveBaseY: field(W.GLOVE_BASE_Y),
  gloveLimitKind: field(W.GLOVE_LIMIT_KIND),
  fightObjects: field(W.FIGHT_LIST, (W.FIGHT_MUSIC - W.FIGHT_LIST) / 2),
  groupObjects: field(W.GROUP_OBJECTS, 4),
  groupNumbers: field(W.GROUP_NUMBERS, 4),
  groupPositions: field(W.GROUP_POSITIONS, 4),
  groupSlots: field(W.GROUP_SLOTS, 4),
  formationX: field(W.FORMATION_X, (W.FORMATION_LAST + 2) / 2),
  formationY: field(W.FORMATION_Y, (W.FORMATION_LAST + 2) / 2),
  formationHeight: field(W.FORMATION_HEIGHT, (W.FORMATION_LAST + 2) / 2),
  formationDirection: field(W.FORMATION_DIRECTION, (W.FORMATION_LAST + 2) / 2),
  armour: field(W.RUNNER_ARMOUR, 13, 2, 8),
  armourRating: field(W.RUNNER_ARMOUR_RATING, 13, 1, 8),
  weapon: field(W.RUNNER_WEAPON, 13, 2, 8),
  weaponKind: field(W.RUNNER_WEAPON_KIND, 13, 1, 8),
  weaponDamage: field(W.RUNNER_WEAPON_DAMAGE, 13, 1, 8),
  weaponRange: field(W.RUNNER_WEAPON_RANGE, 13, 1, 8),
  magic: field(W.MAGIC_POINTS, 13, 1),
});
const tables = new WeakMap(),
  byteFields = [];
for (const [name, { base, count, bytes, stride }] of Object.entries(COMBAT_FIELDS))
  for (let index = 0; index < count; index++)
    for (let byte = 0; byte < bytes; byte++)
      byteFields[base + index * stride + byte] = { name, index, shift: byte * BYTE_BITS };
export const combatState = (wram) => tables.get(wram);
export function detachCombat(wram) {
  let table = tables.get(wram);
  if (!table) {
    table = {};
    for (const [name, { base, count, bytes, stride }] of Object.entries(COMBAT_FIELDS)) {
      const values = bytes === 1 ? new Uint8Array(count) : new Uint16Array(count);
      for (let i = 0; i < count; i++)
        values[i] =
          wram[base + i * stride] | (bytes === 2 ? wram[base + i * stride + 1] << BYTE_BITS : 0);
      table[name] = values;
    }
    tables.set(wram, table);
  }
  return table;
}
export function combatByte(wram, at) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  return f ? (table[f.name][f.index] >>> f.shift) & BYTE_MASK : undefined;
}
export function setCombatByte(wram, at, value) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  if (!f) return false;
  const values = table[f.name],
    mask = BYTE_MASK << f.shift;
  values[f.index] = (values[f.index] & ~mask) | ((value & BYTE_MASK) << f.shift);
  return true;
}
