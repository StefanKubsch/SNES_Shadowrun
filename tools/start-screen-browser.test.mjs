import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findEdge, withStartPage } from './browser-frame.mjs';

const edge = findEdge();
const options = { skip: edge ? false : 'Microsoft Edge not found', timeout: 120000 };
const waitForStart = `new Promise((resolve,reject)=>{const stop=Date.now()+15000;const check=()=>{
  const c=document.querySelector('#screen'),logo=document.querySelector('#start-logo'),button=document.querySelector('#start');
  if(c?.dataset.stage==='data'&&!button.disabled&&logo.complete&&logo.naturalWidth)resolve(true);
  else if(Date.now()>stop)reject(Error('Start screen did not become ready'));else setTimeout(check,25);
};check();})`;

test(
  'loading progress grows with completed data and keeps its label inside the filtered bar',
  options,
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ cdp, evalJs, logDir }) => {
      for (const fail of [false, true]) {
        const { identifier } = await cdp.call('Page.addScriptToEvaluateOnNewDocument', {
          source: `{
          const original = globalThis.fetch;
          globalThis.loadingGates = {};
          globalThis.fetch = async (...args) => {
            const name = String(args[0]).split('/').pop();
            if (['vm-texts.json', 'vm-sound.json'].includes(name)) {
              await new Promise(resolve => loadingGates[name] = resolve);
              if (${fail} && name === 'vm-sound.json') throw Error('Loading test failure');
            }
            return original(...args);
          };
        }`,
        });
        await cdp.call('Page.reload', { ignoreCache: true });
        const waitForGate = (name) =>
          evalJs(`new Promise((resolve,reject)=>{
        const stop=Date.now()+15000; const check=()=>{
          if(globalThis.loadingGates?.['${name}'])resolve(true);
          else if(Date.now()>stop)reject(Error('Loading gate missing: ${name}'));
          else setTimeout(check,25);
        };check();
      })`);
        await waitForGate('vm-texts.json');
        const readProgress = () =>
          evalJs(`(async()=>{
        const c=document.querySelector('#screen'),p=document.querySelector('#loading-progress');
        const original=c.crt.setOverlay;let overlay;
        c.crt.setOverlay=function(pixels){overlay=pixels?.slice();return original.call(this,pixels);};
        p.value=p.value;await new Promise(resolve=>queueMicrotask(resolve));
        c.crt.setOverlay=original;
        const pixel=(x,y)=>Array.from(overlay.slice((y*256+x)*4,(y*256+x)*4+3));
        return {value:p.value,max:p.max,hidden:p.hidden,text:document.querySelector('#status').textContent,
          disabled:document.querySelector('#start').disabled,
          filled:pixel(18,180),empty:pixel(237,180),
          label:Array.from(overlay.slice(182*256*4,192*256*4)).some((v,i)=>i%4===0&&(i/4)%256>32&&(i/4)%256<224&&v>100)};
      })()`);
        const early = await readProgress();
        assert.ok(early.value > 0 && early.value < early.max);
        assert.equal(early.hidden, false);
        assert.equal(early.disabled, true);
        assert.equal(
          early.text,
          `Loading game data … ${Math.floor((early.value / early.max) * 100)}%`,
        );
        assert.deepEqual(early.filled, [49, 91, 68]);
        assert.deepEqual(early.empty, [10, 24, 18]);
        assert.equal(early.label, true, 'the status text is rasterized inside the track');
        await evalJs("loadingGates['vm-texts.json']()");
        await waitForGate('vm-sound.json');
        const later = await readProgress();
        assert.ok(later.value > early.value && later.value < later.max);
        if (!fail) {
          const screenshot = await cdp.call('Page.captureScreenshot', { format: 'png' });
          await writeFile(
            join(logDir, 'monitor-loading-progress.png'),
            Buffer.from(screenshot.data, 'base64'),
          );
        }
        await evalJs("loadingGates['vm-sound.json']()");
        if (fail) {
          await evalJs(`new Promise((resolve,reject)=>{const stop=Date.now()+15000;const check=()=>{
          if(document.querySelector('#screen').dataset.error)resolve(true);
          else if(Date.now()>stop)reject(Error('Loading failure missing'));else setTimeout(check,25);
        };check();})`);
        } else await evalJs(waitForStart);
        assert.deepEqual(
          await evalJs(`(()=>{const p=document.querySelector('#loading-progress');return {
        hidden:p.hidden,complete:p.value===p.max,disabled:document.querySelector('#start').disabled,
        text:document.querySelector('#status').textContent};})()`),
          {
            hidden: true,
            complete: !fail,
            disabled: fail,
            text: fail ? 'Loading test failure' : 'Game data loaded.',
          },
        );
        await cdp.call('Page.removeScriptToEvaluateOnNewDocument', { identifier });
      }
      console.log(JSON.stringify({ logDir }));
    });
  },
);

