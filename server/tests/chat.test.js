const test = require('node:test');
const assert = require('node:assert/strict');
const { setupChat } = require('../src/socket/chat');

function fixture() {
  const room = { code: 'TEST' }, saved = [], alerts = [], events = [];
  const rooms = new Map();
  function player(id) {
    const handlers = {};
    const socket = { id, user: { userId: `user_${id}`, username: id }, on: (event, fn) => { handlers[event] = fn; } };
    rooms.set(id, room);
    setupChat({ to: () => ({ emit: (event, message) => events.push(message) }) }, socket, {
      getRoom: id => rooms.get(id), saveReport: report => saved.push(report), sendAlert: (...args) => alerts.push(args),
    });
    return handlers;
  }
  return { room, rooms, saved, alerts, events, player };
}

test('reports preserve server evidence, ignore forged fields, and deduplicate', () => {
  const f = fixture(), sender = f.player('alice'), reporter = f.player('bob');
  sender['chat-message']({ text: 'A message' });
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
  sender['chat-message']({ text: 'A message' });
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
  sender['chat-message']({ text: 'x'.repeat(300) });
  sender['chat-message']({ text: 'too soon' });
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].text.length, 200);
  assert.equal(f.room.recentChat.length, 100);
});

test('limits reports and refuses to acknowledge failed storage', () => {
  const f = fixture(), reporter = f.player('bob');
  f.room.recentChat = Array.from({ length: 11 }, (_, id) => ({ id: String(id), socketId: 'alice', userId: 'user_alice', username: 'Alice', text: 'Message', at: 1 }));
  for (let id = 0; id < 11; id++) {
    reporter['report-chat']({ messageId: String(id), reason: 'Spam' }, result => assert.equal(result.ok, id < 10));
  }
  assert.equal(f.saved.length, 10);
  const handlers = {};
  setupChat({}, { id: 'charlie', user: {}, on: (event, fn) => { handlers[event] = fn; } }, {
    getRoom: () => f.room, saveReport: () => { throw new Error('Disk unavailable'); }, sendAlert: () => assert.fail('Do not alert before saving'),
  });
  handlers['report-chat']({ messageId: '0', reason: 'Spam' }, result => assert.equal(result.ok, false));
});
