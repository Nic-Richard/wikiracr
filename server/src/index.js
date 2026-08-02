const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initDb } = require('./db');
const { setupSocketHandlers } = require('./socket/handlers');
const apiRouter = require('./routes/api');
const log = require('./lib/logger');

process.on('unhandledRejection', (reason) => {
  log.error('[process] unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  log.error('[process] uncaught exception:', err);
});

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const CLIENT_URL_MATCH = CLIENT_URL.match(/^(https?:\/\/)(www\.)?(.+)$/);
const ALLOWED_ORIGINS = CLIENT_URL_MATCH
  ? [`${CLIENT_URL_MATCH[1]}${CLIENT_URL_MATCH[3]}`, `${CLIENT_URL_MATCH[1]}www.${CLIENT_URL_MATCH[3]}`]
  : [CLIENT_URL];

function checkOrigin(origin, callback) {
  if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
  log.debug('[cors] rejected origin:', origin);
  callback(new Error('Not allowed by CORS'));
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: checkOrigin,
    credentials: true,
  },
});

app.use(cors({
  origin: checkOrigin,
  credentials: true,
}));

app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/stripe/webhook')) {
    return next();
  }
  return express.json()(req, res, next);
});

app.use('/api', apiRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use('/api', (err, req, res, next) => {
  log.error('[api] unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong' });
});

app.get('/health', (req, res) => res.json({ ok: true }));

setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;

initDb().then(() => {
  server.listen(PORT, () => {
    log.info(`Server running on port ${PORT}`);
  });
}).catch(err => {
  log.error('Failed to initialize database:', err);
  process.exit(1);
});
