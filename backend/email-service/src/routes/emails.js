/**
 * ============================================================================
 * Email API Routes - Core Email Management Operations
 * ============================================================================
 *
 * RESTful API endpoints for email composition and sending.
 * Emails are queued to Kafka for async processing by notification-service.
 *
 * ENDPOINTS:
 * - GET  /api/emails       - List user's emails
 * - GET  /api/emails/stats - Get email statistics
 * - POST /api/emails/send  - Send/queue new email
 * - GET  /api/emails/:id   - Get single email details
 *
 * WORKFLOW:
 * 1. User submits email via POST /api/emails/send
 * 2. Email record created in PostgreSQL (status: pending)
 * 3. Message published to 'email_requests' Kafka topic
 * 4. Notification-service consumes and delivers the email
 * 5. Status updated in PostgreSQL upon delivery/failure
 *
 * AUTHENTICATION:
 * All endpoints require JWT authentication via authMiddleware.
 * User ID is extracted from the JWT token (req.user.id).
 *
 * ERROR HANDLING:
 * - 400: Validation errors
 * - 401: Authentication required
 * - 404: Email not found
 * - 500: Internal server error
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../config/logger');

// ============================================================================
// KAFKA TOPIC CONFIGURATION
// ============================================================================

/**
 * Topic name for email request messages.
 * This topic is consumed by the notification-service for email delivery.
 *
 * TOPIC STRUCTURE:
 * - email_requests: Primary topic for new email requests
 * - email_requests_retry: Retry queue (managed by notification-service)
 * - email_dlq: Dead letter queue for failed emails
 */
const EMAIL_REQUESTS_TOPIC = 'email_requests';

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * GET /api/emails/stats
 *
 * Retrieves email statistics for the authenticated user.
 *
 * STATISTICS RETURNED:
 * - totalEmails: Total number of emails sent by user
 * - sentToday: Emails sent successfully today
 * - pending: Emails awaiting delivery
 * - failed: Emails that failed to deliver
 *
 * USE CASE:
 * Dashboard widgets showing email activity summary.
 *
 * RESPONSE FORMAT:
 * {
 *   totalEmails: 150,
 *   sentToday: 12,
 *   pending: 3,
 *   failed: 2
 * }
 */
