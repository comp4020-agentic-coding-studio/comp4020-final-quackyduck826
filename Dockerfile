# syntax = docker/dockerfile:1

# Node runs the TypeScript server directly, and the client is plain static
# files. The one runtime dependency is `ws`, for the crit 9 multiplayer
# WebSocket layer — everything else is still native/unbundled. Serves HTTP on
# 0.0.0.0:$PORT and publishes README.md at /readme/.
FROM docker.io/library/node:24-alpine
WORKDIR /app
# Pinned to match mise.toml's pnpm version, rather than corepack's own
# version resolution (there's no packageManager field in package.json).
RUN npm install -g pnpm@11.9.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY src/server ./src/server
COPY public ./public
COPY README.md ./
COPY docs ./docs
ENV PORT=8080
CMD ["node", "src/server/index.ts"]