test(
  'the monitor start screen filters the logo, subtitle, button and status and accepts curved mouse input',
  options,
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ cdp, evalJs, logDir }) => {
      await evalJs(waitForStart);
      const initial = await evalJs(`(async()=>{
      const c=document.querySelector('#screen'),crt=c.crt,status=document.querySelector('#status'),button=document.querySelector('#start');
      const {tubeReference}=await import('/src/crt/beam.mjs');
      const {SNES_PAL_RGB,SONY_PVM_20M2E}=await import('/src/crt/profiles.mjs');
      const {srgbEncode}=await import('/src/crt/signal.mjs');
      const {SRGB,DISPLAY_P3}=await import('/src/crt/colour.mjs');
      const original=crt.setOverlay;let overlay;
      crt.setOverlay=function(pixels){overlay=pixels?.slice();return original.call(this,pixels);};
      status.textContent='Ready to start';await new Promise(resolve=>queueMicrotask(resolve));
      const frame=crt.source(),sourceBlack=frame.every((value,i)=>i%4===3?value===255:value===0);
      const shown=crt.snapshot(),W=c.width,H=c.height;
      const ref=tubeReference(overlay,SNES_PAL_RGB,SONY_PVM_20M2E,crt.output==='display-p3'?DISPLAY_P3:SRGB);
      let difference=0;
      for(let y=0;y<H;y+=31)for(let x=0;x<W;x+=11){const light=ref.pixel(crt.layout,W,H,x,y),at=(y*W+x)*4;
        for(let channel=0;channel<3;channel++)difference=Math.max(difference,Math.abs(shown[at+channel]-Math.round(srgbEncode(light[channel])*255)));}
      const {START_BUTTON}=await import('/src/browser/start-screen.mjs');
      const {sourceToOutput}=await import('/src/crt/geometry.mjs');
      const point=sourceToOutput(crt.layout,SNES_PAL_RGB,START_BUTTON.x+START_BUTTON.width/2,START_BUTTON.y+START_BUTTON.height/2);
      const outside=sourceToOutput(crt.layout,SNES_PAL_RGB,16,190),box=c.getBoundingClientRect();
      const client=p=>({x:box.left+p.x*box.width,y:box.top+p.y*box.height});
      // Distinct raster regions must contain the actual logo, subtitle, button
      // and status, rather than relying on unfiltered HTML above the canvas.
      const energy=(first,last)=>{let sum=0;for(let y=first;y<last;y++)for(let x=16;x<240;x++)for(let k=0;k<3;k++)sum+=overlay[(y*256+x)*4+k];return sum;};
      return {sourceBlack,difference,presentation:c.dataset.presentation,logo:[document.querySelector('#start-logo').naturalWidth,document.querySelector('#start-logo').naturalHeight],
        regions:[energy(18,125),energy(129,140),energy(148,172),energy(182,203)],
        accessible:[document.querySelector('h1').textContent,button.textContent,status.getAttribute('role')],
        onScreenDom:button.getBoundingClientRect().width,button:client(point),outside:client(outside)};
    })()`);
      assert.equal(
        initial.sourceBlack,
        true,
        'the startup UI leaves the retained input frame unchanged',
      );
      assert.equal(initial.presentation, 'start');
      assert.deepEqual(initial.logo, [1500, 729]);
      assert.deepEqual(initial.accessible, ['Shadowrun Enhanced', 'Start Game', 'status']);
      assert.equal(
        initial.onScreenDom,
        1,
        'the semantic button is visually represented in the raster',
      );
      assert.ok(
        initial.regions.every((sum) => sum > 10000),
        JSON.stringify(initial.regions),
      );
      assert.ok(
        initial.difference <= 2,
        `start UI differs from the full CRT reference by ${initial.difference}`,
      );
      const screenshot = await cdp.call('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      await writeFile(
        join(logDir, 'monitor-start-screen.png'),
        Buffer.from(screenshot.data, 'base64'),
      );

      const click = async ({ x, y }) => {
        await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await cdp.call('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x,
          y,
          button: 'left',
          clickCount: 1,
        });
        await cdp.call('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x,
          y,
          button: 'left',
          clickCount: 1,
        });
      };
      await click(initial.outside);
      assert.equal(
        await evalJs("document.querySelector('#start').disabled"),
        false,
        'clicking status/background does not start the game',
      );
      await click(initial.button);
      const live =
        await evalJs(`new Promise((resolve,reject)=>{const stop=Date.now()+15000;const check=()=>{
      const c=document.querySelector('#screen');if(c.dataset.error)reject(Error(c.dataset.error));
      else if(c.dataset.ready==='true'&&c.dataset.presentation==='game')resolve({hidden:document.querySelector('#start').hidden,pad:Number(c.dataset.pad??0)});
      else if(Date.now()>stop)reject(Error('Mouse start did not reach the first game frame'));else setTimeout(check,25);
    };check();})`);
      assert.deepEqual(
        live,
        { hidden: true, pad: 0 },
        'the start click never becomes a game mouse button',
      );
      const paused = await evalJs(`(async()=>{
      const c=document.querySelector('#screen'),crt=c.crt;
      dispatchEvent(new KeyboardEvent('keydown',{code:'KeyP'}));
      const original=crt.source(),copy=original.slice(),before=crt.snapshot();
      await new Promise(resolve=>queueMicrotask(resolve));const after=crt.snapshot();
      return {same:crt.source()===original&&copy.every((v,i)=>original[i]===v),changed:before.some((v,i)=>v!==after[i]),status:document.querySelector('#status').textContent};
    })()`);
      assert.equal(paused.same, true, 'status compositing does not mutate recorded game pixels');
      assert.equal(paused.changed, true, 'the pause status is also sent through CRT');
      assert.equal(paused.status, 'Paused (P resumes).');
      console.log(
        JSON.stringify({ difference: initial.difference, regions: initial.regions, logDir }),
      );
    });
  },
);

