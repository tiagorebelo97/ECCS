/**
 * ============================================================================
 * ECCS Notification Service - Kafka Consumer with Retry and DLQ Support
 * ============================================================================
 *
 * This service is responsible for:
 * 1. Consuming email request messages from the 'email_requests' Kafka topic
 * 2. Processing emails using Nodemailer with optional SES/SendGrid support
 * 3. Implementing exponential backoff retry policy for transient failures
 * 4. Forwarding permanently failed messages to the Dead Letter Queue (DLQ)
 * 5. Logging all processing steps, errors, and latency metrics to MongoDB
 *
 * ARCHITECTURE OVERVIEW:
 * ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
 * │  email_requests  │ ───> │ Notification Svc │ ───> │  SMTP/SES/Grid   │
 * │   (Kafka Topic)  │      │   (Consumer)     │      │  (Email Delivery)│
 * └──────────────────┘      └──────────────────┘      └──────────────────┘
 *          │                        │
 *          │                        ├── Success ──> MongoDB (log)
 *          │                        │
 *          │                        └── Failure ──> Retry Queue
 *          │                                            │
 *          └─────── email_requests_retry <──────────────┘
 *                           │
 *                           └── Max Retries ──> email_dlq (Dead Letter Queue)
 *
 * CONTROL FLOW:
 * 1. Consumer subscribes to 'email_requests' and 'email_requests_retry' topics
 * 2. Messages are processed with automatic offset management
 * 3. On success: log to MongoDB, acknowledge message (auto-commit)
 * 4. On failure: calculate exponential backoff delay, send to retry topic
 * 5. After max retries exceeded: forward to 'email_dlq' for manual review
 *
 * ERROR HANDLING STRATEGY:
 * - Transient errors (network, rate limits): Retry with exponential backoff
 * - Permanent errors (invalid email, auth failure): Log and send to DLQ
 * - Unhandled exceptions: Logged with full stack trace, message sent to DLQ
 *
 * MESSAGE ACKNOWLEDGEMENT:
 * - Uses KafkaJS automatic offset management (autoCommit: true by default)
 * - Messages are committed after successful processing of eachMessage
 * - Failed messages are not acknowledged until retry/DLQ handling completes
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const promClient = require('prom-client');
const logger = require('./config/logger');
const EmailProcessor = require('./services/emailProcessor');
const { initTracer } = require('./config/tracer');

// ============================================================================
// EXPRESS APPLICATION SETUP
// ============================================================================
const app = express();
const PORT = process.env.PORT || 3003;

// Initialize distributed tracing for request correlation across services
const tracer = initTracer('notification-service');

// ============================================================================
// PROMETHEUS METRICS CONFIGURATION
// ============================================================================
// These metrics are exposed at /metrics for Prometheus scraping and Grafana visualization

// Collect default Node.js metrics (memory, CPU, event loop, etc.)
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics();

/**
 * Counter metric for tracking total emails processed, categorized by status.
 * Status labels: 'success', 'retry', 'failed', 'dlq'
 * Used for monitoring email delivery success rates and failure patterns.
 */
const emailsProcessed = new promClient.Counter({
  name: 'emails_processed_total',
  help: 'Total number of emails processed',
  labelNames: ['status']
});

/**
 * Histogram metric for measuring email processing duration.
 * Buckets are optimized for typical email delivery times (0.5s to 30s).
 * Used for tracking latency SLAs and identifying slow deliveries.
 */
const emailProcessingDuration = new promClient.Histogram({
  name: 'email_processing_duration_seconds',
  help: 'Duration of email processing in seconds',
  buckets: [0.5, 1, 2, 5, 10, 30]
});

/**
 * Gauge metric for tracking current retry queue depth.
 * High values may indicate delivery issues or rate limiting.
 */
const retryQueueDepth = new promClient.Gauge({
  name: 'email_retry_queue_depth',
  help: 'Current number of emails in retry queue'
});

/**
 * Counter metric for tracking PostgreSQL status update failures.
 * Used to monitor data synchronization issues between MongoDB and PostgreSQL.
 */
const postgresUpdateFailures = new promClient.Counter({
  name: 'postgres_email_status_update_failures_total',
  help: 'Total number of failed PostgreSQL email status updates',
  labelNames: ['status']
});

