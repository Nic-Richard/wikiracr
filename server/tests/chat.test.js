const test = require('node:test');
const assert = require('node:assert/strict');
const { setupChat } = require('../src/socket/chat');

function fixture() {
  const room = { code: 'TEST' }, saved = [], alerts = [], events = [], received = {}, banned = new Set();
  const rooms = new Map(), sockets = new Map([['observer', { user: { userId: 'user_observer' }, emit: (_event, message) => events.push(message) }]]);
  const io = { sockets: { sockets, adapter: { rooms: new Map([['TEST', new Set(['observer'])]]) } } };
  function player(id, user = { userId: `user_${id}`, username: id }) {
    const handlers = {};
    const socket = { id, user, on: (event, fn) => { handlers[event] = fn; }, emit: (_event, message) => (received[id] ||= []).push(message) };
    rooms.set(id, room);
    sockets.set(id, socket);
    io.sockets.adapter.rooms.get('TEST').add(id);
    setupChat(io, socket, {
      getRoom: id => rooms.get(id), saveReport: report => saved.push(report), sendAlert: (...args) => alerts.push(args), chatBanned: userId => banned.has(userId),
    });
    return handlers;
  }
  return { room, rooms, saved, alerts, events, received, banned, player };
}

test('reports preserve server evidence, ignore forged fields, and deduplicate', () => {
  const f = fixture(), sender = f.player('alice'), reporter = f.player('bob');
  sender['chat-message']({ text: 'A message', termsVersion: '2026-10-20' });
  const message = f.events[0];
  assert.equal(message.userId, 'user_alice');
  const payload = { messageId: message.id, reason: 'Harassment', text: 'forged', userId: 'forged' };
  let result;
  reporter['report-chat'](payload, value => { result = value; });
  assert.equal(result.ok, true);
  assert.equal(f.saved[0].context.text, 'A message');
  assert.equal(f.saved[0].context.reportedUserId, 'user_alice');
  assert.equal(f.saved[0].userId, 'user_bob');
  assert.equal(f.alerts[0][0], 'reports');
  reporter['report-chat'](payload, () => {});
  assert.equal(f.saved.length, 1);
});

test('rejects own, missing, cross-room and invalid reports', () => {
  const f = fixture(), sender = f.player('alice'), reporter = f.player('bob');
  sender['chat-message']({ text: 'A message', termsVersion: '2026-10-20' });
  const payload = { messageId: f.events[0].id, reason: 'Spam' };
  const denied = value => assert.equal(value.ok, false);
  sender['report-chat'](payload, denied);
  reporter['report-chat']({ ...payload, messageId: 'missing' }, denied);
  reporter['report-chat']({ ...payload, reason: 'invalid' }, denied);
  f.rooms.set('bob', { code: 'OTHER' });
  reporter['report-chat'](payload, denied);
  assert.equal(f.saved.length, 0);
});

test('bounds messages, throttles spam and rejects malformed payloads', () => {
  const f = fixture(), sender = f.player('alice');
  f.room.recentChat = Array.from({ length: 100 }, (_, id) => ({ id }));
  sender['chat-message'](null);
  sender['chat-message']({ text: {} });
  sender['chat-message']({ text: 'x'.repeat(300), termsVersion: '2026-10-20' });
  sender['chat-message']({ text: 'too soon', termsVersion: '2026-10-20' });
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].text.length, 200);
  assert.equal(f.room.recentChat.length, 100);
});

test('chat rejects missing or outdated rules acknowledgment', () => {
  const f = fixture(), sender = f.player('alice');
  sender['chat-message']({ text: 'No consent' });
  sender['chat-message']({ text: 'Outdated', termsVersion: 'old' });
  assert.equal(f.events.length, 0);
  sender['chat-message']({ text: 'Accepted', termsVersion: '2026-10-20' });
  assert.equal(f.events.length, 1);
});

test('limits reports and refuses to acknowledge failed storage', () => {
  const f = fixture(), reporter = f.player('bob');
  f.room.recentChat = Array.from({ length: 11 }, (_, id) => ({ id: String(id), socketId: 'alice', userId: 'user_alice', username: 'Alice', text: 'Message', at: 1 }));
  for (let id = 0; id < 11; id++) {
    reporter['report-chat']({ messageId: String(id), reason: 'Spam' }, result => assert.equal(result.ok, id < 10));
  }
  assert.equal(f.saved.length, 10);
  const handlers = {};
  setupChat({}, { id: 'charlie', user: { userId: 'user_charlie' }, on: (event, fn) => { handlers[event] = fn; } }, {
    getRoom: () => f.room, saveReport: () => { throw new Error('Disk unavailable'); }, sendAlert: () => assert.fail('Do not alert before saving'),
  });
  handlers['report-chat']({ messageId: '0', reason: 'Spam' }, result => assert.equal(result.ok, false));
});

test('guests cannot chat, read chat or report, and banned players cannot send', () => {
  const f = fixture(), guest = f.player('guest', { userId: null, username: 'Guest' }), alice = f.player('alice');
  const replies = [];
  guest['chat-message']({ text: 'Hello', termsVersion: '2026-10-20' }, value => replies.push(value));
  assert.equal(replies[0].ok, false);
  alice['chat-message']({ text: 'Hi', termsVersion: '2026-10-20' }, value => replies.push(value));
  assert.equal(replies[1].ok, true);
  assert.equal(f.events.length, 1);
  assert.equal(f.received.guest, undefined);
  guest['report-chat']({ messageId: f.events[0].id, reason: 'Spam' }, value => replies.push(value));
  assert.equal(replies[2].ok, false);
  assert.equal(f.saved.length, 0);
  f.banned.add('user_bob');
  const bob = f.player('bob');
  bob['chat-message']({ text: 'Banned', termsVersion: '2026-10-20' }, value => replies.push(value));
  assert.match(replies[3].error, /turned off/);
  assert.equal(f.events.length, 1);
});
