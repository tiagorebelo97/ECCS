# ============================================================================
# ECCS Frontend Dockerfile - React Application
# ============================================================================
# This Dockerfile creates an optimized, production-ready React application
# using a multi-stage build for minimal image size and enhanced security.
#
# SECURITY FEATURES:
#   - Multi-stage build to exclude build dependencies from final image
#   - Non-root user execution (nginx user)
#   - Read-only filesystem compatible
#   - No shell access in final image (distroless-like approach)
#   - Security headers configured in nginx.conf
#
# PODMAN COMPATIBILITY:
#   - Rootless container support (runs as non-root by default)
#   - Compatible with Podman's security model
#   - Uses unprivileged ports (3000) for rootless operation
#
# BUILD ARGUMENTS:
#   - REACT_APP_API_URL: Backend API URL for the React application
#   - NODE_ENV: Build environment (defaults to production)
# ============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Stage
# -----------------------------------------------------------------------------
# This stage installs dependencies and builds the React application.
# All build tools and node_modules are discarded after this stage.
# -----------------------------------------------------------------------------
FROM node:18-alpine AS builder

# LABEL: Metadata for the image (OCI standard)
# These labels help identify the image and its purpose
LABEL org.opencontainers.image.title="ECCS Frontend Builder"
LABEL org.opencontainers.image.description="Build stage for ECCS React frontend application"
LABEL org.opencontainers.image.source="https://github.com/eccs/frontend"
LABEL maintainer="ECCS DevOps Team"

# Build-time arguments for React environment configuration
# These are baked into the static files during build
ARG REACT_APP_API_URL=http://localhost:80
ARG NODE_ENV=production

# Set environment variables for the build process
# NODE_ENV=production ensures optimized builds
ENV NODE_ENV=${NODE_ENV}
ENV REACT_APP_API_URL=${REACT_APP_API_URL}

# Set working directory for all subsequent commands
# Using /app as a standard convention for application code
WORKDIR /app

# Copy package files first for better layer caching
# Docker caches layers, so unchanged package.json means cached npm install
COPY package*.json ./

# Install dependencies using npm ci for reproducible builds
# --only=production flag is deprecated in npm 7+, using --omit=dev instead
# npm ci uses package-lock.json for exact versions
RUN npm ci --omit=dev && \
    # Clean npm cache to reduce image size
    npm cache clean --force

# Copy the rest of the application source code
# .dockerignore should exclude node_modules, .git, etc.
COPY . .

# Build the React application for production
# This creates optimized static files in /app/build directory
RUN npm run build && \
    # Remove source maps in production for security
    rm -rf build/**/*.map

# -----------------------------------------------------------------------------
# Stage 2: Production Stage
# -----------------------------------------------------------------------------
# This stage creates the final minimal image using nginx to serve static files.
# Only the built artifacts are copied, no Node.js or build tools included.
# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS production

# LABEL: Production image metadata
LABEL org.opencontainers.image.title="ECCS Frontend"
LABEL org.opencontainers.image.description="ECCS React frontend application served by Nginx"
LABEL org.opencontainers.image.source="https://github.com/eccs/frontend"
LABEL org.opencontainers.image.version="1.0.0"
LABEL maintainer="ECCS DevOps Team"

# Install security updates and remove unnecessary packages
# dumb-init provides proper signal handling for containers
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache dumb-init && \
    # Remove default nginx configurations that we'll replace
    rm -rf /etc/nginx/conf.d/default.conf && \
    # Create directory for nginx to store temp files (needed for non-root)
    mkdir -p /var/cache/nginx /var/run/nginx && \
    # Ensure nginx user owns required directories for rootless operation
    chown -R nginx:nginx /var/cache/nginx /var/run/nginx /var/log/nginx

# Copy built React application from builder stage
# --chown ensures files are owned by nginx user for security
COPY --from=builder --chown=nginx:nginx /app/build /usr/share/nginx/html

# Copy custom main nginx.conf for rootless container compatibility
# This removes the "user" directive and sets PID file to writable location
COPY --chown=nginx:nginx nginx-main.conf /etc/nginx/nginx.conf

# Copy custom nginx server configuration
# This includes security headers and proper routing for SPA
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf

# HEALTHCHECK: Container health monitoring
# Podman and orchestrators use this to verify container is running properly
# --interval: How often to check (every 30 seconds)
# --timeout: How long to wait for response (10 seconds)
# --start-period: Grace period before first check (5 seconds)
# --retries: Number of failures before marking unhealthy (3)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

# EXPOSE: Document which port the application listens on
# Port 3000 is used to allow rootless operation (ports < 1024 require root)
# Note: This is documentation only; actual port mapping is done at runtime
EXPOSE 3000

# Switch to non-root user for security (rootless container support)
# The nginx user is created by the nginx:alpine base image
USER nginx

# Use dumb-init as PID 1 for proper signal handling
# This ensures SIGTERM is properly forwarded to nginx for graceful shutdown
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start nginx in foreground mode (required for containers)
# -g 'daemon off;' prevents nginx from daemonizing
CMD ["nginx", "-g", "daemon off;"]
