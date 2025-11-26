/**
 * ============================================================================
 * Email Log Model - MongoDB Schema for Email Processing Audit Trail
 * ============================================================================
 *
 * This model stores comprehensive logging data for every email processed
 * through the notification service. It serves multiple purposes:
 *
 * 1. AUDIT TRAIL: Complete history of email processing attempts
 * 2. DEBUGGING: Error details and stack traces for failed deliveries
 * 3. MONITORING: Latency metrics for performance analysis
 * 4. COMPLIANCE: Timestamp records for regulatory requirements
 *
 * COLLECTION: email_logs (configured in init-mongo.js)
 *
 * INDEXES:
 * - emailId: Quick lookup by email identifier
 * - status + processedAt: Query emails by status with time ordering
 * - processedAt: Time-based queries and log rotation
 *
 * SCHEMA VALIDATION:
 * MongoDB schema validation is configured in init-mongo.js for data integrity.
 */

const mongoose = require('mongoose');

/**
 * Email Log Schema Definition
 *
 * FIELD DESCRIPTIONS:
 *
 * emailId (required):
 *   - Unique identifier linking this log to the email in PostgreSQL
 *   - Used for correlating logs with email records
 *   - Indexed for fast lookup
 *
 * status (required):
 *   - Current processing state of the email
 *   - Values: 'pending', 'sent', 'failed', 'retry'
 *   - Indexed with processedAt for status-based queries
 *
 * errorMessage (optional):
 *   - Human-readable error description when status is 'failed' or 'retry'
 *   - Null for successful deliveries
 *   - Captured from exception messages
 *
 * errorCode (optional):
 *   - Machine-readable error code from email provider
 *   - Examples: 'ECONNREFUSED', 'EAUTH', '550'
 *   - Useful for automated error categorization
 *
 * errorStack (optional):
 *   - Full stack trace for debugging
 *   - Only populated for unexpected errors
 *   - Stored for development/debugging purposes
 *
 * processedAt (required):
 *   - Timestamp when this log entry was created
 *   - Defaults to current time
 *   - Used for time-based queries and retention
 *
 * latencyMs (optional):
 *   - Total processing time in milliseconds
 *   - Measured from message receipt to completion
 *   - Used for SLA monitoring and performance analysis
 *
 * sendLatencyMs (optional):
 *   - Time spent specifically on SMTP/API send operation
 *   - Subset of total latencyMs
 *   - Helps identify slow email providers
 *
 * attempt (optional):
 *   - Which retry attempt this log represents
 *   - 1 for first attempt, increments on retries
 *   - Used to track retry patterns
 *
 * maxAttempts (optional):
 *   - Maximum configured retry attempts
 *   - Helps understand retry configuration at log time
 *
 * retryScheduledAt (optional):
 *   - When the next retry is scheduled (for retry status)
 *   - Null for final states (sent, failed)
 *
 * provider (optional):
 *   - Email provider used ('smtp', 'ses', 'sendgrid')
 *   - Helps track provider-specific issues
 *
 * messageId (optional):
 *   - Message ID returned by email provider on success
 *   - Unique identifier for tracking in provider logs
 *
 * recipientEmail (optional):
 *   - Recipient email address
 *   - Stored for debugging without PostgreSQL lookup
 *
 * metadata (flexible):
 *   - Additional context not covered by specific fields
 *   - Mixed type allows any JSON structure
 *   - Used for provider-specific data, debugging info
 */
const emailLogSchema = new mongoose.Schema({
  // ===========================================================================
  // CORE IDENTIFICATION FIELDS
  // ===========================================================================

  /**
   * Email identifier from PostgreSQL emails table.
   * Required field - every log must be associated with an email.
   */
  emailId: {
    type: String,
    required: true,
    index: true
  },

  /**
   * Processing status at time of logging.
   * Enum ensures only valid statuses are stored.
   */
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'retry'],
    required: true
  },

  // ===========================================================================
  // ERROR TRACKING FIELDS
  // ===========================================================================

  /**
   * Human-readable error message.
   * Null for successful deliveries.
   */
  errorMessage: {
    type: String,
    default: null
  },

  /**
   * Machine-readable error code from provider or Node.js.
   * Examples: 'ECONNREFUSED', 'ETIMEDOUT', 'EAUTH', '550', '421'
   */
  errorCode: {
    type: String,
    default: null
  },

  /**
   * Full error stack trace for debugging.
   * Only populated for unexpected/internal errors.
   */
  errorStack: {
    type: String,
    default: null
  },

  // ===========================================================================
  // TIMING AND LATENCY FIELDS
  // ===========================================================================

  /**
   * Timestamp when this log entry was created.
   * Defaults to current time if not provided.
   */
  processedAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  /**
   * Total processing time from message receipt to completion.
   * Measured in milliseconds.
   */
  latencyMs: {
    type: Number,
    default: null
  },

  /**
   * Time spent on the actual email send operation.
   * Subset of total latencyMs, excludes parsing and logging.
   */
  sendLatencyMs: {
    type: Number,
    default: null
  },

  // ===========================================================================
  // RETRY TRACKING FIELDS
  // ===========================================================================

  /**
   * Current retry attempt number.
   * 1 for first attempt, increments with each retry.
   */
  attempt: {
    type: Number,
    default: 1
  },

  /**
   * Maximum configured retry attempts.
   * Stored for historical context.
   */
  maxAttempts: {
    type: Number,
    default: null
  },

  /**
   * Scheduled time for next retry attempt.
   * Only populated when status is 'retry'.
   */
  retryScheduledAt: {
    type: Date,
    default: null
  },

  /**
   * Calculated backoff delay for this retry.
   * Stored in milliseconds.
   */
  backoffDelayMs: {
    type: Number,
    default: null
  },

  // ===========================================================================
  // DELIVERY CONTEXT FIELDS
  // ===========================================================================

  /**
   * Email provider used for this delivery attempt.
   * Values: 'smtp', 'ses', 'sendgrid'
   */
  provider: {
    type: String,
    default: null
  },

  /**
   * Message ID returned by the email provider.
   * Unique identifier for tracking in provider logs.
   */
  messageId: {
    type: String,
    default: null
  },

  /**
   * Recipient email address.
   * Stored for debugging without PostgreSQL lookup.
   */
  recipientEmail: {
    type: String,
    default: null
  },

  /**
   * Whether this email was sent to Dead Letter Queue.
   * True when max retries exceeded.
   */
  sentToDlq: {
    type: Boolean,
    default: false
  },

  // ===========================================================================
  // FLEXIBLE METADATA FIELD
  // ===========================================================================

  /**
   * Additional metadata for extensibility.
   * Can contain any JSON-serializable data.
   *
   * Common uses:
   * - deliveryInfo: Full response from email provider
   * - kafkaMetadata: Partition, offset, topic info
   * - templateInfo: Template ID and rendered data
   * - customFields: Application-specific data
   */
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }

}, {
  // ===========================================================================
  // SCHEMA OPTIONS
  // ===========================================================================

  /**
   * Automatically add createdAt and updatedAt fields.
   * createdAt: When the document was first created
   * updatedAt: When the document was last modified
   */
  timestamps: true,

  /**
   * Collection name in MongoDB.
   * Matches the collection created in init-mongo.js
   */
  collection: 'email_logs'
});

