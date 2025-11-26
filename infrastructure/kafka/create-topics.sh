#!/bin/bash
# ============================================================================
# ECCS Kafka Topic Creation Script
# ============================================================================
# This script creates and configures Kafka topics for the ECCS platform.
# It should be run after Kafka is fully initialized.
#
# TOPICS CREATED:
#   - email-notifications: Primary topic for email events
#   - email-notifications-retry: Retry queue for failed processing
#   - email-notifications-dlq: Dead letter queue for permanent failures
#
# USAGE:
#   ./create-topics.sh
#
# ENVIRONMENT VARIABLES:
#   - KAFKA_BROKER: Kafka broker address (default: localhost:9092)
#
# TOPIC CONFIGURATION:
#   - Partitions: Determines parallelism (3 for moderate load)
#   - Replication: Data redundancy (1 for single-node, 3 for production)
#   - Retention: How long to keep messages
#   - Cleanup policy: delete (time-based) or compact (key-based)
# ============================================================================

set -e  # Exit on any error

# Configuration
KAFKA_BROKER=${KAFKA_BROKER:-localhost:9092}

# Color output for visibility
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}ECCS Kafka Topic Creation Script${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# ============================================================================
# Wait for Kafka to be ready
# ============================================================================
# Kafka needs time to elect a controller and become ready for operations.
# We poll the broker until it responds to topic list requests.
echo -e "${YELLOW}Waiting for Kafka broker at ${KAFKA_BROKER}...${NC}"

MAX_RETRIES=30
RETRY_COUNT=0

while ! kafka-topics.sh --bootstrap-server $KAFKA_BROKER --list > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}ERROR: Kafka not ready after $MAX_RETRIES attempts. Exiting.${NC}"
        exit 1
    fi
    echo "  Attempt $RETRY_COUNT/$MAX_RETRIES - waiting 5 seconds..."
    sleep 5
done

echo -e "${GREEN}Kafka is ready!${NC}"
echo ""

# ============================================================================
# Topic Definitions
# ============================================================================
# Define topics with their configuration in format:
#   topic_name:partitions:replication_factor:retention_ms:cleanup_policy
#
# PARTITIONS:
#   - More partitions = more parallelism for consumers
#   - Each partition can only be consumed by one consumer in a group
#   - Rule of thumb: start with 3x number of consumer instances
#
# REPLICATION FACTOR:
#   - Should be <= number of brokers
#   - 1 for development, 3 for production
#   - Higher replication = better durability but more storage
#
# RETENTION (in milliseconds):
#   - email-notifications: 7 days (604800000ms) - standard retention
#   - retry topic: 3 days (259200000ms) - faster cleanup of retries
#   - DLQ: 30 days (2592000000ms) - long retention for investigation
#
# CLEANUP POLICY:
#   - delete: Remove old segments based on time/size
#   - compact: Keep only latest value per key (for state)
# ============================================================================

