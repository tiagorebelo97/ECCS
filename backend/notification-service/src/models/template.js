/**
 * ============================================================================
 * Template Model - MongoDB Schema for Email Templates
 * ============================================================================
 *
 * This model defines the structure for email templates stored in MongoDB.
 * Templates support placeholder syntax: {{variableName}}
 *
 * NOTE: This is a minimal schema for template lookup during email processing.
 * The full template management (CRUD) is handled by the email-service's
 * PostgreSQL-based templates table. This MongoDB model is only used for
 * fast template content retrieval during email rendering.
 *
 * For full template management, use the email-service's /api/templates endpoints.
 */

const mongoose = require('mongoose');

/**
 * Template Schema
 * 
 * This schema mirrors the essential fields from the PostgreSQL templates table
 * for quick access during email rendering. Full template data is managed in PostgreSQL.
 */
const templateSchema = new mongoose.Schema({
  // Template identifier (corresponds to PostgreSQL template ID)
  templateId: {
    type: String,
    required: true,
    index: true
  },

  // HTML content with placeholders
  htmlContent: {
    type: String,
    required: true
  },

  // Plain text content with placeholders
  textContent: {
    type: String,
    default: ''
  },

  // Subject line with placeholders
  subject: {
    type: String,
    default: ''
  },

  // Array of placeholder variable names
  placeholders: [{
    type: String
  }],

  // Last sync timestamp from PostgreSQL
  syncedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'templates'
});

// Index for fast lookup by templateId
templateSchema.index({ templateId: 1 }, { unique: true });

module.exports = mongoose.model('Template', templateSchema);
