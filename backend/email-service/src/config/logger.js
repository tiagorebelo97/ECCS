/**
 * ============================================================================
 * Winston Logger Configuration - Email Service
 * ============================================================================
 *
 * Centralized logging configuration for the email service.
 * Provides structured JSON logging for production and colored console
 * output for development.
 *
 * LOG LEVELS (in order of severity):
 * - error: Critical errors requiring immediate attention
 * - warn: Warning conditions that should be reviewed
 * - info: General operational messages
 * - http: HTTP request/response logging
 * - debug: Detailed debugging information
 *
 * LOG DESTINATIONS:
 * - Development: Console with colors
 * - Production: Console (JSON) + File rotation + Logstash
 *
 * ELASTICSEARCH INTEGRATION:
 * In production, logs are sent to Logstash via TCP for indexing in
 * Elasticsearch. This enables centralized log aggregation and visualization
 * in Kibana with pre-configured dashboards.
 *
 * STRUCTURED LOGGING:
 * All log entries include:
 * - timestamp: ISO-8601 formatted timestamp
 * - level: Log severity level
 * - service: Service name identifier
 * - message: Human-readable message
 * - Additional context as JSON properties
 *
 * USAGE EXAMPLES:
 * logger.info({ message: 'Email queued', emailId: '123', userId: '456' });
 * logger.error({ message: 'Database error', error: err.message, stack: err.stack });
 */

const winston = require('winston');
require('winston-logstash');

/**
 * Custom log format for JSON output.
 * Ensures all logs are valid JSON for log aggregation systems (ELK, etc.)
 */
const jsonFormat = winston.format.combine(
  // Add ISO-8601 timestamp
  winston.format.timestamp({
    format: 'YYYY-MM-DDTHH:mm:ss.SSSZ'
  }),
  // Capture error stack traces
  winston.format.errors({ stack: true }),
  // Output as JSON
  winston.format.json()
);

/**
 * Console format for development.
 * Includes colors and human-readable formatting.
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    // Format message with optional metadata
    let log = `${timestamp} [${level}]: ${message}`;
    // Add metadata if present (excluding default service meta)
    if (Object.keys(meta).length > 0 && meta.service !== 'email-service') {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

/**
 * Logger instance with environment-specific configuration.
 *
 * CONFIGURATION:
 * - LOG_LEVEL env var controls minimum log level (default: 'info')
 * - NODE_ENV determines output format and destinations
 */
const logger = winston.createLogger({
  // Minimum log level (can be overridden by LOG_LEVEL env var)
  level: process.env.LOG_LEVEL || 'info',

  // Default JSON format for all transports
  format: jsonFormat,

  // Default metadata added to all log entries
  defaultMeta: {
    service: 'email-service',
    version: process.env.npm_package_version || '1.0.0'
  },

  // Log transports (outputs)
  transports: [
    // Console transport (always enabled)
    new winston.transports.Console({
      // Use colored format in development, JSON in production
      format: process.env.NODE_ENV === 'production' ? jsonFormat : consoleFormat
    })
  ],

  // Don't exit on handled exceptions
  exitOnError: false
});

// ============================================================================
// PRODUCTION FILE TRANSPORTS
// ============================================================================
// Add file-based logging in production for persistence and rotation

if (process.env.NODE_ENV === 'production') {
  /**
   * Error log file - captures only error level messages.
   * Used for quick identification of critical issues.
   */
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,                // Keep 5 rotated files
    format: jsonFormat
  }));

  /**
   * Combined log file - captures all log levels.
   * Complete audit trail for debugging and analysis.
   */
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10,               // Keep 10 rotated files
    format: jsonFormat
  }));

  /**
   * Logstash transport - sends logs to ELK stack for centralized monitoring.
   * Logs are indexed in Elasticsearch and visualized in Kibana.
   * 
   * CONFIGURATION:
   * - LOGSTASH_HOST: Hostname of Logstash server (default: logstash)
   * - LOGSTASH_PORT: TCP port for log ingestion (default: 5000)
   * 
   * IMPORTANT FILTERS IN KIBANA:
   * - service:email-service - Filter logs from this service
   * - level:error - Show only errors
   * - tags:email-service - Filter by service tag
   */
  if (process.env.LOGSTASH_HOST || process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.Logstash({
      port: parseInt(process.env.LOGSTASH_PORT, 10) || 5000,
      host: process.env.LOGSTASH_HOST || 'logstash',
      node_name: 'email-service',
      max_connect_retries: -1,  // Retry indefinitely
      timeout_connect_retries: 5000  // Wait 5s between retries
    }));
    
    // Log connection status (only once at startup)
    console.log(`[email-service] Logstash transport configured: ${process.env.LOGSTASH_HOST || 'logstash'}:${process.env.LOGSTASH_PORT || 5000}`);
  }
}

// ============================================================================
// STREAM FOR HTTP REQUEST LOGGING
// ============================================================================
// Can be used with morgan for HTTP request logging

logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

module.exports = logger;
