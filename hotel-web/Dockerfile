# ── Build stage: Node → static dist ────────────────────────────────
# node:20-slim (Debian/glibc) — node:20-alpine (musl) rollup 4.x'in native
# binary'lerinde (@rollup/rollup-linux-x64-*) bilinen "MODULE_NOT_FOUND" bug'ini
# tetikliyor. Debian glibc bu variant'la stabil.
FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./
# Lockfile container icinde SILINIYOR (Docker'a ozel). Sebep: npm 10.x'te
# bilinen "silent optional-dep skip" bug'i (npm/cli#4828, rollup#4415) —
# lockfile varken @rollup/rollup-linux-*, @esbuild/linux-* gibi platform-
# spesifik native binary'ler bazen atlaniyor -> "MODULE_NOT_FOUND" fail.
# CI'da (ci.yml) npm ci strict check hala calisiyor (deterministik dogrulama
# orada); Docker imaj build'i lockfile-siz taze cozumleme yapiyor.
RUN rm -f package-lock.json && npm install --no-audit --no-fund

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
