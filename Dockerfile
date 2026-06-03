# syntax=docker/dockerfile:1

# ---- Stage 1: build the static assets ----
FROM node:24-alpine AS build
WORKDIR /app

# Install dependencies first to leverage Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci

# WebSocket source the dashboard connects to at runtime. Vite inlines
# VITE_-prefixed env vars at build time, so it must be present here.
# Points at the EdgeCloud_Main MQTT->WebSocket bridge (see its docker-compose).
ARG VITE_WS_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Copy the rest of the source and produce the production build in /app/dist
COPY . .
RUN npm run build

# ---- Stage 2: serve the static assets with nginx ----
FROM nginx:1.27-alpine AS runtime

# SPA-aware nginx configuration (history fallback to index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the compiled assets from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
