# Using a Dockerfile instead of Railway's default build specifically because
# better-sqlite3 compiles/downloads a native binary tied to a particular OS +
# CPU + C library + Node ABI combination. A single Dockerfile guarantees the
# exact same environment builds AND runs the app.
#
# Node version is pinned to 22, not left to float on a "20" or "lts" tag:
# better-sqlite3 v13 (an N-API rewrite) hard-requires Node >=22 — anything
# older fails to load its native binary, including as a segmentation fault
# in some cases rather than a clean error. node-cron also requires >=20, so
# 22 satisfies both.
FROM node:22-bookworm-slim

WORKDIR /app

# python3/make/g++ are node-gyp's fallback toolchain, used only if
# better-sqlite3 can't fetch a matching prebuilt binary for this platform —
# having them here means that fallback can't fail the build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
