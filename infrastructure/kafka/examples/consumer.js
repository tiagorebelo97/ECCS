/**
 * ============================================================================
 * ECCS Kafka Consumer Example - Verifying Message Processing
 * ============================================================================
 *
 * This example demonstrates how to consume messages from the 'email_requests'
 * Kafka topic and verify message processing, including error handling and DLQ.
 *
 * PURPOSE:
 * - Demonstrate proper consumer configuration and offset management
 * - Show message deserialization and validation
 * - Illustrate retry and Dead Letter Queue (DLQ) patterns
 * - Verify message processing from producer examples
 *
 * USAGE:
 *   # Install dependencies first
 *   npm install kafkajs
 *
 *   # Run with default settings (localhost:9092)
 *   node consumer.js
 *
 *   # Run with custom broker
 *   KAFKA_BROKERS=kafka:9092 node consumer.js
 *
 *   # Run in DLQ monitoring mode
 *   node consumer.js --dlq
 *
 *   # Run from beginning of topic
 *   node consumer.js --from-beginning
 *
 * ENVIRONMENT VARIABLES:
 *   - KAFKA_BROKERS: Comma-separated Kafka broker addresses (default: localhost:9092)
 *   - KAFKA_GROUP_ID: Consumer group ID (default: example-consumer-group)
 *
 * CONSUMER BEHAVIOR:
 * - Subscribes to email_requests topic (or email_dlq with --dlq flag)
 * - Validates message schema
 * - Logs message details and processing status
 * - Demonstrates error handling and DLQ routing
 *
 * OFFSET MANAGEMENT:
 * - Uses automatic offset commits (default KafkaJS behavior)
 * - Commits after each message is processed successfully
 * - Failed messages are logged but still committed (moved to DLQ in production)
 */

const { Kafka } = require('kafkajs');

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Kafka topic names matching the create-topics.sh configuration.
 */
const EMAIL_REQUESTS_TOPIC = 'email_requests';
const RETRY_TOPIC = 'email_requests_retry';
const DLQ_TOPIC = 'email_dlq';

/**
 * Expected message schema fields for validation.
 */
const REQUIRED_FIELDS = ['id', 'to', 'subject', 'body', 'userId', 'timestamp'];
const OPTIONAL_FIELDS = ['templateId', 'templateData', 'source', 'metadata'];

// ============================================================================
// KAFKA CONSUMER SETUP
// ============================================================================

/**
 * Initialize Kafka client with consumer-optimized configuration.
 *
 * CLIENT CONFIGURATION:
 * - clientId: Identifies this consumer in broker logs
 * - brokers: List of Kafka broker addresses
 * - retry: Built-in retry for transient connection failures
 */
const kafka = new Kafka({
  clientId: 'eccs-example-consumer',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8,
    maxRetryTime: 30000,
  },
  connectionTimeout: 10000,
});

/**
 * Create consumer instance with offset management settings.
 *
 * CONSUMER CONFIGURATION:
 * - groupId: Consumer group for load balancing
 * - sessionTimeout: Time before consumer is considered dead
 * - heartbeatInterval: Frequency of heartbeats to coordinator
 * - maxBytesPerPartition: Maximum data per partition per fetch
 *
 * OFFSET MANAGEMENT:
 * - autoCommit: true (default) - commits after processing
 * - autoCommitInterval: Time between auto-commits
 * - autoCommitThreshold: Messages before auto-commit
 *
 * REBALANCING:
 * - When consumers join/leave, partitions are redistributed
 * - sessionTimeout determines when a consumer is considered dead
 */
const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'example-consumer-group',
  // Session management
  sessionTimeout: 30000,        // 30 seconds
  heartbeatInterval: 3000,      // 3 seconds
  // Fetch settings
  maxBytesPerPartition: 1048576, // 1MB
  maxWaitTimeInMs: 5000,        // Max time to wait for messages
  // Retry settings for consumer operations
  retry: {
    retries: 10,
  },
});

// Producer for sending to DLQ (demonstration)
const producer = kafka.producer();

