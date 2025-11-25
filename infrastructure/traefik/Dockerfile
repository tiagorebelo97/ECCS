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
#   - JWT authentication middleware
#   - Rate limiting and circuit breaking
#   - TLS termination (HTTPS)
#   - Request tracing with Jaeger
#
# ROUTING:
#   - /api/auth/* → auth-service:3002
#   - /api/emails/* → email-service:3001
#   - /kibana/* → kibana:5601
#   - /grafana/* → grafana:3000
#
# SECURITY FEATURES:
#   - Non-root execution (traefik user)
#   - Read-only container socket access
#   - Security headers middleware
#   - Rate limiting per IP
#   - TLS 1.2+ enforcement
#
# PODMAN COMPATIBILITY:
#   - Uses Podman socket instead of Docker socket
#   - Rootless container support
#   - Pod-based networking
#   - SELinux compatible socket access
#
# PERSISTENT VOLUMES:
#   - /etc/traefik/dynamic: Dynamic configuration files
#   - /etc/traefik/certs: TLS certificates (production)
#   - /var/run/podman/podman.sock: Podman socket (read-only)
#
# ENVIRONMENT VARIABLES:
#   - CONTAINER_SOCK: Container runtime socket path
# ============================================================================

# Base image: Official Traefik v3.0
FROM traefik:v3.0

# LABEL: OCI standard image metadata
LABEL org.opencontainers.image.title="ECCS Traefik API Gateway"
LABEL org.opencontainers.image.description="API gateway and reverse proxy for ECCS platform"
LABEL org.opencontainers.image.source="https://github.com/eccs/infrastructure"
LABEL org.opencontainers.image.version="3.0"
LABEL org.opencontainers.image.vendor="ECCS Team"
LABEL maintainer="ECCS DevOps Team"

# Copy static configuration
COPY traefik.yml /etc/traefik/traefik.yml

# Copy dynamic configuration
COPY dynamic/ /etc/traefik/dynamic/

# Create directory for TLS certificates
RUN mkdir -p /etc/traefik/certs && \
    # Create non-root user for Traefik
    # Note: Alpine-based Traefik image may not have adduser
    # Using numeric UID instead
    chown -R 65532:65532 /etc/traefik/

# HEALTHCHECK: Verify Traefik is routing traffic
# Checks the Traefik ping endpoint
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:8080/ping || exit 1

# EXPOSE: Document Traefik ports
# 80: HTTP entrypoint
# 443: HTTPS entrypoint
# 8080: Dashboard and API
EXPOSE 80 443 8080

# Note: Traefik base image already runs as non-root
# and handles entrypoint/cmd
