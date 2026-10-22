# Docker

Production still runs on the VPS with PM2 and nginx. These containers make a later move
(AWS ECS, Lightsail or another host) a matter of pushing images and setting environment
variables.

- `api`: the Node server as the non-root `node` user. `pairs.db` and the Higher or Lower
  list are baked into the image; player data (`app.db`) lives on the `state` volume.
- `web`: nginx serving the prerendered site and proxying `/api` and `/socket.io` to `api`.
  TLS ends in front of it (load balancer, Cloudflare or a host nginx).

```sh
cp .env.docker.example .env.docker   # fill in Clerk, Stripe and alert keys
VITE_CLERK_PUBLISHABLE_KEY=pk_... docker compose up --build -d
```

The site is on `http://localhost:8080` (`WEB_PORT` changes it). Set `CLIENT_URL` to the
public origin so CORS and Socket.IO accept it.

Moving production: copy `/var/www/wikiracr/data/app.db` into the `state` volume with
SQLite's backup API while the API is stopped, then point DNS or the load balancer at `web`.
A new `pairs.db` means a new `api` image.
