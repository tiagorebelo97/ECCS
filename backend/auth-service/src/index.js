require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const promClient = require('prom-client');
const logger = require('./config/logger');
const { checkHealth: checkElasticsearchHealth, ELASTICSEARCH_ENABLED, indexLog } = require('./config/elasticsearch');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3002;

// Prometheus metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics();

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  const elasticsearchHealth = await checkElasticsearchHealth();
  res.status(200).json({
    status: 'healthy',
    service: 'auth-service',
    elasticsearch: elasticsearchHealth
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// PostgreSQL connection
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

// Make db available to routes
app.set('db', pool);

// Routes with rate limiting
app.use('/api/auth', authLimiter, authRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  try {
    await pool.query('SELECT NOW()');
    logger.info('Connected to PostgreSQL');

    // Verify Elasticsearch connection
    if (ELASTICSEARCH_ENABLED) {
      const esHealth = await checkElasticsearchHealth();
      if (esHealth.status === 'green' || esHealth.status === 'yellow') {
        logger.info(`Connected to Elasticsearch cluster: ${esHealth.clusterName}`);
        // Log startup event to Elasticsearch
        await indexLog('info', 'Auth service started', {
          event: 'service_startup',
          port: PORT
        });
      } else {
        logger.warn('Elasticsearch connection failed, continuing without centralized logging');
      }
    } else {
      logger.info('Elasticsearch logging is disabled');
    }

    app.listen(PORT, () => {
      logger.info(`Auth service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});