// ============================================================================
// MESSAGE VALIDATION AND PROCESSING
// ============================================================================

/**
 * Validates the message schema against expected structure.
 *
 * VALIDATION RULES:
 * - All required fields must be present
 * - 'to' field must be a valid email format
 * - 'timestamp' must be a valid ISO8601 date
 * - 'id' must be a non-empty string
 *
 * @param {Object} message - Parsed message payload
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
function validateMessage(message) {
  const errors = [];

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (message[field] === undefined || message[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate email format
  if (message.to && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.to)) {
    errors.push(`Invalid email format: ${message.to}`);
  }

  // Validate timestamp format
  if (message.timestamp) {
    const date = new Date(message.timestamp);
    if (isNaN(date.getTime())) {
      errors.push(`Invalid timestamp format: ${message.timestamp}`);
    }
  }

  // Validate ID is non-empty
  if (message.id !== undefined && (typeof message.id !== 'string' || message.id.trim() === '')) {
    errors.push('ID must be a non-empty string');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Processes a single message from Kafka.
 *
 * PROCESSING STEPS:
 * 1. Deserialize JSON payload
 * 2. Validate message schema
 * 3. Log message details
 * 4. Simulate processing (in production: actual email sending)
 * 5. Handle errors and route to DLQ if needed
 *
 * ERROR HANDLING:
 * - Parse errors: Immediate DLQ (cannot retry malformed JSON)
 * - Validation errors: Immediate DLQ (cannot fix data issues)
 * - Processing errors: Could retry, then DLQ after max attempts
 *
 * @param {Object} kafkaMessage - Raw Kafka message object
 * @param {string} topic - Topic the message came from
 * @param {number} partition - Partition the message came from
 * @returns {Object} Processing result
 */
async function processMessage(kafkaMessage, topic, partition) {
  const offset = kafkaMessage.offset;
  const key = kafkaMessage.key?.toString();
  const timestamp = kafkaMessage.timestamp;

  console.log('\n' + '-'.repeat(60));
  console.log(`📨 Message received from ${topic}`);
  console.log(`   Partition: ${partition}, Offset: ${offset}`);
  console.log(`   Key: ${key || 'null'}`);
  console.log(`   Timestamp: ${new Date(parseInt(timestamp)).toISOString()}`);

  // Display headers
  if (kafkaMessage.headers && Object.keys(kafkaMessage.headers).length > 0) {
    console.log('   Headers:');
    for (const [headerKey, headerValue] of Object.entries(kafkaMessage.headers)) {
      console.log(`     ${headerKey}: ${headerValue?.toString() || 'null'}`);
    }
  }

  // ========================================================================
  // STEP 1: Deserialize JSON payload
  // ========================================================================
  let payload;
  try {
    payload = JSON.parse(kafkaMessage.value.toString());
  } catch (parseError) {
    console.log(`   ❌ PARSE ERROR: ${parseError.message}`);
    console.log('   → Would route to DLQ (cannot retry malformed JSON)');
    return {
      success: false,
      error: 'PARSE_ERROR',
      message: parseError.message
    };
  }

  // ========================================================================
  // STEP 2: Validate message schema
  // ========================================================================
  const validation = validateMessage(payload);
  if (!validation.valid) {
    console.log('   ❌ VALIDATION ERRORS:');
    validation.errors.forEach(err => console.log(`      - ${err}`));
    console.log('   → Would route to DLQ (data issues cannot be retried)');
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      errors: validation.errors
    };
  }

  // ========================================================================
  // STEP 3: Log message details
  // ========================================================================
  console.log('   ✅ Message validated successfully');
  console.log(`   Email ID: ${payload.id}`);
  console.log(`   To: ${payload.to}`);
  console.log(`   Subject: ${payload.subject}`);
  console.log(`   Body Preview: ${payload.body.substring(0, 50)}...`);
  console.log(`   User ID: ${payload.userId}`);
  console.log(`   Source: ${payload.source || 'unknown'}`);

  if (payload.templateId) {
    console.log(`   Template: ${payload.templateId}`);
  }

  // ========================================================================
  // STEP 4: Simulate processing
  // ========================================================================
  console.log('   🔄 Processing message...');

  // Simulate some processing time
  await new Promise(resolve => setTimeout(resolve, 100));

  // Simulate occasional failures for demonstration
  // In production, this would be actual email sending logic
  if (Math.random() < 0.1) { // 10% failure rate for demo
    console.log('   ⚠️  SIMULATED FAILURE: Would retry with exponential backoff');
    return {
      success: false,
      error: 'SIMULATED_ERROR',
      message: 'Simulated transient failure for demonstration'
    };
  }

  // ========================================================================
  // STEP 5: Processing complete
  // ========================================================================
  console.log('   ✅ Message processed successfully');

  return {
    success: true,
    emailId: payload.id,
    processedAt: new Date().toISOString()
  };
}

