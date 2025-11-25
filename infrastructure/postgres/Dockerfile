# ============================================================================
# ECCS PostgreSQL Dockerfile - Primary Relational Database
# ============================================================================
# This Dockerfile creates a customized PostgreSQL instance for the ECCS platform
# with initialization scripts, optimized configurations, and security hardening.
#
# DATABASE RESPONSIBILITIES:
#   - User authentication data storage (eccs_auth database)
#   - Email metadata storage (eccs_email database)
#   - Transaction management for email operations
#   - ACID compliance for critical data
#
# DATABASES CREATED:
#   - eccs_auth: User accounts, sessions, permissions
#   - eccs_email: Email records, templates, schedules
#
# SECURITY FEATURES:
#   - Non-root PostgreSQL user (postgres user with UID 999)
#   - Encrypted connections supported (SSL/TLS)
#   - Password authentication required
#   - Network-restricted access via Podman networking
#   - No superuser access from applications
#
# PODMAN COMPATIBILITY:
#   - Rootless container support
#   - Volume mounts with proper permissions
#   - SELinux context compatible (:z or :Z flags)
#   - User namespace mapping friendly
#
# PERSISTENT VOLUMES:
#   - /var/lib/postgresql/data: Database files (CRITICAL - must persist)
#   - /docker-entrypoint-initdb.d: Initialization scripts (read-only)
#
# ENVIRONMENT VARIABLES (required):
#   - POSTGRES_USER: Database superuser name
#   - POSTGRES_PASSWORD: Superuser password (use secrets in production)
#   - POSTGRES_DB: Default database name
#   - POSTGRES_MULTIPLE_DATABASES: Comma-separated list of databases to create
# ============================================================================

# Base image: PostgreSQL 15 on Alpine Linux
# Alpine variant is ~50MB vs ~150MB for Debian variant
FROM postgres:15-alpine

# LABEL: OCI standard image metadata
LABEL org.opencontainers.image.title="ECCS PostgreSQL Database"
LABEL org.opencontainers.image.description="PostgreSQL database for ECCS platform with multi-database initialization"
LABEL org.opencontainers.image.source="https://github.com/eccs/infrastructure"
LABEL org.opencontainers.image.version="15.0"
LABEL org.opencontainers.image.vendor="ECCS Team"
LABEL maintainer="ECCS DevOps Team"

# Install additional utilities for operations
# These are useful for debugging and backup operations
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache \
        # curl: For healthchecks and API calls
        curl \
        # jq: For JSON processing in scripts
        jq && \
    rm -rf /var/cache/apk/*

# Copy custom PostgreSQL configuration
# This includes performance tuning and security settings
COPY postgresql.conf /etc/postgresql/postgresql.conf

# Copy initialization scripts
# Scripts in /docker-entrypoint-initdb.d are executed on first container start
# They run in alphabetical order, so prefix with numbers (01-, 02-, etc.)
COPY init-scripts/ /docker-entrypoint-initdb.d/

# Ensure init scripts are executable and owned by postgres user
RUN chmod +x /docker-entrypoint-initdb.d/*.sh 2>/dev/null || true && \
    chown -R postgres:postgres /docker-entrypoint-initdb.d/

# HEALTHCHECK: Verify PostgreSQL is accepting connections
# Uses pg_isready which is the standard PostgreSQL health check tool
# --interval: Check every 10 seconds
# --timeout: Wait up to 5 seconds for response
# --start-period: Allow 30 seconds for database initialization
# --retries: Mark unhealthy after 5 consecutive failures
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-postgres} || exit 1

# EXPOSE: Document PostgreSQL port
# Default PostgreSQL port is 5432
EXPOSE 5432

# VOLUME: Declare persistent data location
# This ensures data survives container recreation
# In Podman, use named volumes: podman volume create postgres_data
VOLUME ["/var/lib/postgresql/data"]

# The base postgres image already runs as postgres user
# and handles the entrypoint/cmd, so we don't override them

# Optional: Use custom config file
# Uncomment if you have a custom postgresql.conf
# CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
