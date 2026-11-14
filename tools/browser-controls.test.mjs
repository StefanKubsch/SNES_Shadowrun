import test from 'node:test';
import assert from 'node:assert/strict';
import {BACK,BUTTONS,DEFAULT_BINDINGS,bind,bindingsText,bitsFor,captureInput,cleanPad,gamepadBits,keyInputs,parseBindings} from '../src/browser/controls.mjs';

// Pad word bits after Book I PDF 148 (B Y Select Start Up Down Left Right A X L R).
const B=0x8000,Y=0x4000,SELECT=0x2000,START=0x1000,UP=0x0800,DOWN=0x0400,LEFT=0x0200,RIGHT=0x0100,A=0x0080,X=0x0040,L=0x0020,R=0x0010;
const press=(code,key)=>bitsFor(DEFAULT_BINDINGS,keyInputs({code,key}));

test('the pad word bits follow the SNES joypad register',()=>{
  assert.deepEqual(BUTTONS.map(([,bit])=>bit),[B,Y,SELECT,START,UP,DOWN,LEFT,RIGHT,A,X,L,R]);
});
test('the default keys are the user layout: WASD, F=A, X, Y, E=Start, G=Select, mouse L, B and R',()=>{
  assert.deepEqual([press('KeyW','w'),press('KeyA','a'),press('KeyS','s'),press('KeyD','d')],[UP,LEFT,DOWN,RIGHT]);
  assert.deepEqual([press('ArrowUp','ArrowUp'),press('ArrowRight','ArrowRight')],[UP,RIGHT]);
  assert.deepEqual([press('KeyF','f'),press('KeyX','x'),press('KeyE','e'),press('KeyG','g'),press('KeyB','b')],[A,X,START,SELECT,B]);
  // Esc is the back key (mouse-control.mjs: Select in menus), not an SNES button.
  assert.equal(press('Escape','Escape'),0);assert.deepEqual(DEFAULT_BINDINGS[BACK],['code:Escape']);
  // Y by its label: on QWERTZ it is code KeyZ, on QWERTY KeyY.
  assert.equal(press('KeyZ','y'),Y);assert.equal(press('KeyY','y'),Y);assert.equal(press('KeyY','z'),0);
  // Shift does not change the label.
  assert.equal(press('KeyZ','Y'),Y);
  // Left button and Q L (Examine), middle button B (action list), right button R (Use, by context
  // the action list where Use does nothing: mouse-control.mjs useEvent).
  assert.deepEqual([bitsFor(DEFAULT_BINDINGS,['mouse:0']),bitsFor(DEFAULT_BINDINGS,['mouse:1']),bitsFor(DEFAULT_BINDINGS,['mouse:2'])],[L,B,R]);
  assert.equal(press('KeyQ','q'),L);
  assert.equal(press('KeyP','p'),0,'P pauses');
});
test('opposite directions cancel and the low nibble stays clear',()=>{
  assert.equal(cleanPad(UP|DOWN|A),A);assert.equal(cleanPad(LEFT|RIGHT|UP),UP);
  assert.equal(cleanPad(UP|LEFT|0x000F),UP|LEFT);
});
test('a standard gamepad maps by position like the SNES pad, the left stick as directions',()=>{
  const pad=(pressed,axes=[0,0])=>({connected:true,axes,buttons:Array.from({length:17},(_,i)=>({pressed:pressed.includes(i),value:pressed.includes(i)?1:0}))});
  assert.equal(gamepadBits(pad([0])),B);assert.equal(gamepadBits(pad([1])),A);
  assert.equal(gamepadBits(pad([2])),Y);assert.equal(gamepadBits(pad([3])),X);
  assert.equal(gamepadBits(pad([4,5])),L|R);assert.equal(gamepadBits(pad([6,7])),L|R);
  assert.equal(gamepadBits(pad([8,9])),SELECT|START);
  assert.equal(gamepadBits(pad([12,14])),UP|LEFT);assert.equal(gamepadBits(pad([13,15])),DOWN|RIGHT);
  assert.equal(gamepadBits(pad([],[-0.9,0.8])),LEFT|DOWN);assert.equal(gamepadBits(pad([],[0.3,-0.4])),0);
  assert.equal(gamepadBits({...pad([0]),connected:false}),0);assert.equal(gamepadBits(null),0);
});
test('rebinding moves an input to one button and survives storage',()=>{
  assert.equal(captureInput({code:'KeyZ',key:'y'}),'key:y');
  assert.equal(captureInput({code:'Space',key:' '}),'code:Space');
  let bindings=bind(DEFAULT_BINDINGS,'B','key:f');
  assert.deepEqual([bindings.B,bindings.A],[['key:f'],[]]);
  assert.equal(bind(bindings,'A','code:KeyP'),bindings,'P stays reserved');
  const restored=parseBindings(JSON.stringify(bindings));
  assert.deepEqual(restored,bindings);
  assert.deepEqual(parseBindings('{"A":["code:KeyP","nonsense","mouse:1"],"B":7}').A,['mouse:1']);
  assert.deepEqual(parseBindings('broken'),DEFAULT_BINDINGS);
  assert.match(bindingsText(DEFAULT_BINDINGS),/^B=B\/middle mouse button, Y=Y, Select=G, Start=E, Up=W\/↑, .*L=left mouse button\/Q, R=right mouse button, Back=Esc$/);
  assert.deepEqual(bind(DEFAULT_BINDINGS,BACK,'code:Backspace')[BACK],['code:Backspace']);
});
