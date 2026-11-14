import test from 'node:test';
import assert from 'node:assert/strict';
import { findEdge, withStartPage } from './browser-frame.mjs';

// Real Edge/WebGL2: a unique value per source pixel on a 1024-pixel canvas.
// Plain output is exactly the pattern enlarged four times. Tube output follows
// geometry, signal, beam, convergence, grille, wires and halation; every 13th row
// agrees with the JS reference within float-target precision. Screen corners are
// black, only halation remains beside the picture. toSource maps pixel centres
// back. The page defaults to CRT; F9 persists the choice; fullscreen fills the height.
const edge = findEdge();
test(
  'the CRT module draws the source exactly and runs signal path and beam on the tube',
  { skip: edge ? false : 'Microsoft Edge not found', timeout: 120000 },
  async () => {
    const result = await withStartPage(
      { exe: edge, commandTimeout: 30000 },
      async ({ cdp, evalJs }) => {
        const shown = await evalJs(`(async()=>{
    const {createCrt}=await import('/src/crt/crt.mjs'),{SNES_PAL_RGB,SONY_PVM_20M2E}=await import('/src/crt/profiles.mjs');
    const frames=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const canvas=document.createElement('canvas');canvas.style.cssText='display:block;width:1024px';document.body.prepend(canvas);
    const crt=createCrt(canvas,{source:SNES_PAL_RGB,monitor:SONY_PVM_20M2E,enabled:false,output:'srgb'});
    const pattern=new Uint8ClampedArray(256*224*4);
    for(let y=0;y<224;y++)for(let x=0;x<256;x++)pattern.set([x,y,(x*7+y*13)&255,255],(y*256+x)*4);
    await frames();crt.draw(pattern);
    const plain={width:canvas.width,height:canvas.height,ratio:devicePixelRatio,wrong:0};
    let out=crt.snapshot();
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      const at=(y*canvas.width+x)*4,from=((y>>2)*256+(x>>2))*4;
      for(let c=0;c<4;c++)if(out[at+c]!==pattern[from+c]){plain.wrong++;break;}}
    crt.setEnabled(true);await frames();out=crt.snapshot();
    const W=canvas.width,H=canvas.height,box=canvas.getBoundingClientRect(),tube={width:W,height:H,wrong:0,checked:0,black:[]};
    const p=crt.layout.picture,left=Math.ceil(p.x*W-0.5),top=Math.ceil(p.y*H-0.5);tube.left=left;tube.top=top;
    const {tubeReference}=await import('/src/crt/beam.mjs'),{srgbEncode}=await import('/src/crt/signal.mjs');
    const {sourceToOutput}=await import('/src/crt/geometry.mjs');
    const ref=tubeReference(pattern,SNES_PAL_RGB,SONY_PVM_20M2E);tube.spot=crt.spot;tube.diff=0;
    for(let y=0;y<H;y+=13)for(let x=0;x<W;x++){const at=(y*W+x)*4,light=ref.pixel(crt.layout,W,H,x,y);tube.checked++;
      for(let c=0;c<3;c++)tube.diff=Math.max(tube.diff,Math.abs(out[at+c]-Math.round(srgbEncode(light[c])*255)));}
    for(let sy=0;sy<224;sy+=7)for(let sx=0;sx<256;sx+=5){
      const projected=sourceToOutput(crt.layout,SNES_PAL_RGB,sx+0.5,sy+0.5);
      const x=Math.floor(projected.x*W),y=Math.floor(projected.y*H);
      const back=crt.toSource(box.left+(x+0.5)*box.width/W,box.top+(y+0.5)*box.height/H);if(Math.floor(back.x)!==sx||Math.floor(back.y)!==sy)tube.wrong++;}
    for(const [x,y] of [[0,0],[W-1,H-1],[left-8,H>>1],[W>>1,top-8]])tube.black.push(out[(y*W+x)*4]+out[(y*W+x)*4+1]+out[(y*W+x)*4+2]);
    const mid=crt.toSource(box.left+box.width/2,box.top+box.height/2);tube.mid=[mid.x,mid.y];
    tube.adjusted=[];
    for(const controls of [{brightness:0.08,contrast:1.7},{brightness:-0.06,contrast:0.6},{brightness:0.1,contrast:0}]){
      crt.setControls(controls);const changed=crt.snapshot(),reference=tubeReference(pattern,SNES_PAL_RGB,SONY_PVM_20M2E,undefined,controls);
      let diff=0;for(let y=0;y<H;y+=53)for(let x=0;x<W;x+=7){const light=reference.pixel(crt.layout,W,H,x,y),at=(y*W+x)*4;
        for(let c=0;c<3;c++)diff=Math.max(diff,Math.abs(changed[at+c]-Math.round(srgbEncode(light[c])*255)));}
      tube.adjusted.push({controls,diff});
    }
    crt.setEnabled(false);await frames();const raw=crt.snapshot();tube.plainWithControls=true;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)for(let c=0;c<3;c++)
      if(raw[(y*canvas.width+x)*4+c]!==pattern[((y>>2)*256+(x>>2))*4+c])tube.plainWithControls=false;
    crt.destroy();canvas.remove();
    // Start page: on by default; F9 switches off and remembers it.
    const page=document.querySelector('#screen'),button=document.querySelector('#crt');
    const before=[page.dataset.crt,button.hidden,getComputedStyle(page).aspectRatio];
    dispatchEvent(new KeyboardEvent('keydown',{code:'F9'}));
    const after=[page.dataset.crt,localStorage.getItem('shadowrun.crt.1'),button.getAttribute('aria-pressed'),getComputedStyle(page).aspectRatio];
    return {plain,tube,before,after};})()`);
        // Fullscreen button with a user gesture: picture fills the height at its aspect ratio.
        await cdp.call('Runtime.evaluate', {
          expression: "document.querySelector('#fullscreen').click()",
          userGesture: true,
        });
        shown.full =
          await evalJs(`new Promise(resolve=>setTimeout(()=>{const c=document.querySelector('#screen');
      resolve({full:document.fullscreenElement?.id??null,aspect:c.crt.layout.aspect,escape:document.querySelector('#frame').dataset.escape??null,width:c.clientWidth,height:c.clientHeight,screen:innerHeight,device:[c.width,c.height]});},500))`);
        // A real short Esc press (browser input, not a synthetic event) reaches the page and keeps fullscreen.
        await evalJs(
          `(()=>{window.escapes=0;addEventListener('keydown',e=>{if(e.code==='Escape')window.escapes++;});})()`,
        );
        for (const type of ['rawKeyDown', 'keyUp'])
          await cdp.call('Input.dispatchKeyEvent', {
            type,
            key: 'Escape',
            code: 'Escape',
            windowsVirtualKeyCode: 27,
            nativeVirtualKeyCode: 27,
          });
        shown.esc = await evalJs(
          `new Promise(resolve=>setTimeout(()=>resolve({escapes:window.escapes,full:document.fullscreenElement?.id??null}),500))`,
        );
        return shown;
      },
    );
    const { plain, tube, before, after, full, esc } = result;
    assert.equal(full.full, 'frame', 'the picture frame is fullscreen');
    // Keyboard Lock: a short Esc goes to the game (back key), holding it leaves fullscreen.
    assert.equal(full.escape, 'game', 'Esc is locked for the game in fullscreen');
    assert.deepEqual(
      esc,
      { escapes: 1, full: 'frame' },
      'a short Esc goes to the game and fullscreen stays',
    );
    assert.equal(full.height, full.screen, 'fullscreen picture fills the height');
    // After F9 the page shows the plain picture (8:7); fullscreen keeps that aspect.
    assert.equal(full.aspect, 256 / 224);
    assert.ok(
      Math.abs(full.width - full.height * full.aspect) <= 1 && full.device[0] === full.width,
      JSON.stringify(full),
    );
    assert.equal(plain.ratio, 1, 'headless Edge draws one device pixel per CSS pixel');
    assert.deepEqual(
      [plain.width, plain.height, plain.wrong],
      [1024, 896, 0],
      'plain picture is the pattern scaled by four',
    );
    assert.deepEqual([tube.width, tube.height], [1024, 768], 'tube output is 4:3');
    assert.equal(tube.wrong, 0, 'toSource maps source pixel centres back');
    console.log(JSON.stringify({ spot: tube.spot, diff: tube.diff, checked: tube.checked }));
    assert.ok(
      tube.diff <= 2,
      `tube output differs from the beam reference by ${tube.diff} in ${tube.checked} pixels`,
    );
    for (const { controls, diff } of tube.adjusted)
      assert.ok(diff <= 2, `adjusted CRT differs by ${diff}: ${JSON.stringify(controls)}`);
    assert.equal(tube.plainWithControls, true, 'monitor controls leave the plain output bit exact');
    // Screen corners are black; beside the picture only the dim halation remains (profiles.mjs).
    assert.deepEqual(tube.black.slice(0, 2), [0, 0], 'screen corners are black');
    assert.ok(
      tube.black.slice(2).every((v) => v > 0 && v <= 30),
      'only halation beside the picture: ' + tube.black,
    );
    // 5% underscan and 92.5% of the active line: about 62 pixels left and 99 top.
    assert.ok(
      Math.abs(tube.left - 1024 * (0.025 + (0.95 * (1 - (256 * 4) / 21281370 / 52e-6)) / 2)) < 1,
      'left edge ' + tube.left,
    );
    assert.ok(
      Math.abs(tube.top - 768 * (0.025 + (0.95 * (1 - 224 / 288)) / 2)) < 1,
      'top edge ' + tube.top,
    );
    assert.deepEqual(
      tube.mid.map((v) => Math.round(v * 1e6) / 1e6),
      [128, 112],
      'screen centre is the picture centre',
    );
    assert.deepEqual(before.slice(0, 2), ['on', false]);
    assert.deepEqual(after.slice(0, 3), ['off', 'off', 'false']);
    assert.notEqual(before[2], after[2], 'the page canvas changes its aspect ratio');
  },
);

