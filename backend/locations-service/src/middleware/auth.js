const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

const JWT_SECRET = process.env.JWT_SECRET;

// In production, fail if JWT_SECRET is not provided
if (process.env.NODE_ENV === 'production' && !JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is required in production');
  process.exit(1);
}

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const secret = JWT_SECRET || 'your-super-secret-jwt-key';
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, secret);
    
    req.user = {
      id: decoded.userId,
      email: decoded.email
    };
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authMiddleware };
