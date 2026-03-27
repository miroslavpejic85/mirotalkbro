# Build stage - compile mediasoup worker and bundle mediasoup-client
FROM node:22-slim AS build

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
FROM node:22-slim

WORKDIR /src

ENV NODE_ENV="production"

# Copy node_modules with compiled mediasoup worker (production deps only)
COPY --from=build /src/node_modules /src/node_modules

# Copy application files
COPY package*.json .
COPY .env.template ./.env
COPY app app
COPY public public

# Copy freshly built mediasoup-client bundle (overwrite repo version)
COPY --from=build /src/public/js/mediasoup-client.js /src/public/js/mediasoup-client.js

# Set default command to start the application
CMD ["npm", "start"]