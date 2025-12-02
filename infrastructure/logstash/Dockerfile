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
#   - Kafka (optional): For high-volume log streaming
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
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        jq && \
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

# Environment defaults - set BEFORE plugin installation to ensure adequate memory
# during the build process. The plugin installation process is memory-intensive
# and will fail with OutOfMemoryError if insufficient heap is allocated.
ENV LS_JAVA_OPTS="-Xms256m -Xmx256m"

# Install the MongoDB input plugin for the eccs-mongodb pipeline
# This plugin is required to read email_logs and application_logs collections
# from MongoDB and push them to Elasticsearch for Kibana dashboards.
RUN /usr/share/logstash/bin/logstash-plugin install logstash-input-mongodb

# HEALTHCHECK: Verify Logstash is processing events
# Checks the Logstash API for pipeline status
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD curl -f http://localhost:9600/_node/stats/pipelines || exit 1

# EXPOSE: Document Logstash ports
# 5000: TCP input for application logs
# 5044: Beats input for Filebeat/Metricbeat
# 9600: Logstash monitoring API
EXPOSE 5000 5044 9600
