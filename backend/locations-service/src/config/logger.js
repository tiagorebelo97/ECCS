/**
 * ============================================================================
 * Winston Logger Configuration - Locations Service
 * ============================================================================
 */

const winston = require('winston');
const LogstashTransport = require('winston-logstash/lib/winston-logstash-latest');

const jsonFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DDTHH:mm:ss.SSSZ'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0 && meta.service !== 'locations-service') {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  defaultMeta: {
    service: 'locations-service',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? jsonFormat : consoleFormat
    })
  ],
  exitOnError: false
});

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

  if (process.env.LOGSTASH_HOST || process.env.NODE_ENV === 'production') {
    logger.add(new LogstashTransport({
      port: parseInt(process.env.LOGSTASH_PORT, 10) || 5000,
      host: process.env.LOGSTASH_HOST || 'logstash',
      node_name: 'locations-service',
      max_connect_retries: -1,
      timeout_connect_retries: 5000
    }));
    
    console.log(`[locations-service] Logstash transport configured: ${process.env.LOGSTASH_HOST || 'logstash'}:${process.env.LOGSTASH_PORT || 5000}`);
  }
}

logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

module.exports = logger;
