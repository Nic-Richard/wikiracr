import { io } from 'socket.io-client';
import { NATIVE_APP, API_ORIGIN } from './platform';

const SERVER_URL = NATIVE_APP ? API_ORIGIN : (import.meta.env.VITE_SERVER_URL || window.location.origin);
const GUEST_USER = { userId: null, username: 'Guest', isPro: false };

let socket = null;
let authKey = '';
let tokenGetter = null;
export function setSocketTokenGetter(getter) { tokenGetter = getter; }
export function resumeSocket() { if (socket && !socket.connected) socket.connect(); }

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

  s.auth = NATIVE_APP ? callback => {
    if (!auth.user?.userId) return callback(auth);
    Promise.resolve(tokenGetter ? tokenGetter() : token).then(fresh => callback({ ...auth, token: fresh })).catch(() => callback({ ...auth, token: null }));
  } : auth;
  authKey = nextKey;
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
  socket = null;
  authKey = '';
}
