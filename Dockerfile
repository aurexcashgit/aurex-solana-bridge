# Multi-stage Docker build for Aurex Solana Bridge API

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY api/package.json ./api/
COPY sdk/package.json ./sdk/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY api/ ./api/
COPY sdk/ ./sdk/

# Build SDK first
WORKDIR /app/sdk
RUN npm run build

# Build API
WORKDIR /app/api
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install security updates and utilities
RUN apk update && apk upgrade && \
    apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S aurex -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=aurex:nodejs /app/api/dist ./dist
COPY --from=builder --chown=aurex:nodejs /app/api/package.json ./
COPY --from=builder --chown=aurex:nodejs /app/node_modules ./node_modules

# Create logs directory
RUN mkdir -p logs && chown aurex:nodejs logs

# Switch to non-root user
USER aurex

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]