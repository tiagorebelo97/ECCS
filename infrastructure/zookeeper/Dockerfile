# ============================================================================
# ECCS Zookeeper Dockerfile - Kafka Coordination Service
# ============================================================================
# This Dockerfile creates a customized Zookeeper instance for the ECCS platform,
# providing coordination services for Kafka.
#
# SERVICE RESPONSIBILITIES:
#   - Kafka broker coordination
#   - Cluster membership management
#   - Configuration management
#   - Leader election for Kafka partitions
#
# SECURITY FEATURES:
#   - Non-root execution where possible
#   - Network-restricted access (internal only)
#   - No external port exposure in production
#
# PODMAN COMPATIBILITY:
#   - Rootless container support
#   - Volume mounts for data persistence
#   - Pod networking with Kafka
#
# PERSISTENT VOLUMES:
#   - /var/lib/zookeeper/data: Transaction logs
#   - /var/lib/zookeeper/log: Data snapshots
#
# ENVIRONMENT VARIABLES:
#   - ZOOKEEPER_CLIENT_PORT: Client connection port (2181)
#   - ZOOKEEPER_TICK_TIME: Heartbeat interval (2000ms)
#   - ZOOKEEPER_INIT_LIMIT: Sync phase timeout
#   - ZOOKEEPER_SYNC_LIMIT: Sync timeout
# ============================================================================

# Base image: Confluent Zookeeper
FROM confluentinc/cp-zookeeper:7.4.0

# LABEL: OCI standard image metadata
LABEL org.opencontainers.image.title="ECCS Zookeeper"
LABEL org.opencontainers.image.description="Zookeeper coordination service for ECCS Kafka cluster"
LABEL org.opencontainers.image.source="https://github.com/eccs/infrastructure"
LABEL org.opencontainers.image.version="7.4.0"
LABEL org.opencontainers.image.vendor="ECCS Team"
LABEL maintainer="ECCS DevOps Team"

# HEALTHCHECK: Verify Zookeeper is accepting connections
# Uses the Zookeeper four-letter-word command 'ruok'
# Note: Requires KAFKA_OPTS="-Dzookeeper.4lw.commands.whitelist=ruok" to be set
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD echo "ruok" | nc localhost 2181 | grep -q "imok" || exit 1

# EXPOSE: Document Zookeeper ports
# 2181: Client connections
# 2888: Follower connections (cluster)
# 3888: Leader election (cluster)
EXPOSE 2181 2888 3888

# VOLUME: Persistent data storage
VOLUME ["/var/lib/zookeeper/data", "/var/lib/zookeeper/log"]

# Environment defaults
ENV ZOOKEEPER_CLIENT_PORT=2181
ENV ZOOKEEPER_TICK_TIME=2000
ENV ZOOKEEPER_INIT_LIMIT=5
ENV ZOOKEEPER_SYNC_LIMIT=2