// ============================================================================
// HEALTH CHECK AND METRICS ENDPOINTS
// ============================================================================

/**
 * Health check endpoint for container orchestration (Kubernetes, Docker).
 * Returns service status for liveness/readiness probes.
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'notification-service' });
});

/**
 * Prometheus metrics endpoint.
 * Exposes all registered metrics in Prometheus text format.
 */
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// ============================================================================
// POSTGRESQL CONNECTION FOR EMAIL STATUS UPDATES
// ============================================================================

/**
 * PostgreSQL connection pool for updating email status in the emails table.
 * After processing an email (success or failure), we update the status
 * from 'pending' to 'sent' or 'failed' in the PostgreSQL database.
 */
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'eccs_email',
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

/**
 * Updates the email status in PostgreSQL after processing.
 *
 * @param {number} emailId - The email ID to update
 * @param {string} status - New status ('sent' or 'failed')
 * @param {string|null} errorMessage - Error message if failed
 */
async function updateEmailStatus(emailId, status, errorMessage = null) {
  try {
    // Ensure emailId is a valid positive integer for PostgreSQL query consistency
    const numericEmailId = parseInt(emailId, 10);
    if (isNaN(numericEmailId) || numericEmailId <= 0) {
      logger.warn({
        message: 'Invalid emailId - must be a positive integer',
        emailId: emailId,
        status: status
      });
      postgresUpdateFailures.inc({ status: status });
      return;
    }

    // Ensure status is a string for consistent type inference
    const statusString = String(status);

    const query = `
      UPDATE emails
      SET status = $1::VARCHAR,
          sent_at = CASE WHEN $1::VARCHAR = 'sent' THEN NOW() ELSE sent_at END,
          error_message = $2,
          updated_at = NOW()
      WHERE id = $3
    `;
    const result = await pool.query(query, [statusString, errorMessage, numericEmailId]);

    if (result.rowCount === 0) {
      logger.warn({
        message: 'Email status update affected no rows - email may not exist',
        emailId: emailId,
        status: status
      });
      postgresUpdateFailures.inc({ status: status });
    } else {
      logger.info({
        message: 'Email status updated in PostgreSQL',
        emailId: emailId,
        status: status
      });
    }
  } catch (error) {
    logger.error({
      message: 'Failed to update email status in PostgreSQL',
      emailId: emailId,
      status: status,
      error: error.message
    });
    postgresUpdateFailures.inc({ status: status });
    // Don't throw - we don't want to block message processing for status update failures
  }
}

// ============================================================================
// KAFKA CONFIGURATION
// ============================================================================

/**
 * Initialize Kafka client with broker connection settings.
 *
 * Configuration options:
 * - clientId: Identifies this service in Kafka broker logs
 * - brokers: Comma-separated list of Kafka broker addresses
 * - retry: Built-in retry settings for initial connection attempts
 *
 * The retry configuration here handles Kafka connection issues, not message
 * processing retries (which are handled separately with exponential backoff).
 */
const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,  // Initial wait time in ms before first retry
    retries: 8              // Maximum number of connection retry attempts
  }
});

/**
 * Consumer configuration with offset management.
 *
 * OFFSET MANAGEMENT EXPLAINED:
 * - groupId: Consumer group for load balancing across service instances
 * - sessionTimeout: Time before consumer is considered dead (default 30s)
 * - heartbeatInterval: Frequency of heartbeats to coordinator (default 3s)
 * - autoCommit: When true, offsets are committed after message processing
 *
 * The consumer group allows multiple instances of this service to share
 * the workload, with Kafka automatically partitioning messages among them.
 */
const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'notification-group',
  sessionTimeout: 30000,      // 30 seconds before rebalance on failure
  heartbeatInterval: 3000,    // Send heartbeat every 3 seconds
  maxWaitTimeInMs: 5000,      // Maximum time to wait for messages
  retry: {
    retries: 10               // Retries for consumer operations
  }
});

// Producer for sending messages to retry and DLQ topics
const producer = kafka.producer();

// ============================================================================
// EMAIL PROCESSOR INSTANCE
// ============================================================================

