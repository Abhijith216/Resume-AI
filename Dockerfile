# ResumeAI — production image
#
# sql.js is pure WASM (no native build needed), but Puppeteer downloads
# Chromium for PDF export. On Alpine we use the system Chromium instead,
# which keeps the image small and avoids glibc issues.

FROM node:22-alpine AS base

# Chromium + fonts for Puppeteer PDF rendering
RUN apk add --no-cache chromium ca-certificates ttf-freefont

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# App source
COPY server ./server
COPY public ./public

# Non-root user; /data is where the persistent volume mounts
RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /data && chown -R app:app /data /app
USER app

ENV DATA_DIR=/data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server/index.js"]
