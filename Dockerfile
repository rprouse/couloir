# syntax=docker/dockerfile:1

# --- Build: install everything, build the SPA and bundle the server ---------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Runtime: just Node, the built SPA and the single-file server -----------
# The server bundle inlines its dependencies (vite.server.config.ts), so no
# node_modules are copied.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
# Runs as the image's unprivileged `node` user by default. On Unraid the
# template runs it as nobody:users (99:100) instead, matching appdata ownership.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1
# Exec form, so node is PID 1 and receives SIGTERM from `docker stop` directly.
CMD ["node", "dist-server/main.js"]
