/**
 * ============================================================================
 * ECCS Kafka Producer Example - Simulating Frontend Email Requests
 * ============================================================================
 *
 * This example demonstrates how to produce messages to the 'email_requests'
 * Kafka topic, simulating frontend email request submissions.
 *
 * PURPOSE:
 * - Demonstrate proper message structure and serialization
 * - Show best practices for Kafka producer configuration
 * - Simulate frontend requests for testing the notification-service
 *
 * USAGE:
 *   # Install dependencies first
 *   npm install kafkajs uuid
 *
 *   # Run with default settings (localhost:9092)
 *   node producer.js
 *
 *   # Run with custom broker
 *   KAFKA_BROKERS=kafka:9092 node producer.js
 *
 *   # Run in batch mode (sends multiple messages)
 *   node producer.js --batch 10
 *
 * ENVIRONMENT VARIABLES:
 *   - KAFKA_BROKERS: Comma-separated Kafka broker addresses (default: localhost:9092)
 *
 * MESSAGE SCHEMA:
 * The producer sends messages with the following JSON structure:
 * {
 *   "id": "uuid",              // Unique message identifier
 *   "to": "email@example.com", // Recipient email address
 *   "subject": "string",       // Email subject line
 *   "body": "string",          // Email body content
 *   "userId": "string",        // User ID who initiated the request
 *   "timestamp": "ISO8601",    // Request timestamp
 *   "source": "string",        // Source system identifier
 *   "templateId": "string",    // Optional: Template ID for templated emails
 *   "templateData": {}         // Optional: Data for template placeholders
 * }
 *
 * SERIALIZATION:
 * - Key: Email ID as string (for partition consistency)
 * - Value: JSON.stringify(emailData) with UTF-8 encoding
 * - Headers: Metadata for filtering without deserializing body
 */

const { Kafka, Partitioners } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Kafka topic name for email requests.
 * This matches the topic created by create-topics.sh
 */
const EMAIL_REQUESTS_TOPIC = 'email_requests';

/**
 * Sample email data for demonstration.
 * In production, this would come from the frontend API request.
 */
const SAMPLE_EMAILS = [
  {
    to: 'user1@example.com',
    subject: 'Welcome to ECCS',
    body: 'Thank you for signing up! Your account has been created successfully.',
    templateId: null,
    templateData: null
  },
  {
    to: 'user2@example.com',
    subject: 'Password Reset Request',
    body: 'Click the link below to reset your password. This link expires in 24 hours.',
    templateId: 'password-reset',
    templateData: { resetLink: 'https://eccs.example.com/reset/abc123', userName: 'John Doe' }
  },
  {
    to: 'user3@example.com',
    subject: 'Order Confirmation #12345',
    body: 'Your order has been confirmed and will be shipped within 2-3 business days.',
    templateId: 'order-confirmation',
    templateData: { orderNumber: '12345', totalAmount: '$99.99', items: ['Item A', 'Item B'] }
  },
  {
    to: 'user4@example.com',
    subject: 'Weekly Newsletter',
    body: 'Here are this week\'s updates from ECCS...',
    templateId: null,
    templateData: null
  },
  {
    to: 'user5@example.com',
    subject: 'Account Verification Required',
    body: 'Please verify your email address by clicking the link below.',
    templateId: 'email-verification',
    templateData: { verificationLink: 'https://eccs.example.com/verify/xyz789', userName: 'Jane Smith' }
  }
];

// ============================================================================
// KAFKA PRODUCER SETUP
// ============================================================================

/**
 * Initialize Kafka client with production-ready configuration.
 *
 * CLIENT CONFIGURATION:
 * - clientId: Identifies this producer in broker logs
 * - brokers: List of Kafka broker addresses
 * - retry: Built-in retry for transient connection failures
 * - connectionTimeout: Time to wait for initial connection
 */
const kafka = new Kafka({
  clientId: 'eccs-example-producer',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,      // Initial retry delay (ms)
    retries: 8,                 // Maximum retry attempts
    maxRetryTime: 30000,        // Maximum retry delay (ms)
    factor: 2,                  // Exponential backoff factor
    multiplier: 1.5,            // Randomization factor
  },
  connectionTimeout: 10000,     // 10 second connection timeout
});

