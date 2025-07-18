# Production Dockerfile for Frontend
# Multi-stage build for optimized production image
FROM node:20-slim AS base

# Install security updates
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends dumb-init && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci --ignore-scripts && \
    npm cache clean --force

# Build stage
FROM base AS build
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Production stage - serve static files with nginx
FROM nginx:alpine AS production

# Copy built application
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Change ownership and switch to non-root user
RUN chown -R nextjs:nodejs /usr/share/nginx/html
USER nextjs

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
