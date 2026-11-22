// Save overlay import (src/browser/start.mjs, user 2026-11-20): an .srm import
// asks a yes/no safety question first; "No" and Escape keep the stored state and
// the overlay, "Yes" imports and marks the status line green; a wrong file is red.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withStartPage, findEdge } from './browser-frame.mjs';
import { testTempDir } from './temp-dir.mjs';

const edge = findEdge();
// detail: an expression whose value the timeout error appends (page state).
const waitFor = (
  condition,
  message,
  detail = "''",
) => `new Promise((resolve,reject)=>{const end=Date.now()+15000;
  const check=()=>{const v=(${condition})();if(v)resolve(v);else if(Date.now()>end)reject(Error(${JSON.stringify(message)}+' '+${detail}));
  else setTimeout(check,25);};check();})`;
test(
  'an .srm import asks first and marks the imported state',
  { skip: edge ? false : 'Microsoft Edge not found', timeout: 120000 },
  async (t) => {
    const dir = await testTempDir(t, 'snes-save-import-test-'),
      good = join(dir, 'Backup.srm'),
      bad = join(dir, 'Broken.srm');
    await writeFile(good, await readFile(new URL('./mesen/saves/apartment.srm', import.meta.url)));
    await writeFile(bad, new Uint8Array(3));
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ cdp, evalJs }) => {
      await evalJs(
        "document.querySelector('#menu-toggle').click();document.querySelector('#saves-settings-open').click();window.importCloses=0;document.querySelector('#save-confirm').addEventListener('close',()=>window.importCloses++)",
      );
      const { root } = await cdp.call('DOM.getDocument');
      const input = await cdp.call('DOM.querySelector', {
        nodeId: root.nodeId,
        selector: '#save-file',
      });
      const choose = (path) =>
        cdp.call('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path] });
      const state = `(()=>{const s=document.querySelector('#save-status'),q=document.querySelector('#save-confirm');
        return {open:q.open,focus:document.activeElement?.id,question:document.querySelector('#save-confirm-text').textContent,
          yes:document.querySelector('#save-confirm-yes').textContent,no:document.querySelector('#save-confirm-no').textContent,
          tone:s.dataset.tone,status:s.textContent,hash:document.querySelector('#screen').dataset.saveHash??null,
          overlay:document.querySelector('#saves').closest('dialog').open};})()`;
      const asked = () =>
        evalJs(waitFor("()=>document.querySelector('#save-confirm').open", 'No import question'));

      await choose(good);
      await asked();
      let s = await evalJs(state);
      assert.equal(s.focus, 'save-confirm-no', '"No" has the initial focus');
      assert.match(s.question, /Backup\.srm/);
      assert.deepEqual([s.yes, s.no], ['Yes, import', 'No']);
      await evalJs("document.querySelector('#save-confirm-no').click()");
      await evalJs(waitFor('()=>window.importCloses===1', 'First cancellation did not settle'));
      s = await evalJs(state);
      assert.deepEqual([s.open, s.hash, s.tone, s.overlay], [false, null, '', true]);

      await choose(good);
      await asked();
      await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Escape', key: 'Escape' });
      await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Escape', key: 'Escape' });
      await evalJs(waitFor('()=>window.importCloses===2', 'Escape cancellation did not settle'));
      s = await evalJs(state);
      assert.deepEqual(
        [s.open, s.hash, s.overlay],
        [false, null, true],
        'Escape closes only the question',
      );

      await choose(good);
      await asked();
      await evalJs("document.querySelector('#save-confirm-yes').click()");
      await evalJs(
        waitFor(
          "()=>document.querySelector('#screen').dataset.saveHash",
          'Import missing',
          `JSON.stringify(${state})`,
        ),
      );
      s = await evalJs(state);
      assert.equal(s.tone, 'imported');
      assert.match(s.status, /Backup\.srm/);
      const cards =
        await evalJs(`Array.from(document.querySelectorAll('#save-slot-list > section')).map(card => ({
        hidden: card.hidden, text: card.textContent, buttonHidden: card.querySelector('button').hidden
      }))`);
      assert.match(cards[0].text, /Game 1/);
      assert.match(cards[0].text, /Jake’s apartment/);
      assert.doesNotMatch(cards[0].text, /Invalid Date|2026/);
      assert.match(cards[1].text, /Empty/);
      assert.equal(
        cards[0].buttonHidden,
        true,
        'descriptions are visible before starting; save action is not',
      );
      assert.deepEqual(
        cards.map((card) => card.hidden),
        [false, false, true, true],
      );
      await cdp.call('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: false,
      });
      assert.equal(
        await evalJs(`(() => {
        const list = document.querySelector('#save-slot-list');
        return list.scrollWidth <= list.clientWidth;
      })()`),
        true,
        'slot cards fit the narrow overlay',
      );
      const colour = await evalJs(
        "getComputedStyle(document.querySelector('#save-status')).backgroundColor",
      );
      assert.notEqual(colour, 'rgba(0, 0, 0, 0)', 'the imported status is highlighted');

      await choose(bad);
      await evalJs(
        waitFor(
          "()=>document.querySelector('#save-status').dataset.tone==='error'",
          'No error tone',
        ),
      );
      s = await evalJs(state);
      assert.equal(s.open, false, 'a wrong file is rejected without a question');
    });
  },
);
