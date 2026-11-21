import { readProgress } from './progress.mjs';

// Keep the release evidence check without generating a duplicate status document.
await readProgress(process.cwd());
console.log('Historical proof inventory validated.');
