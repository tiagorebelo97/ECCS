# ============================================================================
# ECCS Kibana Dockerfile - Log Visualization Dashboard
# ============================================================================
# This Dockerfile creates a customized Kibana instance for the ECCS platform,
# providing visualization and analysis of log data stored in Elasticsearch.
#
# SERVICE RESPONSIBILITIES:
#   - Log visualization and dashboards
#   - Full-text log search interface
#   - Real-time log streaming
#   - Alerting and anomaly detection
#   - Index pattern management
#
# SECURITY FEATURES:
#   - Non-root execution (kibana user with UID 1000)
#   - X-Pack security integration available
#   - Network-restricted access via Podman networking
#   - Traefik reverse proxy for external access
#
# PODMAN COMPATIBILITY:
#   - Rootless container support
#   - No special host requirements
#   - Memory limits via cgroups
#
# ENVIRONMENT VARIABLES:
#   - ELASTICSEARCH_HOSTS: Elasticsearch cluster URL
#   - SERVER_HOST: Bind address (0.0.0.0 for containers)
#   - SERVER_BASEPATH: URL base path (if behind reverse proxy)
# ============================================================================

# Base image: Official Kibana 8.11
FROM docker.elastic.co/kibana/kibana:8.11.0

# LABEL: OCI standard image metadata
LABEL org.opencontainers.image.title="ECCS Kibana"
LABEL org.opencontainers.image.description="Log visualization and analytics dashboard for ECCS"
LABEL org.opencontainers.image.source="https://github.com/eccs/infrastructure"
LABEL org.opencontainers.image.version="8.11.0"
LABEL org.opencontainers.image.vendor="ECCS Team"
LABEL maintainer="ECCS DevOps Team"

# Switch to root for installation
USER root

# Install additional utilities
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        jq && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy custom Kibana configuration
COPY kibana.yml /usr/share/kibana/config/kibana.yml

# Copy saved objects (dashboards, visualizations)
# These are imported on first startup
COPY saved-objects/ /usr/share/kibana/saved-objects/

# Ensure proper permissions
RUN chown -R kibana:kibana /usr/share/kibana/config/ && \
    chown -R kibana:kibana /usr/share/kibana/saved-objects/ 2>/dev/null || true

# Switch back to kibana user
USER kibana

# HEALTHCHECK: Verify Kibana is ready
# Checks the Kibana status API
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD curl -f http://localhost:5601/api/status || exit 1

# EXPOSE: Document Kibana port
EXPOSE 5601

# Environment defaults
ENV ELASTICSEARCH_HOSTS=http://elasticsearch:9200
ENV SERVER_HOST=0.0.0.0
