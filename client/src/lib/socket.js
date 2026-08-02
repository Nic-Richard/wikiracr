import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const GUEST_USER = { userId: null, username: 'Guest', isPro: false };

let socket = null;
let authKey = '';

function makeAuth(user = null, token = null) {
  return { user: user || GUEST_USER, token: token || null };
}

function keyFor(auth) {
  return auth.user?.userId || 'guest';
}

export function getSocket(user = null, token = null) {
  if (!socket) {
    const auth = makeAuth(user, token);
    authKey = keyFor(auth);
    socket = io(SERVER_URL, { autoConnect: false, auth });
  }
  return socket;
}

export function connectSocket(user, token = null) {
  const s = getSocket(user, token);
  const auth = makeAuth(user, token);
  const nextKey = keyFor(auth);

  if (s.connected && authKey !== nextKey) {
    s.disconnect();
  }

  s.auth = auth;
  authKey = nextKey;
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
  socket = null;
  authKey = '';
}
