/**
 * ============================================================================
 * Winston Logger Configuration - Auth Service
 * ============================================================================
 *
 * Centralized logging configuration for the auth service.
 * Provides structured JSON logging for production and colored console
 * output for development.
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
 * IMPORTANT KIBANA FILTERS:
 * - service:auth-service - Filter logs from this service
 * - level:error - Show only errors
 * - tags:auth-service - Filter by service tag
 * - message:"login" OR message:"register" - Authentication events
 */

const winston = require('winston');
require('winston-logstash');

/**
 * Custom log format for JSON output.
 * Ensures all logs are valid JSON for log aggregation systems (ELK, etc.)
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DDTHH:mm:ss.SSSZ'
  }),
  winston.format.errors({ stack: true }),
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
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0 && meta.service !== 'auth-service') {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  defaultMeta: { 
    service: 'auth-service',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? jsonFormat : consoleFormat
    })
  ],
  exitOnError: false
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({ 
    filename: 'logs/error.log', 
    level: 'error',
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5,
    format: jsonFormat
  }));
  logger.add(new winston.transports.File({ 
    filename: 'logs/combined.log',
    maxsize: 50 * 1024 * 1024,
    maxFiles: 10,
    format: jsonFormat
  }));

  /**
   * Logstash transport - sends logs to ELK stack for centralized monitoring.
   * Logs are indexed in Elasticsearch and visualized in Kibana.
   */
  if (process.env.LOGSTASH_HOST || process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.Logstash({
      port: parseInt(process.env.LOGSTASH_PORT, 10) || 5000,
      host: process.env.LOGSTASH_HOST || 'logstash',
      node_name: 'auth-service',
      max_connect_retries: -1,
      timeout_connect_retries: 5000
    }));
    
    console.log(`[auth-service] Logstash transport configured: ${process.env.LOGSTASH_HOST || 'logstash'}:${process.env.LOGSTASH_PORT || 5000}`);
  }
}

// Stream for HTTP request logging (can be used with morgan)
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

module.exports = logger;
