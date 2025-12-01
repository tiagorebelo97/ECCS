/**
 * ============================================================================
 * Email Processor - Multi-Provider Email Delivery Service
 * ============================================================================
 *
 * This module handles email delivery using multiple provider options:
 * 1. SMTP (Nodemailer) - Default, works with any SMTP server
 * 2. AWS SES - Amazon Simple Email Service for high-volume sending
 * 3. SendGrid - Popular email API service
 *
 * PROVIDER SELECTION:
 * The email provider is determined by the EMAIL_PROVIDER environment variable:
 * - 'smtp' (default): Uses Nodemailer with SMTP configuration
 * - 'ses': Uses AWS SES SDK
 * - 'sendgrid': Uses SendGrid API
 *
 * CONFIGURATION:
 * Each provider requires specific environment variables:
 *
 * SMTP:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * SES:
 *   AWS_REGION, AWS_SES_SMTP_USER, AWS_SES_SMTP_PASS, SES_FROM_EMAIL
 *
 * SendGrid:
 *   SENDGRID_API_KEY, SENDGRID_FROM_EMAIL
 *
 * ERROR HANDLING:
 * - Network errors: Throws for retry mechanism
 * - Authentication errors: Throws for retry (may be temporary)
 * - Invalid recipient: Throws (will eventually go to DLQ)
 * - Rate limiting: Throws for retry with backoff
 */

const nodemailer = require('nodemailer');
const logger = require('../config/logger');
const EmailLog = require('../models/emailLog');
const Template = require('../models/template');

/**
 * EmailProcessor class handles email delivery through multiple providers.
 *
 * DESIGN PATTERN:
 * Uses Strategy pattern internally - the transport is selected at construction
 * time based on environment configuration, but the interface remains consistent.
 *
 * THREAD SAFETY:
 * This class is designed to be instantiated once and reused across requests.
 * The underlying transporter handles connection pooling automatically.
 */
class EmailProcessor {
  /**
   * Constructs an EmailProcessor with the configured email provider.
   *
   * INITIALIZATION:
   * 1. Determine provider from environment (default: smtp)
   * 2. Create appropriate transport configuration
   * 3. Verify transport connection on first use
   *
   * SUPPORTED PROVIDERS:
   * - 'smtp': Direct SMTP connection (most compatible)
   * - 'ses': AWS Simple Email Service (high deliverability)
   * - 'sendgrid': SendGrid API (easy to use, good analytics)
   */
  constructor() {
    // Determine which email provider to use based on environment configuration
    this.provider = process.env.EMAIL_PROVIDER || 'smtp';

    // Log the selected provider for debugging
    logger.info({
      message: 'Initializing EmailProcessor',
      provider: this.provider
    });

    // Initialize the appropriate transporter based on provider selection
    this.transporter = this._createTransporter();
  }

  /**
   * Creates the email transporter based on the configured provider.
   *
   * TRANSPORTER OPTIONS:
   * Each provider has different configuration requirements and capabilities:
   *
   * SMTP:
   * - Most universal, works with any email server
   * - Requires host, port, authentication
   * - Supports TLS/SSL encryption
   *
   * SES:
   * - AWS service, requires AWS credentials
   * - Automatic bounce/complaint handling
   * - High deliverability reputation
   *
   * SendGrid:
   * - API-based, no SMTP connection required
   * - Built-in analytics and tracking
   * - Easy template support
   *
   * @returns {Object} Nodemailer transporter instance
   * @private
   */
  _createTransporter() {
    switch (this.provider.toLowerCase()) {
      case 'ses':
        // ====================================================================
        // AWS SES Configuration
        // ====================================================================
        // AWS SES provides high-volume email sending with excellent deliverability.
        // Requires AWS credentials and SES-verified sender identity.
        logger.info('Configuring AWS SES transport');
        return nodemailer.createTransport({
          // Use SES SMTP interface (requires SMTP credentials, not IAM keys)
          // SMTP endpoint format: email-smtp.{region}.amazonaws.com
          host: `email-smtp.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`,
          port: 587,
          secure: false, // Use STARTTLS
          auth: {
            // AWS SES SMTP credentials (different from IAM credentials)
            // Generate in AWS SES Console > SMTP Settings
            user: process.env.AWS_SES_SMTP_USER,
            pass: process.env.AWS_SES_SMTP_PASS
          },
          // SES-specific options
          connectionTimeout: 10000,  // 10 second connection timeout
          greetingTimeout: 10000,    // 10 second greeting timeout
          socketTimeout: 30000       // 30 second socket timeout
        });

      case 'sendgrid':
        // ====================================================================
        // SendGrid Configuration
        // ====================================================================
        // SendGrid is a popular email service with API-based sending.
        // Uses SMTP relay with API key authentication.
        logger.info('Configuring SendGrid transport');
        return nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: {
            // SendGrid uses 'apikey' as the username with the API key as password
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          },
          // Connection pool settings for high-volume sending
          pool: true,
          maxConnections: 5,
          maxMessages: 100
        });