test(
  'the semantic start button supports keyboard activation and startup UI survives plain output',
  options,
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ cdp, evalJs }) => {
      await evalJs(waitForStart);
      const plain = await evalJs(`(async()=>{
      const c=document.querySelector('#screen');dispatchEvent(new KeyboardEvent('keydown',{code:'F9'}));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const shown=c.crt.snapshot();document.querySelector('#start').focus();
      return {on:c.crt.enabled,visible:shown.some((v,i)=>i%4!==3&&v>80),sourceBlack:c.crt.source().every((v,i)=>i%4===3||v===0),focused:document.activeElement.id};
    })()`);
      assert.deepEqual(plain, { on: false, visible: true, sourceBlack: true, focused: 'start' });
      const recovered = await evalJs(`(async()=>{
        const OriginalWorker=globalThis.Worker;let stub;
        globalThis.Worker=class {constructor(){stub=this;}postMessage(data){if(data.command==='start')this.gameplay=data.gameplay;}terminate(){}};
        document.querySelector('#start').click();
        // Exercise failure after ready has already hidden the native button.
        stub.onmessage({data:{ready:true,gameplay:stub.gameplay,save:false}});
        stub.onmessage({data:{error:'Unable to start the game'}});
        globalThis.Worker=OriginalWorker;
        await new Promise(resolve=>queueMicrotask(resolve));
        const c=document.querySelector('#screen'),button=document.querySelector('#start');
        button.focus();
        return {presentation:c.dataset.presentation,hidden:button.hidden,disabled:button.disabled,status:document.querySelector('#status').textContent,gameplayLocked:document.querySelector('#bugfixes').disabled};
      })()`);
      assert.deepEqual(recovered, {
        presentation: 'start',
        hidden: false,
        disabled: false,
        // The session was ready, so its recording exists and the page asks for the export.
        status:
          'Unable to start the game. Please export the recording (menu, Recording) before starting again.',
        gameplayLocked: false,
      });
      for (const type of ['keyDown', 'keyUp'])
        await cdp.call('Input.dispatchKeyEvent', {
          type,
          key: 'Enter',
          code: 'Enter',
          windowsVirtualKeyCode: 13,
          nativeVirtualKeyCode: 13,
          ...(type === 'keyDown' ? { text: '\r', unmodifiedText: '\r' } : {}),
        });
      const started =
        await evalJs(`new Promise((resolve,reject)=>{const stop=Date.now()+15000;const check=()=>{
      const c=document.querySelector('#screen');if(c.dataset.ready==='true')resolve({presentation:c.dataset.presentation,pad:Number(c.dataset.pad??0)});
      else if(c.dataset.error||Date.now()>stop)reject(Error('Keyboard start failed: '+JSON.stringify({dataset:{...c.dataset},status:document.querySelector('#status').textContent,focused:document.activeElement.id,disabled:document.querySelector('#start').disabled})));else setTimeout(check,25);
    };check();})`);
      assert.deepEqual(started, { presentation: 'game', pad: 0 });
    });
  },
);

