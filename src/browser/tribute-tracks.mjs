// Song numbers and ARAM table addresses are from the European driver/catalogue.
// Named SPC dumps independently identify the songs; see docs/TRIBUTE-SOUNDTRACK.md.
import { GAME_SONG_TABLE, TITLE_SONG_TABLE } from '../constants/sound-commands.mjs';
export { GAME_SONG_TABLE, TITLE_SONG_TABLE };
export const TRIBUTE_TRACKS = Object.freeze({
  1: { number: '03', name: 'Tenth Street', file: '03-tenth-street.ogg' },
  2: { number: '08', name: 'Sleazy Bar', file: '08-sleazy-bar.ogg' },
  3: { number: '09', name: 'Ghouls', file: '09-ghouls.ogg' },
  4: { number: '06', name: 'Seems Familiar', file: '06-seems-familiar.ogg' },
  5: { number: '10', name: 'The Cage', file: '10-the-cage.ogg' },
  6: { number: '07', name: 'Gunfight', file: '07-gunfight.ogg' },
  7: { number: '02', name: 'The Morgue', file: '02-the-morgue.ogg' },
  8: { number: '12', name: 'The Matrix', file: '12-the-matrix.ogg' },
  9: { number: '05', name: 'Funky Conversation', file: '05-funky-conversation.ogg' },
  10: { number: '04', name: 'Shady Conversation', file: '04-shady-conversation.ogg' },
  12: { number: '11', name: 'Uptown', file: '11-uptown.ogg' },
});
export const TRIBUTE_MAIN_THEME = Object.freeze({
  number: '01',
  name: 'Main Theme',
  file: '01-main-theme.ogg',
});
export function tributeUrl(file) {
  return new URL(`../../assets/tribute/${file}`, import.meta.url).href;
}
export function tributeTrack({ table, song } = {}) {
  if (table === GAME_SONG_TABLE) return TRIBUTE_TRACKS[song] ?? null;
  // Track 01 combines Seattle 2050 and the menu theme (user clarification).
  return table === TITLE_SONG_TABLE && (song === 1 || song === 2) ? TRIBUTE_MAIN_THEME : null;
}
