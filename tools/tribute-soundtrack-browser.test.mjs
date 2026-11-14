import test from 'node:test';
import assert from 'node:assert/strict';
import { withStartPage, findEdge } from './browser-frame.mjs';
import { AUDIO_HEADROOM } from '../src/browser/audio-output.mjs';

const edge = findEdge();
test(
  'all preloaded tribute recordings play and resume with subsequent OGG network access blocked',
  { skip: edge ? false : 'Microsoft Edge not found', timeout: 120000 },
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 60000 }, async ({ evalJs, cdp }) => {
      const preloaded = await evalJs(`(async()=>{
        const {TributeCache}=await import('/src/browser/tribute-cache.mjs');
        const {TRIBUTE_TRACKS,TRIBUTE_MAIN_THEME}=await import('/src/browser/tribute-tracks.mjs');
        globalThis.preloadedTribute=new TributeCache();await preloadedTribute.preload();
        return [TRIBUTE_MAIN_THEME,...Object.values(TRIBUTE_TRACKS)].map(track=>preloadedTribute.source(track.file));
      })()`);
      assert.equal(preloaded.length, 12);
      assert.ok(preloaded.every((url) => url.startsWith('blob:')));
      await cdp.call('Network.enable');
      await cdp.call('Network.setBlockedURLs', { urls: ['*/assets/tribute/*'] });
      const result = await evalJs(`(async()=>{
        const {TributePlayer}=await import('/src/browser/tribute-player.mjs');
        const {TRIBUTE_TRACKS,GAME_SONG_TABLE,TITLE_SONG_TABLE}=await import('/src/browser/tribute-tracks.mjs');
        const context=new AudioContext({sampleRate:32000});await context.resume();
        const player=new TributePlayer(context,{enabled:true,sourceFor:file=>preloadedTribute.source(file)});
        const wait=async(check)=>{const end=performance.now()+10000;while(!check()){
          if(player.error||performance.now()>end)throw Error(player.error||'cached track did not start');
          await new Promise(resolve=>setTimeout(resolve,25));}};
        let revision=0;const played=[];
        for(const [table,song] of [[TITLE_SONG_TABLE,2],...Object.keys(TRIBUTE_TRACKS).map(Number).map(song=>[GAME_SONG_TABLE,song])]) {
          player.update({table,song,revision:++revision,playing:true,volume:1});
          await wait(()=>player.active&&player.entry.media.currentTime>0);
          played.push(player.entry.media.src.startsWith('blob:'));
        }
        const street={table:GAME_SONG_TABLE,song:1,playing:true,volume:1};
        player.update({...street,revision:++revision});await wait(()=>player.active);
        player.entry.media.currentTime=19;await wait(()=>player.entry.media.currentTime>=19&&player.entry.media.readyState>=3);
        player.update({...street,song:10,revision:++revision});await wait(()=>player.active);
        player.update({...street,revision:++revision});await wait(()=>player.active);
        const resumed=player.entry.media.currentTime>=19&&player.entry.media.currentTime<20;
        player.close();preloadedTribute.close();await context.close();
        return {played,resumed};
      })()`);
      assert.ok(result.played.every(Boolean), 'every supported cue plays from retained bytes');
      assert.equal(result.resumed, true, 'blob playback preserves independent track positions');
    });
  },
);
test(
  'audio settings default to Tribute, preserve an explicit Original choice and omit soundtrack credits',
  {
    skip: edge ? false : 'Microsoft Edge not found',
    timeout: 60000,
  },
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ evalJs, cdp }) => {
      const selection = () =>
        evalJs(`(()=>{const button=document.querySelector('#soundtrack');return {
      text:button.textContent,pressed:button.getAttribute('aria-pressed'),
      artist:document.querySelector('#audio-settings').textContent.includes('Julian Daniels'),
      links:document.querySelectorAll('#audio-settings a[href*="juliandaniels"]').length};})()`);
      assert.deepEqual(await selection(), {
        text: 'Soundtrack: Tribute',
        pressed: 'true',
        artist: false,
        links: 0,
      });
      await evalJs("document.querySelector('#soundtrack').click()");
      assert.equal(await evalJs("localStorage.getItem('shadowrun.soundtrack.1')"), 'original');
      const reload = async () => {
        await cdp.call('Page.reload');
        await new Promise((resolve) => setTimeout(resolve, 250));
        await evalJs(`new Promise((resolve,reject)=>{const end=Date.now()+20000;const check=()=>{
        if(document.querySelector('#screen')?.dataset.stage==='data')resolve(true);
        else if(Date.now()>end)reject(Error('reload'));else setTimeout(check,25);};check();})`);
      };
      await reload();
      assert.deepEqual(await selection(), {
        text: 'Soundtrack: Original',
        pressed: 'false',
        artist: false,
        links: 0,
      });
      assert.equal(
        await evalJs(
          "performance.getEntriesByType('resource').filter(entry=>entry.name.includes('/assets/tribute/')).length",
        ),
        0,
        'a saved Original choice performs no tribute preloads',
      );
      await evalJs("document.querySelector('#soundtrack').click()");
      assert.equal(await evalJs("localStorage.getItem('shadowrun.soundtrack.1')"), 'tribute');
      await reload();
      assert.deepEqual(await selection(), {
        text: 'Soundtrack: Tribute',
        pressed: 'true',
        artist: false,
        links: 0,
      });
    });
  },
);
test(
  'the real worklet retains SFX while replacing music and restores the original mix',
  {
    skip: edge ? false : 'Microsoft Edge not found',
    timeout: 120000,
  },
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ evalJs }) => {
      const result = await evalJs(`(async()=>{
      const paths=[];
      for(const tribute of [false,true]) {
        const context=new OfflineAudioContext(2,4096,32000);
        const prelude=URL.createObjectURL(new Blob([
          "const original=globalThis.registerProcessor;globalThis.registerProcessor=(name,Processor)=>{"+
          "class Fixture extends Processor{constructor(options){super(options);"+
          "this.port.onmessage({data:{original:new Int16Array(8192).fill(12000),effects:new Int16Array(8192).fill(3000)}});"+
          "this.port.onmessage({data:{command:'tribute-active',active:options.processorOptions.tribute}});}}"+
          "original(name,Fixture);globalThis.registerProcessor=original;};"
        ],{type:'text/javascript'}));
        await context.audioWorklet.addModule(prelude);URL.revokeObjectURL(prelude);
        await context.audioWorklet.addModule('/src/browser/audio-worklet.mjs');
        const node=new AudioWorkletNode(context,'snes-audio',{numberOfInputs:0,outputChannelCount:[2],processorOptions:{analogEnabled:false,tribute}});
        node.connect(context.destination); const buffer=await context.startRendering();
        paths.push(Array.from(buffer.getChannelData(0).slice(2048)));
      } return paths;
    })()`);
      for (const [i, value] of [12000, 3000].entries())
        assert.ok(
          result[i].every((sample) => Math.abs(sample - (value / 32768) * AUDIO_HEADROOM) < 1e-7),
        );
    });
  },
);

