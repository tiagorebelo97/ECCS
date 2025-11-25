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
    # Primary email notification topic
    # Format: topic:partitions:replication:retention_ms:cleanup
    "email-notifications:3:1:604800000:delete"
    
    # Retry topic for failed email processing
    # Messages are requeued here for retry attempts
    "email-notifications-retry:3:1:259200000:delete"
    
    # Dead Letter Queue for permanently failed messages
    # Messages here require manual intervention
    "email-notifications-dlq:3:1:2592000000:delete"
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
kafka-topics.sh --bootstrap-server $KAFKA_BROKER --list | grep "email-" | while read topic; do
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
