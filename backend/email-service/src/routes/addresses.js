/**
 * ============================================================================
 * Email Addresses API Routes
 * ============================================================================
 *
 * RESTful API endpoints for managing email addresses (contact book).
 * Allows users to maintain a list of frequently used email addresses.
 *
 * ENDPOINTS:
 * - GET    /api/addresses       - List all addresses for user
 * - POST   /api/addresses       - Create new address
 * - GET    /api/addresses/:id   - Get single address
 * - PUT    /api/addresses/:id   - Update address
 * - DELETE /api/addresses/:id   - Delete address
 * - GET    /api/addresses/search - Search addresses
 *
 * AUTHENTICATION:
 * All endpoints require JWT authentication via authMiddleware.
 * User ID is extracted from the JWT token (req.user.id).
 *
 * ERROR HANDLING:
 * - 400: Validation errors (invalid input)
 * - 401: Authentication required
 * - 404: Address not found
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
 * Validation rules for creating/updating email addresses.
 *
 * VALIDATED FIELDS:
 * - email: Must be valid email format
 * - name: Optional display name (max 100 chars)
 * - label: Optional category label (e.g., 'work', 'personal')
 */
const addressValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email address is required')
    .normalizeEmail(),
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Name must not exceed 100 characters'),
  body('label')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Label must not exceed 50 characters')
];

/**
 * Handles validation errors and returns appropriate response.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {boolean} True if errors exist (response sent), false otherwise
 */
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  return null;
};

// =============================================================================
// API ENDPOINTS
// =============================================================================

/**
 * GET /api/addresses
 *
 * Lists all email addresses for the authenticated user.
 *
 * QUERY PARAMETERS:
 * - page: Page number for pagination (default: 1)
 * - limit: Results per page (default: 50, max: 100)
 * - sort: Sort field (default: 'name')
 * - order: Sort order 'asc' or 'desc' (default: 'asc')
 *
 * RESPONSE:
 * {
 *   addresses: [...],
 *   pagination: { page, limit, total, pages }
 * }
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().isIn(['name', 'email', 'created_at']),
  query('order').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  // Handle validation errors
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const db = req.app.get('db');
    const userId = req.user.id;

    // Pagination parameters with defaults
    const page = req.query.page || 1;
    const limit = req.query.limit || 50;
    const offset = (page - 1) * limit;
    const sort = req.query.sort || 'name';
    const order = req.query.order || 'asc';

    // Validate sort column to prevent SQL injection
    const validSortColumns = ['name', 'email', 'created_at'];
    const sortColumn = validSortColumns.includes(sort) ? sort : 'name';
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

    // Query addresses with pagination
    const addressesResult = await db.query(
      `SELECT id, email, name, label, created_at, updated_at
       FROM email_addresses
       WHERE user_id = $1
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Get total count for pagination
    const countResult = await db.query(
      'SELECT COUNT(*) FROM email_addresses WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].count);

    // Log successful query
    logger.info({
      message: 'Email addresses retrieved',
      userId: userId,
      count: addressesResult.rows.length,
      page: page
    });

    res.json({
      addresses: addressesResult.rows,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error({
      message: 'Failed to retrieve email addresses',
      userId: req.user.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to retrieve addresses' });
  }
});

/**
 * POST /api/addresses
 *
 * Creates a new email address entry for the authenticated user.
 *
 * REQUEST BODY:
 * {
 *   email: "user@example.com",  // Required
 *   name: "John Doe",           // Optional
 *   label: "work"               // Optional
 * }
 *
 * RESPONSE:
 * {
 *   message: "Address created",
 *   address: { id, email, name, label, ... }
 * }
 */
