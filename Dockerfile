# syntax=docker/dockerfile:1.7
# Imagen para Cloud Run — multi-stage, sin dependencias de build en la imagen final.

# ---------- deps: solo para instalar (cacheable) ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- build ----------
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
# Cloud Run inyecta PORT en tiempo de ejecución; 8080 es el valor por defecto.
ENV PORT=8080

# Dependencias de producción únicamente.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Artefacto compilado.
COPY --from=build /app/dist ./dist

# Endurecimiento: proceso sin privilegios y sistema de ficheros de solo lectura.
RUN addgroup -g 10001 -S nodejs && adduser -u 10001 -S astro -G nodejs \
    && chown -R astro:nodejs /app
USER astro

EXPOSE 8080

# dumb-init evita procesos zombis y propaga SIGTERM (apagado limpio en Cloud Run).
ENTRYPOINT ["/usr/bin/env", "node", "./dist/server/entry.mjs"]
