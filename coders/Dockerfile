FROM node:26-slim AS manifests
RUN npm install -g pnpm@11.28.2
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY apps/server/package.json ./apps/server/package.json
COPY apps/client/package.json ./apps/client/package.json
COPY packages/editor-ext/package.json ./packages/editor-ext/package.json
COPY packages/base-formula/package.json ./packages/base-formula/package.json

FROM manifests AS dependencies
RUN pnpm install --prod --frozen-lockfile --filter '!./apps/client'

FROM manifests AS builder
RUN pnpm install --frozen-lockfile
COPY . .
RUN test ! -d apps/client/src/ee && test ! -d packages/ee && test ! -f apps/server/src/ee/ee.module.ts
RUN pnpm --filter @docmost/editor-ext build && pnpm --filter @docmost/base-formula build
RUN pnpm --filter server build

FROM node:26-slim AS runtime
ARG SOURCE_URL
ARG REVISION
RUN test -n "$SOURCE_URL" && test -n "$REVISION"
WORKDIR /app
ENV CODERS_SOURCE_URL=$SOURCE_URL CODERS_REVISION=$REVISION
ENV NODE_ENV=production CODERS_MODE=true CLOUD=false PORT=8080 HOST=0.0.0.0 \
    STORAGE_DRIVER=postgres FILE_UPLOAD_SIZE_LIMIT=5mb FILE_IMPORT_SIZE_LIMIT=5mb \
    DATABASE_MAX_POOL=4 DISABLE_TELEMETRY=true COLLAB_DISABLE_REDIS=true \
    HOME=/tmp TMPDIR=/tmp
COPY --from=dependencies /app/node_modules /app/node_modules
COPY --from=dependencies /app/apps/server/node_modules /app/apps/server/node_modules
COPY --from=dependencies /app/packages /app/packages
COPY --from=builder /app/apps/server/dist /app/apps/server/dist
COPY --from=builder /app/packages/editor-ext/dist /app/packages/editor-ext/dist
COPY --from=builder /app/packages/base-formula/dist /app/packages/base-formula/dist
COPY apps/server/package.json /app/apps/server/package.json
COPY scripts/coders/start.cjs /app/scripts/coders/start.cjs
COPY LICENSE /app/LICENSE
COPY NOTICE.coders.md /app/NOTICE.coders.md
USER 65534:65534
EXPOSE 8080
CMD ["node", "scripts/coders/start.cjs"]
