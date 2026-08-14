FROM node:24-alpine AS builder

WORKDIR /app
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci --workspace=frontend --include-workspace-root

COPY frontend frontend
ARG BUILD_COMMIT=local
ENV BUILD_COMMIT=${BUILD_COMMIT}
RUN npm run build --workspace=frontend

FROM caddy:2-alpine

ARG BUILD_COMMIT=local
ENV BUILD_COMMIT=${BUILD_COMMIT}
LABEL org.opencontainers.image.revision=${BUILD_COMMIT}

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/frontend/dist /srv
RUN printf '{"commit":"%s"}\n' "$BUILD_COMMIT" > /srv/build-info.json

EXPOSE 80 443