/**
 * EmailProcessor handles the actual email delivery using Nodemailer.
 * Supports multiple email providers: SMTP, AWS SES, SendGrid.
 * See services/emailProcessor.js for implementation details.
 */
const emailProcessor = new EmailProcessor();

// ============================================================================
// RETRY POLICY CONFIGURATION (EXPONENTIAL BACKOFF)
// ============================================================================

/**
 * Maximum number of retry attempts before sending to DLQ.
 * After MAX_RETRY_ATTEMPTS failures, the message is considered permanently failed.
 */
const MAX_RETRY_ATTEMPTS = parseInt(process.env.MAX_RETRY_ATTEMPTS) || 5;

/**
 * Base delay for exponential backoff calculation (in milliseconds).
 * Actual delay = BASE_RETRY_DELAY * (2 ^ attemptNumber)
 *
 * Example delays with BASE_RETRY_DELAY = 1000ms:
 * - Attempt 1: 1000ms  (1 second)
 * - Attempt 2: 2000ms  (2 seconds)
 * - Attempt 3: 4000ms  (4 seconds)
 * - Attempt 4: 8000ms  (8 seconds)
 * - Attempt 5: 16000ms (16 seconds)
 */
const BASE_RETRY_DELAY = parseInt(process.env.BASE_RETRY_DELAY) || 1000;

/**
 * Maximum delay cap to prevent excessive wait times (in milliseconds).
 * Even with exponential backoff, delay won't exceed this value.
 */
const MAX_RETRY_DELAY = parseInt(process.env.MAX_RETRY_DELAY) || 60000;

/**
 * Kafka topic names for message routing.
 *
 * TOPIC STRUCTURE:
 * - EMAIL_REQUESTS_TOPIC: Primary topic for incoming email requests
 * - RETRY_TOPIC: Intermediate topic for failed messages awaiting retry
 * - DLQ_TOPIC: Dead Letter Queue for permanently failed messages
 */
const EMAIL_REQUESTS_TOPIC = 'email_requests';
const RETRY_TOPIC = 'email_requests_retry';
const DLQ_TOPIC = 'email_dlq';

// ============================================================================
// EXPONENTIAL BACKOFF CALCULATION
// ============================================================================

/**
 * Calculates the delay before the next retry attempt using exponential backoff.
 *
 * EXPONENTIAL BACKOFF FORMULA:
 * delay = min(BASE_RETRY_DELAY * (2 ^ attempt), MAX_RETRY_DELAY)
 *
 * This strategy provides:
 * 1. Quick initial retries for transient failures
 * 2. Increasing delays to handle rate limiting and resource exhaustion
 * 3. Jitter can be added for better distribution in high-volume scenarios
 *
 * @param {number} attempt - Current retry attempt number (1-based)
 * @returns {number} Delay in milliseconds before next retry
 */
function calculateBackoffDelay(attempt) {
  // Calculate exponential delay: base * 2^attempt
  const exponentialDelay = BASE_RETRY_DELAY * Math.pow(2, attempt);

  // Apply maximum delay cap to prevent excessive wait times
  const cappedDelay = Math.min(exponentialDelay, MAX_RETRY_DELAY);

  // Add jitter (±10%) to prevent thundering herd problem
  // Jitter helps distribute retries when multiple messages fail simultaneously
  const jitter = cappedDelay * 0.1 * (Math.random() - 0.5);

  return Math.round(cappedDelay + jitter);
}

// ============================================================================
// MESSAGE PROCESSING CORE FUNCTION
// ============================================================================

/**
 * Processes a single email message from Kafka.
 *
 * PROCESSING FLOW:
 * 1. Parse message payload and extract email data
 * 2. Record start time for latency measurement
 * 3. Attempt email delivery via EmailProcessor
 * 4. On success: Log to MongoDB, increment success counter
 * 5. On failure: Determine if retry is possible, schedule retry or send to DLQ
 *
 * ERROR HANDLING:
 * - All errors are caught and logged with full context
 * - Transient errors trigger retry with exponential backoff
 * - After max retries, message is forwarded to DLQ
 * - MongoDB logging captures error details and latency for debugging
 *
 * MESSAGE ACKNOWLEDGEMENT:
 * - KafkaJS handles acknowledgement automatically after this function completes
 * - If an error is thrown, the message will be redelivered on next poll
 * - We explicitly handle all errors to control retry behavior
 *
 * @param {Object} message - Kafka message object containing email data
 * @param {number} attempt - Current attempt number (1 for first attempt)
 */
