# Apache Kafka Setup for ECCS

This document provides comprehensive documentation for the Apache Kafka setup in the ECCS (Enterprise Cloud Communication System) platform, covering topic configurations, message schemas, serialization strategies, and error management patterns.

## Table of Contents

1. [Overview](#overview)
2. [Topic Configurations](#topic-configurations)
3. [Message Schemas](#message-schemas)
4. [Serialization Strategy](#serialization-strategy)
5. [Error Management](#error-management)
6. [Example Usage](#example-usage)
7. [Monitoring and Operations](#monitoring-and-operations)

---

## Overview

### Architecture

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  Frontend/API   │────▶│   email_requests    │────▶│  Notification   │
│  (Producer)     │     │   (Kafka Topic)     │     │   Service       │
│                 │     │                     │     │  (Consumer)     │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
                                                            │
                                                            ▼
                                                    ┌───────────────┐
                                                    │   Success?    │
                                                    └───────┬───────┘
                                                       Yes │   │ No
                                                           │   │
                    ┌──────────────────────────────────────┘   │
                    │                                          │
                    ▼                                          ▼
            ┌───────────────┐                      ┌─────────────────────┐
            │   MongoDB     │                      │ email_requests_retry │
            │   (Log)       │                      │   (Retry Topic)     │
            └───────────────┘                      └─────────────────────┘
                                                            │
                                                            ▼
                                                    ┌───────────────┐
                                                    │ Max Retries?  │
                                                    └───────┬───────┘
                                                       No  │   │ Yes
                                                           │   │
                    ┌──────────────────────────────────────┘   │
                    │                                          │
                    ▼                                          ▼
            ┌───────────────┐                      ┌───────────────────┐
            │  Retry with   │                      │    email_dlq      │
            │  Backoff      │                      │ (Dead Letter Queue)│
            └───────────────┘                      └───────────────────┘
```

### Components

| Component | Role | Description |
|-----------|------|-------------|
| Email Service | Producer | Publishes email requests to Kafka when users submit emails |
| Notification Service | Consumer | Consumes email requests and handles delivery via SMTP |
| Kafka | Message Broker | Provides reliable, scalable message streaming |
| Zookeeper | Coordination | Manages Kafka cluster coordination |

---

## Topic Configurations

### Topic: `email_requests`

The primary topic for incoming email requests from the frontend/email-service.

```bash
Topic: email_requests
Partitions: 6
Replication Factor: 1 (dev) / 3 (prod)
Retention: 7 days (604800000ms)
Cleanup Policy: delete
```

**Configuration Rationale:**

| Setting | Value | Reasoning |
|---------|-------|-----------|
| **Partitions: 6** | Allows 6 parallel consumers | Even distribution for balanced load; recommended: partitions ≥ max consumer instances |
| **Replication: 1/3** | Dev: 1, Prod: 3 | Production requires 3 for high availability; cannot exceed broker count |
| **Retention: 7 days** | 604800000ms | Allows replay for debugging and consumer catch-up |
| **Cleanup: delete** | Time-based deletion | Suitable for event streaming (vs. compact for state) |

**Additional Topic Configs:**

```bash
segment.bytes=1073741824       # 1GB segment size
min.insync.replicas=1          # Minimum replicas for write acknowledgment
```

### Topic: `email_requests_retry`

Intermediate topic for failed messages awaiting retry with exponential backoff.

```bash
Topic: email_requests_retry
Partitions: 6
Replication Factor: 1 (dev) / 3 (prod)
Retention: 3 days (259200000ms)
Cleanup Policy: delete
```

**Configuration Rationale:**

| Setting | Value | Reasoning |
|---------|-------|-----------|
| **Partitions: 6** | Matches primary topic | Consistent throughput and processing capability |
| **Retention: 3 days** | 259200000ms | Shorter retention; failed messages move to DLQ after max retries |

### Topic: `email_dlq` (Dead Letter Queue)

Stores messages that failed after all retry attempts for manual investigation.

```bash
Topic: email_dlq
Partitions: 3
Replication Factor: 1 (dev) / 3 (prod)
Retention: 30 days (2592000000ms)
Cleanup Policy: delete
```

**Configuration Rationale:**

| Setting | Value | Reasoning |
|---------|-------|-----------|
| **Partitions: 3** | Fewer than primary | DLQ traffic should be minimal; enough for parallel manual processing |
| **Retention: 30 days** | 2592000000ms | Extended retention for thorough investigation |

**DLQ Use Cases:**
- Invalid email addresses (permanent failures)
- Malformed message payloads
- Exceeded retry limits
- Unrecoverable system errors

### Creating Topics

Use the provided script to create all topics:

```bash
# Set broker address (optional, defaults to localhost:9092)
export KAFKA_BROKER=kafka:9092

# Run the topic creation script
./infrastructure/kafka/create-topics.sh
```

---

## Message Schemas

### Email Request Message

Messages sent to the `email_requests` topic follow this JSON schema:

```json
{
  "id": "uuid-v4-string",
  "to": "recipient@example.com",
  "subject": "Email subject line",
  "body": "Plain text or HTML email body content",
  "userId": "user-identifier",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "source": "email-service-api",
  "templateId": "optional-template-id",
  "templateData": {
    "key1": "value1",
    "key2": "value2"
  },
  "metadata": {
    "clientVersion": "1.0.0",
    "environment": "production"
  }
}
```

**Field Definitions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | ✅ | Unique identifier for tracking and deduplication |
| `to` | string (email) | ✅ | Recipient email address |
| `subject` | string | ✅ | Email subject line (max 500 chars) |
| `body` | string | ✅ | Email body content |
| `userId` | string | ✅ | ID of user initiating the request |
| `timestamp` | string (ISO8601) | ✅ | Request timestamp |
| `source` | string | ❌ | Source system identifier |
| `templateId` | string | ❌ | Template ID for templated emails |
| `templateData` | object | ❌ | Data for template placeholders |
| `metadata` | object | ❌ | Additional context for debugging |

### Retry Message Schema

Messages in the `email_requests_retry` topic include retry metadata:

```json
{
  "id": "uuid-v4-string",
  "to": "recipient@example.com",
  "subject": "Email subject",
  "body": "Email content",
  "userId": "user-id",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "_retry": {
    "attempt": 2,
    "previousError": "Connection timeout",
    "scheduledAt": "2024-01-15T10:32:00.000Z",
    "backoffDelayMs": 4000,
    "originalTopic": "email_requests"
  }
}
```

**Retry Metadata Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `attempt` | number | Current retry attempt (1-based) |
| `previousError` | string | Error message from previous attempt |
| `scheduledAt` | string (ISO8601) | When this retry was scheduled |
| `backoffDelayMs` | number | Delay applied before retry |
| `originalTopic` | string | Topic where message originated |

### Dead Letter Queue Message Schema

Messages in `email_dlq` contain failure context:

```json
{
  "originalData": {
    "id": "uuid",
    "to": "recipient@example.com",
    "subject": "Subject",
    "body": "Content",
    "userId": "user-id",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "dlqMetadata": {
    "failureReason": "Max retries exceeded: Connection refused",
    "failedAt": "2024-01-15T10:45:00.000Z",
    "totalAttempts": 5,
    "maxAttemptsConfigured": 5,
    "originalTopic": "email_requests",
    "consumerGroup": "notification-group",
    "serviceInstance": "notification-service-pod-1"
  }
}
```

---

## Serialization Strategy

### Key Serialization

- **Type:** String
- **Content:** Email ID (UUID)
- **Purpose:** Partition affinity and message ordering

```javascript
key: emailId.toString()  // "550e8400-e29b-41d4-a716-446655440000"
```

**Benefits:**
- Same email ID → same partition → ordered processing
- Enables deduplication based on key
- Efficient partition lookup

### Value Serialization

- **Type:** JSON (UTF-8 encoded)
- **Format:** `JSON.stringify(payload)`

```javascript
value: JSON.stringify({
  id: "550e8400-e29b-41d4-a716-446655440000",
  to: "user@example.com",
  subject: "Hello",
  body: "Content",
  userId: "user-123",
  timestamp: new Date().toISOString()
})
```

**Why JSON?**

| Advantage | Description |
|-----------|-------------|
| **Schema Evolution** | Add new fields without breaking consumers |
| **Human Readable** | Easy debugging and log analysis |
| **Language Agnostic** | Works with any Kafka client |
| **Tooling Support** | Compatible with Kafka tools (kafka-console-consumer) |

**JSON vs. Alternatives:**

| Format | Pros | Cons | Use Case |
|--------|------|------|----------|
| JSON | Flexible, readable | Larger size | General purpose |
| Avro | Schema registry, compact | Setup complexity | High-volume systems |
| Protobuf | Compact, typed | Schema management | Performance-critical |

### Header Serialization

Headers provide metadata for routing and filtering without deserializing the body:

```javascript
headers: {
  'x-email-id': emailId.toString(),
  'x-user-id': userId.toString(),
  'x-timestamp': new Date().toISOString(),
  'x-content-type': 'application/json'
}
```

**Header Use Cases:**
- Message routing based on metadata
- Quick filtering without parsing body
- Tracing and correlation
- Content type identification

---

## Error Management

### Error Categories

| Category | Examples | Handling Strategy |
|----------|----------|-------------------|
| **Transient** | Network timeout, rate limit | Retry with exponential backoff |
| **Permanent** | Invalid email format, auth failure | Send to DLQ immediately |
| **Parse Error** | Malformed JSON | Send to DLQ (cannot retry) |

### Retry Policy: Exponential Backoff

The notification-service implements exponential backoff for transient failures:

```
Delay = min(BASE_DELAY × 2^attempt, MAX_DELAY) ± jitter
```

**Default Configuration:**

| Parameter | Value | Environment Variable |
|-----------|-------|---------------------|
| Base Delay | 1000ms | `BASE_RETRY_DELAY` |
| Max Delay | 60000ms | `MAX_RETRY_DELAY` |
| Max Attempts | 5 | `MAX_RETRY_ATTEMPTS` |
| Jitter | ±10% | Built-in |

**Retry Schedule Example:**

| Attempt | Delay (approx) | Cumulative Time |
|---------|----------------|-----------------|
| 1 | 1 second | 1 second |
| 2 | 2 seconds | 3 seconds |
| 3 | 4 seconds | 7 seconds |
| 4 | 8 seconds | 15 seconds |
| 5 | 16 seconds | 31 seconds |
| DLQ | - | After 31 seconds |

### Dead Letter Queue Handling

Messages reach the DLQ when:

1. **Max retries exceeded** - After 5 failed attempts
2. **Parse errors** - Malformed JSON payload
3. **Validation errors** - Missing required fields
4. **Permanent failures** - Invalid email address

**DLQ Processing Workflow:**

```
1. Alert on DLQ messages (monitoring)
2. Investigate failure reason
3. Fix root cause (if possible)
4. Manually reprocess or archive
```

### Consumer Offset Management

The notification-service uses automatic offset commits:

```javascript
consumer.run({
  autoCommit: true,           // Default: commits after processing
  autoCommitInterval: 5000,   // Commit every 5 seconds
  autoCommitThreshold: 100    // Or every 100 messages
});
```

**Offset Strategies:**

| Strategy | Pros | Cons | Use Case |
|----------|------|------|----------|
| Auto commit | Simple | At-least-once | Default |
| Manual commit | Precise control | Complex | Exactly-once |
| Transactional | Exactly-once | Performance overhead | Financial |

---

## Example Usage

### Running the Examples

```bash
# Navigate to examples directory
cd infrastructure/kafka/examples

# Install dependencies
npm install

# Run producer (sends sample messages)
npm run producer

# Run producer in batch mode
npm run producer:batch

# Run consumer (processes messages)
npm run consumer

# Run consumer for DLQ monitoring
npm run consumer:dlq

# Run consumer from beginning of topic
npm run consumer:from-beginning
```

### Producer Example

```javascript
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'email-producer',
  brokers: ['localhost:9092']
});

const producer = kafka.producer();

async function sendEmail(emailData) {
  await producer.connect();
  
  await producer.send({
    topic: 'email_requests',
    messages: [{
      key: emailData.id,
      value: JSON.stringify(emailData),
      headers: {
        'x-email-id': emailData.id,
        'x-timestamp': new Date().toISOString()
      }
    }],
    acks: -1  // Wait for all replicas
  });
  
  await producer.disconnect();
}
```

### Consumer Example

```javascript
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'email-consumer',
  brokers: ['localhost:9092']
});

const consumer = kafka.consumer({ 
  groupId: 'notification-group' 
});

async function processEmails() {
  await consumer.connect();
  await consumer.subscribe({ 
    topic: 'email_requests', 
    fromBeginning: false 
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const emailData = JSON.parse(message.value.toString());
      
      try {
        await sendEmail(emailData);
        console.log(`✅ Email ${emailData.id} sent`);
      } catch (error) {
        console.error(`❌ Failed: ${error.message}`);
        // Implement retry/DLQ logic here
      }
    }
  });
}
```

---

## Monitoring and Operations

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `kafka_consumer_lag` | Messages waiting to be processed | > 1000 |
| `emails_processed_total` | Total emails processed | N/A (counter) |
| `email_processing_duration_seconds` | Processing latency | p99 > 30s |
| `email_retry_queue_depth` | Messages in retry queue | > 100 |

### Prometheus Metrics

The notification-service exposes metrics at `/metrics`:

```
# Email processing metrics
emails_processed_total{status="success"} 1000
emails_processed_total{status="retry"} 50
emails_processed_total{status="failed"} 5
emails_processed_total{status="dlq"} 2

# Processing duration histogram
email_processing_duration_seconds_bucket{le="0.5"} 800
email_processing_duration_seconds_bucket{le="1"} 950
email_processing_duration_seconds_bucket{le="5"} 995

# Retry queue depth
email_retry_queue_depth 3
```

### Health Checks

Each service exposes health endpoints:

```bash
# Notification service health
curl http://localhost:3003/health
# Response: {"status":"healthy","service":"notification-service"}

# Kafka broker health
kafka-broker-api-versions --bootstrap-server localhost:9092
```

### Common Operations

**List topics:**
```bash
kafka-topics.sh --bootstrap-server localhost:9092 --list
```

**Describe topic:**
```bash
kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic email_requests
```

**Consumer group status:**
```bash
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group notification-group
```

**Reset consumer offset:**
```bash
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --group notification-group \
  --topic email_requests \
  --reset-offsets --to-earliest --execute
```

**Consume messages (debugging):**
```bash
kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic email_requests \
  --from-beginning \
  --max-messages 10
```

---

## Best Practices

### Producer Best Practices

1. **Use idempotent producer** - Prevents duplicate messages
2. **Set appropriate acks** - Use `acks: -1` for durability
3. **Use keys for ordering** - Same key → same partition
4. **Handle send failures** - Implement retry logic

### Consumer Best Practices

1. **Handle rebalancing** - Implement proper shutdown handlers
2. **Process idempotently** - Messages may be redelivered
3. **Monitor consumer lag** - Alert on growing lag
4. **Use DLQ for failures** - Don't block the queue

### Schema Evolution

1. **Add optional fields only** - Maintains backward compatibility
2. **Never remove required fields** - Breaks existing consumers
3. **Version your schemas** - Include version in metadata
4. **Document changes** - Maintain schema changelog

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Consumer lag growing | Slow processing | Scale consumers, optimize processing |
| Messages in DLQ | Repeated failures | Check logs, fix root cause |
| Timeout errors | Network issues | Check connectivity, increase timeouts |
| Duplicate messages | Retry without idempotency | Implement deduplication |

### Debug Commands

```bash
# Check Kafka logs
docker logs eccs-kafka

# Check consumer group
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group notification-group

# Check topic partitions
kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic email_requests
```

---

## References

- [KafkaJS Documentation](https://kafka.js.org/)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [Confluent Kafka Best Practices](https://www.confluent.io/blog/)
