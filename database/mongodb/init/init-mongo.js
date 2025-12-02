// MongoDB initialization script for ECCS logging database

db = db.getSiblingDB('eccs_logs');

// Create collections with schema validation
db.createCollection('email_logs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['emailId', 'status', 'processedAt'],
      properties: {
        emailId: {
          bsonType: 'string',
          description: 'Email ID from PostgreSQL'
        },
        status: {
          enum: ['pending', 'sent', 'failed', 'retry'],
          description: 'Email processing status'
        },
        errorMessage: {
          bsonType: ['string', 'null'],
          description: 'Error message if failed'
        },
        processedAt: {
          bsonType: 'date',
          description: 'When the email was processed'
        },
        metadata: {
          bsonType: 'object',
          description: 'Additional metadata'
        }
      }
    }
  }
});

// Create indexes
db.email_logs.createIndex({ emailId: 1 });
db.email_logs.createIndex({ status: 1, processedAt: -1 });
db.email_logs.createIndex({ processedAt: -1 });

// Create application logs collection
db.createCollection('application_logs', {
  capped: true,
  size: 100000000, // 100MB
  max: 1000000 // 1 million documents
});

db.application_logs.createIndex({ timestamp: -1 });
db.application_logs.createIndex({ service: 1, level: 1 });

// Insert placeholder documents for Logstash mongodb input plugin
// The plugin requires at least one document in each collection to initialize
// its progress tracking. Without these, the plugin crashes with:
// NoMethodError: undefined method [] for nil:NilClass in init_placeholder
db.email_logs.insertOne({
  emailId: 'placeholder-init',
  status: 'sent',
  processedAt: new Date(),
  metadata: {
    isPlaceholder: true,
    description: 'Initialization placeholder for Logstash mongodb input plugin'
  }
});

db.application_logs.insertOne({
  timestamp: new Date(),
  service: 'mongodb-init',
  level: 'info',
  message: 'Initialization placeholder for Logstash mongodb input plugin',
  isPlaceholder: true
});

print('MongoDB initialization complete!');