test(
  'all twelve OGG tracks stream in Edge and the player follows stops, pause, switches and failures',
  {
    skip: edge ? false : 'Microsoft Edge not found',
    timeout: 180000,
  },
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 150000 }, async ({ evalJs, logDir }) => {
      const result = await evalJs(`(async()=>{
      const {TributePlayer}=await import('/src/browser/tribute-player.mjs');
      const {TRIBUTE_TRACKS,GAME_SONG_TABLE,TITLE_SONG_TABLE}=await import('/src/browser/tribute-tracks.mjs');
      const context=new AudioContext({sampleRate:32000});await context.resume();
      const wait=async(check,label)=>{const end=performance.now()+10000;while(!check()){
        if(performance.now()>end)throw Error(label);await new Promise(r=>setTimeout(r,25));}};
      const player=new TributePlayer(context,{enabled:true});const streamed=[];
      let revision=0;
      for(const [table,song] of [[TITLE_SONG_TABLE,2],...Object.keys(TRIBUTE_TRACKS).map(Number).map(s=>[GAME_SONG_TABLE,s])]) {
        player.update({table,song,revision:++revision,repeat:true,playing:true,volume:1});
        await wait(()=>player.active||player.error,'start '+song);if(player.error)throw Error(player.error);
        const media=player.entry.media;
        await wait(()=>media.currentTime>0.1,'stream '+song);
        streamed.push({song,duration:media.duration,time:media.currentTime});
      }
      const current=player.entry.media;
      const pauseEvent=new Promise(resolve=>current.addEventListener('pause',resolve,{once:true}));
      player.setEnabled(false);await pauseEvent;const before=current.currentTime;
      await new Promise(r=>setTimeout(r,80));
      const stopped=current.currentTime===before&&current.paused&&!player.active;
      player.setEnabled(true);await wait(()=>player.active,'resume');
      const retained=current.currentTime>=before;
      player.setPaused(true);const paused=current.paused;
      player.setPaused(false);await wait(()=>player.active,'unpause');
      player.update({table:GAME_SONG_TABLE,song:11,revision:++revision,repeat:true,playing:true,volume:1});
      const fallback=!player.active&&player.entry===null;
      player.update({table:GAME_SONG_TABLE,song:1,revision:++revision,repeat:true,playing:true,volume:1});
      await wait(()=>player.active,'street before punk');const street=player.entry.media;
      await wait(()=>street.currentTime>0.1,'street playback');
      const streetAt=street.currentTime;
      player.update({table:GAME_SONG_TABLE,song:0,revision:++revision,repeat:false,playing:false,volume:1});
      player.update({table:GAME_SONG_TABLE,song:1,revision:++revision,repeat:true,playing:true,volume:1});
      await wait(()=>player.active,'street after punk');
      const punkResumed=street===player.entry.media&&street.currentTime>=streetAt;
      street.currentTime=12.75;
      await wait(()=>player.active&&street.currentTime>=12.75&&street.readyState>=3,'seek street before different dialog');
      // Release unloads the retired element, which can cancel its queued pause
      // event and reset its currentTime. Observe the cursor before switching.
      const savedStreet=street.currentTime;
      player.update({table:GAME_SONG_TABLE,song:10,revision:++revision,repeat:true,playing:true,volume:1});
      await wait(()=>player.active,'different dialog');const dialog=player.entry.media;
      dialog.currentTime=7.25;
      await wait(()=>player.active&&dialog.currentTime>=7.25&&dialog.readyState>=3,'seek dialog');
      const savedDialog=dialog.currentTime;
      player.update({table:GAME_SONG_TABLE,song:1,revision:++revision,repeat:true,playing:true,volume:1});
      await wait(()=>player.active,'return street after different dialog');
      const streetRestored=player.entry.media.currentTime;
      const dialogPositionRestored=street.paused&&dialog.paused&&streetRestored>=savedStreet&&streetRestored-savedStreet<0.5;
      player.update({table:GAME_SONG_TABLE,song:10,revision:++revision,repeat:true,playing:true,volume:1});
      await wait(()=>player.active,'return dialog');
      const dialogRestored=player.entry.media.currentTime;
      const independentPositions=dialogRestored>=savedDialog&&dialogRestored-savedDialog<0.5;
      player.update({table:TITLE_SONG_TABLE,song:1,revision:++revision,repeat:false,playing:true,volume:1});
      await wait(()=>player.active,'combined intro');const combined=player.entry.media;
      await wait(()=>combined.currentTime>0.1,'combined stream');
      player.update({table:TITLE_SONG_TABLE,song:0,revision:++revision,repeat:false,playing:false,volume:1});
      const combinedAt=combined.currentTime;
      player.update({table:TITLE_SONG_TABLE,song:2,revision:++revision,repeat:false,playing:true,volume:1});
      await wait(()=>player.active,'combined menu');
      const titleContinued=combined===player.entry.media&&combined.currentTime>=combinedAt;
      const everyCueLoops=combined.loop;
      const lastTime=combined.duration-0.04;combined.currentTime=lastTime;
      await wait(()=>combined.currentTime<1&&player.active,'loop instead of timeout');
      const looped=player.entry.media===combined&&player.active;
      player.update({table:TITLE_SONG_TABLE,song:3,revision:++revision,repeat:false,playing:true,volume:1});
      const shootingStopsTitle=combined.paused&&player.entry===null&&!player.active;
      player.update({table:GAME_SONG_TABLE,song:7,revision:++revision,repeat:true,playing:true,volume:1});
      await wait(()=>player.active,'morgue');
      player.entry.media.src='/assets/tribute/missing.ogg';player.entry.media.load();
      await wait(()=>!!player.error,'missing fallback');const failed=!player.active;
      player.close();await context.close();
      return {streamed,stopped,retained,paused,fallback,punkResumed,dialogPositionRestored,independentPositions,titleContinued,everyCueLoops,looped,shootingStopsTitle,failed};
    })()`);
      assert.equal(result.streamed.length, 12);
      assert.ok(result.streamed.every((track) => track.duration > 60 && track.time > 0));
      for (const key of [
        'stopped',
        'retained',
        'paused',
        'fallback',
        'punkResumed',
        'dialogPositionRestored',
        'independentPositions',
        'titleContinued',
        'everyCueLoops',
        'looped',
        'shootingStopsTitle',
        'failed',
      ])
        assert.equal(result[key], true, key);
      console.log(JSON.stringify({ tracks: result.streamed.length, logDir }));
    });
  },
);

