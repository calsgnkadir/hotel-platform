# ── Build stage: Node → static dist ────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

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
