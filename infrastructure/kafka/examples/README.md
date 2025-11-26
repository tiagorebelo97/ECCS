# ECCS Kafka Examples

This directory contains example Kafka producers and consumers for the ECCS email system.

## Prerequisites

- Node.js 18+
- Kafka broker running (see main project's `podman-compose.yml`)

## Setup

```bash
# Install dependencies
npm install

# Ensure Kafka topics are created
../create-topics.sh
```

## Producer Example

The producer simulates frontend email requests by publishing messages to the `email_requests` topic.

```bash
# Send sample emails
npm run producer

# Send batch of 10 emails
npm run producer:batch
```

### Producer Features

- Proper message serialization (JSON)
- Message key for partition affinity
- Headers for metadata
- Idempotent producer configuration
- Sample email data for testing

## Consumer Example

The consumer demonstrates message processing, validation, and error handling.

```bash
# Consume from email_requests topic
npm run consumer

# Monitor Dead Letter Queue
npm run consumer:dlq

# Consume from beginning of topic
npm run consumer:from-beginning
```

### Consumer Features

- Message schema validation
- Offset management (automatic commit)
- Error handling demonstration
- Statistics tracking
- DLQ monitoring mode

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KAFKA_BROKERS` | `localhost:9092` | Kafka broker addresses |
| `KAFKA_GROUP_ID` | `example-consumer-group` | Consumer group ID |

## Message Schema

See [KAFKA.md](../../../docs/KAFKA.md) for detailed message schema documentation.

### Quick Reference

```json
{
  "id": "uuid",
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "body": "Email content",
  "userId": "user-123",
  "timestamp": "2024-01-15T10:30:00Z",
  "source": "example-producer",
  "templateId": null,
  "templateData": null
}
```

## Troubleshooting

### Connection refused

Ensure Kafka is running:
```bash
# Check Kafka status
docker ps | grep kafka

# Or with podman
podman ps | grep kafka
```

### Consumer not receiving messages

1. Check topic exists:
   ```bash
   kafka-topics.sh --bootstrap-server localhost:9092 --list
   ```

2. Check consumer group lag:
   ```bash
   kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
     --describe --group example-consumer-group
   ```

3. Try consuming from beginning:
   ```bash
   npm run consumer:from-beginning
   ```