router.get('/stats', async (req, res) => {
  try {
    // Get database connection from app context
    const db = req.app.get('db');
    const userId = req.user.id;

    // Execute parallel queries for better performance
    // Each query counts emails with specific criteria
    const [totalResult, sentTodayResult, pendingResult, failedResult] = await Promise.all([
      // Total emails ever sent by this user
      db.query('SELECT COUNT(*) FROM emails WHERE user_id = $1', [userId]),

      // Emails successfully sent today (status = 'sent' AND created today)
      db.query(
        "SELECT COUNT(*) FROM emails WHERE user_id = $1 AND status = 'sent' AND created_at >= CURRENT_DATE",
        [userId]
      ),

      // Emails currently in queue awaiting processing
      db.query(
        "SELECT COUNT(*) FROM emails WHERE user_id = $1 AND status = 'pending'",
        [userId]
      ),

      // Emails that failed delivery after all retries
      db.query(
        "SELECT COUNT(*) FROM emails WHERE user_id = $1 AND status = 'failed'",
        [userId]
      )
    ]);

    // Build and return statistics response
    const stats = {
      totalEmails: parseInt(totalResult.rows[0].count),
      sentToday: parseInt(sentTodayResult.rows[0].count),
      pending: parseInt(pendingResult.rows[0].count),
      failed: parseInt(failedResult.rows[0].count)
    };

    // Log statistics retrieval for monitoring
    logger.info({
      message: 'Email statistics retrieved',
      userId: userId,
      stats: stats
    });

    res.json(stats);

  } catch (error) {
    // Log error with context for debugging
    logger.error({
      message: 'Failed to get email statistics',
      userId: req.user.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * GET /api/emails
 *
 * Lists emails for the authenticated user with pagination.
 *
 * QUERY PARAMETERS:
 * - limit: Maximum emails to return (default: 100)
 * - offset: Pagination offset (default: 0)
 * - status: Filter by status (optional)
 *
 * RESPONSE FORMAT:
 * [
 *   {
 *     id: 123,
 *     recipient: "user@example.com",
 *     subject: "Hello",
 *     status: "sent",
 *     created_at: "2024-01-01T12:00:00Z"
 *   },
 *   ...
 * ]
 *
 * ORDERING:
 * Results are ordered by creation date, newest first.
 */
router.get('/', async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;

    // Query emails for this user, newest first
    // Limit to 100 to prevent excessive data transfer
    const result = await db.query(
      'SELECT * FROM emails WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [userId]
    );

    // Log query for monitoring
    logger.info({
      message: 'Emails retrieved',
      userId: userId,
      count: result.rows.length
    });

    res.json(result.rows);

  } catch (error) {
    logger.error({
      message: 'Failed to get emails',
      userId: req.user.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get emails' });
  }
});

/**
 * POST /api/emails/send
 *
 * Sends a new email by queuing it for delivery.
 *
 * WORKFLOW:
 * 1. Validate request body (to, subject, body required)
 * 2. Create email record in PostgreSQL with 'pending' status
 * 3. Publish message to 'email_requests' Kafka topic
 * 4. Return success with email details
 *
 * REQUEST BODY:
 * {
 *   to: "recipient@example.com",    // Required - recipient email
 *   subject: "Email Subject",       // Required - email subject line
 *   body: "Email content here...",  // Required - plain text body
 *   templateId: "abc123",           // Optional - use template for body
 *   templateData: { key: "value" }  // Optional - template placeholder values
 * }
 *
 * RESPONSE:
 * {
 *   message: "Email queued for sending",
 *   email: { id, recipient, subject, status, ... }
 * }
 *
 * KAFKA MESSAGE FORMAT:
 * {
 *   id: 123,
 *   to: "recipient@example.com",
 *   subject: "Subject",
 *   body: "Content",
 *   userId: 456,
 *   timestamp: "2024-01-01T12:00:00Z"
 * }
 */
router.post('/send', [
  // Validation rules with custom error messages
  body('to')
    .isEmail()
    .withMessage('Valid email address required')
    .normalizeEmail(),
  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Subject must not exceed 500 characters'),
  body('body')
    .notEmpty()
    .withMessage('Body is required'),
  body('templateId')
    .optional()
    .isString(),
  body('templateData')
    .optional()
    .isObject()
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return detailed validation errors
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const { to, subject, body: emailBody, templateId, templateData } = req.body;
    const db = req.app.get('db');
    const producer = req.app.get('kafka');
    const userId = req.user.id;

    // ========================================================================
    // STEP 1: Create email record in PostgreSQL
    // ========================================================================
    // Initial status is 'pending' - will be updated by notification-service
    const result = await db.query(
      `INSERT INTO emails (user_id, recipient, subject, body, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, to, subject, emailBody, 'pending']
    );

    const email = result.rows[0];

    // ========================================================================
    // STEP 2: Publish to Kafka for async processing
    // ========================================================================
    // The notification-service will consume this message and handle delivery

    // Construct Kafka message with all required data
    const kafkaMessage = {
      // Email identifier for tracking
      id: email.id,
      // Delivery information
      to: to,
      subject: subject,
      body: emailBody,
      // User context
      userId: userId,
      // Template information (optional)
      templateId: templateId || null,
      templateData: templateData || null,
      // Metadata for tracking
      timestamp: new Date().toISOString(),
      source: 'email-service-api'
    };

    // Send to Kafka topic
    await producer.send({
      topic: EMAIL_REQUESTS_TOPIC,
      messages: [
        {
          // Use email ID as key for partition consistency
          // All messages for same email go to same partition
          key: email.id.toString(),
          // JSON-encoded email data
          value: JSON.stringify(kafkaMessage),
          // Headers for quick filtering without parsing body
          headers: {
            'x-email-id': email.id.toString(),
            'x-user-id': userId.toString(),
            'x-timestamp': new Date().toISOString()
          }
        }
      ]
    });

    // ========================================================================
    // STEP 3: Log and respond
    // ========================================================================
    logger.info({
      message: 'Email queued for sending',
      emailId: email.id,
      recipient: to,
      userId: userId,
      kafkaTopic: EMAIL_REQUESTS_TOPIC
    });

    // Return success response with email details
    res.status(201).json({
      message: 'Email queued for sending',
      email: email
    });

  } catch (error) {
    // Log the error with full context
    logger.error({
      message: 'Failed to queue email',
      userId: req.user.id,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to send email' });
  }
});

/**
 * GET /api/emails/:id
 *
 * Retrieves details of a specific email.
 *
 * PATH PARAMETERS:
 * - id: Email ID (integer)
 *
 * AUTHORIZATION:
 * Only the email owner (user who created it) can access it.
 *
 * RESPONSE:
 * {
 *   id: 123,
 *   user_id: 456,
 *   recipient: "user@example.com",
 *   subject: "Subject",
 *   body: "Content",
 *   status: "sent",
 *   sent_at: "2024-01-01T12:05:00Z",
 *   error_message: null,
 *   created_at: "2024-01-01T12:00:00Z",
 *   updated_at: "2024-01-01T12:05:00Z"
 * }
 */
router.get('/:id', async (req, res) => {
  try {
    const db = req.app.get('db');
    const emailId = req.params.id;
    const userId = req.user.id;

    // Query email by ID, ensuring it belongs to the authenticated user
    // This prevents users from accessing other users' emails
    const result = await db.query(
      'SELECT * FROM emails WHERE id = $1 AND user_id = $2',
      [emailId, userId]
    );

    // Check if email exists and belongs to user
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // Log access for audit trail
    logger.info({
      message: 'Email details retrieved',
      emailId: emailId,
      userId: userId
    });

    res.json(result.rows[0]);

  } catch (error) {
    logger.error({
      message: 'Failed to get email',
      emailId: req.params.id,
      userId: req.user.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get email' });
  }
});

module.exports = router;