test(
  'the audio option persists and switches the running game, worklet and pause state',
  {
    skip: edge ? false : 'Microsoft Edge not found',
    timeout: 180000,
  },
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 150000 }, async ({ evalJs, cdp, logDir }) => {
      assert.equal(
        await evalJs("document.querySelector('#soundtrack').textContent"),
        'Soundtrack: Tribute',
      );
      assert.equal(await evalJs("document.querySelector('#tribute-volume').value"), '25');
      await evalJs(`(()=>{const slider=document.querySelector('#tribute-volume');
        slider.value='35';slider.dispatchEvent(new Event('input'));})()`);
      assert.equal(await evalJs("localStorage.getItem('shadowrun.soundtrack.volume.1')"), '0.35');
      await evalJs("document.querySelector('#menu-toggle').click()");
      await evalJs("document.querySelector('#audio-settings-open').click()");
      const sliderVisible =
        await evalJs(`(()=>{const slider=document.querySelector('#tribute-volume'),
        rect=slider.getBoundingClientRect(),style=getComputedStyle(slider);
        return rect.width>100&&rect.height>10&&style.opacity==='1'&&style.position==='static';})()`);
      assert.equal(
        sliderVisible,
        true,
        'the volume slider is visibly rendered, not hidden by the file-input rule',
      );
      assert.equal(await evalJs("localStorage.getItem('shadowrun.soundtrack.1')"), null);
      await cdp.call('Page.reload');
      await new Promise((resolve) => setTimeout(resolve, 250));
      await evalJs(`new Promise((resolve,reject)=>{const end=Date.now()+20000;const check=()=>{
      if(document.querySelector('#screen')?.dataset.stage==='data')resolve(true);
      else if(Date.now()>end)reject(Error('reload'));else setTimeout(check,25);};check();})`);
      assert.equal(
        await evalJs("document.querySelector('#soundtrack').getAttribute('aria-pressed')"),
        'true',
      );
      assert.equal(await evalJs("document.querySelector('#tribute-volume').value"), '35');
      await evalJs(`(()=>{const NativeWorker=window.Worker;
        const NativeAudio=window.Audio;window.tributeMedia=[];
        window.Audio=function(...args){const media=new NativeAudio(...args);tributeMedia.push(media);return media;};
        window.menuEffectsPeak=0;window.menuOriginalPeak=0;window.menuFrames=0;
        window.Worker=class extends NativeWorker{constructor(...args){super(...args);
          this.addEventListener('message',({data})=>{
            if(!data.frame||data.music?.table!==0x7674||data.music.song!==2)return;
            window.menuFrames++;
            for(const s of data.effects)window.menuEffectsPeak=Math.max(window.menuEffectsPeak,Math.abs(s));
            for(const s of data.audio)window.menuOriginalPeak=Math.max(window.menuOriginalPeak,Math.abs(s));
          });}};})()`);
      await evalJs("document.querySelector('#start').click()");
      const wait = (condition) =>
        evalJs(`new Promise((resolve,reject)=>{const end=Date.now()+100000;const check=()=>{
      const data=document.querySelector('#screen').dataset;
      if(data.error||data.audioError)reject(Error(JSON.stringify({...data})));
      else if(${condition})resolve({...data});else if(Date.now()>end)reject(Error('wait: '+JSON.stringify({...data})));
      else setTimeout(check,25);};check();})`);
      await wait("data.tributeActive==='true'&&data.soundtrack==='tribute'");
      const first = await evalJs("({...document.querySelector('#screen').dataset})");
      assert.equal(first.tributeTrack, 'Main Theme');
      assert.equal(
        await evalJs(
          "tributeMedia.length>0&&tributeMedia.every(media=>media.src.startsWith('blob:'))",
        ),
        true,
        'the actual game page uses its preloaded main theme',
      );
      await evalJs("document.querySelector('#soundtrack').click()");
      await wait("data.tributeActive==='false'");
      await evalJs("document.querySelector('#soundtrack').click()");
      await wait("data.tributeActive==='true'&&data.soundtrack==='tribute'");
      await evalJs("dispatchEvent(new KeyboardEvent('keydown',{code:'KeyP'}))");
      await wait("data.paused==='true'&&data.soundtrack==='original'");
      await evalJs("dispatchEvent(new KeyboardEvent('keydown',{code:'KeyP'}))");
      const last = await wait("data.paused==='false'&&data.tributeActive==='true'");
      assert.ok(Number(last.nmi) >= Number(first.nmi));
      assert.equal(last.audioError, undefined);
      await evalJs(`(()=>{const slider=document.querySelector('#tribute-volume');
        slider.value='10';slider.dispatchEvent(new Event('input'));})()`);
      assert.equal(await evalJs("localStorage.getItem('shadowrun.soundtrack.volume.1')"), '0.1');
      await wait("data.tributeActive==='true'&&window.menuFrames>=180");
      const menu = await evalJs(
        '({effects:window.menuEffectsPeak,original:window.menuOriginalPeak})',
      );
      assert.equal(
        menu.effects,
        0,
        'neither sequenced menu notes nor command-based musical accents leak',
      );
      assert.ok(menu.original > 0, 'the original mix still runs for switching back');
      console.log(JSON.stringify({ first: first.nmi, last: last.nmi, logDir }));
    });
  },
);