/**
 * Processes a message from the Dead Letter Queue.
 *
 * DLQ MESSAGE STRUCTURE:
 * {
 *   originalData: { ... original email data ... },
 *   dlqMetadata: {
 *     failureReason: "Error message",
 *     failedAt: "ISO8601 timestamp",
 *     totalAttempts: 5,
 *     maxAttemptsConfigured: 5,
 *     originalTopic: "email_requests",
 *     consumerGroup: "notification-group",
 *     serviceInstance: "hostname"
 *   }
 * }
 *
 * @param {Object} kafkaMessage - Raw Kafka message from DLQ
 * @param {number} partition - Partition the message came from
 */
async function processDlqMessage(kafkaMessage, partition) {
  const offset = kafkaMessage.offset;
  const key = kafkaMessage.key?.toString();

  console.log('\n' + '='.repeat(60));
  console.log('☠️  DEAD LETTER QUEUE MESSAGE');
  console.log('='.repeat(60));
  console.log(`   Partition: ${partition}, Offset: ${offset}`);
  console.log(`   Key: ${key || 'null'}`);

  // Display headers for quick failure identification
  if (kafkaMessage.headers) {
    console.log('   Headers:');
    for (const [headerKey, headerValue] of Object.entries(kafkaMessage.headers)) {
      console.log(`     ${headerKey}: ${headerValue?.toString() || 'null'}`);
    }
  }

  // Parse DLQ message
  let dlqMessage;
  try {
    dlqMessage = JSON.parse(kafkaMessage.value.toString());
  } catch (parseError) {
    console.log(`   ❌ Cannot parse DLQ message: ${parseError.message}`);
    return;
  }

  // Display failure information
  console.log('\n   📋 FAILURE DETAILS:');
  if (dlqMessage.dlqMetadata) {
    const meta = dlqMessage.dlqMetadata;
    console.log(`   Failure Reason: ${meta.failureReason}`);
    console.log(`   Failed At: ${meta.failedAt}`);
    console.log(`   Total Attempts: ${meta.totalAttempts}/${meta.maxAttemptsConfigured}`);
    console.log(`   Original Topic: ${meta.originalTopic}`);
    console.log(`   Consumer Group: ${meta.consumerGroup}`);
    console.log(`   Service Instance: ${meta.serviceInstance}`);
  }

  // Display original data
  console.log('\n   📧 ORIGINAL EMAIL DATA:');
  if (dlqMessage.originalData) {
    const data = dlqMessage.originalData;
    if (typeof data === 'string') {
      console.log(`   Raw Data: ${data.substring(0, 200)}...`);
    } else {
      console.log(`   ID: ${data.id || 'unknown'}`);
      console.log(`   To: ${data.to || 'unknown'}`);
      console.log(`   Subject: ${data.subject || 'unknown'}`);
    }
  }

  console.log('\n   ⚠️  ACTION REQUIRED: Manual investigation needed');
  console.log('='.repeat(60));
}

// ============================================================================
// CONSUMER STATISTICS
// ============================================================================

