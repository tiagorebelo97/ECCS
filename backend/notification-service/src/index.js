require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Kafka } = require('kafkajs');
const promClient = require('prom-client');
const logger = require('./config/logger');
const EmailProcessor = require('./services/emailProcessor');
const { initTracer } = require('./config/tracer');

const app = express();
const PORT = process.env.PORT || 3003;

// Initialize tracing
const tracer = initTracer('notification-service');

// Prometheus metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics();

const emailsProcessed = new promClient.Counter({
  name: 'emails_processed_total',
  help: 'Total number of emails processed',
  labelNames: ['status']
});

const emailProcessingDuration = new promClient.Histogram({
  name: 'email_processing_duration_seconds',
  help: 'Duration of email processing in seconds',
  buckets: [0.5, 1, 2, 5, 10, 30]
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'notification-service' });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// Kafka configuration
const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || 'notification-group' });
const producer = kafka.producer();

// Email processor instance
const emailProcessor = new EmailProcessor();

// Retry configuration
const RETRY_ATTEMPTS = parseInt(process.env.RETRY_ATTEMPTS) || 3;
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY) || 5000;
const DLQ_TOPIC = 'email-notifications-dlq';
const RETRY_TOPIC = 'email-notifications-retry';

async function processMessage(message, attempt = 1) {
  const startTime = Date.now();
  const emailData = JSON.parse(message.value.toString());
  
  logger.info(`Processing email ${emailData.id}, attempt ${attempt}`);

  try {
    await emailProcessor.sendEmail(emailData);
    
    emailsProcessed.inc({ status: 'success' });
    emailProcessingDuration.observe((Date.now() - startTime) / 1000);
    
    logger.info(`Email ${emailData.id} sent successfully`);
    
    // Update email status in MongoDB log
    await emailProcessor.logEmailStatus(emailData.id, 'sent', null);
  } catch (error) {
    logger.error(`Failed to send email ${emailData.id}:`, error.message);
    
    if (attempt < RETRY_ATTEMPTS) {
      // Send to retry topic with delay
      logger.info(`Scheduling retry ${attempt + 1} for email ${emailData.id}`);
      
      await producer.send({
        topic: RETRY_TOPIC,
        messages: [{
          key: message.key,
          value: JSON.stringify({
            ...emailData,
            retryAttempt: attempt + 1,
            lastError: error.message,
            nextRetryAt: new Date(Date.now() + RETRY_DELAY).toISOString()
          }),
          headers: {
            'retry-count': attempt.toString()
          }
        }]
      });
      
      emailsProcessed.inc({ status: 'retry' });
    } else {
      // Send to dead letter queue
      logger.error(`Email ${emailData.id} failed after ${RETRY_ATTEMPTS} attempts, sending to DLQ`);
      
      await producer.send({
        topic: DLQ_TOPIC,
        messages: [{
          key: message.key,
          value: JSON.stringify({
            ...emailData,
            failureReason: error.message,
            failedAt: new Date().toISOString(),
            totalAttempts: RETRY_ATTEMPTS
          })
        }]
      });
      
      emailsProcessed.inc({ status: 'failed' });
      
      // Update email status
      await emailProcessor.logEmailStatus(emailData.id, 'failed', error.message);
    }
    
    emailProcessingDuration.observe((Date.now() - startTime) / 1000);
  }
}

async function runConsumer() {
  await consumer.connect();
  await producer.connect();
  
  // Subscribe to main topic and retry topic
  await consumer.subscribe({ topic: 'email-notifications', fromBeginning: false });
  await consumer.subscribe({ topic: RETRY_TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (topic === RETRY_TOPIC) {
        const data = JSON.parse(message.value.toString());
        const retryAttempt = data.retryAttempt || 1;
        
        // Add delay for retry
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        await processMessage(message, retryAttempt);
      } else {
        await processMessage(message);
      }
    }
  });

  logger.info('Notification service consumer is running');
}

async function start() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Start Kafka consumer
    await runConsumer();

    // Start Express server for health checks
    app.listen(PORT, () => {
      logger.info(`Notification service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start notification service:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  await consumer.disconnect();
  await producer.disconnect();
  await mongoose.disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
