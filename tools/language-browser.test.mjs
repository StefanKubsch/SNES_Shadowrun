// Page menu "Language" (docs/LANGUAGES.md): the choice persists, the German
// asset loads with the game data, the worker starts in German and records
// it, and a switch during the game becomes a recording event.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withStartPage, findEdge } from './browser-frame.mjs';

const edge = findEdge();
const waitFor = (condition, message) => `new Promise((resolve,reject)=>{const end=Date.now()+15000;
  const check=()=>{const v=(${condition})();if(v)resolve(v);else if(Date.now()>end)reject(Error(${JSON.stringify(message)}));
  else setTimeout(check,25);};check();})`;
test(
  'the language choice persists, starts the worker in German and records switches',
  { skip: edge ? false : 'Microsoft Edge not found', timeout: 120000 },
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ cdp, evalJs, logDir }) => {
      const label = "document.querySelector('#language').textContent";
      assert.equal(await evalJs(label), 'Language: English');
      await evalJs(
        "document.querySelector('#menu-toggle').click();document.querySelector('#language').click()",
      );
      await evalJs(waitFor(`()=>${label}==='Sprache: Deutsch'`, 'German did not load'));
      await evalJs('globalThis.beforeLanguageReload = true');
      await cdp.call('Page.reload');
      await evalJs(
        waitFor(
          "()=>!globalThis.beforeLanguageReload&&document.querySelector('#screen')?.dataset.stage==='data'",
          'Reload did not finish',
        ),
      );
      assert.equal(await evalJs(label), 'Sprache: Deutsch');
      await evalJs(`(()=>{
        const Worker=globalThis.Worker;
        globalThis.Worker=class extends Worker {
          constructor(...args){super(...args);globalThis.gameWorker=this;this.addEventListener('message',({data})=>{
            if(data.recording)globalThis.recorded=JSON.parse(data.recording);
          });}
        };
        document.querySelector('#start').click();
      })()`);
      await evalJs(
        waitFor(
          "()=>{const d=document.querySelector('#screen').dataset;if(d.error)throw Error(d.error);return d.bugfixes;}",
          'Worker did not start',
        ),
      );
      // Back to English during the game: the worker applies it at a pad read.
      await evalJs("document.querySelector('#language').click()");
      await evalJs(waitFor(`()=>${label}==='Language: English'`, 'English not chosen'));
      assert.equal(await evalJs("document.querySelector('#menu h2').textContent"), 'Options');
      assert.equal(
        await evalJs("document.querySelector('#recording-settings-open').textContent"),
        'Recording',
      );
      assert.equal(
        await evalJs("document.querySelector('#bugfixes').disabled"),
        true,
        'language changes preserve the running session lock',
      );
      const recorded = await evalJs(
        waitFor(
          `()=>{if(globalThis.recorded?.events?.length)return recorded;
            globalThis.recorded=null;document.querySelector('#recording-export').click();}`,
          'No language event recorded',
        ),
      );
      assert.equal(recorded.language, 'de');
      assert.deepEqual(
        recorded.events.map((e) => e[1]),
        ['language-en'],
      );
      console.log(JSON.stringify({ logDir }));
    });
  },
);