declare -a TOPICS=(
    # ========================================================================
    # PRIMARY EMAIL REQUESTS TOPIC: email_requests
    # ========================================================================
    # This is the main topic for email requests from the frontend/email-service.
    # 
    # PARTITIONS (6):
    #   - Allows 6 parallel consumers for horizontal scaling
    #   - Even partition count for balanced distribution
    #   - Recommended: partitions >= max expected consumer instances
    #
    # REPLICATION FACTOR (1 for dev, 3 for production):
    #   - Development: 1 (single broker setup)
    #   - Production: 3 (ensures data durability across broker failures)
    #   - Note: Cannot exceed number of brokers in the cluster
    #
    # RETENTION (7 days = 604800000ms):
    #   - Keeps messages for replay and debugging
    #   - Allows consumers to catch up after extended downtime
    #
    # CLEANUP POLICY (delete):
    #   - Time-based retention, oldest messages removed first
    #   - Suitable for event streaming (vs. compact for state)
    #
    # Format: topic:partitions:replication:retention_ms:cleanup
    "email_requests:6:1:604800000:delete"
    
    # ========================================================================
    # RETRY TOPIC: email_requests_retry
    # ========================================================================
    # Intermediate topic for failed messages awaiting retry with exponential backoff.
    #
    # PARTITIONS (6):
    #   - Matches primary topic for consistent throughput
    #
    # REPLICATION FACTOR (1 for dev, 3 for production):
    #   - Same durability requirements as primary topic
    #
    # RETENTION (3 days = 259200000ms):
    #   - Shorter retention as retries should complete quickly
    #   - Failed messages move to DLQ after max retries
    #
    "email_requests_retry:6:1:259200000:delete"
    
    # ========================================================================
    # DEAD LETTER QUEUE: email_dlq
    # ========================================================================
    # Stores messages that failed after all retry attempts for manual investigation.
    #
    # PARTITIONS (3):
    #   - Fewer partitions as DLQ traffic should be minimal
    #   - Enough for parallel manual processing if needed
    #
    # REPLICATION FACTOR (1 for dev, 3 for production):
    #   - Critical data - failed messages need investigation
    #   - Higher replication ensures no data loss
    #
    # RETENTION (30 days = 2592000000ms):
    #   - Extended retention for thorough investigation
    #   - Allows time for debugging and potential reprocessing
    #
    # USE CASES:
    #   - Invalid email addresses (permanent failures)
    #   - Malformed message payloads
    #   - Exceeded retry limits
    #   - Unrecoverable system errors
    #
    "email_dlq:3:1:2592000000:delete"
)

# ============================================================================
# Create Topics
# ============================================================================
echo -e "${GREEN}Creating ECCS Kafka topics...${NC}"
echo ""

for topic_config in "${TOPICS[@]}"; do
    # Parse topic configuration
    IFS=':' read -r topic partitions replication retention cleanup <<< "$topic_config"
    
    echo -e "${YELLOW}Processing topic: $topic${NC}"
    
    # Check if topic already exists
    if kafka-topics.sh --bootstrap-server $KAFKA_BROKER --list | grep -q "^$topic$"; then
        echo -e "  ${GREEN}✓ Topic '$topic' already exists${NC}"
        
        # Optionally update configuration for existing topics
        echo "  Updating configuration..."
        kafka-configs.sh --bootstrap-server $KAFKA_BROKER \
            --entity-type topics \
            --entity-name $topic \
            --alter \
            --add-config "retention.ms=$retention,cleanup.policy=$cleanup" \
            2>/dev/null || echo "  (Config update skipped)"
    else
        # Create new topic with configuration
        echo "  Creating topic with $partitions partitions..."
        
        kafka-topics.sh --bootstrap-server $KAFKA_BROKER \
            --create \
            --topic $topic \
            --partitions $partitions \
            --replication-factor $replication \
            --config retention.ms=$retention \
            --config cleanup.policy=$cleanup \
            --config segment.bytes=1073741824 \
            --config min.insync.replicas=1
        
        echo -e "  ${GREEN}✓ Created topic '$topic'${NC}"
    fi
    
    # Show topic details
    echo "  Configuration:"
    echo "    - Partitions: $partitions"
    echo "    - Replication: $replication"
    echo "    - Retention: $((retention / 86400000)) days"
    echo "    - Cleanup: $cleanup"
    echo ""
done

# ============================================================================
# Verify Topics
# ============================================================================
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Topic Creation Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Created topics:"
kafka-topics.sh --bootstrap-server $KAFKA_BROKER --list | grep "email" | while read topic; do
    echo "  - $topic"
done
echo ""

# Show topic details
echo "Topic details:"
for topic_config in "${TOPICS[@]}"; do
    IFS=':' read -r topic _ _ _ _ <<< "$topic_config"
    echo ""
    echo "=== $topic ==="
    kafka-topics.sh --bootstrap-server $KAFKA_BROKER --describe --topic $topic 2>/dev/null || true
done

echo ""
echo -e "${GREEN}ECCS Kafka setup complete!${NC}"
exit 0
