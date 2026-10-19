import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';

function fixture(connected = true) {
  const socket = new EventEmitter();
  Object.assign(socket, { connected, id: 'current-socket' });
  const joins = [], state = {};
  let room = { state: 'lobby', players: [] }, cancelled = false;
  socket.timeout = () => ({ emit: (event, payload, callback) => { joins.push({ event, payload }); callback(null, { ok: true, state: room }); } });
  const source = readFileSync(new URL('../src/lib/gameSocket.js', import.meta.url), 'utf8')
    .replace("import { connectSocket } from './socket';", '')
    .replace('export async function', 'async function');
  const context = vm.createContext({ connectSocket: () => socket, Date });
  vm.runInContext(source, context);
  const args = new Proxy({ code: 'TEST', user: null, isPro: false, getToken: async () => null, socketRef: {}, startTimeRef: {}, isCancelled: () => cancelled }, {
    get: (target, key) => key in target ? target[key] : key.startsWith('set') ? value => { state[key] = value; } : () => {},
  });
  return { socket, joins, state, args, start: () => context.connectMultiplayerRoom(args), room: value => { room = value; }, cancel: () => { cancelled = true; } };
}

test('room joins once initially and restores authoritative progress after reconnect', async () => {
  const f = fixture();
  await f.start();
  assert.equal(f.joins.length, 1);
  f.room({ state: 'playing', startTime: Date.now() - 12000, pair: { startTitle: 'Alpha', endTitle: 'Charlie', pathLength: 2 }, players: [{ socketId: 'current-socket', path: ['Alpha', 'Bravo'], clicks: 1 }] });
  f.socket.emit('connect');
  assert.equal(f.joins.length, 2);
  assert.equal(f.joins[1].payload.code, 'TEST');
  assert.deepEqual([...f.state.setNavHist], ['Alpha', 'Bravo']);
  assert.equal(f.state.setClicks, 1);
  assert.equal(f.state.setHistIdx, 1);
  assert.equal(f.state.setPhase, 'playing');
  assert(f.state.setElapsed >= 12);
});

test('new connections wait for transport and stale initialization cannot rejoin', async () => {
  const f = fixture(false);
  await f.start();
  assert.equal(f.joins.length, 0);
  f.socket.emit('connect');
  assert.equal(f.joins.length, 1);
  f.cancel();
  f.socket.emit('connect');
  assert.equal(f.joins.length, 1);
});
