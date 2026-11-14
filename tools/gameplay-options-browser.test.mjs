import test from 'node:test';
import assert from 'node:assert/strict';
import { withStartPage, findEdge } from './browser-frame.mjs';

const edge = findEdge();
test(
  'Game defaults to fixes on, persists both choices, and the real worker records the locked session, also after a fault',
  {
    skip: edge ? false : 'Microsoft Edge not found',
    timeout: 120000,
  },
  async () => {
    for (const enabled of [true, false])
      await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ cdp, evalJs, logDir }) => {
        // Document readiness can precede the game's asynchronous startup.
        await evalJs(`new Promise((resolve,reject)=>{const end=Date.now()+15000;const check=()=>{
          const state=document.querySelector('#screen').dataset;
          if(state.error)reject(Error(state.error));else if(state.stage==='data')resolve(true);
          else if(Date.now()>end)reject(Error('Game data did not finish loading'));else setTimeout(check,25);
        };check();})`);
        const initial = await evalJs(`(()=>{
        document.querySelector('#menu-toggle').click();
        document.querySelector('#game-settings-open').click();
        return ['#bugfixes','#prevent-exploits','#instant-text'].map(id=>{
          const b=document.querySelector(id);
          return {pressed:b.getAttribute('aria-pressed'),disabled:b.disabled,visible:b.getBoundingClientRect().width>0};
        });
      })()`);
        assert.deepEqual(initial, [
          { pressed: 'true', disabled: false, visible: true },
          { pressed: 'false', disabled: false, visible: true },
          { pressed: 'true', disabled: false, visible: true },
        ]);
        if (!enabled)
          await evalJs(
            "document.querySelector('#bugfixes').click();document.querySelector('#prevent-exploits').click()",
          );
        // A missing preference is itself the persisted default-on behaviour.
        await evalJs('globalThis.beforeGameplayReload = true');
        await cdp.call('Page.reload');
        await evalJs(`new Promise((resolve,reject)=>{const end=Date.now()+15000;const check=()=>{
        if(!globalThis.beforeGameplayReload && document.querySelector('#screen')?.dataset.stage==='data')resolve(true);
        else if(Date.now()>end)reject(Error('Reload did not finish'));else setTimeout(check,25);
      };check();})`);
        assert.equal(
          await evalJs("document.querySelector('#bugfixes').getAttribute('aria-pressed')"),
          String(enabled),
        );
        assert.equal(
          await evalJs("document.querySelector('#prevent-exploits').getAttribute('aria-pressed')"),
          String(!enabled),
        );
        // Observe actual Worker messages; start and recording still use production code.
        await evalJs(`(()=>{
        const Worker=globalThis.Worker;
        globalThis.Worker=class extends Worker {
          constructor(...args){super(...args);globalThis.gameWorker=this;this.addEventListener('message',({data})=>{
            if(data.recording)globalThis.recordedGameplay=JSON.parse(data.recording).gameplay;
          });}
        };
        document.querySelector('#start').click();
      })()`);
        await evalJs(`new Promise((resolve,reject)=>{const end=Date.now()+15000;const check=()=>{
        const d=document.querySelector('#screen').dataset;
        if(d.error)reject(Error(d.error));else if(d.bugfixes==='${enabled}')resolve(true);
        else if(Date.now()>end)reject(Error('Worker did not start'));else setTimeout(check,25);
      };check();})`);
        const locked = await evalJs(
          "['#bugfixes','#prevent-exploits','#four-save-slots','#instant-text','#fluid-controls'].map(id=>document.querySelector(id).disabled)",
        );
        assert.deepEqual(locked, [true, true, true, true, true]);
        await evalJs("document.querySelector('#recording-export').click()");
        const recorded =
          await evalJs(`new Promise((resolve,reject)=>{const end=Date.now()+15000;const check=()=>{
        if(globalThis.recordedGameplay)resolve(recordedGameplay);
        else if(Date.now()>end)reject(Error('Worker did not export'));else setTimeout(check,25);
      };check();})`);
        assert.deepEqual(recorded, {
          version: 1,
          bugfixes: enabled,
          preventExploits: !enabled,
          fourSaveSlots: false,
          instantText: true,
          fluidControls: true,
        });
        // A fault stops the session, but the worker's recording up to it stays exportable.
        const fault = await evalJs(`new Promise((resolve,reject)=>{globalThis.recordedGameplay=null;
        gameWorker.postMessage({command:'unknown'});const end=Date.now()+15000;const check=()=>{
        const d=document.querySelector('#screen').dataset;
        if(d.error){document.querySelector('#recording-export').click();resolve(d.error);}
        else if(Date.now()>end)reject(Error('Worker did not report the fault'));else setTimeout(check,25);
      };check();})`);
        assert.equal(fault, 'The game is not running yet.');
        const afterFault =
          await evalJs(`new Promise((resolve,reject)=>{const end=Date.now()+15000;const check=()=>{
        if(globalThis.recordedGameplay)resolve(recordedGameplay);
        else if(Date.now()>end)reject(Error('Worker did not export after the fault'));else setTimeout(check,25);
      };check();})`);
        assert.deepEqual(afterFault, recorded);
        console.log(JSON.stringify({ enabled, logDir }));
      });
  },
);
