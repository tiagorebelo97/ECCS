/**
 * ============================================================================
 * ECCS Locations Service - RESTful API for Location Management
 * ============================================================================
 *
 * This service provides REST API endpoints for:
 * 1. Saving map locations with names and addresses
 * 2. Reverse geocoding coordinates to addresses
 * 3. Indexing locations in Elasticsearch for map visualization
 *
 * ARCHITECTURE:
 * - Express.js HTTP server
 * - PostgreSQL for data persistence
 * - Elasticsearch for geo-point indexing and map visualization
 * - JWT-based authentication
 * - Jaeger for distributed tracing
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const { Client } = require('@elastic/elasticsearch');
const promClient = require('prom-client');
const logger = require('./config/logger');
const { initTracer } = require('./config/tracer');
const locationRoutes = require('./routes/locations');
const { authMiddleware } = require('./middleware/auth');

// ============================================================================
// EXPRESS APPLICATION SETUP
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3003;

// Initialize distributed tracing for request correlation
const tracer = initTracer('locations-service');

// ============================================================================
// PROMETHEUS METRICS CONFIGURATION
// ============================================================================

const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics();

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

// ============================================================================
// RATE LIMITING CONFIGURATION
// ============================================================================

const locationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    httpRequestDuration.labels(req.method, route, res.statusCode).observe(duration);
  });
  next();
});

// ============================================================================
// HEALTH CHECK AND METRICS ENDPOINTS
// ============================================================================

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'locations-service' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// ============================================================================
// DATABASE CONNECTIONS
// ============================================================================

/**
 * PostgreSQL connection pool for structured data.
 */
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

/**
 * Elasticsearch client for geo-point indexing.
 */
let esClient = null;
if (process.env.ELASTICSEARCH_HOST) {
  esClient = new Client({
    node: process.env.ELASTICSEARCH_HOST
  });
}

// ============================================================================
// APPLICATION CONTEXT
// ============================================================================

app.set('db', pool);
app.set('elasticsearch', esClient);
app.set('logger', logger);
app.set('tracer', tracer);

// ============================================================================
// API ROUTES
// ============================================================================

app.use('/api/locations', locationLimiter, authMiddleware, locationRoutes);

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

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
// ELASTICSEARCH INDEX SETUP
// ============================================================================

async function setupElasticsearchIndex() {
  if (!esClient) {
    logger.info('Elasticsearch not configured, skipping index setup');
    return;
  }

  try {
    const indexExists = await esClient.indices.exists({ index: 'eccs-locations' });
    
    if (!indexExists) {
      await esClient.indices.create({
        index: 'eccs-locations',
        mappings: {
          properties: {
            id: { type: 'integer' },
            user_id: { type: 'integer' },
            name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            address: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            location: { type: 'geo_point' },
            created_at: { type: 'date' },
            updated_at: { type: 'date' }
          }
        }
      });
      logger.info('Created eccs-locations index in Elasticsearch');
    } else {
      logger.info('eccs-locations index already exists in Elasticsearch');
    }
  } catch (error) {
    logger.error('Error setting up Elasticsearch index:', error.message);
  }
}

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function start() {
  try {
    // Verify PostgreSQL connection
    await pool.query('SELECT NOW()');
    logger.info('Connected to PostgreSQL');

    // Setup Elasticsearch index
    await setupElasticsearchIndex();

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`Locations service listening on port ${PORT}`);
      logger.info('Available routes:');
      logger.info('  - /api/locations (location operations)');
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

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await pool.end();
  if (esClient) {
    await esClient.close();
  }
  process.exit(0);
});