// =============================================================================
// INDEXES FOR QUERY PERFORMANCE
// =============================================================================

/**
 * Compound index for status-based queries with time ordering.
 * Optimizes queries like: "Get all failed emails in the last hour"
 *
 * Query examples:
 * - db.email_logs.find({ status: 'failed' }).sort({ processedAt: -1 })
 * - db.email_logs.find({ status: 'retry', processedAt: { $gte: oneHourAgo } })
 */
emailLogSchema.index({ status: 1, processedAt: -1 });

/**
 * Index for provider-based analysis.
 * Optimizes queries for provider performance comparison.
 *
 * Query examples:
 * - db.email_logs.find({ provider: 'ses', status: 'failed' })
 * - Aggregation pipelines grouping by provider
 */
emailLogSchema.index({ provider: 1, status: 1 });

/**
 * Index for latency analysis queries.
 * Supports finding slow deliveries.
 *
 * Query example:
 * - db.email_logs.find({ latencyMs: { $gt: 5000 } })
 */
emailLogSchema.index({ latencyMs: 1 });

/**
 * TTL index for automatic log expiration (optional).
 * Uncomment to automatically delete logs older than specified days.
 * Retention period should match compliance requirements.
 */
// emailLogSchema.index(
//   { processedAt: 1 },
//   { expireAfterSeconds: 90 * 24 * 60 * 60 } // 90 days
// );

// =============================================================================
// STATIC METHODS FOR COMMON QUERIES
// =============================================================================

/**
 * Finds all log entries for a specific email.
 *
 * @param {string} emailId - Email identifier to search
 * @returns {Promise<Array>} Array of log entries, newest first
 */
emailLogSchema.statics.findByEmailId = function(emailId) {
  return this.find({ emailId }).sort({ processedAt: -1 });
};

/**
 * Gets email processing statistics for a time range.
 *
 * @param {Date} startDate - Start of time range
 * @param {Date} endDate - End of time range
 * @returns {Promise<Object>} Statistics object with counts by status
 */
emailLogSchema.statics.getStatistics = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        processedAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgLatencyMs: { $avg: '$latencyMs' }
      }
    }
  ]);
};

/**
 * Gets latency percentiles for performance monitoring.
 *
 * @param {number} hours - Number of hours to analyze
 * @returns {Promise<Object>} Latency percentiles (p50, p90, p99)
 */
emailLogSchema.statics.getLatencyPercentiles = function(hours = 24) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  return this.aggregate([
    {
      $match: {
        processedAt: { $gte: cutoff },
        latencyMs: { $ne: null }
      }
    },
    {
      $group: {
        _id: null,
        latencies: { $push: '$latencyMs' }
      }
    },
    {
      $project: {
        p50: { $arrayElemAt: [{ $sortArray: { input: '$latencies', sortBy: 1 } }, { $floor: { $multiply: [{ $size: '$latencies' }, 0.5] } }] },
        p90: { $arrayElemAt: [{ $sortArray: { input: '$latencies', sortBy: 1 } }, { $floor: { $multiply: [{ $size: '$latencies' }, 0.9] } }] },
        p99: { $arrayElemAt: [{ $sortArray: { input: '$latencies', sortBy: 1 } }, { $floor: { $multiply: [{ $size: '$latencies' }, 0.99] } }] },
        count: { $size: '$latencies' }
      }
    }
  ]);
};

// Export the model
module.exports = mongoose.model('EmailLog', emailLogSchema);