/**
 * Create producer instance with optimal settings.
 *
 * PRODUCER CONFIGURATION:
 * - createPartitioner: Uses default partitioner (key-based if key provided)
 * - idempotent: Enables exactly-once semantics (prevents duplicates)
 * - maxInFlightRequests: Concurrent requests per connection
 * - transactionTimeout: Timeout for transactional operations
 *
 * PARTITIONER BEHAVIOR:
 * - With key: Consistent partition assignment (same key → same partition)
 * - Without key: Round-robin distribution across partitions
 */
const producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner,
  // Enable idempotent producer for exactly-once semantics
  // Note: Requires Kafka 0.11+ and acks=all
  idempotent: true,
  // Maximum in-flight requests per connection
  maxInFlightRequests: 5,
  // Transaction timeout (for transactional producer)
  transactionTimeout: 30000,
});

// ============================================================================
// MESSAGE CREATION FUNCTIONS
// ============================================================================

/**
 * Creates a properly formatted email request message.
 *
 * MESSAGE STRUCTURE:
 * This function ensures consistent message format across all producers.
 * The structure matches what the notification-service consumer expects.
 *
 * SERIALIZATION STRATEGY:
 * - Key: String (email ID) for partition affinity
 * - Value: JSON string for flexible schema evolution
 * - Headers: Metadata for routing and filtering
 *
 * @param {Object} emailData - Email request data
 * @param {string} emailData.to - Recipient email address
 * @param {string} emailData.subject - Email subject line
 * @param {string} emailData.body - Email body content
 * @param {string} [emailData.templateId] - Optional template ID
 * @param {Object} [emailData.templateData] - Optional template data
 * @param {string} userId - ID of user sending the email
 * @returns {Object} Formatted Kafka message object
 */
function createEmailMessage(emailData, userId) {
  // Generate unique ID for this email request
  const emailId = uuidv4();
  const timestamp = new Date().toISOString();

  // Construct the message payload
  // This schema matches what notification-service expects
  const payload = {
    // Unique identifier for tracking and deduplication
    id: emailId,
    // Recipient information
    to: emailData.to,
    // Email content
    subject: emailData.subject,
    body: emailData.body,
    // User context
    userId: userId,
    // Templating (optional)
    templateId: emailData.templateId || null,
    templateData: emailData.templateData || null,
    // Metadata
    timestamp: timestamp,
    source: 'example-producer',
    // Request metadata for debugging
    metadata: {
      clientVersion: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }
  };

  // Return formatted Kafka message
  return {
    // Key ensures messages for same email go to same partition
    // This maintains ordering for related operations
    key: emailId,
    // JSON-serialized payload
    value: JSON.stringify(payload),
    // Headers for quick filtering without deserializing body
    headers: {
      'x-email-id': emailId,
      'x-user-id': userId,
      'x-timestamp': timestamp,
      'x-source': 'example-producer',
      'x-content-type': 'application/json'
    }
  };
}

// ============================================================================
// PRODUCER FUNCTIONS
// ============================================================================

/**
 * Sends a single email request to Kafka.
 *
 * DELIVERY GUARANTEES:
 * - acks: 'all' ensures message is written to all replicas
 * - Idempotent producer prevents duplicate messages
 * - Retries handle transient failures automatically
 *
 * @param {Object} emailData - Email request data
 * @param {string} userId - User ID sending the email
 * @returns {Promise<Object>} Kafka send result with partition and offset
 */
async function sendEmailRequest(emailData, userId) {
  const message = createEmailMessage(emailData, userId);

  console.log(`\n📧 Sending email request:`);
  console.log(`   ID: ${message.key}`);
  console.log(`   To: ${emailData.to}`);
  console.log(`   Subject: ${emailData.subject}`);

  // Send to Kafka with delivery acknowledgment
  const result = await producer.send({
    topic: EMAIL_REQUESTS_TOPIC,
    messages: [message],
    // Acknowledgment level
    // 0: No acknowledgment (fire and forget)
    // 1: Leader acknowledgment only
    // -1/all: All replicas must acknowledge
    acks: -1,  // Equivalent to 'all'
    // Timeout for request completion
    timeout: 30000,
  });

  // Log delivery confirmation
  const recordMetadata = result[0];
  console.log(`   ✅ Delivered to partition ${recordMetadata.partition}, offset ${recordMetadata.baseOffset}`);

  return result;
}

