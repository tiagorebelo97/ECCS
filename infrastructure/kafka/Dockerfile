# ============================================================================
# ECCS Kafka Dockerfile - Message Streaming Platform
# ============================================================================
# This Dockerfile creates a customized Kafka instance for the ECCS platform,
# providing asynchronous message streaming for email notifications.
#
# SERVICE RESPONSIBILITIES:
#   - Asynchronous message queue for email events
#   - Event streaming between microservices
#   - Dead letter queue for failed messages
#   - Retry topic management
#
# TOPICS (auto-created or via script):
#   - email-notifications: Primary email events
#   - email-notifications-retry: Retry queue
#   - email-notifications-dlq: Dead letter queue
#
# SECURITY FEATURES:
#   - Network-restricted access (internal only)
#   - SASL authentication supported
#   - TLS encryption supported
#
# PODMAN COMPATIBILITY:
#   - Rootless container support
#   - Volume mounts for data persistence
#   - Pod networking with Zookeeper
#
# PERSISTENT VOLUMES:
#   - /var/lib/kafka/data: Kafka log segments
#
# ENVIRONMENT VARIABLES:
#   - KAFKA_BROKER_ID: Unique broker identifier
#   - KAFKA_ZOOKEEPER_CONNECT: Zookeeper connection string
#   - KAFKA_ADVERTISED_LISTENERS: Listener addresses for clients
#   - KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: Replication for internal topics
# ============================================================================

# Base image: Confluent Kafka
FROM confluentinc/cp-kafka:7.4.0

# LABEL: OCI standard image metadata
LABEL org.opencontainers.image.title="ECCS Kafka"
LABEL org.opencontainers.image.description="Kafka message broker for ECCS event streaming"
LABEL org.opencontainers.image.source="https://github.com/eccs/infrastructure"
LABEL org.opencontainers.image.version="7.4.0"
LABEL org.opencontainers.image.vendor="ECCS Team"
LABEL maintainer="ECCS DevOps Team"

# Copy topic creation script
COPY create-topics.sh /docker-entrypoint-initdb.d/

# Make script executable
USER root
RUN chmod +x /docker-entrypoint-initdb.d/create-topics.sh 2>/dev/null || true
USER appuser

# HEALTHCHECK: Verify Kafka is accepting connections
# Checks that the broker is responding to metadata requests
HEALTHCHECK --interval=10s --timeout=10s --start-period=60s --retries=10 \
    CMD kafka-broker-api-versions --bootstrap-server localhost:9092 || exit 1

# EXPOSE: Document Kafka ports
# 9092: Client connections (PLAINTEXT)
# 9093: Client connections (SSL/TLS)
# 9094: Client connections (SASL_SSL)
EXPOSE 9092 9093 9094

# VOLUME: Persistent data storage
VOLUME ["/var/lib/kafka/data"]

# Environment defaults for single-node development
ENV KAFKA_BROKER_ID=1
ENV KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181
ENV KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092
ENV KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1
ENV KAFKA_AUTO_CREATE_TOPICS_ENABLE=true
ENV KAFKA_NUM_PARTITIONS=3
ENV KAFKA_DEFAULT_REPLICATION_FACTOR=1
