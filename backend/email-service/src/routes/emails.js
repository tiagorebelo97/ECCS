const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../config/logger');

// Get email statistics
router.get('/stats', async (req, res) => {
  try {
    const db = req.app.get('db');
    
    const totalResult = await db.query('SELECT COUNT(*) FROM emails WHERE user_id = $1', [req.user.id]);
    const sentTodayResult = await db.query(
      "SELECT COUNT(*) FROM emails WHERE user_id = $1 AND status = 'sent' AND created_at >= CURRENT_DATE",
      [req.user.id]
    );
    const pendingResult = await db.query(
      "SELECT COUNT(*) FROM emails WHERE user_id = $1 AND status = 'pending'",
      [req.user.id]
    );
    const failedResult = await db.query(
      "SELECT COUNT(*) FROM emails WHERE user_id = $1 AND status = 'failed'",
      [req.user.id]
    );

    res.json({
      totalEmails: parseInt(totalResult.rows[0].count),
      sentToday: parseInt(sentTodayResult.rows[0].count),
      pending: parseInt(pendingResult.rows[0].count),
      failed: parseInt(failedResult.rows[0].count)
    });
  } catch (error) {
    logger.error('Failed to get stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Get all emails for user
router.get('/', async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(
      'SELECT * FROM emails WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    logger.error('Failed to get emails:', error);
    res.status(500).json({ error: 'Failed to get emails' });
  }
});

// Send email (queue to Kafka)
router.post('/send', [
  body('to').isEmail().withMessage('Valid email address required'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('body').notEmpty().withMessage('Body is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { to, subject, body: emailBody } = req.body;
    const db = req.app.get('db');
    const producer = req.app.get('kafka');

    // Insert email record
    const result = await db.query(
      'INSERT INTO emails (user_id, recipient, subject, body, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, to, subject, emailBody, 'pending']
    );

    const email = result.rows[0];

    // Send to Kafka for processing
    await producer.send({
      topic: 'email-notifications',
      messages: [
        {
          key: email.id.toString(),
          value: JSON.stringify({
            id: email.id,
            to,
            subject,
            body: emailBody,
            userId: req.user.id,
            timestamp: new Date().toISOString()
          })
        }
      ]
    });

    logger.info(`Email queued for sending: ${email.id}`);
    res.status(201).json({ message: 'Email queued for sending', email });
  } catch (error) {
    logger.error('Failed to queue email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Get single email
router.get('/:id', async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(
      'SELECT * FROM emails WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Failed to get email:', error);
    res.status(500).json({ error: 'Failed to get email' });
  }
});

module.exports = router;