/**
 * Sends a batch of email requests to Kafka.
 *
 * BATCH BENEFITS:
 * - Improved throughput (fewer network round trips)
 * - Better compression (larger batches compress better)
 * - Atomic delivery (all messages in batch succeed or fail together)
 *
 * @param {Array<Object>} emailsWithUsers - Array of {emailData, userId} objects
 * @returns {Promise<Object>} Kafka batch send result
 */
async function sendBatchEmailRequests(emailsWithUsers) {
  console.log(`\n📦 Sending batch of ${emailsWithUsers.length} email requests...`);

  // Create messages for all emails
  const messages = emailsWithUsers.map(({ emailData, userId }) =>
    createEmailMessage(emailData, userId)
  );

  // Send batch
  const result = await producer.send({
    topic: EMAIL_REQUESTS_TOPIC,
    messages: messages,
    acks: -1,
    timeout: 30000,
  });

  console.log(`   ✅ Batch delivered successfully`);
  result.forEach((metadata) => {
    console.log(`   Partition ${metadata.partition}: offsets ${metadata.baseOffset} - ${metadata.baseOffset + messages.length - 1}`);
  });

  return result;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

/**
 * Main function demonstrating producer usage.
 *
 * DEMONSTRATION MODES:
 * 1. Single message: Sends one email request
 * 2. Batch mode (--batch N): Sends N random email requests
 * 3. Interactive: Prompts for email details (if implemented)
 */
async function main() {
  console.log('='.repeat(60));
  console.log('ECCS Kafka Producer Example');
  console.log('='.repeat(60));

  try {
    // Connect to Kafka
    console.log('\n🔌 Connecting to Kafka...');
    await producer.connect();
    console.log('   ✅ Connected to Kafka brokers');

    // Check for batch mode argument
    const batchIndex = process.argv.indexOf('--batch');
    const batchSize = batchIndex !== -1 ? parseInt(process.argv[batchIndex + 1]) || 5 : 0;

    if (batchSize > 0) {
      // ======================================================================
      // BATCH MODE: Send multiple messages
      // ======================================================================
      console.log(`\n📊 Batch mode: Sending ${batchSize} email requests`);

      // Generate batch of email requests
      const batch = [];
      for (let i = 0; i < batchSize; i++) {
        // Select random sample email
        const emailData = SAMPLE_EMAILS[i % SAMPLE_EMAILS.length];
        // Generate random user ID
        const userId = `user-${Math.floor(Math.random() * 1000)}`;
        batch.push({ emailData, userId });
      }

      // Send batch
      await sendBatchEmailRequests(batch);

    } else {
      // ======================================================================
      // SINGLE MODE: Send individual messages
      // ======================================================================
      console.log('\n📊 Single mode: Sending sample email requests');

      // Send each sample email
      for (const emailData of SAMPLE_EMAILS) {
        const userId = `user-${Math.floor(Math.random() * 1000)}`;
        await sendEmailRequest(emailData, userId);
        // Small delay between messages for demonstration
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All messages sent successfully!');
    console.log('='.repeat(60));

    // Display message schema for reference
    console.log('\n📋 Message Schema Reference:');
    console.log(JSON.stringify({
      id: 'uuid-v4',
      to: 'recipient@example.com',
      subject: 'Email subject',
      body: 'Email body content',
      userId: 'user-id',
      templateId: 'optional-template-id',
      templateData: { key: 'value' },
      timestamp: 'ISO8601 timestamp',
      source: 'producer-identifier',
      metadata: { clientVersion: '1.0.0', environment: 'development' }
    }, null, 2));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exitCode = 1;
  } finally {
    // Disconnect producer
    console.log('\n🔌 Disconnecting from Kafka...');
    await producer.disconnect();
    console.log('   ✅ Disconnected');
  }
}

// Run the example
main();
