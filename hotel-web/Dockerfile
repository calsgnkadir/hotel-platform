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
# API/WS adresi build-time gömülür (Vite). Compose backend'i 8080'de açar;
# REST (VITE_API_URL || '') ve WS (VITE_API_URL || localhost:8080) buraya gider.
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ── Runtime stage: nginx ile statik servis ─────────────────────────
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
