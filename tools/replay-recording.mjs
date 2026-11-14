// Native replay of a browser session recording (src/browser/recording.mjs).
// node tools/replay-recording.mjs <recording.json> [--until n]
// Replays from the reset with the recorded seed, start SRAM and raw inputs, reports the NMIs
// reached, the first WRAM hash that differs from the recording, the first pad read off the
// recorded path and a fault of the native run (with its NMI) if one happens.
import {readFileSync} from 'node:fs';
import {cartridge} from './cartridge-harness.mjs';
import {parseRecording,replayRecording} from '../src/browser/recording.mjs';
import {buildLanguage,GERMAN} from '../src/data/language.mjs';

// Text languages a recording may use (src/data/language.mjs).
const languages = {[GERMAN]: buildLanguage(JSON.parse(readFileSync('assets/vm-texts-de.json', 'utf8')))};

const [file, ...rest] = process.argv.slice(2);
if (!file) { console.log('Usage: node tools/replay-recording.mjs <recording.json> [--until n]'); process.exit(1); }
const recording = parseRecording(readFileSync(file, 'utf8'));
const at = rest.indexOf('--until'), until = at < 0 ? recording.nmis : +rest[at + 1];
console.log(`recording: ${recording.nmis} NMIs, ${recording.reads} pad reads, ${recording.inputs.length} input changes, ${recording.checks.length} checks`);
let frame = 0;
try {
  const {nmis, mismatch, offPath} = replayRecording(cartridge, recording, {until, languages, onFrame: f => { frame = f.nmi; }});
  console.log(`replayed to NMI ${nmis}`);
  console.log(mismatch ? `first WRAM difference at NMI ${mismatch.nmi}` : 'all WRAM checks equal');
  if (offPath) console.log(`off the recorded path at pad read ${offPath.read}: NMI ${offPath.actual} instead of ${offPath.expected}`);
} catch (error) {
  console.log(`native run stopped after NMI ${frame}: ${error.reason ?? error.message}`);
  process.exitCode = 2;
}
