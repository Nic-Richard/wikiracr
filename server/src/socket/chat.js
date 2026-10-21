const { randomUUID } = require('node:crypto');

const REASONS = new Set(['Harassment', 'Hate or threats', 'Sexual content', 'Spam', 'Other']);

function setupChat(io, socket, { getRoom, saveReport, sendAlert }) {
  let lastMessageAt = 0;
  let reports = 0;
  let reportWindow = Date.now();
  const reported = new Set();

  socket.on('chat-message', (payload = {}) => {
    const room = getRoom(socket.id);
    if (!room || typeof payload?.text !== 'string' || payload.termsVersion !== '2026-10-20') return;
    const text = payload.text.trim().slice(0, 200);
    const at = Date.now();
    if (!text || at - lastMessageAt < 750) return;
    lastMessageAt = at;
    const message = {
      id: randomUUID(), socketId: socket.id, userId: socket.user.userId || null,
      username: socket.user.username, text, at,
    };
    room.recentChat = [...(room.recentChat || []), message].slice(-100);
    io.to(room.code).emit('chat-message', message);
  });

  socket.on('report-chat', (payload = {}, reply) => {
    if (typeof reply !== 'function') return;
    const room = getRoom(socket.id);
    const message = room?.recentChat?.find(item => item.id === payload?.messageId);
    if (!message || message.socketId === socket.id || (message.userId && message.userId === socket.user.userId)) return reply({ ok: false, error: 'This message is no longer available to report.' });
    if (!REASONS.has(payload.reason)) return reply({ ok: false, error: 'Choose a report reason.' });
    if (reported.has(message.id)) return reply({ ok: true });
    if (Date.now() - reportWindow >= 60 * 60 * 1000) { reports = 0; reportWindow = Date.now(); }
    if (reports >= 10) return reply({ ok: false, error: 'Too many reports. Try again later.' });
    const context = { room: room.code, messageId: message.id, reportedUserId: message.userId, reportedSocketId: message.socketId, username: message.username, text: message.text, at: message.at };
    let reportId;
    try {
      reportId = saveReport({ type: 'player', message: payload.reason, context, userId: socket.user.userId || null });
    } catch {
      return reply({ ok: false, error: 'Could not save the report. Try again.' });
    }
    if (!reportId) return reply({ ok: false, error: 'Account deletion is in progress.' });
    reports += 1;
    reported.add(message.id);
    sendAlert('reports', {
      title: 'Player report', description: payload.reason,
      fields: [{ name: 'Report', value: String(reportId) }, { name: 'From', value: socket.user.userId || 'Guest' }, ...Object.entries(context).map(([name, value]) => ({ name, value: String(value ?? 'Guest').slice(0, 300) }))],
    });
    reply({ ok: true });
  });
}

module.exports = { setupChat };
