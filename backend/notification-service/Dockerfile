# ============================================================================
# ECCS Notification Service Dockerfile - Kafka Consumer Microservice
# ============================================================================
# This Dockerfile creates a secure, optimized Node.js backend service for
# consuming email notification events from Kafka and processing them.
#
# SERVICE RESPONSIBILITIES:
#   - Kafka consumer for email notification topics
#   - SMTP email delivery
#   - Retry logic with exponential backoff
#   - Dead letter queue (DLQ) handling for failed messages
#   - Integration with MongoDB for audit logging
#   - Distributed tracing with Jaeger
#
# KAFKA INTEGRATION:
#   - Consumes from: email_requests, email_requests_retry topics
#   - Produces to: email_requests_retry, email_dlq
#   - Consumer group: notification-group
#
# SECURITY FEATURES:
#   - Non-root user execution (node user with UID 1000)
#   - Minimal Alpine Linux base
#   - Production-only dependencies
#   - Proper signal handling for graceful Kafka consumer shutdown
#   - SMTP credentials via environment variables (not in image)
#
# PODMAN COMPATIBILITY:
#   - Rootless container support
#   - User namespace mapping friendly
#   - Pod networking for Kafka communication
#
# ENVIRONMENT VARIABLES (required - see podman-compose.yml):
#   - NODE_ENV: Runtime environment
#   - KAFKA_BROKERS: Kafka broker addresses (e.g., "kafka:9092")
#   - KAFKA_GROUP_ID: Consumer group identifier
#   - MONGODB_URI: MongoDB connection for logging
#   - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS: SMTP configuration
#   - RETRY_ATTEMPTS: Number of retry attempts for failed emails
#   - RETRY_DELAY: Delay between retries in milliseconds
#   - JAEGER_ENDPOINT: Distributed tracing endpoint
# ============================================================================

# Base image: Node.js 18 on Alpine Linux
FROM node:18-alpine

# LABEL: OCI standard image metadata
LABEL org.opencontainers.image.title="ECCS Notification Service"
LABEL org.opencontainers.image.description="Kafka consumer for email notification processing"
LABEL org.opencontainers.image.source="https://github.com/eccs/notification-service"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="ECCS Team"
LABEL maintainer="ECCS DevOps Team"

# Install security updates and required packages
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache \
        # tini: Minimal init for proper signal handling
        # CRITICAL for Kafka consumers to handle graceful shutdown
        tini \
        # curl: For healthcheck
        curl && \
    rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Set proper ownership for non-root operation
RUN chown -R node:node /app

# Copy package files first (enables Docker layer caching)
COPY --chown=node:node package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy application source code
COPY --chown=node:node . .

# HEALTHCHECK: Monitor Kafka consumer health
# The notification service should expose a /health endpoint
# that reports Kafka consumer connection status
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3004/health || exit 1

# Note: This service doesn't expose an HTTP port by default
# It's a Kafka consumer, but we may expose metrics/health on 3004
EXPOSE 3004

# Switch to non-root user
USER node

# Set production environment
ENV NODE_ENV=production

# Use tini as init system
# CRITICAL: Kafka consumers need proper SIGTERM handling to commit offsets
# and leave consumer group gracefully
ENTRYPOINT ["/sbin/tini", "--"]

# Start the Kafka consumer application
CMD ["npm", "start"]
