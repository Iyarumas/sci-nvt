FROM node:24-alpine AS builder

WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci --workspace=backend --include-workspace-root

COPY backend backend
RUN npm run build --workspace=backend

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci --omit=dev --workspace=backend --include-workspace-root \
  && npm cache clean --force

COPY --from=builder /app/backend/dist backend/dist
COPY --from=builder /app/backend/database backend/database
COPY --from=builder /app/backend/scripts backend/scripts

WORKDIR /app/backend
EXPOSE 3333

CMD ["node", "dist/main.js"]

