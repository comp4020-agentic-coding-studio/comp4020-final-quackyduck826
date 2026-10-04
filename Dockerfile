# syntax = docker/dockerfile:1

# Zero runtime dependencies: Node runs the TypeScript server directly, and the
# client is plain static files. Serves HTTP on 0.0.0.0:$PORT and publishes
# README.md at /readme/.
FROM docker.io/library/node:24-alpine
WORKDIR /app
COPY src/server ./src/server
COPY public ./public
COPY README.md ./
COPY docs ./docs
ENV PORT=8080
CMD ["node", "src/server/index.ts"]