async function processMessage(message, attempt = 1) {
  // Record processing start time for latency measurement
  const startTime = Date.now();

  // Parse the message value (JSON string) to extract email data
  // Email data structure: { id, to, subject, body, userId, timestamp, templateId? }
  let emailData;
  try {
    emailData = JSON.parse(message.value.toString());
  } catch (parseError) {
    // Invalid JSON - cannot retry, send directly to DLQ
    logger.error('Failed to parse message payload:', parseError);
    await sendToDeadLetterQueue(message, 'PARSE_ERROR', parseError.message, 1);
    return;
  }

  // Log processing start with context for traceability
  logger.info({
    message: 'Processing email message',
    emailId: emailData.id,
    attempt: attempt,
    maxAttempts: MAX_RETRY_ATTEMPTS,
    recipient: emailData.to
  });

  try {
    // ========================================================================
    // EMAIL DELIVERY ATTEMPT
    // ========================================================================
    // EmailProcessor.sendEmail handles the actual delivery using configured
    // transport (SMTP, SES, or SendGrid). It returns delivery details on success.
    const deliveryResult = await emailProcessor.sendEmail(emailData);

    // ========================================================================
    // SUCCESS PATH
    // ========================================================================
    // Calculate total processing latency
    const latencyMs = Date.now() - startTime;

    // Increment Prometheus success counter
    emailsProcessed.inc({ status: 'success' });

    // Record latency in histogram for percentile calculations
    emailProcessingDuration.observe(latencyMs / 1000);

    // Log success with full context for audit trail
    logger.info({
      message: 'Email sent successfully',
      emailId: emailData.id,
      recipient: emailData.to,
      attempt: attempt,
      latencyMs: latencyMs,
      messageId: deliveryResult?.messageId
    });

    // Persist success status and metrics to MongoDB for reporting
    // This creates a complete audit trail of all email deliveries
    await emailProcessor.logEmailStatus(emailData.id, 'sent', null, {
      latencyMs: latencyMs,
      attempt: attempt,
      deliveryInfo: deliveryResult,
      processedAt: new Date()
    });

    // Update email status in PostgreSQL from 'pending' to 'sent'
    await updateEmailStatus(emailData.id, 'sent', null);

  } catch (error) {
    // ========================================================================
    // FAILURE PATH - RETRY OR DLQ DECISION
    // ========================================================================
    const latencyMs = Date.now() - startTime;

    // Log failure with comprehensive error context
    logger.error({
      message: 'Failed to send email',
      emailId: emailData.id,
      recipient: emailData.to,
      attempt: attempt,
      maxAttempts: MAX_RETRY_ATTEMPTS,
      error: error.message,
      stack: error.stack,
      latencyMs: latencyMs
    });

    // Check if we have remaining retry attempts
    if (attempt < MAX_RETRY_ATTEMPTS) {
      // ======================================================================
      // RETRY PATH - Schedule for exponential backoff retry
      // ======================================================================
      await scheduleRetry(message, emailData, attempt, error);

      // Increment retry counter for monitoring
      emailsProcessed.inc({ status: 'retry' });
      retryQueueDepth.inc();

      // Log retry attempt status to MongoDB
      await emailProcessor.logEmailStatus(emailData.id, 'retry', error.message, {
        latencyMs: latencyMs,
        attempt: attempt,
        nextAttempt: attempt + 1,
        scheduledRetryDelay: calculateBackoffDelay(attempt),
        processedAt: new Date()
      });

    } else {
      // ======================================================================
      // DLQ PATH - Max retries exceeded, send to Dead Letter Queue
      // ======================================================================
      await sendToDeadLetterQueue(message, emailData, error.message, attempt);

      // Increment failed counter for alerting
      emailsProcessed.inc({ status: 'failed' });

      // Log permanent failure to MongoDB
      await emailProcessor.logEmailStatus(emailData.id, 'failed', error.message, {
        latencyMs: latencyMs,
        totalAttempts: attempt,
        sentToDlq: true,
        processedAt: new Date()
      });

      // Update email status in PostgreSQL from 'pending' to 'failed'
      await updateEmailStatus(emailData.id, 'failed', error.message);
    }

    // Record failure latency for SLA monitoring
    emailProcessingDuration.observe(latencyMs / 1000);
  }
}

