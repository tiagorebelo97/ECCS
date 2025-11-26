# ============================================================================
# ECCS Traefik Dockerfile - API Gateway and Reverse Proxy
# ============================================================================
# This Dockerfile creates a customized Traefik instance for the ECCS platform,
# providing API gateway, load balancing, and security features.
#
# SERVICE RESPONSIBILITIES:
#   - Reverse proxy for all ECCS services
#   - Dynamic routing based on container labels
#   - Load balancing across service replicas
#   - JWT authentication middleware (via ForwardAuth)
#   - Rate limiting and circuit breaking for DDoS prevention
#   - TLS termination (HTTPS) with configurable certificates
#   - Request tracing with Jaeger
#
# ROUTING ARCHITECTURE:
#   - /api/auth/*   → auth-service:3002   (public, rate-limited)
#   - /api/emails/* → email-service:3001  (JWT protected)
#   - /kibana/*     → kibana:5601         (internal only)
#   - /grafana/*    → grafana:3000        (internal only)
#
# SECURITY FEATURES:
#   - JWT validation via ForwardAuth to auth-service
#   - Token issuer verification (shared JWT_SECRET)
#   - Token claim checks (userId, email, exp)
#   - Multi-tier rate limiting (DDoS prevention)
#   - Non-root execution (traefik user, UID 65532)
#   - Read-only container socket access
#   - Security headers (XSS, clickjacking, MIME sniffing protection)
#   - TLS 1.2+ enforcement with strong cipher suites
#   - HSTS for forced HTTPS connections
#
# PODMAN COMPATIBILITY:
#   - Uses Podman socket instead of Docker socket when configured
#   - Supports rootless container execution
#   - Pod-based networking compatible
#   - SELinux compatible socket access (:z flag)
#
# DYNAMIC SERVICE DISCOVERY:
#   Traefik automatically discovers Podman/Docker containers using labels:
#   - traefik.enable=true: Enable routing for container
#   - traefik.http.routers.<name>.rule: Define routing rule
#   - traefik.http.services.<name>.loadbalancer.server.port: Backend port
#
# VOLUME MOUNTS:
#   - /etc/traefik/traefik.yml: Static configuration (read-only)
#   - /etc/traefik/dynamic/: Dynamic configuration files (watched)
#   - /etc/traefik/certs/: TLS certificates (optional)
#   - /var/run/docker.sock or /run/podman/podman.sock: Container socket (ro)
#
# ENVIRONMENT VARIABLES:
#   - CONTAINER_SOCK: Container runtime socket path
#     - Docker: /var/run/docker.sock
#     - Podman (rootless): /run/user/1000/podman/podman.sock
#     - Podman (rootful): /run/podman/podman.sock
# ============================================================================

# Base image: Official Traefik v3.0
# SECURITY: Using specific version tag for reproducible builds
FROM traefik:v3.0

# LABEL: OCI standard image metadata
LABEL org.opencontainers.image.title="ECCS Traefik API Gateway"
LABEL org.opencontainers.image.description="API gateway and reverse proxy for ECCS platform with JWT auth, rate limiting, and TLS"
LABEL org.opencontainers.image.source="https://github.com/eccs/infrastructure"
LABEL org.opencontainers.image.version="3.0"
LABEL org.opencontainers.image.vendor="ECCS Team"
LABEL maintainer="ECCS DevOps Team"

# Copy static configuration
# This file is read once at startup
COPY traefik.yml /etc/traefik/traefik.yml

# Copy dynamic configuration files
# These files are watched for changes and reloaded automatically
# The compose file mounts ./infrastructure/traefik to /etc/traefik/dynamic
# so we copy *.yml files that should be baked into the image
COPY dynamic-config.yml /etc/traefik/dynamic/dynamic-config.yml

# Create directories and set permissions
# SECURITY: Traefik runs as non-root user (UID 65532)
RUN mkdir -p /etc/traefik/certs /etc/traefik/dynamic && \
    chown -R 65532:65532 /etc/traefik/

# HEALTHCHECK: Verify Traefik is routing traffic
# Checks the Traefik ping endpoint on the internal dashboard port
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:8080/ping || exit 1

# EXPOSE: Document Traefik ports
# 80: HTTP entrypoint (web)
# 443: HTTPS entrypoint (websecure)
# 8080: Dashboard and API (traefik)
EXPOSE 80 443 8080

# Note: Traefik base image already configures:
# - Non-root user execution
# - Entrypoint and command
# - Alpine-based minimal image
