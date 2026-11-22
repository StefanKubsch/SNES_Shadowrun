import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withStartPage, findEdge } from './browser-frame.mjs';
import { testTempDir } from './temp-dir.mjs';
import { saveToText } from '../src/browser/save-file.mjs';
import { importSaveBundle } from '../src/browser/save-bundle.mjs';
import { slotChecksum } from '../src/game/save-slots.mjs';

const edge = findEdge();
const waitFor = (condition) =>
  `new Promise((resolve,reject)=>{const end=Date.now()+15000;const check=()=>{if(${condition})resolve(true);else if(Date.now()>end)reject(Error('Save bundle condition timed out: '+${JSON.stringify(condition)}));else setTimeout(check,25);};check();})`;
async function downloaded(path) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    try {
      return new Uint8Array(await readFile(path));
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw Error('Download missing: ' + path);
}

test(
  'bundle downloads restore pictures and dates in a fresh browser store; raw imports and cancellation remain supported',
  { skip: edge ? false : 'Microsoft Edge not found', timeout: 120000 },
  async (t) => {
    const dir = await testTempDir(t, 'snes-save-bundle-'),
      apartment = new Uint8Array(
        await readFile(new URL('./mesen/saves/apartment.srm', import.meta.url)),
      );
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ cdp, evalJs, logDir }) => {
      const open = () =>
        evalJs(
          "document.querySelector('#menu-toggle').click();document.querySelector('#saves-settings-open').click()",
        );
      const reload = async () => {
        await cdp.call('Page.reload');
        await new Promise((resolve) => setTimeout(resolve, 250));
        await evalJs(waitFor("document.querySelector('#screen')?.dataset.stage==='data'"));
        await open();
      };
      const stored = () =>
        evalJs(
          "[localStorage.getItem('shadowrun.sram.1'),localStorage.getItem('shadowrun.sram.extra.1'),localStorage.getItem('shadowrun.save-details.1')]",
        );
      await open();
      assert.equal(
        await evalJs(
          "document.querySelector('#save-bundle-export').disabled && document.querySelector('#save-export').disabled",
        ),
        true,
      );
      await evalJs(`(async()=>{
      const {fromBase64,saveToText,SAVE_KEY,SAVE_EXTRA_KEY}=await import('/src/browser/save-file.mjs');
      const {updateSaveDetails,SAVE_DETAILS_KEY}=await import('/src/browser/save-details.mjs');
      const original=fromBase64(${JSON.stringify(saveToText(apartment))}),save=new Uint8Array(0x4000);save.set(original);save.set(original.subarray(0,0x0ffe),0x2ffe);
      const canvas=document.createElement('canvas');canvas.width=128;canvas.height=112;const context=canvas.getContext('2d');context.fillStyle='#b4461e';context.fillRect(0,0,128,112);
      localStorage.setItem(SAVE_KEY,saveToText(save.subarray(0,0x2000)));localStorage.setItem(SAVE_EXTRA_KEY,saveToText(save.subarray(0x2000)));
      localStorage.setItem(SAVE_DETAILS_KEY,JSON.stringify(updateSaveDetails(null,save,[],'2026-11-22T12:00:00.000Z',{room:345,image:canvas.toDataURL('image/png')})));
    })()`);
      await reload();
      const original = await stored();
      const clickDownload = async (selector) => {
        const point = await evalJs(
          `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
        );
        await cdp.call('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          button: 'left',
          clickCount: 1,
          ...point,
        });
        await cdp.call('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          button: 'left',
          clickCount: 1,
          ...point,
        });
      };
      await clickDownload('#save-bundle-export');
      const bundle = await downloaded(join(logDir, 'downloads', 'Shadowrun.shadowrun'));
      // Separate user activations: browsers block a second automatic download.
      await clickDownload('#save-export');
      const raw = await downloaded(join(logDir, 'downloads', 'Shadowrun.srm')),
        restored = importSaveBundle(bundle),
        packagePath = join(dir, 'Backup.shadowrun');
      assert.deepEqual(restored.save, raw);
      assert.deepEqual(restored.details, JSON.parse(original[2]));
      await writeFile(packagePath, bundle);
      await evalJs(
        "for(const key of ['shadowrun.sram.1','shadowrun.sram.extra.1','shadowrun.save-details.1'])localStorage.removeItem(key)",
      );
      await reload();
      const choose = async (path) => {
        const { root } = await cdp.call('DOM.getDocument'),
          { nodeId } = await cdp.call('DOM.querySelector', {
            nodeId: root.nodeId,
            selector: '#save-file',
          });
        await cdp.call('DOM.setFileInputFiles', { nodeId, files: [path] });
      };
      await choose(packagePath);
      await evalJs(waitFor("document.querySelector('#save-confirm').open"));
      assert.deepEqual(await stored(), [null, null, null]);
      await evalJs("document.querySelector('#save-confirm-no').click()");
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.deepEqual(await stored(), [null, null, null]);
      await choose(packagePath);
      await evalJs(waitFor("document.querySelector('#save-confirm').open"));
      await evalJs("document.querySelector('#save-confirm-yes').click()");
      await evalJs(
        waitFor(
          "document.querySelector('#save-status').dataset.tone==='imported' && document.querySelector('#save-slot-list img').naturalWidth===128",
        ),
      );
      assert.deepEqual(await stored(), original);
      assert.equal(
        await evalJs('document.querySelector(\'[data-save-slot="3"] img\').naturalWidth'),
        128,
      );
      const broken = JSON.parse(new TextDecoder().decode(bundle));
      broken.version++;
      const brokenPath = join(dir, 'Broken.shadowrun');
      await writeFile(brokenPath, JSON.stringify(broken));
      await choose(brokenPath);
      await evalJs(waitFor("document.querySelector('#save-status').dataset.tone==='error'"));
      assert.deepEqual(await stored(), original);
      assert.equal(await evalJs("document.querySelector('#save-confirm').open"), false);
      const changed = apartment.slice();
      changed[2] ^= 1;
      new DataView(changed.buffer).setUint16(0, slotChecksum(changed, 0), true);
      const rawPath = join(dir, 'Legacy.srm');
      await writeFile(rawPath, changed);
      await choose(rawPath);
      await evalJs(waitFor("document.querySelector('#save-confirm').open"));
      await evalJs("document.querySelector('#save-confirm-yes').click()");
      await evalJs(waitFor("document.querySelector('#save-status').dataset.tone==='imported'"));
      const afterRaw = await stored();
      assert.equal(afterRaw[0], saveToText(changed));
      assert.equal(afterRaw[1], null);
      assert.equal(JSON.parse(afterRaw[2])[0].preview, null);
      assert.equal(JSON.parse(afterRaw[2])[0].savedAt, null);
      assert.equal(await evalJs("document.querySelector('#save-slot-list img').hidden"), true);
    });
  },
);
