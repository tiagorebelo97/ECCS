/**
 * ============================================================================
 * Email Templates API Routes
 * ============================================================================
 *
 * RESTful API endpoints for managing email templates.
 * Templates allow users to create reusable email content with placeholders.
 *
 * ENDPOINTS:
 * - GET    /api/templates          - List all templates
 * - POST   /api/templates          - Create new template
 * - GET    /api/templates/:id      - Get single template
 * - PUT    /api/templates/:id      - Update template
 * - DELETE /api/templates/:id      - Delete template
 * - POST   /api/templates/:id/preview - Preview template with sample data
 *
 * TEMPLATE PLACEHOLDERS:
 * Templates support placeholder syntax: {{variableName}}
 * Example: "Hello {{userName}}, your order {{orderId}} is ready."
 *
 * AUTHENTICATION:
 * All endpoints require JWT authentication via authMiddleware.
 * User ID is extracted from the JWT token (req.user.id).
 *
 * ERROR HANDLING:
 * - 400: Validation errors (invalid input)
 * - 401: Authentication required
 * - 404: Template not found
 * - 500: Internal server error
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../config/logger');

// =============================================================================
// VALIDATION MIDDLEWARE
// =============================================================================

/**
 * Validation rules for creating/updating email templates.
 *
 * VALIDATED FIELDS:
 * - name: Template name (required, max 100 chars)
 * - subject: Email subject line with optional placeholders (required)
 * - htmlContent: HTML body content (required)
 * - textContent: Plain text body content (optional, auto-generated if not provided)
 * - description: Template description (optional)
 * - category: Template category for organization (optional)
 */
const templateValidation = [
  body('name')
    .notEmpty()
    .withMessage('Template name is required')
    .trim()
    .isLength({ max: 100 })
    .withMessage('Template name must not exceed 100 characters'),
  body('subject')
    .notEmpty()
    .withMessage('Subject line is required')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Subject must not exceed 500 characters'),
  body('htmlContent')
    .notEmpty()
    .withMessage('HTML content is required'),
  body('textContent')
    .optional()
    .trim(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category must not exceed 50 characters')
];

/**
 * Extracts placeholder variables from template content.
 *
 * PLACEHOLDER FORMAT:
 * - Uses double curly braces: {{variableName}}
 * - Variable names can contain letters, numbers, underscores
 * - Case-sensitive matching
 *
 * @param {string} content - Template content to parse
 * @returns {string[]} Array of unique variable names
 */
function extractPlaceholders(content) {
  if (!content) return [];

  // Regex to match {{variableName}} pattern
  const placeholderRegex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  const matches = content.match(placeholderRegex) || [];

  // Extract unique variable names
  const variables = [...new Set(
    matches.map(match => match.replace(/\{\{|\}\}/g, ''))
  )];

  return variables;
}

/**
 * Renders template content by replacing placeholders with values.
 *
 * @param {string} content - Template content with placeholders
 * @param {Object} data - Key-value pairs for replacement
 * @returns {string} Rendered content
 */
function renderTemplate(content, data) {
  if (!content) return '';

  let rendered = content;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(placeholder, value || '');
  }

  return rendered;
}

/**
 * Strips HTML tags to generate plain text version.
 *
 * @param {string} html - HTML content
 * @returns {string} Plain text version
 */
