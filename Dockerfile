# syntax=docker/dockerfile:1.7
#
# Production image for Fleet (siglar.com) deploys.
# Local dev still uses docker-compose.yml (which builds with this same Dockerfile).
#
# Env vars are injected by Fleet at runtime — do NOT bake a .env into the image.
# Required vars are documented in README_FLEET.md.

FROM node:22-slim

WORKDIR /usr/casket
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    port=3001

# Install dependencies first (separate layer = better build cache when source
# changes but deps don't). pm2 is installed globally because CMD uses
# pm2-runtime; vite/forever/vim/nano from the old Dockerfile are dropped —
# none of them are needed at runtime.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm install -g pm2 \
    && rm -rf /root/.npm

# Now the source. .dockerignore keeps .env, server.crt/key, .git, etc. out.
COPY . .

# Belt-and-braces: any local .env that slipped past .dockerignore would override
# the Fleet-injected env. Strip them on every build.
RUN rm -f .env .env.docker .env.example .env.docker.example

EXPOSE 3001

# pm2-runtime keeps the process alive and forwards signals correctly for
# Kubernetes / Docker stop semantics. src/index.js does its own Node `cluster`
# forking — pm2 here is just a supervisor.
CMD ["pm2-runtime", "src/index.js"]
