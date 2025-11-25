# ============================================================================
# ECCS Elasticsearch Dockerfile - Search and Analytics Engine
# ============================================================================
# This Dockerfile creates a customized Elasticsearch instance for the ECCS
# platform, optimized for log storage, search, and analytics.
#
# SERVICE RESPONSIBILITIES:
#   - Centralized log storage and indexing
#   - Full-text search across all application logs
#   - Time-series data aggregation for analytics
#   - Integration with Kibana for visualization
#   - Index lifecycle management for log retention
#
# SECURITY FEATURES:
#   - Non-root execution (elasticsearch user with UID 1000)
#   - X-Pack security available (disabled by default for dev)
#   - Network-restricted access via Podman networking
#   - TLS support for production deployments
#
# PODMAN COMPATIBILITY:
#   - Rootless container support
#   - vm.max_map_count may need host adjustment
#   - Volume mounts with proper permissions
#   - Memory limits via cgroups
#
# PERSISTENT VOLUMES:
#   - /usr/share/elasticsearch/data: Index data (CRITICAL)
#   - /usr/share/elasticsearch/logs: Application logs
#
# MEMORY REQUIREMENTS:
#   - Minimum: 512MB heap (1GB container memory)
#   - Recommended: 2GB heap (4GB container memory)
#   - Heap should be 50% of container memory, max 30GB
#
# ENVIRONMENT VARIABLES:
#   - discovery.type: single-node for standalone deployment
#   - ES_JAVA_OPTS: JVM heap size settings
#   - xpack.security.enabled: Enable/disable security features
#   - cluster.name: Cluster identifier
# ============================================================================

# Base image: Official Elasticsearch 8.11
FROM docker.elastic.co/elasticsearch/elasticsearch:8.11.0

# LABEL: OCI standard image metadata
LABEL org.opencontainers.image.title="ECCS Elasticsearch"
LABEL org.opencontainers.image.description="Elasticsearch search and analytics engine for ECCS logging"
LABEL org.opencontainers.image.source="https://github.com/eccs/infrastructure"
LABEL org.opencontainers.image.version="8.11.0"
LABEL org.opencontainers.image.vendor="ECCS Team"
LABEL maintainer="ECCS DevOps Team"

# Switch to root for installation (will switch back)
USER root

# Install additional utilities
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        jq && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy custom configuration
COPY elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml

# Copy index templates and lifecycle policies
COPY templates/ /usr/share/elasticsearch/config/templates/

# Ensure proper permissions for elasticsearch user
RUN chown -R elasticsearch:elasticsearch /usr/share/elasticsearch/config/

# Switch back to elasticsearch user
USER elasticsearch

# HEALTHCHECK: Verify Elasticsearch cluster health
# Checks the cluster health API endpoint
# Yellow status is acceptable for single-node deployments
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD curl -f http://localhost:9200/_cluster/health?wait_for_status=yellow || exit 1

# EXPOSE: Document Elasticsearch ports
# 9200: HTTP REST API
# 9300: Node-to-node communication (cluster)
EXPOSE 9200 9300

# VOLUME: Persistent data storage
VOLUME ["/usr/share/elasticsearch/data"]

# Environment defaults (can be overridden at runtime)
ENV discovery.type=single-node
ENV xpack.security.enabled=false
ENV ES_JAVA_OPTS="-Xms512m -Xmx512m"
