# Build stage - compile mediasoup worker and bundle mediasoup-client
FROM node:24-slim AS build

WORKDIR /src

# Build mediasoup worker from source for multi-arch support
ENV MEDIASOUP_SKIP_WORKER_PREBUILT_DOWNLOAD="true"

# Install build dependencies for mediasoup worker (C++ compilation)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        python3 \
        python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Copy package files, env template, and public dir (postinstall writes mediasoup-client bundle)
COPY package*.json .
COPY .env.template ./.env
COPY public public

# Install all dependencies (devDeps needed for esbuild postinstall), then prune
RUN npm ci --silent \
    && npm prune --omit=dev \
    && npm cache clean --force

# Production stage - minimal runtime image
FROM node:24-slim

WORKDIR /src

ENV NODE_ENV="production"

# FFmpeg converts RTMP H.264/AAC sources into mediasoup-compatible VP8/Opus RTP.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy node_modules with compiled mediasoup worker (production deps only)
COPY --chown=node:node --from=build /src/node_modules /src/node_modules

# Copy application files, already owned by the runtime user
COPY --chown=node:node package*.json .
COPY --chown=node:node .env.template ./.env
COPY --chown=node:node app app
COPY --chown=node:node public public

# Copy freshly built mediasoup-client bundle (overwrite repo version)
COPY --chown=node:node --from=build /src/public/js/mediasoup-client.js /src/public/js/mediasoup-client.js

# Run as the non-root "node" user (uid/gid 1000) shipped with the base image
USER node

# Set default command to start the application
CMD ["npm", "start"]