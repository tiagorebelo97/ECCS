# ============================================================================
# ECCS Logstash Dockerfile - Log Processing Pipeline
# ============================================================================
# This Dockerfile creates a customized Logstash instance for the ECCS platform,
# configured to receive, process, and route logs to Elasticsearch.
#
# SERVICE RESPONSIBILITIES:
#   - Receive logs from application services (TCP, Beats)
#   - Parse and transform log data
#   - Enrich logs with metadata (geoip, service names)
#   - Route logs to Elasticsearch indices
#   - Handle log filtering and aggregation
#
# INPUT SOURCES:
#   - TCP (port 5000): JSON logs from applications
#   - Beats (port 5044): Filebeat and other Beat agents
#   - MongoDB: Email and application logs from MongoDB collections
#
# OUTPUT DESTINATIONS:
#   - Elasticsearch: Primary log storage
#   - Stdout: Debug output (optional)
#
# SECURITY FEATURES:
#   - Non-root execution (logstash user with UID 1000)
#   - No sensitive data in image
#   - Network-restricted access via Podman networking
#
# PODMAN COMPATIBILITY:
#   - Rootless container support
#   - Volume mounts for pipeline configuration
#   - Memory limits via cgroups (JVM heap)
#
# ENVIRONMENT VARIABLES:
#   - LS_JAVA_OPTS: JVM heap size settings
#   - ELASTICSEARCH_HOSTS: Elasticsearch cluster URL
#   - MONGODB_URI: MongoDB connection string
#   - MONGODB_WAIT_TIMEOUT: Seconds to wait for MongoDB (default: 300)
#   - MONGODB_INIT_WAIT: Seconds to wait after MongoDB is reachable (default: 30)
# ============================================================================

# Base image: Official Logstash 8.11
FROM docker.elastic.co/logstash/logstash:8.11.0

# LABEL: OCI standard image metadata
LABEL org.opencontainers.image.title="ECCS Logstash"
LABEL org.opencontainers.image.description="Log processing pipeline for ECCS centralized logging"
LABEL org.opencontainers.image.source="https://github.com/eccs/infrastructure"
LABEL org.opencontainers.image.version="8.11.0"
LABEL org.opencontainers.image.vendor="ECCS Team"
LABEL maintainer="ECCS DevOps Team"

# Switch to root for installation
USER root

# Install additional utilities
# - curl, jq: HTTP requests and JSON processing
# - netcat-openbsd: Network connectivity checks for MongoDB
# - python3, python3-pip: For MongoDB connectivity verification with pymongo
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        jq \
        netcat-openbsd \
        python3 \
        python3-pip && \
    pip3 install --no-cache-dir pymongo && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Remove default pipeline configuration
RUN rm -f /usr/share/logstash/pipeline/logstash.conf

# Copy custom Logstash configuration
COPY config/logstash.yml /usr/share/logstash/config/logstash.yml
COPY config/pipelines.yml /usr/share/logstash/config/pipelines.yml
COPY config/jvm.options /usr/share/logstash/config/jvm.options
COPY config/log4j2.properties /usr/share/logstash/config/log4j2.properties

# Copy pipeline configurations
COPY pipeline/ /usr/share/logstash/pipeline/

# Copy patterns for grok parsing
COPY patterns/ /usr/share/logstash/patterns/

# Copy custom entrypoint script
# This script waits for MongoDB to have placeholder documents before starting Logstash
# to work around a bug in logstash-input-mongodb plugin that crashes on empty collections
COPY docker-entrypoint.sh /usr/local/bin/eccs-entrypoint.sh
RUN chmod +x /usr/local/bin/eccs-entrypoint.sh

# Create log directory and ensure proper permissions
# The /var/log/logstash directory is required for Logstash's rolling file appenders
# configured in log4j2.properties. Without this, Logstash fails with errors:
# - "Could not create directory /var/log/logstash"
# - "Unable to create file /var/log/logstash/logstash-json.log"
RUN mkdir -p /var/log/logstash && \
    chown -R logstash:logstash /var/log/logstash && \
    chown -R logstash:logstash /usr/share/logstash/config/ && \
    chown -R logstash:logstash /usr/share/logstash/pipeline/ && \
    chown -R logstash:logstash /usr/share/logstash/patterns/ 2>/dev/null || true

# Switch back to logstash user
USER logstash

# Install the MongoDB input plugin for the eccs-mongodb pipeline
# This plugin is required to read email_logs and application_logs collections
# from MongoDB and push them to Elasticsearch for Kibana dashboards.
#
# KNOWN ISSUE: The plugin (v0.4.1, last updated 2017) has a bug where it crashes
# with "NoMethodError: undefined method [] for nil:NilClass" when querying an
# empty MongoDB collection. This is worked around by:
# 1. MongoDB init script creates placeholder documents in each collection
# 2. Custom entrypoint waits for MongoDB to have these documents before starting
#
# NOTE: Plugin installation is memory-intensive (JRuby + bundler). We set
# LS_JAVA_OPTS inline with 1GB heap because ENV values don't apply to RUN
# commands during build. Without this, the build fails with OutOfMemoryError.
RUN LS_JAVA_OPTS="-Xms1g -Xmx1g" /usr/share/logstash/bin/logstash-plugin install logstash-input-mongodb

# Environment defaults for runtime - 256MB is sufficient for normal operation
ENV LS_JAVA_OPTS="-Xms256m -Xmx256m"

# HEALTHCHECK: Verify Logstash is processing events
# Checks the Logstash API for pipeline status
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD curl -f http://localhost:9600/_node/stats/pipelines || exit 1

# EXPOSE: Document Logstash ports
# 5000: TCP input for application logs
# 5044: Beats input for Filebeat/Metricbeat
# 9600: Logstash monitoring API
EXPOSE 5000 5044 9600

# Use custom entrypoint that waits for MongoDB before starting Logstash
ENTRYPOINT ["/usr/local/bin/eccs-entrypoint.sh"]
