# ============================================================================
# ECCS Email Service Dockerfile - Node.js Backend Microservice
# ============================================================================
# This Dockerfile creates a secure, optimized Node.js backend service for
# handling email operations in the ECCS (Email Communication and Control System).
#
# SERVICE RESPONSIBILITIES:
#   - Email composition and validation
#   - Communication with PostgreSQL for email storage
#   - Publishing email events to Kafka for async processing
#   - Integration with MongoDB for logging
#   - Metrics exposure for Prometheus scraping
#
# SECURITY FEATURES:
#   - Non-root user execution (node user with UID 1000)
#   - Minimal base image (Alpine Linux)
#   - No shell access in production (optional)
#   - Read-only filesystem compatible
#   - Proper signal handling with tini
#
# PODMAN COMPATIBILITY:
#   - Rootless container support
#   - User namespace mapping friendly
#   - Compatible with Podman's security model
#
# ENVIRONMENT VARIABLES (see podman-compose.yml for defaults):
#   - NODE_ENV: Runtime environment (production/development)
#   - POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB: Database connection
#   - KAFKA_BROKERS: Kafka cluster connection string
#   - MONGODB_URI: MongoDB connection for logging
#   - JWT_SECRET: Secret for JWT verification
#   - JAEGER_ENDPOINT: Distributed tracing endpoint
# ============================================================================

# Base image: Node.js 18 on Alpine Linux
# Alpine provides a minimal, security-focused base image (~5MB vs ~100MB for debian)
FROM node:18-alpine

# LABEL: OCI standard image metadata
# Helps with image identification, filtering, and documentation
LABEL org.opencontainers.image.title="ECCS Email Service"
LABEL org.opencontainers.image.description="Email processing microservice for ECCS platform"
LABEL org.opencontainers.image.source="https://github.com/eccs/email-service"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="ECCS Team"
LABEL maintainer="ECCS DevOps Team"

# Install security updates and required packages
# tini: A minimal init system for containers (handles signals properly)
# dumb-init: Alternative to tini for signal forwarding
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache \
        # tini provides proper PID 1 signal handling
        tini \
        # curl for healthchecks (wget is built-in to Alpine)
        curl && \
    # Clean APK cache to reduce image size
    rm -rf /var/cache/apk/*

# Create application directory with proper ownership
# The node user (UID 1000) is created by the Node.js base image
WORKDIR /app

# Change ownership of the app directory to the node user
# This allows the non-root user to write logs and temp files if needed
RUN chown -R node:node /app

# Copy package files first for Docker layer caching
# Changes to source code won't invalidate the npm install layer
COPY --chown=node:node package*.json ./

# Install production dependencies only
# npm ci: Clean install using package-lock.json for reproducibility
# --omit=dev: Skip development dependencies (reduces attack surface)
RUN npm ci --omit=dev && \
    # Clean npm cache to reduce image size
    npm cache clean --force

# Copy application source code with proper ownership
# Using --chown ensures files are owned by non-root user
COPY --chown=node:node . .

# HEALTHCHECK: Container health monitoring for orchestrators
# The email service should expose a /health endpoint
# --interval: Check every 30 seconds
# --timeout: Wait up to 10 seconds for response
# --start-period: Allow 40 seconds for service startup
# --retries: Mark unhealthy after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# EXPOSE: Document the service port
# Port 3001 is the email service's HTTP API port
# This is documentation only; actual binding is done at runtime
EXPOSE 3001

# Switch to non-root user for enhanced security
# The node user (UID 1000) is created by the Node.js base image
# This is CRITICAL for rootless Podman operation
USER node

# Set Node.js environment to production
# This enables various production optimizations
ENV NODE_ENV=production

# Use tini as PID 1 for proper signal handling
# This ensures SIGTERM is properly forwarded to Node.js for graceful shutdown
# Prevents zombie processes and handles orphaned child processes
ENTRYPOINT ["/sbin/tini", "--"]

# Start the Node.js application
# Using npm start allows package.json to define the start script
CMD ["npm", "start"]
