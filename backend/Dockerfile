# Production Dockerfile for Backend
# Multi-stage build for security and smaller image size
FROM node:20-slim AS base

# Install security updates and dumb-init
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends dumb-init && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nodejs

WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Build stage
FROM base AS build
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Production stage
FROM base AS production

# Copy only production dependencies and built application
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./

# Change to non-root user
USER nodejs

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Use dumb-init and start production server
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
