# ==============================================================================
# SmartRoute Pro — Production Frontend Multi-Stage Container
# Stage 1: Build React/Vite SPA -> Stage 2: Serve via Nginx Alpine
# ==============================================================================

# Stage 1: Build Application
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies with frozen lockfile for build reproducibility
COPY package*.json ./
RUN npm ci

# Copy frontend source files
COPY . .

# Support build-time API base URL configuration
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Compile TypeScript and build production bundle
RUN npm run build

# Stage 2: Production Nginx Server
FROM nginx:1.25-alpine

# Remove default Nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled production assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration with SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose standard web port
EXPOSE 80

# Production health probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/ || exit 1

# Launch Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
