import { panFixture, panWord } from './render-c416-fixtures.mjs';
import { sampleFixture } from './render-f130-fixtures.mjs';
export const audioEntry = { bank: 0x80, status: 0xC5, emulation: 0, directPage: 0,
  stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests', ioRead4217: [17, 34], ioRead2140: [0, 1, 2] };
// Synthetic source/cache/voice/token fixture; selector4C/sound002D match the
// separately pinned menu pair, but this is no original initialized scene.
export function audioFixture({ selector = 0x4C, sound = 0x2D, cachedSound = 0, voice = 3,
  cachedVoice = 0, token = 0, operand = 0x40, writeWindows = [[0x7E1CE2, 0x7E1CE4]], ...pan } = {}) {
  const data = panFixture({ ...pan, bank: 0x80, writeWindows });
  for (const [address, value] of [[2, selector], [4, operand], [6, voice],
    [0x801CE0, cachedSound], [0x801CE2, cachedVoice], [0x80C4B3 + selector, sound]]) panWord(data, address, value);
  data.seed(0x801CE4, [token]); return data;
}
export const highAudioEntry = { ...audioEntry, ioRead2140: Array.from({length:256},(_,n)=>n) };
// Synthetic F130 directory/payload layered into the same C46E byte owner.
export function highAudioFixture({sound=0x8007,cachedSound=0,...options}={}) {
  const data=audioFixture({...options,sound,cachedSound,writeWindows:options.writeWindows
    ?? [[0x7E0089,0x7E0099],[0x7E1CE0,0x7E1CE7]]});
  const sample=sampleFixture({...options,bank:0x80,selector:sound&255,writeWindows:[]});
  for(const[address,value]of sample.snapshot().bytes)data.seed(address,[value]);return data;
}