// ============================================================================
// RETRY SCHEDULING FUNCTION
// ============================================================================

/**
 * Schedules a failed message for retry with exponential backoff.
 *
 * RETRY MECHANISM:
 * 1. Calculate backoff delay based on current attempt number
 * 2. Enrich message with retry metadata (attempt count, error, scheduled time)
 * 3. Send to retry topic for later processing
 * 4. The retry topic consumer will apply the delay before reprocessing
 *
 * @param {Object} message - Original Kafka message
 * @param {Object} emailData - Parsed email data
 * @param {number} attempt - Current attempt number
 * @param {Error} error - Error that caused the failure
 */
async function scheduleRetry(message, emailData, attempt, error) {
  // Calculate delay using exponential backoff with jitter
  const backoffDelay = calculateBackoffDelay(attempt);
  const nextRetryTime = new Date(Date.now() + backoffDelay);

  logger.info({
    message: 'Scheduling retry for failed email',
    emailId: emailData.id,
    currentAttempt: attempt,
    nextAttempt: attempt + 1,
    backoffDelayMs: backoffDelay,
    scheduledRetryTime: nextRetryTime.toISOString()
  });

  // Send enriched message to retry topic
  // The message includes all original data plus retry metadata
  await producer.send({
    topic: RETRY_TOPIC,
    messages: [{
      // Preserve original key for message ordering and deduplication
      key: message.key,
      value: JSON.stringify({
        // Original email data
        ...emailData,
        // Retry metadata
        _retry: {
          attempt: attempt + 1,
          previousError: error.message,
          scheduledAt: nextRetryTime.toISOString(),
          backoffDelayMs: backoffDelay,
          originalTopic: EMAIL_REQUESTS_TOPIC
        }
      }),
      headers: {
        // Headers for quick filtering and monitoring without parsing body
        'x-retry-count': (attempt + 1).toString(),
        'x-original-topic': EMAIL_REQUESTS_TOPIC,
        'x-scheduled-retry-time': nextRetryTime.toISOString()
      }
    }]
  });
}

// ============================================================================
// DEAD LETTER QUEUE FORWARDING
// ============================================================================

/**
 * Forwards a permanently failed message to the Dead Letter Queue.
 *
 * DLQ PURPOSE:
 * - Store messages that cannot be processed after maximum retries
 * - Enable manual investigation and potential reprocessing
 * - Prevent poison messages from blocking the main queue
 * - Provide audit trail for compliance and debugging
 *
 * DLQ MESSAGE STRUCTURE:
 * - Original message data preserved for potential reprocessing
 * - Failure metadata: reason, timestamp, total attempts
 * - Error details: message, stack trace
 * - Processing context: original topic, consumer group
 *
 * @param {Object} message - Original Kafka message
 * @param {Object|string} emailData - Parsed email data or error type for parse failures
 * @param {string} errorMessage - Final error message that caused DLQ routing
 * @param {number} totalAttempts - Total number of processing attempts made
 */
