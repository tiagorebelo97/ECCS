#!/bin/bash
# Script to create Kafka topics

KAFKA_BROKER=${KAFKA_BROKER:-localhost:9092}

# Wait for Kafka to be ready
echo "Waiting for Kafka to be ready..."
while ! kafka-topics.sh --bootstrap-server $KAFKA_BROKER --list > /dev/null 2>&1; do
  sleep 5
done
echo "Kafka is ready!"

# Create topics
topics=(
  "email-notifications:3:1"
  "email-notifications-retry:3:1"
  "email-notifications-dlq:3:1"
)

for topic_config in "${topics[@]}"; do
  IFS=':' read -r topic partitions replication <<< "$topic_config"
  
  # Check if topic exists
  if kafka-topics.sh --bootstrap-server $KAFKA_BROKER --list | grep -q "^$topic$"; then
    echo "Topic '$topic' already exists"
  else
    kafka-topics.sh --bootstrap-server $KAFKA_BROKER \
      --create \
      --topic $topic \
      --partitions $partitions \
      --replication-factor $replication
    echo "Created topic '$topic' with $partitions partitions"
  fi
done

echo "Topic setup complete!"
