# Multi-stage Dockerfile for NexusOps AI React Frontend (Nginx)
# Build context must be repository root (.) so root .dockerignore is honored.

FROM node:20-alpine AS builder
WORKDIR /app

COPY apps/web/package*.json ./
RUN npm ci

COPY apps/web/index.html apps/web/vite.config.ts ./
COPY apps/web/tsconfig.json apps/web/tsconfig.app.json apps/web/tsconfig.node.json ./
COPY apps/web/public ./public
COPY apps/web/src ./src

ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
