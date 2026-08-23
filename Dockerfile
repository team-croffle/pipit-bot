FROM node:22-bookworm-slim AS builder

ENV HUSKY=0

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-setuptools \
    make \
    g++ && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare yarn@4.18.0 --activate

WORKDIR /app

COPY .yarn ./.yarn
COPY .yarnrc.yml package.json yarn.lock ./
COPY dashboard/package.json ./dashboard/package.json
RUN yarn install --immutable

COPY . .
RUN yarn build && yarn dashboard:build && \
    YARN_ENABLE_IMMUTABLE_INSTALLS=false yarn workspaces focus --all --production

FROM node:22-bookworm-slim

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dashboard/dist ./dashboard/dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV STREAM_ROOT=/streams
ENV API_PORT=3000

RUN mkdir -p /streams /app/data && chown -R node:node /app /streams

USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]
