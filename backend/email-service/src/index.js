/**
 * ============================================================================
 * ECCS Email Service - RESTful API for Email Management
 * ============================================================================
 *
 * This service provides REST API endpoints for:
 * 1. Managing email composition and queuing (sending to Kafka)
 * 2. Managing email addresses (contact book functionality)
 * 3. Managing email templates (reusable email content)
 *
 * ARCHITECTURE:
 * - Express.js HTTP server
 * - PostgreSQL for data persistence
 * - Kafka for async email processing (producer)
 * - MongoDB for logging and audit trail
 * - JWT-based authentication
 *
 * API ROUTES:
 * - /api/emails     - Email operations (list, send, get)
 * - /api/addresses  - Email address management (CRUD)
 * - /api/templates  - Email template management (CRUD)
 *
 * SECURITY:
 * - Helmet.js security headers
 * - Rate limiting per endpoint
 * - JWT token authentication
 * - Input validation with express-validator
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const mongoose = require('mongoose');
const { Kafka } = require('kafkajs');
const promClient = require('prom-client');
const logger = require('./config/logger');
const { checkHealth: checkElasticsearchHealth, ELASTICSEARCH_ENABLED, indexLog } = require('./config/elasticsearch');
const emailRoutes = require('./routes/emails');
const addressRoutes = require('./routes/addresses');
const templateRoutes = require('./routes/templates');
const { authMiddleware } = require('./middleware/auth');
const { initTracer } = require('./config/tracer');

// ============================================================================
// EXPRESS APPLICATION SETUP
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize distributed tracing for request correlation
const tracer = initTracer('email-service');

// ============================================================================
// PROMETHEUS METRICS CONFIGURATION
// ============================================================================

// Collect default Node.js metrics (memory, CPU, event loop latency)
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics();

/**
 * HTTP request duration histogram for monitoring API latency.
 * Labels: method, route, status_code
 * Used for SLA tracking and identifying slow endpoints.
 */
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

// ============================================================================
// RATE LIMITING CONFIGURATION
// ============================================================================

/**
 * Rate limiter for email-related endpoints.
 *
 * CONFIGURATION:
 * - Window: 15 minutes
 * - Max requests: 100 per window per IP
 * - Applies to: /api/emails/*
 *
 * PURPOSE:
 * Prevents abuse and ensures fair usage of email sending resources.
 */
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,     // Return rate limit info in headers
  legacyHeaders: false       // Disable X-RateLimit-* headers
});

/**
 * Rate limiter for address book endpoints.
 * More lenient than email limiter since these don't trigger external actions.
 */
const addressLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // 200 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter for template endpoints.
 */
const templateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150,                  // 150 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

// Security headers (XSS protection, content type options, etc.)
app.use(helmet());

// CORS configuration - adjust origins in production
app.use(cors());

// JSON body parser
app.use(express.json());

/**
 * Request timing middleware.
 * Records HTTP request duration for Prometheus metrics.
 */
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    // Normalize route for metrics (replace IDs with :id)
    const route = req.route?.path || req.path;
    httpRequestDuration.labels(req.method, route, res.statusCode).observe(duration);
  });
  next();
});

// ============================================================================
// HEALTH CHECK AND METRICS ENDPOINTS
// ============================================================================

/**
 * Health check endpoint for container orchestration.
 * Returns service status for liveness/readiness probes.
 */
app.get('/health', async (req, res) => {
  const elasticsearchHealth = await checkElasticsearchHealth();
  res.status(200).json({
    status: 'healthy',
    service: 'email-service',
    elasticsearch: elasticsearchHealth
  });
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
// DATABASE CONNECTIONS
// ============================================================================

/**
 * PostgreSQL connection pool for structured data.
 *
 * STORED DATA:
 * - User accounts (via auth-service)
 * - Email records and history
 * - Email addresses (contact book)
 * - Email templates
 */
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

/**
 * MongoDB connection for logging and audit trail.
 * Using mongoose for schema validation and query building.
 */
mongoose.connect(process.env.MONGODB_URI)
  .then(() => logger.info('Connected to MongoDB'))
  .catch(err => logger.error('MongoDB connection error:', err));

// ============================================================================
// KAFKA PRODUCER SETUP
// ============================================================================

/**
 * Kafka client for publishing email requests.
 *
 * TOPICS PRODUCED:
 * - email_requests: New email requests for notification-service
 */
const kafka = new Kafka({
  clientId: 'email-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const producer = kafka.producer();

// ============================================================================
// APPLICATION CONTEXT
// ============================================================================

/**
 * Make shared dependencies available to route handlers.
 * Routes access these via req.app.get('key').
 */
app.set('db', pool);
app.set('kafka', producer);
app.set('tracer', tracer);

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * Email routes - sending and managing emails
 * All routes require JWT authentication
 * Rate limited to prevent abuse
 */
app.use('/api/emails', emailLimiter, authMiddleware, emailRoutes);

/**
 * Address book routes - managing contact email addresses
 * All routes require JWT authentication
 */
app.use('/api/addresses', addressLimiter, authMiddleware, addressRoutes);

/**
 * Template routes - managing reusable email templates
 * All routes require JWT authentication
 */
app.use('/api/templates', templateLimiter, authMiddleware, templateRoutes);

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

/**
 * Global error handler for unhandled errors.
 * Logs error details and returns generic error response.
 */
app.use((err, req, res, next) => {
  logger.error({
    message: 'Unhandled error',
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

/**
 * Starts the email service.
 *
 * STARTUP SEQUENCE:
 * 1. Verify PostgreSQL connection
 * 2. Connect Kafka producer
 * 3. Verify Elasticsearch connection
 * 4. Start HTTP server
 */
async function start() {
  try {
    // Verify PostgreSQL connection
    await pool.query('SELECT NOW()');
    logger.info('Connected to PostgreSQL');

    // Connect Kafka producer
    await producer.connect();
    logger.info('Connected to Kafka');

    // Verify Elasticsearch connection
    if (ELASTICSEARCH_ENABLED) {
      const esHealth = await checkElasticsearchHealth();
      if (esHealth.status === 'green' || esHealth.status === 'yellow') {
        logger.info(`Connected to Elasticsearch cluster: ${esHealth.clusterName}`);
        // Log startup event to Elasticsearch
        await indexLog('info', 'Email service started', {
          event: 'service_startup',
          port: PORT
        });
      } else {
        logger.warn('Elasticsearch connection failed, continuing without centralized logging');
      }
    } else {
      logger.info('Elasticsearch logging is disabled');
    }

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`Email service listening on port ${PORT}`);
      logger.info('Available routes:');
      logger.info('  - /api/emails    (email operations)');
      logger.info('  - /api/addresses (address book)');
      logger.info('  - /api/templates (email templates)');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

/**
 * Graceful shutdown handler.
 * Closes all connections before exiting.
 */
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await producer.disconnect();
  await pool.end();
  await mongoose.disconnect();
  process.exit(0);
});
