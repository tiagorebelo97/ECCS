require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { Pool } = require('pg');
const mongoose = require('mongoose');
const { Kafka } = require('kafkajs');
const promClient = require('prom-client');
const logger = require('./config/logger');
const emailRoutes = require('./routes/emails');
const { authMiddleware } = require('./middleware/auth');
const { initTracer } = require('./config/tracer');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize tracing
const tracer = initTracer('email-service');

// Prometheus metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics();

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request timing middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.path, res.statusCode).observe(duration);
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'email-service' });
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

// MongoDB connection for logging
mongoose.connect(process.env.MONGODB_URI)
  .then(() => logger.info('Connected to MongoDB'))
  .catch(err => logger.error('MongoDB connection error:', err));

// Kafka producer setup
const kafka = new Kafka({
  clientId: 'email-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const producer = kafka.producer();

// Make dependencies available to routes
app.set('db', pool);
app.set('kafka', producer);
app.set('tracer', tracer);

// Routes
app.use('/api/emails', authMiddleware, emailRoutes);

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

    await producer.connect();
    logger.info('Connected to Kafka');

    app.listen(PORT, () => {
      logger.info(`Email service listening on port ${PORT}`);
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
  await producer.disconnect();
  await pool.end();
  await mongoose.disconnect();
  process.exit(0);
});
