# Deploying casket on Fleet

Casket deploys as a **stack** of three services from this single repo:

| Service | Image | Role |
|---|---|---|
| `casket` | built from this repo's `Dockerfile` | the app |
| `mongo` | `mongo:7` (pulled) | database |
| `redis` | `redis:7-alpine` (pulled) | cache / queue |

When you push this repo at Fleet, it detects `docker-compose.yml`, builds the
`casket` service from the Dockerfile, pulls the two pre-built images, and
brings them all up as one stack in a private namespace. Internal DNS handles
inter-service connectivity — `casket` reaches `mongo` and `redis` by name.

Same `docker-compose.yml` works for local dev (`docker compose up`).

## One-time setup on Fleet

1. Deploy via **GitHub** (or paste a public repo URL on the deploy page) and
   point at this repo's `main` branch.
2. **Domain:** set `casket.<yourdomain>` (or whatever you like) on the
   `casket` service. Fleet's Traefik handles TLS via Let's Encrypt.
3. **Target port:** `3001` on `casket`. Mongo and Redis stay internal — leave
   them with no public port / domain.
4. **Override `host` env var** on the `casket` service to your public URL
   (e.g. `https://casket.yourdomain.com`). Used for OAuth callbacks and
   absolute-URL generation inside the app.
5. **Change the Mongo password** before going live — see below.

### Changing the Mongo password

The compose file ships with `root` / `example` so local dev just works. For
anything real, change `MONGO_INITDB_ROOT_PASSWORD` on the **mongo** service
AND the matching `mongodb` URL on the **casket** service in Fleet's env-vars
tab. Both have to agree. (Mongo only honours `MONGO_INITDB_ROOT_PASSWORD`
on the very first boot — to rotate it later you'll need to `mongosh` in.)

## Required env vars (all set in `docker-compose.yml`, override on Fleet as needed)

On the **casket** service:

| Var | Default | Notes |
|---|---|---|
| `NODE_ENV` | `production` | |
| `port` | `3001` | `PORT` (uppercase) also accepted |
| `host` | `http://localhost:3001` | **Override to your public URL.** |
| `mongodb` | `mongodb://root:example@mongo:27017/casket?authSource=admin` | Override if you change the Mongo password. |
| `redis` | `redis://redis:6379` | |
| `lang` | `en, no` | |
| `webmaster` | `true` | |

On the **mongo** service:

| Var | Default | Notes |
|---|---|---|
| `MONGO_INITDB_ROOT_USERNAME` | `root` | |
| `MONGO_INITDB_ROOT_PASSWORD` | `example` | **Change before going live.** |

Redis has no required env vars.

## Persistent storage

All three services declare a named volume in `docker-compose.yml`:

| Volume | Mount | Service |
|---|---|---|
| `casket_data` | `/usr/casket_volume` | casket |
| `mongo_data` | `/data/db` | mongo |
| `redis_data` | `/data` | redis |

Fleet provisions a PersistentVolumeClaim for each one. They survive redeploys
and image rebuilds.

## What changed vs the previous setup

- **Dockerfile** rewritten: pinned to `node:22-slim` (much smaller, reproducible),
  drops `vim`/`nano`/`forever`/`vite` global installs, uses `npm ci --omit=dev`
  instead of `npm i`, and **no longer renames `.env.docker` → `.env`** (that
  was the build failure — env is now injected via the platform, not baked in).
- **`.dockerignore`** expanded to keep `.env*`, `server.crt`/`server.key`,
  `.git`, `node_modules`, and local data dirs out of the image.
- **`src/index.js`** accepts both `port` (this repo's historical name) and
  `PORT` (the standard PaaS convention).
- **`docker-compose.yml`** cleaned: dropped `version: "3"` (obsolete),
  removed `container_name` (Fleet manages names), pinned image versions,
  switched the public port from `80/443` to `3001` (Traefik handles edge TLS),
  removed the deprecated `links:` directive.
