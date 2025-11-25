const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const logger = require('../config/logger');
const EmailLog = require('../models/emailLog');

class EmailProcessor {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendEmail(emailData) {
    const { to, subject, body, id } = emailData;

    logger.info(`Sending email to ${to}`);

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text: body,
      html: this.convertToHtml(body)
    };

    const result = await this.transporter.sendMail(mailOptions);

    logger.info(`Email sent: ${result.messageId}`);
    return result;
  }

  convertToHtml(text) {
    return `<div style="font-family: Arial, sans-serif; padding: 20px;">
      <p>${text.replace(/\n/g, '<br>')}</p>
    </div>`;
  }

  async logEmailStatus(emailId, status, errorMessage = null) {
    try {
      const log = new EmailLog({
        emailId,
        status,
        errorMessage,
        processedAt: new Date()
      });

      await log.save();
      logger.info(`Email status logged: ${emailId} - ${status}`);
    } catch (error) {
      logger.error(`Failed to log email status:`, error);
    }
  }
}

module.exports = EmailProcessor;