test(
  'a successful debug room request clears the status overlay and leaves subsequent gameplay unobscured',
  options,
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ evalJs }) => {
      await evalJs(waitForStart);
      assert.deepEqual(
        await evalJs(`(()=>{const b=document.querySelector('#debug-room');return {
        parent:b.parentElement.id,disabled:b.getAttribute('aria-disabled'),
        hidden:b.hidden,hint:b.title.includes('Start a game first')&&b.title.includes('Jake is playable')};})()`),
        { parent: 'menu-actions', disabled: 'true', hidden: false, hint: true },
      );
      await evalJs(`(()=>{
      const c=document.querySelector('#screen'),original=c.crt.setOverlay;
      c.crt.setOverlay=function(pixels){globalThis.debugOverlay=pixels;return original.call(this,pixels);};
      globalThis.debugRequests=0;
      globalThis.Worker=class {
        constructor(){globalThis.debugWorker=this;}
        postMessage(data){if(data.command==='start')this.gameplay=data.gameplay;
          if(data.command==='debug-room')debugRequests++;}
        terminate(){}
      };
      document.querySelector('#start').click();
      debugWorker.onmessage({data:{ready:true,gameplay:debugWorker.gameplay,save:false}});
      globalThis.debugFrame=new Uint8Array(256*224*4);
      for(let i=0;i<debugFrame.length;i+=4)debugFrame.set([24,48,72,255],i);
      debugWorker.onmessage({data:{frame:true,nmi:6000,pixels:debugFrame}});
    })()`);
      await evalJs(`new Promise((resolve,reject)=>{const end=Date.now()+15000;const check=()=>{
      if(document.querySelector('#screen').dataset.ready==='true')resolve(true);
      else if(Date.now()>end)reject(Error('Stub frame was not shown'));else setTimeout(check,25);
    };check();})`);
      assert.deepEqual(
        await evalJs(`(()=>{const b=document.querySelector('#debug-room');b.click();
        return {disabled:b.getAttribute('aria-disabled'),requests:debugRequests,
          hint:b.title.includes('only reachable')&&b.title.includes('Jake is playable')};})()`),
        { disabled: 'true', requests: 0, hint: true },
      );
      await evalJs(
        `debugWorker.onmessage({data:{frame:true,nmi:6001,pixels:debugFrame,debugRoomAvailable:true}})`,
      );
      await evalJs(`new Promise((resolve,reject)=>{const end=Date.now()+15000;const check=()=>{
        if(document.querySelector('#debug-room').getAttribute('aria-disabled')==='false')resolve(true);
        else if(Date.now()>end)reject(Error('Debug room did not become available'));else setTimeout(check,25);
      };check();})`);
      assert.deepEqual(
        await evalJs(`(()=>{const b=document.querySelector('#debug-room');
        const hint=b.title.includes('bottom centre')&&b.title.includes('Jake is playable');b.click();b.click();
        return {hint,requests:debugRequests,disabled:b.getAttribute('aria-disabled')};})()`),
        { hint: true, requests: 1, disabled: 'true' },
      );
      const results = await evalJs(`(async()=>{
      const c=document.querySelector('#screen'),status=document.querySelector('#status'),results=[];
      const source=debugFrame.slice();
      const difference=(actual,base)=>{
        let rgb=0,alpha=0;
        for(let i=0;i<actual.length;i++){
          const delta=Math.abs(actual[i]-base[i]);
          if(i%4===3)alpha=Math.max(alpha,delta);else rgb=Math.max(rgb,delta);
        }
        return {sameSize:actual.length===base.length,rgb,alpha};
      };
      for(const enabled of [false,true]){
        c.crt.setEnabled(enabled);
        // Let the canvas resize and output colour-space tag settle. The raw
        // frame and plain output stay exact; filtered float passes can round
        // this flat fixture by one RGB code when the same bytes are uploaded.
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const base=c.crt.snapshot();
        debugWorker.onmessage({data:{debugRoom:false}});
        await new Promise(resolve=>queueMicrotask(resolve));
        const refused=status.textContent.includes('only reachable')&&debugOverlay!==null;
        debugWorker.onmessage({data:{debugRoom:true}});
        await new Promise(resolve=>queueMicrotask(resolve));
        const clear=status.textContent===''&&debugOverlay===null;
        const restored=difference(c.crt.snapshot(),base);
        c.crt.draw(debugFrame);
        results.push({enabled:c.crt.enabled,refused,clear,restored,
          nextFrame:difference(c.crt.snapshot(),base),
          sourceUnchanged:c.crt.source()===debugFrame&&source.every((v,i)=>debugFrame[i]===v),
          hint:document.querySelector('#debug-room').title.includes('only reachable')});
      }
      return results;
    })()`);
      for (const result of results) {
        const { enabled, restored, nextFrame, ...state } = result;
        assert.deepEqual(state, {
          refused: true,
          clear: true,
          sourceUnchanged: true,
          hint: true,
        });
        for (const comparison of [restored, nextFrame]) {
          assert.equal(comparison.sameSize, true, JSON.stringify(result));
          assert.equal(comparison.alpha, 0, JSON.stringify(result));
          assert.ok(comparison.rgb <= (enabled ? 1 : 0), JSON.stringify(result));
        }
      }
    });
  },
);

