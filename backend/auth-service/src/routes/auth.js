const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const logger = require('../config/logger');

// JWT Configuration
// SECURITY: JWT_SECRET is used to sign and verify tokens
// This secret serves as implicit issuer verification - only tokens signed with this secret are valid
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1h';

// Validate JWT_SECRET configuration at startup
// SECURITY: Warn if using default secret in non-development environments
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  logger.error('CRITICAL: JWT_SECRET environment variable is not set in production!');
  logger.error('Set a strong, unique JWT_SECRET for production deployments.');
}

if (JWT_SECRET.length < 32) {
  logger.warn('WARNING: JWT_SECRET is less than 32 characters. Consider using a longer secret.');
}

// Register new user
router.post('/register', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').notEmpty().withMessage('Name is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password, name } = req.body;
    const db = req.app.get('db');

    // Check if user exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const result = await db.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    logger.info(`User registered: ${email}`);
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;
    const db = req.app.get('db');

    // Find user
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    logger.info(`User logged in: ${email}`);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token
// ============================================================================
// JWT TOKEN VERIFICATION ENDPOINT
// ============================================================================
// This endpoint is called by Traefik's ForwardAuth middleware to validate
// JWT tokens before forwarding requests to protected services.
//
// TOKEN VALIDATION CHECKS:
//   1. Authorization header presence and format (Bearer <token>)
//   2. Token signature verification using JWT_SECRET (issuer verification)
//   3. Token expiration (exp claim)
//   4. Required claims presence (userId, email)
//
// SECURITY FLOW:
//   Client -> Traefik -> /api/auth/verify -> 200 OK (with headers)
//                     -> Traefik -> upstream service (with X-User-* headers)
//
// RESPONSE HEADERS (forwarded by Traefik to upstream):
//   - X-User-Id: User's numeric identifier from JWT
//   - X-User-Email: User's email address from JWT
//   - X-User-Role: User's role (if present in token)
// ============================================================================
router.get('/verify', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Validate Authorization header format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Token verification failed: Missing or invalid Authorization header');
      return res.status(401).json({ valid: false, error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token signature and expiration
    // JWT_SECRET serves as issuer verification - only tokens signed with this secret are valid
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Validate required claims
    if (!decoded.userId || !decoded.email) {
      logger.warn('Token verification failed: Missing required claims');
      return res.status(401).json({ valid: false, error: 'Missing required claims' });
    }
    
    // Set response headers for Traefik ForwardAuth
    // These headers are forwarded to upstream services for user identification
    res.set('X-User-Id', String(decoded.userId));
    res.set('X-User-Email', decoded.email);
    
    // Include role if present in token
    if (decoded.role) {
      res.set('X-User-Role', decoded.role);
    }
    
    // Return success response
    res.json({ 
      valid: true, 
      user: { 
        userId: decoded.userId, 
        email: decoded.email,
        role: decoded.role || 'user'
      } 
    });
  } catch (error) {
    // Handle specific JWT errors for better debugging
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token verification failed: Token expired');
      return res.status(401).json({ valid: false, error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Token verification failed: Invalid token signature');
      return res.status(401).json({ valid: false, error: 'Invalid token' });
    }
    logger.error('Token verification error:', error);
    res.status(401).json({ valid: false, error: 'Token verification failed' });
  }
});

// Refresh token
router.post('/refresh', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    
    // Generate new token
    const newToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