test(
  'video overlay sliders redraw immediately, persist, reset and support keyboard input',
  { skip: edge ? false : 'Microsoft Edge not found', timeout: 120000 },
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ cdp, evalJs }) => {
      const result = await evalJs(`(()=>{
      const crt=document.querySelector('#screen').crt,settings=document.querySelector('#crt-settings');
      const brightness=document.querySelector('#crt-brightness'),contrast=document.querySelector('#crt-contrast');
      document.querySelector('#menu-toggle').click();document.querySelector('#video-settings-open').click();
      const visible=document.querySelector('#video-settings').open&&settings.getBoundingClientRect().height>0;
      const pixels=new Uint8ClampedArray(256*224*4);for(let i=0;i<pixels.length;i+=4)pixels.set([66,66,66,255],i);
      crt.setOverlay(null);crt.draw(pixels);const total=()=>crt.snapshot().reduce((sum,v,i)=>sum+(i%4===3?0:v),0),before=total();
      brightness.value='60';brightness.dispatchEvent(new Event('input',{bubbles:true}));
      contrast.value='140';contrast.dispatchEvent(new Event('input',{bubbles:true}));
      const after=total(),controls=crt.controls;controls.brightness=-0.1;
      const value=crt.controls,labels=[document.querySelector('#crt-brightness-value').value,document.querySelector('#crt-contrast-value').value];
      brightness.focus();return {visible,before,after,value,labels,stored:JSON.parse(localStorage.getItem('shadowrun.crt.controls.1'))};
    })()`);
      assert.equal(result.visible, true, 'settings are reachable inside the video overlay');
      assert.ok(result.after > result.before, 'sliders redraw the last frame without a game frame');
      assert.deepEqual(
        result.value,
        { brightness: 0.06, contrast: 1.4 },
        'getter cannot mutate renderer state',
      );
      assert.deepEqual(result.stored, result.value);
      assert.deepEqual(result.labels, ['+60%', '140%']);
      // A real arrow press changes the focused slider without pressing the SNES pad.
      for (const type of ['rawKeyDown', 'keyUp'])
        await cdp.call('Input.dispatchKeyEvent', {
          type,
          key: 'ArrowRight',
          code: 'ArrowRight',
          windowsVirtualKeyCode: 39,
          nativeVirtualKeyCode: 39,
        });
      const keyboard = await evalJs(
        `({value:document.querySelector('#crt-brightness').value,pad:Number(document.querySelector('#screen').dataset.pad??0)})`,
      );
      assert.deepEqual(keyboard, { value: '61', pad: 0 });
      await evalJs('window.beforeCrtReload=true');
      await cdp.call('Page.reload');
      // Poll from Node: a promise in the old page can disappear with its execution context.
      let reloaded = false;
      const reloadDeadline = Date.now() + 30000;
      while (Date.now() < reloadDeadline) {
        try {
          reloaded = await evalJs(
            `!window.beforeCrtReload&&!!document.querySelector('#screen')?.crt`,
          );
        } catch (error) {
          if (!/context|navigat/i.test(error.message)) throw error;
        }
        if (reloaded) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.ok(reloaded, 'CRT settings page reloaded');
      const restored = await evalJs(`(()=>{
      const crt=document.querySelector('#screen').crt,settings=document.querySelector('#crt-settings'),before=crt.controls;
      dispatchEvent(new KeyboardEvent('keydown',{code:'F9'}));const disabled=settings.querySelector('fieldset').disabled;
      dispatchEvent(new KeyboardEvent('keydown',{code:'F9'}));const enabled=!settings.querySelector('fieldset').disabled;
      document.querySelector('#crt-reset').click();return {before,disabled,enabled,after:crt.controls,stored:localStorage.getItem('shadowrun.crt.controls.1')};
    })()`);
      assert.deepEqual(restored, {
        before: { brightness: 0.061, contrast: 1.4 },
        disabled: true,
        enabled: true,
        after: { brightness: 0, contrast: 1 },
        stored: null,
      });
    });
  },
);
