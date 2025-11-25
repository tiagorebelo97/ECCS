// ============================================================================
// ECCS MongoDB Initialization Script
// ============================================================================
// This script runs on first container startup to create collections,
// indexes, and schema validation for the ECCS logging database.
//
// EXECUTION:
//   - Runs automatically via /docker-entrypoint-initdb.d
//   - Executes in the context of MONGO_INITDB_DATABASE (if set)
//
// COLLECTIONS:
//   - email_logs: Email processing history with validation
//   - application_logs: Capped collection for app events
//   - audit_events: Security and compliance audit trail
//   - metrics: Time-series performance data
// ============================================================================

print('========================================');
print('ECCS MongoDB Initialization Starting...');
print('========================================');

// Switch to the ECCS logging database
db = db.getSiblingDB('eccs_logs');

// ----------------------------------------------------------------------------
// Email Logs Collection
// ----------------------------------------------------------------------------
// Stores processing history for each email sent through the system.
// Includes retry information, error details, and processing metadata.
print('Creating email_logs collection...');

db.createCollection('email_logs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['emailId', 'status', 'processedAt'],
      properties: {
        // Reference to PostgreSQL email ID
        emailId: {
          bsonType: 'string',
          description: 'Email ID from PostgreSQL - required'
        },
        // Processing status
        status: {
          enum: ['pending', 'processing', 'sent', 'failed', 'retry', 'dlq'],
          description: 'Email processing status - required'
        },
        // Error information (if failed)
        errorMessage: {
          bsonType: ['string', 'null'],
          description: 'Error message if processing failed'
        },
        errorCode: {
          bsonType: ['string', 'null'],
          description: 'Error code for categorization'
        },
        errorStack: {
          bsonType: ['string', 'null'],
          description: 'Stack trace for debugging'
        },
        // Retry information
        retryCount: {
          bsonType: 'int',
          minimum: 0,
          description: 'Number of retry attempts'
        },
        nextRetryAt: {
          bsonType: ['date', 'null'],
          description: 'Scheduled time for next retry'
        },
        // Timing information
        processedAt: {
          bsonType: 'date',
          description: 'When processing occurred - required'
        },
        processingDurationMs: {
          bsonType: ['int', 'null'],
          description: 'Processing time in milliseconds'
        },
        // SMTP response information
        smtpResponse: {
          bsonType: ['object', 'null'],
          description: 'SMTP server response details'
        },
        // Kafka metadata
        kafkaMetadata: {
          bsonType: ['object', 'null'],
          properties: {
            topic: { bsonType: 'string' },
            partition: { bsonType: 'int' },
            offset: { bsonType: 'long' }
          }
        },
        // Tracing information
        traceId: {
          bsonType: ['string', 'null'],
          description: 'Distributed tracing ID'
        },
        spanId: {
          bsonType: ['string', 'null'],
          description: 'Span ID for this operation'
        }
      }
    }
  }
});

// Create indexes for common query patterns
print('Creating indexes for email_logs...');
db.email_logs.createIndex({ emailId: 1 }, { unique: true, name: 'idx_emailId' });
db.email_logs.createIndex({ status: 1, processedAt: -1 }, { name: 'idx_status_processed' });
db.email_logs.createIndex({ processedAt: -1 }, { name: 'idx_processed_desc' });
db.email_logs.createIndex({ traceId: 1 }, { sparse: true, name: 'idx_traceId' });
// TTL index to auto-delete old logs after 90 days
db.email_logs.createIndex(
  { processedAt: 1 },
  { expireAfterSeconds: 7776000, name: 'idx_ttl_90days' }
);

// ----------------------------------------------------------------------------
// Application Logs Collection (Capped)
// ----------------------------------------------------------------------------
// Capped collection for high-volume application logging.
// Automatically removes oldest documents when size limit is reached.
print('Creating application_logs collection (capped)...');

db.createCollection('application_logs', {
  capped: true,
  size: 104857600,    // 100MB maximum size
  max: 1000000        // 1 million documents maximum
});

// Create indexes for log querying
print('Creating indexes for application_logs...');
db.application_logs.createIndex({ timestamp: -1 }, { name: 'idx_timestamp' });
db.application_logs.createIndex({ service: 1, level: 1 }, { name: 'idx_service_level' });
db.application_logs.createIndex({ traceId: 1 }, { sparse: true, name: 'idx_traceId' });
db.application_logs.createIndex(
  { level: 1, timestamp: -1 },
  { name: 'idx_level_timestamp' }
);

// ----------------------------------------------------------------------------
// Audit Events Collection
// ----------------------------------------------------------------------------
// Stores security-relevant events for compliance and auditing.
// NOT a capped collection - audit logs must be retained.
print('Creating audit_events collection...');

db.createCollection('audit_events', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['eventType', 'timestamp', 'source'],
      properties: {
        eventType: {
          bsonType: 'string',
          description: 'Type of audit event - required'
        },
        timestamp: {
          bsonType: 'date',
          description: 'When the event occurred - required'
        },
        source: {
          bsonType: 'string',
          description: 'Service that generated the event - required'
        },
        userId: {
          bsonType: ['string', 'null'],
          description: 'User associated with the event'
        },
        action: {
          bsonType: 'string',
          description: 'Action performed'
        },
        resource: {
          bsonType: 'string',
          description: 'Resource affected'
        },
        outcome: {
          enum: ['success', 'failure', 'error'],
          description: 'Outcome of the action'
        },
        ipAddress: {
          bsonType: ['string', 'null'],
          description: 'Client IP address'
        },
        userAgent: {
          bsonType: ['string', 'null'],
          description: 'Client user agent'
        },
        details: {
          bsonType: 'object',
          description: 'Additional event details'
        }
      }
    }
  }
});

// Create indexes for audit queries
print('Creating indexes for audit_events...');
db.audit_events.createIndex({ timestamp: -1 }, { name: 'idx_timestamp' });
db.audit_events.createIndex({ userId: 1, timestamp: -1 }, { name: 'idx_user_timestamp' });
db.audit_events.createIndex({ eventType: 1, timestamp: -1 }, { name: 'idx_type_timestamp' });
db.audit_events.createIndex({ source: 1, eventType: 1 }, { name: 'idx_source_type' });
// TTL index for audit logs (365 days retention)
db.audit_events.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 31536000, name: 'idx_ttl_365days' }
);

// ----------------------------------------------------------------------------
// Metrics Collection (Time-Series)
// ----------------------------------------------------------------------------
// Stores performance and business metrics for monitoring.
print('Creating metrics collection...');

// For MongoDB 5.0+ we could use time-series collections
// Using regular collection with TTL for compatibility
db.createCollection('metrics');

// Create indexes for metrics queries
print('Creating indexes for metrics...');
db.metrics.createIndex({ name: 1, timestamp: -1 }, { name: 'idx_name_timestamp' });
db.metrics.createIndex({ tags: 1, timestamp: -1 }, { name: 'idx_tags_timestamp' });
// TTL index for metrics (30 days retention)
db.metrics.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 2592000, name: 'idx_ttl_30days' }
);

// ----------------------------------------------------------------------------
// Print Summary
// ----------------------------------------------------------------------------
print('========================================');
print('ECCS MongoDB Initialization Complete!');
print('========================================');
print('Created collections:');
print('  - email_logs (with schema validation)');
print('  - application_logs (capped: 100MB)');
print('  - audit_events (with schema validation)');
print('  - metrics (with TTL: 30 days)');
print('');
print('TTL Policies:');
print('  - email_logs: 90 days');
print('  - audit_events: 365 days');
print('  - metrics: 30 days');
print('========================================');