let stats = {
  messagesReceived: 0,
  messagesProcessed: 0,
  messagesFailed: 0,
  startTime: null
};

/**
 * Displays consumer statistics.
 */
function displayStats() {
  const runtime = stats.startTime ? (Date.now() - stats.startTime) / 1000 : 0;
  console.log('\n' + '='.repeat(60));
  console.log('📊 CONSUMER STATISTICS');
  console.log('='.repeat(60));
  console.log(`   Runtime: ${runtime.toFixed(1)}s`);
  console.log(`   Messages Received: ${stats.messagesReceived}`);
  console.log(`   Messages Processed: ${stats.messagesProcessed}`);
  console.log(`   Messages Failed: ${stats.messagesFailed}`);
  console.log(`   Success Rate: ${stats.messagesReceived > 0 ? ((stats.messagesProcessed / stats.messagesReceived) * 100).toFixed(1) : 0}%`);
  console.log(`   Throughput: ${runtime > 0 ? (stats.messagesReceived / runtime).toFixed(2) : 0} msg/s`);
  console.log('='.repeat(60));
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

/**
 * Main function running the consumer.
 *
 * MODES:
 * - Default: Consume from email_requests topic
 * - --dlq: Consume from email_dlq topic (DLQ monitoring)
 * - --from-beginning: Start from earliest offset
 */
async function main() {
  console.log('='.repeat(60));
  console.log('ECCS Kafka Consumer Example');
  console.log('='.repeat(60));

  // Parse command line arguments
  const isDlqMode = process.argv.includes('--dlq');
  const fromBeginning = process.argv.includes('--from-beginning');
  const topic = isDlqMode ? DLQ_TOPIC : EMAIL_REQUESTS_TOPIC;

  console.log(`\n📋 Configuration:`);
  console.log(`   Topic: ${topic}`);
  console.log(`   Group ID: ${process.env.KAFKA_GROUP_ID || 'example-consumer-group'}`);
  console.log(`   From Beginning: ${fromBeginning}`);
  console.log(`   Mode: ${isDlqMode ? 'DLQ Monitoring' : 'Normal Processing'}`);

  try {
    // Connect to Kafka
    console.log('\n🔌 Connecting to Kafka...');
    await consumer.connect();
    await producer.connect(); // For potential DLQ routing
    console.log('   ✅ Connected to Kafka brokers');

    // Subscribe to topic
    console.log(`\n📥 Subscribing to topic: ${topic}`);
    await consumer.subscribe({
      topic: topic,
      fromBeginning: fromBeginning
    });
    console.log('   ✅ Subscribed successfully');

    // Initialize stats
    stats.startTime = Date.now();

    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Received SIGINT, shutting down...');
      displayStats();
      await consumer.disconnect();
      await producer.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\n🛑 Received SIGTERM, shutting down...');
      displayStats();
      await consumer.disconnect();
      await producer.disconnect();
      process.exit(0);
    });

    // Start consuming
    console.log('\n👂 Listening for messages... (Ctrl+C to stop)\n');

    await consumer.run({
      /**
       * eachMessage handler processes one message at a time.
       *
       * OFFSET MANAGEMENT:
       * - KafkaJS auto-commits offsets after this function completes
       * - If an error is thrown, the message may be redelivered
       * - We catch all errors to control acknowledgment
       */
      eachMessage: async ({ topic, partition, message }) => {
        stats.messagesReceived++;

        try {
          if (isDlqMode) {
            await processDlqMessage(message, partition);
          } else {
            const result = await processMessage(message, topic, partition);
            if (result.success) {
              stats.messagesProcessed++;
            } else {
              stats.messagesFailed++;
            }
          }
        } catch (error) {
          console.log(`\n❌ Unhandled error: ${error.message}`);
          stats.messagesFailed++;
        }
      }
    });

  } catch (error) {
    console.error('\n❌ Consumer error:', error.message);
    console.error('Stack:', error.stack);
    process.exitCode = 1;
    await consumer.disconnect();
    await producer.disconnect();
  }
}

// Run the consumer
main();
