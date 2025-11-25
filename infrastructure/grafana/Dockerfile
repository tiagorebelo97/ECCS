# ============================================================================
# ECCS Grafana Dockerfile - Metrics Visualization and Alerting
# ============================================================================
# This Dockerfile creates a customized Grafana instance for the ECCS platform,
# providing metrics visualization, dashboards, and alerting capabilities.
#
# SERVICE RESPONSIBILITIES:
#   - Metrics visualization from Prometheus
#   - Log visualization from Elasticsearch
#   - Distributed tracing visualization from Jaeger
#   - Custom dashboards for ECCS monitoring
#   - Alerting for system and application metrics
#
# DATA SOURCES CONFIGURED:
#   - Prometheus: Metrics storage and querying
#   - Elasticsearch: Log aggregation and search
#   - Jaeger: Distributed tracing
#
# SECURITY FEATURES:
#   - Non-root execution (grafana user with UID 472)
#   - Password protected admin account
#   - Network-restricted access via Podman networking
#   - Traefik reverse proxy for external access
#
# PODMAN COMPATIBILITY:
#   - Rootless container support
#   - Volume mounts for persistent data
#   - User namespace mapping friendly
#
# PERSISTENT VOLUMES:
#   - /var/lib/grafana: Grafana database and plugins
#
# ENVIRONMENT VARIABLES:
#   - GF_SECURITY_ADMIN_USER: Admin username
#   - GF_SECURITY_ADMIN_PASSWORD: Admin password (use secrets)
#   - GF_USERS_ALLOW_SIGN_UP: Disable self-registration
#   - GF_INSTALL_PLUGINS: Plugins to install on startup
# ============================================================================

# Base image: Official Grafana 10.2
FROM grafana/grafana:10.2.0

# LABEL: OCI standard image metadata
LABEL org.opencontainers.image.title="ECCS Grafana"
LABEL org.opencontainers.image.description="Metrics visualization and alerting dashboard for ECCS"
LABEL org.opencontainers.image.source="https://github.com/eccs/infrastructure"
LABEL org.opencontainers.image.version="10.2.0"
LABEL org.opencontainers.image.vendor="ECCS Team"
LABEL maintainer="ECCS DevOps Team"

# Switch to root for installation
USER root

# Install additional utilities
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache \
        curl \
        jq && \
    rm -rf /var/cache/apk/*

# Copy custom Grafana configuration
COPY grafana.ini /etc/grafana/grafana.ini

# Copy provisioning configurations
# These auto-configure data sources and dashboards on startup
COPY provisioning/ /etc/grafana/provisioning/

# Copy custom dashboards
COPY dashboards/ /var/lib/grafana/dashboards/

# Ensure proper permissions for grafana user (UID 472)
RUN chown -R grafana:root /etc/grafana/ && \
    chown -R grafana:root /var/lib/grafana/

# Switch back to grafana user
USER grafana

# HEALTHCHECK: Verify Grafana is ready
# Checks the Grafana API health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# EXPOSE: Document Grafana port
EXPOSE 3000

# VOLUME: Persistent data storage
VOLUME ["/var/lib/grafana"]

# Environment defaults (override in compose/runtime)
ENV GF_SECURITY_ADMIN_USER=admin
ENV GF_USERS_ALLOW_SIGN_UP=false
ENV GF_AUTH_ANONYMOUS_ENABLED=false