async function sendToDeadLetterQueue(message, emailData, errorMessage, totalAttempts) {
  const dlqTimestamp = new Date();

  // Handle case where emailData is a string (error type for parse failures)
  const isParseError = typeof emailData === 'string';
  const emailId = isParseError ? 'UNKNOWN' : emailData.id;

  logger.error({
    message: 'Sending message to Dead Letter Queue',
    emailId: emailId,
    errorMessage: errorMessage,
    totalAttempts: totalAttempts,
    dlqTimestamp: dlqTimestamp.toISOString()
  });

  // Construct DLQ message with comprehensive failure context
  const dlqMessage = {
    // Original data (or raw message if parse failed)
    originalData: isParseError ? message.value.toString() : emailData,
    // Failure context
    dlqMetadata: {
      failureReason: errorMessage,
      failedAt: dlqTimestamp.toISOString(),
      totalAttempts: totalAttempts,
      maxAttemptsConfigured: MAX_RETRY_ATTEMPTS,
      originalTopic: EMAIL_REQUESTS_TOPIC,
      consumerGroup: process.env.KAFKA_GROUP_ID || 'notification-group',
      serviceInstance: process.env.HOSTNAME || 'unknown'
    }
  };

  // Send to DLQ topic
  await producer.send({
    topic: DLQ_TOPIC,
    messages: [{
      key: message.key,
      value: JSON.stringify(dlqMessage),
      headers: {
        'x-failure-reason': errorMessage.substring(0, 200), // Truncate for header size limits
        'x-total-attempts': totalAttempts.toString(),
        'x-failed-at': dlqTimestamp.toISOString(),
        'x-original-topic': EMAIL_REQUESTS_TOPIC
      }
    }]
  });

  // Decrement retry queue gauge (message removed from retry cycle)
  retryQueueDepth.dec();

  // Increment DLQ counter for alerting
  emailsProcessed.inc({ status: 'dlq' });
}

// ============================================================================
// KAFKA CONSUMER INITIALIZATION AND MESSAGE HANDLING
// ============================================================================

/**
 * Initializes and runs the Kafka consumer for email processing.
 *
 * SUBSCRIPTION STRATEGY:
 * 1. Subscribe to main email_requests topic (new email requests)
 * 2. Subscribe to retry topic (failed emails scheduled for retry)
 * 3. Use fromBeginning: false to only process new messages
 *
 * OFFSET MANAGEMENT:
 * - autoCommit is enabled by default in KafkaJS
 * - Offsets are committed after each message is processed
 * - If processing fails before completion, message will be redelivered
 *
 * PARTITION ASSIGNMENT:
 * - Kafka automatically assigns partitions to consumer instances
 * - Multiple instances share the workload via consumer group
 * - Rebalancing occurs when instances join/leave the group
 */
async function runConsumer() {
  // ========================================================================
  // CONNECT TO KAFKA
  // ========================================================================
  // Both consumer and producer must be connected before processing
  logger.info('Connecting to Kafka brokers...');
  await consumer.connect();
  await producer.connect();
  logger.info('Successfully connected to Kafka');

  // ========================================================================
  // TOPIC SUBSCRIPTION
  // ========================================================================
  // Subscribe to main topic for new email requests
  // fromBeginning: false means we only process messages arriving after subscription
  await consumer.subscribe({
    topic: EMAIL_REQUESTS_TOPIC,
    fromBeginning: false
  });
  logger.info(`Subscribed to topic: ${EMAIL_REQUESTS_TOPIC}`);

  // Subscribe to retry topic for failed messages awaiting retry
  await consumer.subscribe({
    topic: RETRY_TOPIC,
    fromBeginning: false
  });
  logger.info(`Subscribed to topic: ${RETRY_TOPIC}`);

  // ========================================================================
  // MESSAGE PROCESSING LOOP
  // ========================================================================
  /**
   * eachMessage callback is invoked for every message received.
   *
   * PROCESSING GUARANTEES:
   * - Messages are processed in partition order (not across partitions)
   * - If an error is thrown, the message will be retried (if not committed)
   * - We catch all errors internally to control retry/DLQ behavior
   *
   * CONCURRENCY NOTE:
   * - eachMessage processes one message at a time per partition
   * - For higher throughput, consider eachBatch processing
   */
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      // Log message receipt for traceability
      logger.debug({
        message: 'Received message from Kafka',
        topic: topic,
        partition: partition,
        offset: message.offset,
        key: message.key?.toString()
      });

      if (topic === RETRY_TOPIC) {
        // ====================================================================
        // RETRY MESSAGE PROCESSING
        // ====================================================================
        // Messages in retry topic have been enriched with retry metadata
        // We need to apply the backoff delay before reprocessing

        let data;
        try {
          data = JSON.parse(message.value.toString());
        } catch (parseError) {
          logger.error('Failed to parse retry message:', parseError);
          await sendToDeadLetterQueue(message, 'RETRY_PARSE_ERROR', parseError.message, MAX_RETRY_ATTEMPTS);
          return;
        }

        const retryAttempt = data._retry?.attempt || 1;
        const scheduledTime = data._retry?.scheduledAt;

        // Calculate remaining wait time if message was scheduled for future
        if (scheduledTime) {
          const scheduledDate = new Date(scheduledTime);
          const now = new Date();
          const remainingDelay = scheduledDate - now;

          // If scheduled time is in the future, wait before processing
          if (remainingDelay > 0) {
            logger.info({
              message: 'Applying backoff delay before retry',
              emailId: data.id,
              remainingDelayMs: remainingDelay
            });
            await new Promise(resolve => setTimeout(resolve, remainingDelay));
          }
        }

        // Process the retry message
        // Remove retry metadata before passing to processor
        const { _retry, ...emailData } = data;
        await processMessage({ ...message, value: Buffer.from(JSON.stringify(emailData)) }, retryAttempt);

        // Decrement retry queue gauge after processing
        retryQueueDepth.dec();

      } else {
        // ====================================================================
        // MAIN TOPIC MESSAGE PROCESSING
        // ====================================================================
        // First attempt at processing a new email request
        await processMessage(message, 1);
      }
    }
  });

  logger.info('Notification service consumer is running and processing messages');
}