router.post('/', addressValidation, async (req, res) => {
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
    const { email, name, label } = req.body;

    // Check if address already exists for this user
    const existingResult = await db.query(
      'SELECT id FROM email_addresses WHERE user_id = $1 AND email = $2',
      [userId, email]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        error: 'Address already exists',
        existingId: existingResult.rows[0].id
      });
    }

    // Insert new address
    const result = await db.query(
      `INSERT INTO email_addresses (user_id, email, name, label)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, email, name || null, label || null]
    );

    const address = result.rows[0];

    // Log successful creation
    logger.info({
      message: 'Email address created',
      userId: userId,
      addressId: address.id,
      email: email
    });

    res.status(201).json({
      message: 'Address created',
      address: address
    });

  } catch (error) {
    logger.error({
      message: 'Failed to create email address',
      userId: req.user.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to create address' });
  }
});

/**
 * GET /api/addresses/search
 *
 * Searches email addresses by email or name.
 *
 * QUERY PARAMETERS:
 * - q: Search query (required, min 2 chars)
 * - limit: Max results (default: 10, max: 50)
 *
 * RESPONSE:
 * {
 *   results: [...]
 * }
 */
router.get('/search', [
  query('q')
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 2 })
    .withMessage('Search query must be at least 2 characters'),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
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
    const searchQuery = req.query.q;
    const limit = req.query.limit || 10;

    // Search by email or name using ILIKE for case-insensitive matching
    const result = await db.query(
      `SELECT id, email, name, label
       FROM email_addresses
       WHERE user_id = $1
         AND (email ILIKE $2 OR name ILIKE $2)
       ORDER BY
         CASE WHEN email ILIKE $3 THEN 0 ELSE 1 END,
         name ASC
       LIMIT $4`,
      [userId, `%${searchQuery}%`, `${searchQuery}%`, limit]
    );

    // Log search query
    logger.info({
      message: 'Email address search executed',
      userId: userId,
      query: searchQuery,
      resultsCount: result.rows.length
    });

    res.json({
      results: result.rows
    });

  } catch (error) {
    logger.error({
      message: 'Failed to search email addresses',
      userId: req.user.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to search addresses' });
  }
});

/**
 * GET /api/addresses/:id
 *
 * Retrieves a single email address by ID.
 *
 * PATH PARAMETERS:
 * - id: Address ID (integer)
 *
 * RESPONSE:
 * { id, email, name, label, created_at, updated_at }
 */
router.get('/:id', [
  param('id').isInt().withMessage('Invalid address ID')
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
    const addressId = req.params.id;

    const result = await db.query(
      `SELECT id, email, name, label, created_at, updated_at
       FROM email_addresses
       WHERE id = $1 AND user_id = $2`,
      [addressId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    logger.error({
      message: 'Failed to retrieve email address',
      userId: req.user.id,
      addressId: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to retrieve address' });
  }
});

/**
 * PUT /api/addresses/:id
 *
 * Updates an existing email address.
 *
 * PATH PARAMETERS:
 * - id: Address ID (integer)
 *
 * REQUEST BODY:
 * {
 *   email: "newemail@example.com",  // Optional
 *   name: "New Name",               // Optional
 *   label: "personal"               // Optional
 * }
 *
 * RESPONSE:
 * {
 *   message: "Address updated",
 *   address: { ... }
 * }
 */
router.put('/:id', [
  param('id').isInt().withMessage('Invalid address ID'),
  ...addressValidation
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
    const addressId = req.params.id;
    const { email, name, label } = req.body;

    // Verify address exists and belongs to user
    const existingResult = await db.query(
      'SELECT id FROM email_addresses WHERE id = $1 AND user_id = $2',
      [addressId, userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Update address
    const result = await db.query(
      `UPDATE email_addresses
       SET email = $1, name = $2, label = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [email, name || null, label || null, addressId, userId]
    );

    // Log successful update
    logger.info({
      message: 'Email address updated',
      userId: userId,
      addressId: addressId
    });

    res.json({
      message: 'Address updated',
      address: result.rows[0]
    });

  } catch (error) {
    logger.error({
      message: 'Failed to update email address',
      userId: req.user.id,
      addressId: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to update address' });
  }
});

/**
 * DELETE /api/addresses/:id
 *
 * Deletes an email address.
 *
 * PATH PARAMETERS:
 * - id: Address ID (integer)
 *
 * RESPONSE:
 * { message: "Address deleted" }
 */
router.delete('/:id', [
  param('id').isInt().withMessage('Invalid address ID')
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
    const addressId = req.params.id;

    // Delete address (only if belongs to user)
    const result = await db.query(
      'DELETE FROM email_addresses WHERE id = $1 AND user_id = $2 RETURNING id',
      [addressId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Log successful deletion
    logger.info({
      message: 'Email address deleted',
      userId: userId,
      addressId: addressId
    });

    res.json({ message: 'Address deleted' });

  } catch (error) {
    logger.error({
      message: 'Failed to delete email address',
      userId: req.user.id,
      addressId: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

module.exports = router;
