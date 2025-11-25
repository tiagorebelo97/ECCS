# ============================================================================
# ECCS MongoDB Dockerfile - Document Database for Logging
# ============================================================================
# This Dockerfile creates a customized MongoDB instance for the ECCS platform
# optimized for high-volume logging and audit data storage.
#
# DATABASE RESPONSIBILITIES:
#   - Email processing logs and audit trails
#   - Application event logging
#   - Performance metrics storage
#   - Unstructured metadata storage
#
# COLLECTIONS CREATED:
#   - email_logs: Processing history for each email
#   - application_logs: Centralized application logging (capped)
#   - audit_events: Security and compliance audit trail
#
# SECURITY FEATURES:
#   - Non-root MongoDB user (mongodb user with UID 999)
#   - Authentication enabled (optional, via environment)
#   - Network-restricted access via Podman networking
#   - No external port exposure in production
#
# PODMAN COMPATIBILITY:
#   - Rootless container support
#   - Volume mounts with proper permissions
#   - SELinux context compatible (:z or :Z flags)
#   - User namespace mapping friendly
#
# PERSISTENT VOLUMES:
#   - /data/db: Database files (CRITICAL - must persist)
#   - /data/configdb: Configuration database
#   - /docker-entrypoint-initdb.d: Initialization scripts (read-only)
#
# ENVIRONMENT VARIABLES (optional):
#   - MONGO_INITDB_ROOT_USERNAME: Admin username (if auth enabled)
#   - MONGO_INITDB_ROOT_PASSWORD: Admin password (if auth enabled)
#   - MONGO_INITDB_DATABASE: Default database name
# ============================================================================

# Base image: MongoDB 6 on Ubuntu (no official Alpine variant)
FROM mongo:6

# LABEL: OCI standard image metadata
LABEL org.opencontainers.image.title="ECCS MongoDB Database"
LABEL org.opencontainers.image.description="MongoDB document database for ECCS logging and audit storage"
LABEL org.opencontainers.image.source="https://github.com/eccs/infrastructure"
LABEL org.opencontainers.image.version="6.0"
LABEL org.opencontainers.image.vendor="ECCS Team"
LABEL maintainer="ECCS DevOps Team"

# Install additional utilities
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        # curl: For healthchecks
        curl \
        # jq: For JSON processing
        jq && \
    # Clean up apt cache
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy initialization scripts
# Scripts run on first container start in alphabetical order
COPY init-scripts/ /docker-entrypoint-initdb.d/

# Ensure init scripts are executable
RUN chmod +x /docker-entrypoint-initdb.d/*.js 2>/dev/null || true && \
    chmod +x /docker-entrypoint-initdb.d/*.sh 2>/dev/null || true

# Copy custom MongoDB configuration
COPY mongod.conf /etc/mongod.conf

# HEALTHCHECK: Verify MongoDB is accepting connections
# Uses mongosh (MongoDB Shell) for health verification
# --interval: Check every 10 seconds
# --timeout: Wait up to 5 seconds for response
# --start-period: Allow 30 seconds for database initialization
# --retries: Mark unhealthy after 5 consecutive failures
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD mongosh --eval "db.adminCommand('ping')" --quiet || exit 1

# EXPOSE: Document MongoDB port
# Default MongoDB port is 27017
EXPOSE 27017

# VOLUME: Declare persistent data locations
# These ensure data survives container recreation
VOLUME ["/data/db", "/data/configdb"]

# The base mongo image handles user switching and entrypoint
# Optionally use custom config:
# CMD ["mongod", "--config", "/etc/mongod.conf"]
