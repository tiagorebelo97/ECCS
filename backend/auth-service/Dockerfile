# ============================================================================
# ECCS Auth Service Dockerfile - Node.js Authentication Microservice
# ============================================================================
# This Dockerfile creates a secure, optimized Node.js backend service for
# handling authentication operations in the ECCS platform.
#
# SERVICE RESPONSIBILITIES:
#   - User registration and login
#   - JWT token generation and validation
#   - Password hashing with bcrypt
#   - Session management
#   - Token verification endpoint for Traefik forward auth
#
# SECURITY FEATURES:
#   - Non-root user execution (node user with UID 1000)
#   - Minimal base image (Alpine Linux)
#   - No development dependencies in production
#   - Proper signal handling with tini
#   - Secrets managed via environment variables (not baked into image)
#
# PODMAN COMPATIBILITY:
#   - Rootless container support
#   - User namespace mapping friendly
#   - SELinux compatible volume mounts
#
# ENVIRONMENT VARIABLES (required - see podman-compose.yml):
#   - NODE_ENV: Runtime environment (production/development)
#   - POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB: Database connection
#   - JWT_SECRET: Secret key for JWT signing (CRITICAL - must be secure)
#   - JWT_EXPIRATION: Token expiration time (e.g., "1h", "7d")
# ============================================================================

# Base image: Node.js 18 on Alpine Linux for minimal footprint
FROM node:18-alpine

# LABEL: OCI standard image metadata
LABEL org.opencontainers.image.title="ECCS Auth Service"
LABEL org.opencontainers.image.description="Authentication and authorization microservice for ECCS platform"
LABEL org.opencontainers.image.source="https://github.com/eccs/auth-service"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="ECCS Team"
LABEL maintainer="ECCS DevOps Team"

# Install security updates and required packages
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache \
        # tini: Minimal init for proper signal handling
        tini \
        # curl: For healthcheck endpoint verification
        curl && \
    # Clean APK cache to reduce image size
    rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Set proper ownership for non-root operation
RUN chown -R node:node /app

# Copy package files first (enables Docker layer caching)
COPY --chown=node:node package*.json ./

# Install production dependencies only
# npm ci: Uses package-lock.json for exact versions
# --omit=dev: Excludes devDependencies (smaller image, fewer vulnerabilities)
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy application source code
COPY --chown=node:node . .

# HEALTHCHECK: Monitor service availability
# The auth service exposes /health endpoint for liveness checks
# This is used by Podman, Kubernetes, and load balancers
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# EXPOSE: Document the service port
# Port 3002 is the auth service's HTTP API port
EXPOSE 3002

# Switch to non-root user (CRITICAL for security)
# UID 1000 is the standard node user in the base image
USER node

# Set production environment
ENV NODE_ENV=production

# Use tini as init system for proper signal handling
# Ensures graceful shutdown on SIGTERM
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["npm", "start"]