test(
  'RGBA overlays blend over opaque frames without changing source data and clear exactly in WebGL and 2D',
  options,
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ evalJs }) => {
      const results = await evalJs(`(async()=>{
      const {createCrt}=await import('/src/crt/crt.mjs'),results=[];
      for(const fallback of [false,true]){
        const canvas=document.createElement('canvas');canvas.style.width='4px';document.body.append(canvas);
        if(fallback){const get=canvas.getContext.bind(canvas);canvas.getContext=(type,...args)=>type==='webgl2'?null:get(type,...args);}
        const crt=createCrt(canvas,{source:{width:2,height:2},monitor:null});
        const base=new Uint8Array(Array.from({length:4},()=>[20,40,60,255]).flat());
        const overlay=new Uint8Array([220,140,60,0,220,140,60,128,220,140,60,255,220,140,60,64]);
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        crt.draw(base);crt.setOverlay(overlay);
        const sample=()=>{const bytes=crt.snapshot(),out=[];for(let y=0;y<2;y++)for(let x=0;x<2;x++){
          const at=(Math.floor(y*canvas.height/2)*canvas.width+Math.floor(x*canvas.width/2))*4;out.push([...bytes.slice(at,at+4)]); }return out;};
        const blended=sample();let rejected=false;try{crt.setOverlay(new Uint8Array(4));}catch{rejected=true;}
        const unchanged=JSON.stringify(sample())===JSON.stringify(blended);
        const same=crt.source()===base&&base.every((v,i)=>v===[20,40,60,255][i%4]);
        const next=new Uint8Array(Array.from({length:4},()=>[100,120,140,255]).flat());
        crt.draw(next);const updated=sample(),rawUpdated=crt.source()===next;
        crt.setOverlay(null);const restored=sample();
        crt.destroy();canvas.remove();results.push({fallback,blended,rejected,unchanged,same,updated,rawUpdated,restored});
      }
      return results;
    })()`);
      for (const result of results) {
        assert.deepEqual(
          result.blended,
          [
            [20, 40, 60, 255],
            [120, 90, 60, 255],
            [220, 140, 60, 255],
            [70, 65, 60, 255],
          ],
          JSON.stringify(result),
        );
        assert.equal(result.same, true);
        assert.equal(result.rejected, true);
        assert.equal(result.unchanged, true);
        assert.equal(result.rawUpdated, true);
        assert.deepEqual(result.updated, [
          [100, 120, 140, 255],
          [160, 130, 100, 255],
          [220, 140, 60, 255],
          [130, 125, 120, 255],
        ]);
        assert.deepEqual(
          result.restored,
          Array.from({ length: 4 }, () => [100, 120, 140, 255]),
        );
      }
    });
  },
);