function htmlToPlainText(html) {
  if (!html) return '';

  return html
    // Replace <br> and </p> with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    // Remove all HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Trim extra whitespace
    .trim();
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

/**
 * GET /api/templates
 *
 * Lists all email templates for the authenticated user.
 *
 * QUERY PARAMETERS:
 * - page: Page number for pagination (default: 1)
 * - limit: Results per page (default: 20, max: 100)
 * - category: Filter by category
 * - search: Search in name and description
 *
 * RESPONSE:
 * {
 *   templates: [...],
 *   pagination: { page, limit, total, pages }
 * }
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('category').optional().trim(),
  query('search').optional().trim()
], async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;

    // Pagination parameters
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const offset = (page - 1) * limit;

    // Build query with optional filters
    let queryText = `
      SELECT id, name, subject, description, category, 
             created_at, updated_at
      FROM email_templates
      WHERE user_id = $1
    `;
    let countQuery = 'SELECT COUNT(*) FROM email_templates WHERE user_id = $1';
    const queryParams = [userId];
    const countParams = [userId];
    let paramIndex = 2;

    // Add category filter if provided
    if (req.query.category) {
      queryText += ` AND category = $${paramIndex}`;
      countQuery += ` AND category = $${paramIndex}`;
      queryParams.push(req.query.category);
      countParams.push(req.query.category);
      paramIndex++;
    }

    // Add search filter if provided
    if (req.query.search) {
      queryText += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      countQuery += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      queryParams.push(`%${req.query.search}%`);
      countParams.push(`%${req.query.search}%`);
      paramIndex++;
    }

    // Add ordering and pagination
    queryText += ' ORDER BY updated_at DESC LIMIT $' + paramIndex + ' OFFSET $' + (paramIndex + 1);
    queryParams.push(limit, offset);

    // Execute queries
    const templatesResult = await db.query(queryText, queryParams);
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Log successful retrieval
    logger.info({
      message: 'Email templates retrieved',
      userId: userId,
      count: templatesResult.rows.length,
      page: page
    });

    res.json({
      templates: templatesResult.rows,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error({
      message: 'Failed to retrieve email templates',
      userId: req.user.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to retrieve templates' });
  }
});

/**
 * POST /api/templates
 *
 * Creates a new email template.
 *
 * REQUEST BODY:
 * {
 *   name: "Welcome Email",           // Required
 *   subject: "Welcome {{userName}}!", // Required
 *   htmlContent: "<h1>Welcome!</h1>", // Required
 *   textContent: "Welcome!",          // Optional
 *   description: "Welcome new users", // Optional
 *   category: "onboarding"            // Optional
 * }
 *
 * RESPONSE:
 * {
 *   message: "Template created",
 *   template: { ... },
 *   placeholders: ["userName"]
 * }
 */
router.post('/', templateValidation, async (req, res) => {
  // Handle validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const db = req.app.get('db');
    const userId = req.user.id;
    const { name, subject, htmlContent, textContent, description, category } = req.body;

    // Generate plain text version if not provided
    const finalTextContent = textContent || htmlToPlainText(htmlContent);

    // Extract placeholders from content
    const placeholders = [
      ...extractPlaceholders(subject),
      ...extractPlaceholders(htmlContent),
      ...extractPlaceholders(finalTextContent)
    ];
    const uniquePlaceholders = [...new Set(placeholders)];

    // Insert new template
    const result = await db.query(
      `INSERT INTO email_templates 
       (user_id, name, subject, html_content, text_content, description, category, placeholders)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, name, subject, htmlContent, finalTextContent, description || null, category || null, uniquePlaceholders]
    );

    const template = result.rows[0];

    // Log successful creation
    logger.info({
      message: 'Email template created',
      userId: userId,
      templateId: template.id,
      templateName: name,
      placeholderCount: uniquePlaceholders.length
    });

    res.status(201).json({
      message: 'Template created',
      template: template,
      placeholders: uniquePlaceholders
    });

  } catch (error) {
    logger.error({
      message: 'Failed to create email template',
      userId: req.user.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * GET /api/templates/:id
 *
 * Retrieves a single template with full content.
 *
 * PATH PARAMETERS:
 * - id: Template ID (integer)
 *
 * RESPONSE:
 * {
 *   id, name, subject, htmlContent, textContent,
 *   description, category, placeholders, created_at, updated_at
 * }
 */
router.get('/:id', [
  param('id').isInt().withMessage('Invalid template ID')
], async (req, res) => {
  // Handle validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const db = req.app.get('db');
    const userId = req.user.id;
    const templateId = req.params.id;

    const result = await db.query(
      `SELECT id, name, subject, html_content as "htmlContent", 
              text_content as "textContent", description, category, 
              placeholders, created_at, updated_at
       FROM email_templates
       WHERE id = $1 AND user_id = $2`,
      [templateId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    logger.error({
      message: 'Failed to retrieve email template',
      userId: req.user.id,
      templateId: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to retrieve template' });
  }
});

/**
 * PUT /api/templates/:id
 *
 * Updates an existing email template.
 *
 * PATH PARAMETERS:
 * - id: Template ID (integer)
 *
 * REQUEST BODY:
 * Same as POST /api/templates
 *
 * RESPONSE:
 * {
 *   message: "Template updated",
 *   template: { ... },
 *   placeholders: [...]
 * }
 */
router.put('/:id', [
  param('id').isInt().withMessage('Invalid template ID'),
  ...templateValidation
], async (req, res) => {
  // Handle validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const db = req.app.get('db');
    const userId = req.user.id;
    const templateId = req.params.id;
    const { name, subject, htmlContent, textContent, description, category } = req.body;

    // Verify template exists and belongs to user
    const existingResult = await db.query(
      'SELECT id FROM email_templates WHERE id = $1 AND user_id = $2',
      [templateId, userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Generate plain text version if not provided
    const finalTextContent = textContent || htmlToPlainText(htmlContent);

    // Extract placeholders from updated content
    const placeholders = [
      ...extractPlaceholders(subject),
      ...extractPlaceholders(htmlContent),
      ...extractPlaceholders(finalTextContent)
    ];
    const uniquePlaceholders = [...new Set(placeholders)];

    // Update template
    const result = await db.query(
      `UPDATE email_templates
       SET name = $1, subject = $2, html_content = $3, text_content = $4,
           description = $5, category = $6, placeholders = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [name, subject, htmlContent, finalTextContent, description || null, category || null, uniquePlaceholders, templateId, userId]
    );

    // Log successful update
    logger.info({
      message: 'Email template updated',
      userId: userId,
      templateId: templateId
    });

    res.json({
      message: 'Template updated',
      template: result.rows[0],
      placeholders: uniquePlaceholders
    });

  } catch (error) {
    logger.error({
      message: 'Failed to update email template',
      userId: req.user.id,
      templateId: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to update template' });
  }
});

/**
 * DELETE /api/templates/:id
 *
 * Deletes an email template.
 *
 * PATH PARAMETERS:
 * - id: Template ID (integer)
 *
 * RESPONSE:
 * { message: "Template deleted" }
 */
router.delete('/:id', [
  param('id').isInt().withMessage('Invalid template ID')
], async (req, res) => {
  // Handle validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const db = req.app.get('db');
    const userId = req.user.id;
    const templateId = req.params.id;

    // Delete template (only if belongs to user)
    const result = await db.query(
      'DELETE FROM email_templates WHERE id = $1 AND user_id = $2 RETURNING id',
      [templateId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Log successful deletion
    logger.info({
      message: 'Email template deleted',
      userId: userId,
      templateId: templateId
    });

    res.json({ message: 'Template deleted' });

  } catch (error) {
    logger.error({
      message: 'Failed to delete email template',
      userId: req.user.id,
      templateId: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * POST /api/templates/:id/preview
 *
 * Previews a template with sample data.
 *
 * PATH PARAMETERS:
 * - id: Template ID (integer)
 *
 * REQUEST BODY:
 * {
 *   data: {
 *     userName: "John",
 *     orderId: "12345"
 *   }
 * }
 *
 * RESPONSE:
 * {
 *   renderedSubject: "Welcome John!",
 *   renderedHtml: "<h1>Welcome John!</h1>",
 *   renderedText: "Welcome John!",
 *   missingPlaceholders: []
 * }
 */
router.post('/:id/preview', [
  param('id').isInt().withMessage('Invalid template ID'),
  body('data').optional().isObject().withMessage('Data must be an object')
], async (req, res) => {
  // Handle validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const db = req.app.get('db');
    const userId = req.user.id;
    const templateId = req.params.id;
    const previewData = req.body.data || {};

    // Fetch template
    const result = await db.query(
      `SELECT subject, html_content, text_content, placeholders
       FROM email_templates
       WHERE id = $1 AND user_id = $2`,
      [templateId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = result.rows[0];

    // Render template with provided data
    const renderedSubject = renderTemplate(template.subject, previewData);
    const renderedHtml = renderTemplate(template.html_content, previewData);
    const renderedText = renderTemplate(template.text_content, previewData);

    // Find missing placeholders
    const providedKeys = Object.keys(previewData);
    const missingPlaceholders = (template.placeholders || []).filter(
      placeholder => !providedKeys.includes(placeholder)
    );

    // Log preview request
    logger.info({
      message: 'Template preview generated',
      userId: userId,
      templateId: templateId,
      missingPlaceholders: missingPlaceholders.length
    });

    res.json({
      renderedSubject: renderedSubject,
      renderedHtml: renderedHtml,
      renderedText: renderedText,
      missingPlaceholders: missingPlaceholders
    });

  } catch (error) {
    logger.error({
      message: 'Failed to preview template',
      userId: req.user.id,
      templateId: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to preview template' });
  }
});

module.exports = router;