      case 'smtp':
      default:
        // ====================================================================
        // SMTP Configuration (Default)
        // ====================================================================
        // Direct SMTP connection - works with any SMTP server including:
        // - Gmail, Outlook, Yahoo (with app passwords)
        // - Mailgun, Postmark, SparkPost SMTP relays
        // - Self-hosted mail servers
        logger.info('Configuring SMTP transport');
        return nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          // Use TLS if port is 465, otherwise STARTTLS upgrade
          secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          },
          // TLS configuration for security
          tls: {
            // Reject unauthorized certificates based on environment config
            // SMTP_TLS_REJECT_UNAUTHORIZED allows explicit control (true/false)
            // Falls back to rejecting only in production if not set
            rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== undefined
              ? process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'true'
              : process.env.NODE_ENV === 'production',
            // Minimum TLS version for security
            minVersion: 'TLSv1.2'
          },
          // Connection settings
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 30000,
          // Debug logging in development
          debug: process.env.NODE_ENV !== 'production',
          logger: process.env.NODE_ENV !== 'production'
        });
    }
  }

  /**
   * Sends an email using the configured provider.
   *
   * EMAIL FLOW:
   * 1. Extract email data (recipient, subject, body, optional template)
   * 2. Construct mail options with proper formatting
   * 3. Apply template if templateId is provided
   * 4. Send via configured transporter
   * 5. Return delivery result with message ID
   *
   * ERROR HANDLING:
   * - Connection errors: Thrown for retry mechanism
   * - Authentication failures: Thrown (may be temporary token issues)
   * - Invalid recipient: Thrown (will eventually go to DLQ)
   * - Rate limiting: Thrown for exponential backoff retry
   *
   * @param {Object} emailData - Email request data
   * @param {string} emailData.id - Unique email identifier
   * @param {string} emailData.to - Recipient email address
   * @param {string} emailData.subject - Email subject line
   * @param {string} emailData.body - Plain text or HTML body content
   * @param {string} [emailData.templateId] - Optional template ID for templated emails
   * @param {Object} [emailData.templateData] - Data to inject into template
   * @returns {Object} Delivery result with messageId and response
   * @throws {Error} On delivery failure (triggers retry mechanism)
   */
  async sendEmail(emailData) {
    const { to, subject, body, id, templateId, templateData } = emailData;

    // Log the send attempt with context for debugging
    logger.info({
      message: 'Initiating email delivery',
      emailId: id,
      recipient: to,
      subject: subject,
      provider: this.provider,
      hasTemplate: !!templateId
    });

    // ========================================================================
    // CONSTRUCT MAIL OPTIONS
    // ========================================================================
    // Build the email message with all required fields
    const mailOptions = {
      // Sender address - uses provider-specific FROM configuration
      from: this._getFromAddress(),
      // Recipient(s) - can be string or array for multiple recipients
      to: to,
      // Subject line
      subject: subject,
      // Message ID header for tracking
      messageId: `<${id}@eccs.local>`,
      // Custom headers for tracking
      headers: {
        'X-ECCS-Email-ID': id,
        'X-ECCS-Provider': this.provider
      }
    };

    // ========================================================================
    // APPLY TEMPLATE OR USE PLAIN BODY
    // ========================================================================
    if (templateId && templateData) {
      // Use template engine for dynamic content
      const renderedContent = await this._renderTemplate(templateId, templateData);
      mailOptions.html = renderedContent.html;
      mailOptions.text = renderedContent.text;
    } else {
      // Use provided body content directly
      mailOptions.text = body;
      mailOptions.html = this._convertToHtml(body);
    }

    // ========================================================================
    // SEND EMAIL
    // ========================================================================
    try {
      // Record send start time for latency measurement
      const sendStartTime = Date.now();

      // Send the email through the configured transporter
      const result = await this.transporter.sendMail(mailOptions);

      // Calculate send latency
      const sendLatencyMs = Date.now() - sendStartTime;

      // Log successful delivery with details
      logger.info({
        message: 'Email delivered successfully',
        emailId: id,
        recipient: to,
        messageId: result.messageId,
        response: result.response,
        provider: this.provider,
        sendLatencyMs: sendLatencyMs
      });

      // Return delivery result for logging
      return {
        messageId: result.messageId,
        response: result.response,
        accepted: result.accepted,
        rejected: result.rejected,
        sendLatencyMs: sendLatencyMs
      };

    } catch (error) {
      // ======================================================================
      // DELIVERY FAILURE HANDLING
      // ======================================================================
      // Log the error with full context for debugging
      logger.error({
        message: 'Email delivery failed',
        emailId: id,
        recipient: to,
        provider: this.provider,
        errorCode: error.code,
        errorMessage: error.message,
        errorResponse: error.response,
        // Include stack trace for debugging
        stack: error.stack
      });

      // Re-throw to trigger retry mechanism in caller
      // The error message is preserved for logging and DLQ
      throw error;
    }
  }

  /**
   * Gets the appropriate FROM address based on provider configuration.
   *
   * PROVIDER-SPECIFIC FROM ADDRESSES:
   * - SMTP: Uses SMTP_FROM or SMTP_USER
   * - SES: Uses SES_FROM_EMAIL
   * - SendGrid: Uses SENDGRID_FROM_EMAIL
   *
   * @returns {string} Formatted FROM address
   * @private
   */
  _getFromAddress() {
    switch (this.provider.toLowerCase()) {
      case 'ses':
        return process.env.SES_FROM_EMAIL || process.env.SMTP_FROM;
      case 'sendgrid':
        return process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_FROM;
      default: {
        // Format: "Display Name <email@example.com>"
        const fromName = process.env.SMTP_FROM_NAME || 'ECCS Email Service';
        const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
        return `${fromName} <${fromEmail}>`;
      }
    }
  }

  /**
   * Renders an email template with provided data.
   *
   * TEMPLATE SYSTEM:
   * Templates are stored in MongoDB and can include placeholders for dynamic content.
   * Placeholders use {{variableName}} syntax and are replaced with templateData values.
   *
   * PLACEHOLDER EXAMPLES:
   * - {{userName}} -> "John Doe"
   * - {{orderNumber}} -> "ORD-12345"
   * - {{companyName}} -> "ECCS Inc."
   *
   * @param {string} templateId - Template identifier in MongoDB
   * @param {Object} templateData - Key-value pairs for placeholder replacement
   * @returns {Object} Rendered content with html and text versions
   * @private
   */
  async _renderTemplate(templateId, templateData) {
    try {
      // Fetch template from MongoDB using the Template model
      const template = await Template.findOne({ templateId: templateId });

      if (!template) {
        logger.warn({
          message: 'Template not found, using empty template',
          templateId: templateId
        });
        return { html: '', text: '' };
      }

      // Render HTML version with placeholder replacement
      let html = template.htmlContent || '';
      let text = template.textContent || '';

      // Replace all placeholders with actual values
      for (const [key, value] of Object.entries(templateData)) {
        const placeholder = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(placeholder, value);
        text = text.replace(placeholder, value);
      }

      return { html, text };

    } catch (error) {
      logger.error({
        message: 'Failed to render template',
        templateId: templateId,
        error: error.message
      });
      // Fall back to empty content on template error
      return { html: '', text: '' };
    }
  }

  /**
   * Converts plain text to basic HTML for email body.
   *
   * CONVERSION RULES:
   * - Preserves newlines as <br> tags
   * - Wraps content in styled container
   * - Uses safe fonts and styling for email clients
   *
   * @param {string} text - Plain text content
   * @returns {string} HTML formatted content
   * @private
   */
  _convertToHtml(text) {
    // Handle null/undefined input
    if (!text) return '';

    // Escape HTML entities to prevent XSS
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // Convert newlines to <br> tags and wrap in styled container
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <p style="font-size: 14px; line-height: 1.6; color: #333333;">
      ${escapedText.replace(/\n/g, '<br>')}
    </p>
  </div>
</body>
</html>`;
  }

  /**
   * Logs email processing status to MongoDB for audit and monitoring.
   *
   * LOG STRUCTURE:
   * Each log entry captures:
   * - Email identification (emailId)
   * - Processing status (pending, sent, failed, retry)
   * - Error details if applicable
   * - Timing and latency metrics
   * - Additional metadata for debugging
   *
   * USE CASES:
   * - Audit trail for compliance
   * - Debugging failed deliveries
   * - Performance monitoring
   * - Analytics and reporting
   *
   * @param {string} emailId - Unique email identifier
   * @param {string} status - Processing status ('pending', 'sent', 'failed', 'retry')
   * @param {string|null} errorMessage - Error message if failed
   * @param {Object} metadata - Additional context (latency, attempt number, etc.)
   */
  async logEmailStatus(emailId, status, errorMessage = null, metadata = {}) {
    try {
      // Create log entry with all context
      const log = new EmailLog({
        emailId: emailId,
        status: status,
        errorMessage: errorMessage,
        processedAt: metadata.processedAt || new Date(),
        metadata: {
          // Spread any provided metadata
          ...metadata,
          // Add standard fields
          provider: this.provider,
          timestamp: new Date().toISOString()
        }
      });

      // Persist to MongoDB
      await log.save();

      // Log the logging action (meta-logging) for debugging
      logger.debug({
        message: 'Email status logged to MongoDB',
        emailId: emailId,
        status: status,
        hasError: !!errorMessage
      });

    } catch (error) {
      // Log failure to store log entry
      // Don't throw - logging failure shouldn't break email processing
      logger.error({
        message: 'Failed to log email status to MongoDB',
        emailId: emailId,
        status: status,
        error: error.message
      });
    }
  }

  /**
   * Verifies the transporter connection is working.
   *
   * VERIFICATION PROCESS:
   * - Tests SMTP handshake with server
   * - Validates credentials
   * - Returns true if connection successful
   *
   * USE CASE:
   * Call during startup or health check to ensure email service is operational.
   *
   * @returns {Promise<boolean>} True if connection is valid
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info({
        message: 'Email transport connection verified',
        provider: this.provider
      });
      return true;
    } catch (error) {
      logger.error({
        message: 'Email transport verification failed',
        provider: this.provider,
        error: error.message
      });
      return false;
    }
  }
}

module.exports = EmailProcessor;
