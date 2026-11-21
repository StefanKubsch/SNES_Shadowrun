import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviceAccess } from '../src/vm/device-access.mjs';
import { VmMemory } from '../src/vm/memory.mjs';

const fixture = () =>
  new DeviceAccess({ mem: new VmMemory(new Uint8Array(0x100000), new Uint8Array(0x20000)) });

test('device services enforce observation order and bank aliases without CPU state', () => {
  const a = fixture(),
    calls = [];
  assert.equal('ctx' in a, false);
  a.io = [{ address: 0x80213d, pc: 0x80c560, width: 1, value: 23 }];
  a.devices = {
    read: (...args) => {
      calls.push(args);
      return 42;
    },
  };
  for (const [address, width, pc] of [
    [0x213c, 1, 0x80c560],
    [0x213d, 2, 0x80c560],
    [0x213d, 1, 0],
  ])
    assert.throws(() => a.busRead(address, width, pc, true), {
      reason: 'device_observation_required',
    });
  assert.equal(a.ioIndex, 0);
  assert.equal(calls.length, 0);
  assert.equal(a.busRead(0x213d, 1, 0x80c560, true), 23);
  assert.equal(a.busRead(0x213c, 1, 0x80c560, true), 42);
  assert.deepEqual(calls, [[0x213c, 1, 0x80c560]]);
  a.io = null;
  assert.throws(() => a.busRead(0x213c, 1), { reason: 'device_observation_required' });
});

test('device services retain memory, arithmetic, write and trace boundaries', () => {
  const a = fixture(),
    writes = [];
  a.busWrite(0x7e1fff, 0xabcd, 2);
  assert.equal(a.busRead(0x7e1fff, 2), 0xabcd);
  a.trace = [];
  a.busWrite(0x4202, 7, 1);
  a.busWrite(0x4203, 9, 1);
  assert.equal(a.busRead(0x4216, 2), 63);
  a.observeArithmetic = true;
  a.io = [{ address: 0x4216, pc: 4, width: 2, value: 99 }];
  assert.equal(a.busRead(0x4216, 2, 4), 99);
  assert.throws(() => a.busWrite(0x2140, 12, 1, 7), { reason: 'device_write_unbound' });
  a.devices = { write: (...args) => writes.push(args) };
  a.busWrite(0x2140, 12, 1, 7);
  assert.deepEqual(writes, [[7, 0x2140, 12, 1]]);
  assert.deepEqual(a.trace.at(-1), { kind: 'write', pc: 7, address: 0x2140, value: 12, width: 1 });
});
