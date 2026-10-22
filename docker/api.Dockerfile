FROM node:20-bookworm-slim

WORKDIR /app
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci --omit=dev --no-audit --no-fund
COPY server/src server/src
COPY server/scripts server/scripts
COPY data/pairs.db data/higherlower_articles.json data/

# SQLite needs a writable folder beside each database for its WAL files.
RUN mkdir -p /app/state && chown -R node:node /app/data /app/state

ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/app/data/pairs.db \
    HIGHERLOWER_PATH=/app/data/higherlower_articles.json \
    APP_DB_PATH=/app/state/app.db

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD node -e "fetch('http://127.0.0.1:3001/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "server/src/index.js"]
