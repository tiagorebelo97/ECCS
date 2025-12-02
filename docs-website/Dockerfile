# ============================================================================
# ECCS Documentation Website Dockerfile
# ============================================================================
# This Dockerfile creates an optimized, production-ready documentation website
# using a multi-stage build for minimal image size and enhanced security.
#
# SECURITY FEATURES:
#   - Multi-stage build to exclude build dependencies from final image
#   - Non-root user execution (nginx user)
#   - Read-only filesystem compatible
#   - Security headers configured in nginx.conf
#
# PODMAN COMPATIBILITY:
#   - Rootless container support (runs as non-root by default)
#   - Compatible with Podman's security model
#   - Uses unprivileged ports (3100) for rootless operation
# ============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Stage
# -----------------------------------------------------------------------------
# This stage installs dependencies and builds the documentation website.
# All build tools and node_modules are discarded after this stage.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# LABEL: Metadata for the image (OCI standard)
LABEL org.opencontainers.image.title="ECCS Documentation Website Builder"
LABEL org.opencontainers.image.description="Build stage for ECCS documentation website"
LABEL org.opencontainers.image.source="https://github.com/eccs/docs-website"
LABEL maintainer="ECCS DevOps Team"

# Set working directory for all subsequent commands
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies using npm ci for reproducible builds
RUN npm ci && \
    npm cache clean --force

# Copy the rest of the application source code
COPY . .

# Build the documentation website for production
# Use npm run build to use the locally installed vite
RUN npm run build && \
    rm -rf dist/**/*.map

# -----------------------------------------------------------------------------
# Stage 2: Production Stage
# -----------------------------------------------------------------------------
# This stage creates the final minimal image using nginx to serve static files.
# Only the built artifacts are copied, no Node.js or build tools included.
# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS production

# LABEL: Production image metadata
LABEL org.opencontainers.image.title="ECCS Documentation Website"
LABEL org.opencontainers.image.description="ECCS documentation website served by Nginx"
LABEL org.opencontainers.image.source="https://github.com/eccs/docs-website"
LABEL org.opencontainers.image.version="1.0.0"
LABEL maintainer="ECCS DevOps Team"

# Set up directories for rootless container compatibility
RUN rm -f /etc/nginx/nginx.conf && \
    rm -f /etc/nginx/conf.d/default.conf && \
    mkdir -p /var/cache/nginx && \
    mkdir -p /etc/nginx/templates && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/templates /etc/nginx/conf.d

# Copy built documentation website from builder stage
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Copy custom main nginx.conf for rootless container compatibility
COPY --chown=nginx:nginx nginx-main.conf /etc/nginx/nginx.conf

# Copy nginx server configuration to templates directory
# The nginx entrypoint will copy this to conf.d/default.conf
COPY --chown=nginx:nginx nginx.conf.template /etc/nginx/templates/default.conf.template

# HEALTHCHECK: Container health monitoring
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3100/ || exit 1

# EXPOSE: Document which port the application listens on
EXPOSE 3100

# Switch to non-root user for security
USER nginx

# Start nginx via the official entrypoint script to enable template processing
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