// ============================================================================
// SERVICE STARTUP
// ============================================================================

/**
 * Main startup function that initializes all service dependencies.
 *
 * STARTUP ORDER:
 * 1. Connect to MongoDB (for logging and audit trail)
 * 2. Start Kafka consumer (begins message processing)
 * 3. Start Express server (health checks and metrics)
 *
 * FAILURE HANDLING:
 * - If any critical dependency fails to connect, the service exits
 * - Exit code 1 signals container orchestration to restart the service
 */
async function start() {
  try {
    // ========================================================================
    // MONGODB CONNECTION
    // ========================================================================
    // MongoDB is used for persistent logging of email processing status
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Successfully connected to MongoDB');

    // ========================================================================
    // POSTGRESQL CONNECTION
    // ========================================================================
    // PostgreSQL is used to update email status after processing
    logger.info('Connecting to PostgreSQL...');
    await pool.query('SELECT NOW()');
    logger.info('Successfully connected to PostgreSQL');

    // ========================================================================
    // KAFKA CONSUMER STARTUP
    // ========================================================================
    // This begins the message processing loop
    await runConsumer();

    // ========================================================================
    // EXPRESS SERVER STARTUP
    // ========================================================================
    // HTTP server for health checks and Prometheus metrics
    app.listen(PORT, () => {
      logger.info(`Notification service HTTP server listening on port ${PORT}`);
      logger.info('Service is ready to process email requests');
    });

  } catch (error) {
    // Critical startup failure - exit for orchestration restart
    logger.error({
      message: 'Failed to start notification service',
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Start the service
start();

// ============================================================================
// GRACEFUL SHUTDOWN HANDLING
// ============================================================================

/**
 * Graceful shutdown handler for clean service termination.
 *
 * SHUTDOWN SEQUENCE:
 * 1. Stop accepting new messages (consumer disconnect)
 * 2. Wait for in-flight messages to complete
 * 3. Disconnect producer (flush pending messages)
 * 4. Close MongoDB connection
 * 5. Exit process
 *
 * IMPORTANCE:
 * - Prevents message loss during deployments
 * - Allows Kafka to rebalance partitions properly
 * - Ensures all logs are flushed to MongoDB
 */
const shutdown = async (signal) => {
  logger.info(`Received ${signal}, initiating graceful shutdown...`);

  try {
    // Stop consuming new messages
    logger.info('Disconnecting Kafka consumer...');
    await consumer.disconnect();

    // Flush and disconnect producer
    logger.info('Disconnecting Kafka producer...');
    await producer.disconnect();

    // Close MongoDB connection
    logger.info('Closing MongoDB connection...');
    await mongoose.disconnect();

    // Close PostgreSQL connection
    logger.info('Closing PostgreSQL connection...');
    await pool.end();

    logger.info('Graceful shutdown completed');
    process.exit(0);

  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Register shutdown handlers for common termination signals
process.on('SIGTERM', () => shutdown('SIGTERM')); // Docker/K8s termination
process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C in terminal
