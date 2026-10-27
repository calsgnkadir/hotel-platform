# ── Build stage: Node → static dist ────────────────────────────────
# node:20-slim (Debian/glibc) — node:20-alpine (musl) rollup 4.x'in native
# binary'lerinde (@rollup/rollup-linux-x64-*) bilinen "MODULE_NOT_FOUND" bug'ini
# tetikliyor. Debian glibc bu variant'la stabil.
FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./
# npm 10.8.2 (bundled in node:20-slim) crashes resolving this Vitest dependency
# graph with "Cannot read properties of null (reading 'edgesOut')". Pin the npm
# 11 line that fixes this resolver failure, then install from the committed lock.
RUN npm install --global npm@11.21.1 \
    && npm ci --include=optional --no-audit --no-fund

COPY . .

# ── Dist stage: statik derleme ─────────────────────────────────────
# Ayrı aşama: compose.verify.yml "build" hedefinde yalnız testleri koşar
# (API adresi gerekmez); derleme bu aşamada, adres zorunlu.
FROM build AS dist
# API/WS adresi build-time gömülür (Vite). Varsayılan YOK: imaj hangi backend'e
# gideceğini bilmeden derlenmez (canlıya yanlışlıkla localhost gömülmesin).
#   docker build --build-arg VITE_API_URL=https://api.kadrom.me .
# Compose bunu args ile verir (docker-compose.yml: yerel yığın, deploy/prod: PUBLIC_URL).
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || (echo "HATA: VITE_API_URL build arg zorunlu (ör. --build-arg VITE_API_URL=https://api.kadrom.me)" >&2; exit 1)
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ── Runtime stage: nginx ile statik servis ─────────────────────────
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=dist /app/dist /usr/share/nginx/html
EXPOSE 80
